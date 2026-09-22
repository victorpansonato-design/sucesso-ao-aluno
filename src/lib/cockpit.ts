import type { BandSlice, CensusAggregate, CensusScope, SignalKey } from '../data/institution';
import {
  DAILY_INTERVENTION_RATE,
  SIGNALS,
  aggregate,
  bandSlices,
  distribute,
  focusOnHighRisk,
  focusOnSignal,
  noise,
  scopeKey,
  wave,
} from '../data/institution';

/* ==========================================================================
   Analítica do Cockpit
   --------------------------------------------------------------------------
   O censo (data/institution.ts) diz como a instituição está HOJE. Este módulo
   responde as outras duas perguntas que um cockpit precisa responder:

     · Como chegamos até aqui?  → séries históricas
     · O que a operação fez?    → intervenções, SLA e desfechos

   Duas regras que valem para tudo aqui:

     1. O PONTO DE HOJE É O CENSO, NÃO UMA APROXIMAÇÃO DELE. Toda série termina
        exatamente no número que o indicador mostra. Um gráfico cujo último
        ponto discorda do KPI ao lado destrói a confiança na tela inteira, e é
        o erro mais comum em dashboard mockado.
     2. NADA É ALEATÓRIO. As séries são funções determinísticas do escopo e da
        data. O mesmo filtro devolve a mesma curva sempre — o que também é o que
        permite comparar período com período sem inventar o passado duas vezes.

   Quando existir backend, cada função exportada aqui vira um endpoint. As
   assinaturas foram desenhadas para isso: escopo + janela → números.
   ========================================================================== */

/* -- Janelas -------------------------------------------------------------- */

export type CockpitPeriod = 'hoje' | '7d' | '30d' | '90d' | 'semestre';

export const PERIODS: {
  key: CockpitPeriod;
  label: string;
  /** Como o período é lido dentro de uma frase: "intervenções <em>hoje</em>". */
  inline: string;
  days: number;
  compare: string;
}[] = [
  { key: 'hoje', label: 'Hoje', inline: 'hoje', days: 1, compare: 'vs. mesmo dia da semana anterior' },
  { key: '7d', label: '7 dias', inline: 'em 7 dias', days: 7, compare: 'vs. 7 dias anteriores' },
  { key: '30d', label: '30 dias', inline: 'em 30 dias', days: 30, compare: 'vs. 30 dias anteriores' },
  { key: '90d', label: '90 dias', inline: 'em 90 dias', days: 90, compare: 'vs. 90 dias anteriores' },
  { key: 'semestre', label: 'Semestre', inline: 'no semestre', days: 180, compare: 'vs. semestre anterior' },
];

export function periodMeta(key: CockpitPeriod) {
  return PERIODS.find((p) => p.key === key) ?? PERIODS[2];
}

/** Janelas do gráfico de evolução. "Hoje" não desenha linha, então fica fora. */
export type ChartRange = '7d' | '30d' | '90d' | 'semestre';

export const CHART_RANGES: { key: ChartRange; label: string; days: number; step: number }[] = [
  { key: '7d', label: '7 dias', days: 7, step: 1 },
  { key: '30d', label: '30 dias', days: 30, step: 1 },
  { key: '90d', label: '90 dias', days: 90, step: 3 },
  { key: 'semestre', label: 'Semestre', days: 180, step: 7 },
];

export function chartRangeMeta(key: ChartRange) {
  return CHART_RANGES.find((r) => r.key === key) ?? CHART_RANGES[1];
}

/** A janela do gráfico que corresponde ao período global escolhido. */
export function chartRangeForPeriod(period: CockpitPeriod): ChartRange {
  return period === 'hoje' ? '7d' : period;
}

/* -- Ancora temporal ------------------------------------------------------
   Fixada uma vez na carga do módulo. Se cada chamada lesse o relógio, uma
   série longa poderia atravessar a meia-noite no meio do cálculo e o eixo x
   ganharia um dia repetido. */

const TODAY = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
})();

const DAY_MS = 86_400_000;

/** Data do deslocamento em dias a partir de hoje. `0` = hoje, `-7` = semana passada. */
export function dateAt(dayOffset: number): Date {
  return new Date(TODAY.getTime() + dayOffset * DAY_MS);
}

/* -- Evolução da base ----------------------------------------------------- */

/** A base cresce ~1% ao mês: rematrícula, transferência e ingresso contínuo. */
const GROWTH_PER_DAY = 0.00035;

/**
 * Quanto cada faixa oscila no curto prazo. Faixa pequena oscila mais — 40 alunos
 * a mais em "Crítico" é um movimento de 9%, e em "Estável" é ruído de medição.
 */
const BAND_WOBBLE = [0.022, 0.1, 0.17, 0.23];

/**
 * Quanto MAIOR cada faixa era um semestre atrás. Positivo = melhorou desde lá.
 * A operação existe há tempo suficiente para que a curva de risco caia — é essa
 * a história que a série conta, e ela é consistente com a taxa de estabilização.
 */
const BAND_TREND = [-0.02, 0.055, 0.2, 0.3];

const ATTENTION_TREND = 0.3;
const ATTENTION_WOBBLE = 0.13;
const HIGH_RISK_TREND = 0.42;
const HIGH_RISK_WOBBLE = 0.19;

export interface DaySnapshot {
  dayOffset: number;
  date: Date;
  monitored: number;
  bands: number[];
  attention: number;
  highRisk: number;
}

/**
 * O estado da base num dia. `dayOffset === 0` devolve o censo intacto; os dias
 * anteriores recebem tendência e oscilação, com uma rampa de cinco dias que
 * costura a curva no valor de hoje sem degrau.
 */
export function snapshotAt(agg: CensusAggregate, key: string, dayOffset: number): DaySnapshot {
  const date = dateAt(dayOffset);

  if (dayOffset >= 0 || agg.monitored === 0) {
    return {
      dayOffset,
      date,
      monitored: agg.monitored,
      bands: agg.bands.slice(),
      attention: agg.attention,
      highRisk: agg.highRisk,
    };
  }

  const age = -dayOffset / 180;
  /* Rampa que costura a curva no valor exato de hoje. Dois dias: mais que isso
     achatava o começo de uma janela de 7 dias, que é justamente onde o
     movimento do dia a dia precisa aparecer. */
  const settle = Math.min(1, -dayOffset / 2);

  const monitored = Math.max(1, Math.round(agg.monitored * (1 + GROWTH_PER_DAY * dayOffset)));

  const shares = agg.bands.map((count, b) => {
    const share = count / agg.monitored;
    const trend = 1 + BAND_TREND[b] * age;
    const wobble = 1 + BAND_WOBBLE[b] * wave(key + ':band' + b, dayOffset) * settle;
    return Math.max(0.0002, share * trend * wobble);
  });
  const bands = distribute(monitored, shares);

  const attention = Math.max(
    0,
    Math.round(
      agg.attention *
        (1 + ATTENTION_TREND * age) *
        (1 + ATTENTION_WOBBLE * wave(key + ':att', dayOffset) * settle),
    ),
  );

  const highRisk = Math.min(
    attention,
    Math.max(
      0,
      Math.round(
        agg.highRisk *
          (1 + HIGH_RISK_TREND * age) *
          (1 + HIGH_RISK_WOBBLE * wave(key + ':hr', dayOffset) * settle),
      ),
    ),
  );

  return { dayOffset, date, monitored, bands, attention, highRisk };
}

export interface BandSeries {
  /** Amostras da mais antiga para a mais recente. A última é hoje. */
  points: DaySnapshot[];
  range: ChartRange;
  /** Amostragem usada, em palavras — vai na legenda do gráfico. */
  sampling: string;
}

export function bandSeries(agg: CensusAggregate, key: string, range: ChartRange): BandSeries {
  const meta = chartRangeMeta(range);
  const points: DaySnapshot[] = [];

  // Anda de trás para frente a partir de hoje, para que hoje seja sempre um
  // ponto amostrado — e não caia entre duas amostras num passo de 3 ou 7 dias.
  for (let d = -(meta.days - 1); d <= 0; d += 1) {
    const fromEnd = -d;
    if (fromEnd % meta.step !== 0) continue;
    points.push(snapshotAt(agg, key, d));
  }

  return {
    points,
    range,
    sampling:
      meta.step === 1 ? 'amostragem diária' : meta.step === 7 ? 'amostragem semanal' : 'amostragem a cada 3 dias',
  };
}

/* -- Intervenções --------------------------------------------------------- */

/** Domingo → sábado. A operação é de segunda a sábado, com sábado curto. */
const WEEKDAY_WEIGHT = [0.1, 1.12, 1.06, 1.02, 0.98, 0.86, 0.42];

/** Intervenções abertas num dia. Flow, não stock: sempre somado, nunca amostrado. */
export function interventionsAt(agg: CensusAggregate, key: string, dayOffset: number): number {
  const snap = snapshotAt(agg, key, dayOffset);
  if (snap.attention === 0) return 0;
  const weekday = WEEKDAY_WEIGHT[dateAt(dayOffset).getDay()];
  const jitter = 0.94 + noise(key + ':iv:' + dayOffset) * 0.12;
  return Math.max(0, Math.round(snap.attention * DAILY_INTERVENTION_RATE * weekday * jitter));
}

/** Soma das intervenções numa janela fechada de dias. */
function interventionsBetween(
  agg: CensusAggregate,
  key: string,
  fromDay: number,
  toDay: number,
): number {
  let sum = 0;
  for (let d = fromDay; d <= toDay; d += 1) sum += interventionsAt(agg, key, d);
  return sum;
}

/* -- Desfechos ------------------------------------------------------------
   Uma única partição alimenta todos os blocos que falam de desfecho. Se
   "concluídas" e "estabilizados" viessem de contas separadas, um bloco poderia
   dizer 69 e o outro somar 71.

   O que esta partição é, e o que ela deixou de ser: é a COMPOSIÇÃO do que a
   equipe registrou ao encerrar — descrição, não placar. A taxa de
   estabilização (estabilizados ÷ apurados) foi removida do produto: sem janela
   de observação declarada e sem grupo de controle, ela credita à operação a
   melhora de alunos que melhorariam sozinhos, e era lida na diretoria como
   resultado atribuível. A composição continua porque cada linha dela é um
   registro do especialista, não uma inferência. */

export type OutcomeKey =
  | 'estabilizado'
  | 'acompanhamento'
  | 'encaminhado'
  | 'sem-contato'
  | 'risco-mantido';

export const OUTCOMES: {
  key: OutcomeKey;
  label: string;
  /** `false` = ainda sem desfecho, fica fora do denominador da taxa. */
  settled: boolean;
  tone: 'ok' | 'info' | 'neutral' | 'warn' | 'crit';
  meaning: string;
}[] = [
  {
    key: 'estabilizado',
    label: 'Estabilizados',
    settled: true,
    tone: 'ok',
    meaning: 'O sinal que abriu o caso deixou de aparecer nos ciclos seguintes.',
  },
  {
    key: 'acompanhamento',
    label: 'Em acompanhamento',
    settled: false,
    tone: 'info',
    meaning: 'Contato feito, próximo passo agendado. Ainda sem desfecho apurado.',
  },
  {
    key: 'encaminhado',
    label: 'Encaminhados',
    settled: true,
    tone: 'neutral',
    meaning: 'Passou para outra área resolver — secretaria, coordenação, financeiro.',
  },
  {
    key: 'sem-contato',
    label: 'Sem contato',
    settled: true,
    tone: 'warn',
    meaning: 'Tentativas esgotadas sem resposta do aluno em nenhum canal.',
  },
  {
    key: 'risco-mantido',
    label: 'Risco mantido',
    settled: true,
    tone: 'crit',
    meaning: 'Houve contato, mas o sinal continua ativo. Volta para a régua.',
  },
];

/** Partição base, na ordem de `OUTCOMES`. Soma 1. */
const OUTCOME_SHARE = [0.596, 0.16, 0.065, 0.075, 0.104];

/**
 * Quanto cada família de sinal encerra acima ou abaixo da média na primeira
 * faixa. Não é enfeite: repactuar uma parcela resolve o problema de vez,
 * enquanto uma queda de acesso costuma ser sintoma de algo que a ligação não
 * alcança. Mostrar isso é metade do valor de medir desfecho por sinal.
 */
const SIGNAL_STABILISATION: Record<SignalKey, number> = {
  acesso: 0.92,
  frequencia: 0.97,
  financeiro: 1.12,
  academico: 1.04,
  onboarding: 1.15,
};

export interface OutcomeBreakdown {
  received: number;
  /** Casos com desfecho apurado. Os em acompanhamento ficam de fora. */
  settled: number;
  counts: Record<OutcomeKey, number>;
}

export function outcomesOf(received: number, signal?: SignalKey): OutcomeBreakdown {
  const counts = {
    estabilizado: 0,
    acompanhamento: 0,
    encaminhado: 0,
    'sem-contato': 0,
    'risco-mantido': 0,
  } as Record<OutcomeKey, number>;

  if (received <= 0) return { received: 0, settled: 0, counts };

  let shares = OUTCOME_SHARE;
  if (signal) {
    const lift = SIGNAL_STABILISATION[signal];
    const stabilised = OUTCOME_SHARE[0] * lift;
    // O que sai (ou entra) em "estabilizados" é compensado nas outras faixas
    // apuradas, proporcionalmente. "Em acompanhamento" não se move: é o volume
    // ainda aberto, e não depende de quão bem o caso termina.
    const openShare = OUTCOME_SHARE[1];
    const otherSettled = 1 - openShare - OUTCOME_SHARE[0];
    const scale = otherSettled > 0 ? (1 - openShare - stabilised) / otherSettled : 0;
    shares = [stabilised, openShare, ...OUTCOME_SHARE.slice(2).map((s) => s * scale)];
  }

  const split = distribute(received, shares);
  OUTCOMES.forEach((o, i) => {
    counts[o.key] = split[i];
  });

  const settled = OUTCOMES.reduce((sum, o, i) => sum + (o.settled ? split[i] : 0), 0);
  return { received, settled, counts };
}

/* -- Operação -------------------------------------------------------------

   A aderência ao prazo de primeiro contato virou o indicador protagonista do
   Dashboard quando a taxa de estabilização saiu, e a troca é de natureza, não
   de gosto: a estabilização precisava de um contrafactual que a operação não
   tem, enquanto o prazo é a única promessa que o sistema registra de ponta a
   ponta — o caso foi aberto aqui e o primeiro contato foi carimbado aqui. É o
   indicador que sobrevive à troca do censo por dados reais sem mudar de
   definição.

   Por isso ela deixou de ser uma constante. Um protagonista precisa de série
   diária e de comparação com o período anterior, e uma constante devolve uma
   reta e uma variação de 0,0 p.p. em toda janela — o que é pior do que não
   mostrar variação nenhuma, porque parece medida. A oscilação usa a mesma
   máquina determinística das outras séries: mesmo escopo e mesmo dia devolvem
   sempre o mesmo valor. */

/** Aderência média ao prazo de primeiro contato. Âncora da oscilação diária. */
const SLA_ADHERENCE = 0.887;

/** Aderência do dia, em [0, 1]. Determinística por escopo e data. */
export function slaAdherenceAt(key: string, day: number): number {
  const value = SLA_ADHERENCE + wave(key + ':sla', day) * 0.06;
  return Math.min(0.99, Math.max(0.62, value));
}

/**
 * Aderência de uma janela, em [0, 1]: média das aderências diárias PONDERADA
 * pelo volume de cada dia, e não a aderência de hoje repetida para trás. Um dia
 * de pico com aderência baixa precisa pesar mais que um sábado com dois casos —
 * senão a janela de 90 dias diria exatamente o mesmo que a de 7.
 *
 * É a mesma função para a janela atual e para a anterior, de propósito: uma
 * comparação entre duas contas diferentes não é uma comparação.
 */
export function slaAdherenceBetween(
  agg: CensusAggregate,
  key: string,
  fromDay: number,
  toDay: number,
): number {
  let weighted = 0;
  let weight = 0;
  for (let d = fromDay; d <= toDay; d += 1) {
    const volume = interventionsAt(agg, key, d);
    weighted += slaAdherenceAt(key, d) * volume;
    weight += volume;
  }
  return weight > 0 ? weighted / weight : slaAdherenceAt(key, toDay);
}

export interface OperationBucket {
  /** Rótulo curto do eixo x. */
  label: string;
  /** Rótulo completo, para o tooltip. */
  full: string;
  received: number;
  inSla: number;
  outSla: number;
}

export interface Operations {
  received: number;
  concluded: number;
  pending: number;
  inSla: number;
  outSla: number;
  slaAdherence: number;
  outcomes: OutcomeBreakdown;
  buckets: OperationBucket[];
  /** Granularidade dos baldes, em palavras. */
  granularity: 'diária' | 'semanal';
}

const dayFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const weekdayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const fullFmt = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
});

export function operationsFor(
  agg: CensusAggregate,
  key: string,
  period: CockpitPeriod,
  signal?: SignalKey,
): Operations {
  const days = periodMeta(period).days;
  const received = interventionsBetween(agg, key, -(days - 1), 0);
  const outcomes = outcomesOf(received, signal);

  const concluded = outcomes.settled;
  const pending = received - concluded;

  const windowAdherence = slaAdherenceBetween(agg, key, -(days - 1), 0);
  const inSla = Math.round(concluded * windowAdherence);
  const outSla = concluded - inSla;

  /* Um único dia não desenha gráfico, então "Hoje" mostra as duas semanas que
     levaram até aqui — o dia de hoje continua sendo a última barra. */
  const chartDays = period === 'hoje' ? 14 : days;
  const weekly = chartDays > 45;
  const buckets: OperationBucket[] = [];

  if (weekly) {
    for (let start = -(chartDays - 1); start <= 0; start += 7) {
      const end = Math.min(0, start + 6);
      let sum = 0;
      for (let d = start; d <= end; d += 1) sum += interventionsAt(agg, key, d);
      const from = dateAt(start);
      const to = dateAt(end);
      const inWindow = Math.round(
        sum * slaAdherenceAt(key, end) * (concluded / Math.max(1, received)),
      );
      buckets.push({
        label: dayFmt.format(from),
        full: 'Semana de ' + dayFmt.format(from) + ' a ' + dayFmt.format(to),
        received: sum,
        inSla: inWindow,
        outSla: Math.max(0, Math.round(sum * (concluded / Math.max(1, received))) - inWindow),
      });
    }
  } else {
    for (let d = -(chartDays - 1); d <= 0; d += 1) {
      const sum = interventionsAt(agg, key, d);
      const date = dateAt(d);
      const settledHere = Math.round(sum * (concluded / Math.max(1, received)));
      const inWindow = Math.round(settledHere * slaAdherenceAt(key, d));
      buckets.push({
        label: chartDays <= 14 ? weekdayFmt.format(date).replace('.', '') : dayFmt.format(date),
        full: fullFmt.format(date),
        received: sum,
        inSla: inWindow,
        outSla: Math.max(0, settledHere - inWindow),
      });
    }
  }

  return {
    received,
    concluded,
    pending,
    inSla,
    outSla,
    slaAdherence: concluded > 0 ? (inSla / concluded) * 100 : 0,
    outcomes,
    buckets,
    granularity: weekly ? 'semanal' : 'diária',
  };
}

/* -- Foco ----------------------------------------------------------------- */

/**
 * Recorte aplicado por cliques dentro da própria página. É separado dos filtros
 * globais de propósito: o filtro muda QUEM está na tela, o foco muda QUAL
 * problema está sendo examinado.
 */
export type CockpitFocus = { kind: 'none' } | { kind: 'signal'; key: SignalKey } | { kind: 'high-risk' };

export const NO_FOCUS: CockpitFocus = { kind: 'none' };

export function focusLabel(focus: CockpitFocus): string | null {
  if (focus.kind === 'signal') {
    return SIGNALS.find((s) => s.key === focus.key)?.label ?? null;
  }
  if (focus.kind === 'high-risk') return 'Alto risco';
  return null;
}

/* -- Indicadores ---------------------------------------------------------- */

export interface Kpi {
  key: 'monitorados' | 'atencao' | 'alto-risco' | 'intervencoes';
  label: string;
  value: number;
  /** Valor no período anterior, para a comparação. `null` = sem base de comparação. */
  previous: number | null;
  /** Variação percentual. `null` quando o anterior é zero ou inexistente. */
  deltaPercent: number | null;
  /** Uma queda é boa notícia em "alto risco" e má em "alunos monitorados". */
  goodDirection: 'up' | 'down';
  suffix?: string;
  decimals?: number;
  hint: string;
}

function deltaOf(value: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return ((value - previous) / previous) * 100;
}

/* -- Sinais --------------------------------------------------------------- */

export interface SignalRow {
  key: SignalKey;
  label: string;
  description: string;
  count: number;
  percent: number;
  highRisk: number;
}

/* -- O modelo completo da página ----------------------------------------- */

export interface CockpitSnapshot {
  scope: CensusScope;
  period: CockpitPeriod;
  focus: CockpitFocus;
  /** A população monitorada. Nunca sofre o recorte de foco. */
  base: CensusAggregate;
  /** Os casos sob exame, já recortados pelo foco. */
  cases: CensusAggregate;
  /** Nenhuma célula do censo no escopo — combinação de filtros impossível. */
  empty: boolean;
  kpis: Kpi[];
  bands: BandSlice[];
  retention: number;
  signals: SignalRow[];
  operations: Operations;
  /**
   * Aderência ao prazo no período anterior, 0–100. É a base de comparação do
   * indicador protagonista, e vem daqui em vez de ser recalculada na camada de
   * leitura para que as duas janelas saiam da mesma conta.
   */
  previousSlaAdherence: number;
}

export function cockpitSnapshot(
  scope: CensusScope,
  period: CockpitPeriod,
  focus: CockpitFocus,
): CockpitSnapshot {
  const base = aggregate(scope);
  const cases =
    focus.kind === 'signal'
      ? focusOnSignal(base, focus.key)
      : focus.kind === 'high-risk'
        ? focusOnHighRisk(base)
        : base;

  const key = scopeKey(scope) + '#' + (focus.kind === 'signal' ? focus.key : focus.kind);
  const signalKey = focus.kind === 'signal' ? focus.key : undefined;
  const meta = periodMeta(period);

  /* Comparação com o período anterior. Para "Hoje" o espelho é o mesmo dia da
     semana passada — comparar segunda com domingo produziria +900% e nenhuma
     informação. */
  const backDays = period === 'hoje' ? 7 : meta.days;
  const previousSnap = snapshotAt(cases, key, -backDays);
  const previousBase = snapshotAt(base, key, -backDays);

  const operations = operationsFor(cases, key, period, signalKey);
  const prevReceived = interventionsBetween(cases, key, -(backDays + meta.days - 1), -backDays);
  const previousSlaAdherence =
    slaAdherenceBetween(cases, key, -(backDays + meta.days - 1), -backDays) * 100;

  const kpis: Kpi[] = [
    {
      key: 'monitorados',
      label: 'Alunos monitorados',
      value: base.monitored,
      previous: previousBase.monitored,
      deltaPercent: deltaOf(base.monitored, previousBase.monitored),
      goodDirection: 'up',
      hint: 'Toda a graduação presencial e híbrida sob leitura automática de sinais.',
    },
    {
      key: 'atencao',
      label: 'Em atenção',
      value: cases.attention,
      previous: previousSnap.attention,
      deltaPercent: deltaOf(cases.attention, previousSnap.attention),
      goodDirection: 'down',
      hint: 'Desvios que a automação não resolveu e que estão com uma pessoa.',
    },
    {
      key: 'alto-risco',
      label: 'Alto risco',
      value: cases.highRisk,
      previous: previousSnap.highRisk,
      deltaPercent: deltaOf(cases.highRisk, previousSnap.highRisk),
      goodDirection: 'down',
      hint: 'Subconjunto de "em atenção" com risco elevado de permanência.',
    },
    {
      key: 'intervencoes',
      label: 'Intervenções ' + meta.inline,
      value: operations.received,
      previous: prevReceived,
      deltaPercent: deltaOf(operations.received, prevReceived),
      goodDirection: 'up',
      hint: 'Contatos humanos abertos na janela. Volume é esforço, não resultado.',
    },
  ];

  const signals: SignalRow[] = SIGNALS.map((signal, i) => ({
    key: signal.key,
    label: signal.label,
    description: signal.description,
    count: cases.signals[i],
    percent: cases.attention > 0 ? (cases.signals[i] / cases.attention) * 100 : 0,
    highRisk: cases.highRiskSignals[i],
  }));

  return {
    scope,
    period,
    focus,
    base,
    cases,
    empty: base.cells === 0,
    kpis,
    bands: bandSlices(base),
    retention: cases.retention,
    signals,
    operations,
    previousSlaAdherence,
  };
}

/** Chave estável do snapshot — usada para memoizar e para semear animações. */
export function snapshotKey(
  scope: CensusScope,
  period: CockpitPeriod,
  focus: CockpitFocus,
): string {
  return (
    scopeKey(scope) + '|' + period + '|' + (focus.kind === 'signal' ? focus.key : focus.kind)
  );
}
