import type { RouteName } from './router';
import type { CockpitSnapshot, Kpi } from './cockpit';
import { dateAt, interventionsAt, periodMeta, slaAdherenceAt, snapshotAt } from './cockpit';
import { focusOnSignal, scopeKey } from '../data/institution';
import { SCORE_BANDS, STATUS_SLUG } from './healthScore';
import { decimal, int } from './format';

/* ==========================================================================
   Pulso do ciclo — a camada de leitura do Dashboard
   --------------------------------------------------------------------------
   Este arquivo transforma o snapshot do censo na frase, na prioridade e no
   funil que a primeira dobra mostra. Ele não desenha nada: recebe números e
   devolve texto e modelos tipados, para que a mesma leitura possa ir para o
   hero, para o aparelho e para o resumo textual de acessibilidade sem ser
   escrita três vezes com três redações diferentes.

   Duas coisas que este módulo NÃO é:

     1. NÃO É IA. É agregação determinística com regras escritas à mão, e é por
        isso que a tela chama isto de "leitura automática do ciclo" e nunca de
        insight. O mesmo escopo produz a mesma frase sempre; se produzisse
        frases diferentes a cada carga, seria um gerador de texto, não um
        indicador.
     2. NÃO INVENTA NÚMERO. Toda contagem daqui sai do agregado que os
        indicadores já mostram. Onde um número não existe no censo — um Health
        Score médio da instituição, por exemplo — este módulo devolve `null` e
        a tela diz que não há medida, em vez de estimar e apresentar a
        estimativa como leitura.

   A distinção que dá nome ao funil, e que o produto vinha perdendo:

     FAIXA DE ATENÇÃO   é uma faixa de Health Score. São 1.741 alunos com score
                        entre 61 e 80. Ninguém foi acionado por isso.
     ATENÇÃO HUMANA     são 163 CASOS abertos com uma pessoa responsável.

   São duas medidas diferentes sobre a mesma população, não dois degraus do
   mesmo funil — e mostrar 1.741 acima de 163 sem dizer isso é o que fazia os
   dois números parecerem contraditórios.
   ========================================================================== */

/* -- Prioridade ----------------------------------------------------------- */

export type PriorityKey = 'sla' | 'alto-risco' | 'fila' | 'nenhuma';

export interface PulsePriority {
  key: PriorityKey;
  /** Rótulo curto do que está em primeiro lugar. */
  label: string;
  count: number;
  /** Texto do botão. Diz para onde vai, não "ver mais". */
  cta: string;
  route: RouteName;
  param: string | null;
  /** Por que este item ganhou a prioridade. Vai no `title` do CTA. */
  why: string;
}

/* -- Hero ----------------------------------------------------------------- */

export interface PulseHero {
  label: string;
  /** 0–100. É o que preenche o calibre de vidro. */
  value: number;
  numerator: number;
  denominator: number;
  numeratorLabel: string;
  denominatorLabel: string;
  /** Variação em pontos percentuais. `null` = sem base de comparação. */
  deltaPP: number | null;
  comparison: string;
  definition: string;
}

/* -- Chamadas compactas --------------------------------------------------- */

export interface PulseCall {
  key: string;
  label: string;
  value: number;
  detail: string;
  tone: 'crit' | 'warn' | 'ink';
  route: RouteName;
  param: string | null;
}

/* -- Funil ---------------------------------------------------------------- */

export type FunnelRelation = 'subset' | 'other-measure';

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  /** O que este número é, em uma frase. Vai no tooltip e no resumo textual. */
  meaning: string;
  /** Como este degrau se relaciona com o de cima. */
  relation: FunnelRelation;
  /** Denominador da proporção mostrada, e o que ele significa. */
  ofLabel: string;
  ofValue: number;
  route: RouteName;
  param: string | null;
  tone: 'ink' | 'warn' | 'risk' | 'crit';
}

/* -- O modelo completo ---------------------------------------------------- */

export interface PulseModel {
  /** "Hoje", "7 dias"… — a janela operacional em vigor. */
  windowLabel: string;
  windowInline: string;
  trend: 'melhorou' | 'estável' | 'piorou';
  trendPercent: number | null;
  tone: 'ok' | 'warn' | 'crit';
  headline: string;
  hero: PulseHero;
  priority: PulsePriority;
  calls: PulseCall[];
  funnel: FunnelStage[];
  /** Resumo em prosa. Alternativa textual dos gráficos da primeira dobra. */
  summary: string;
}

/**
 * Movimento da pressão sobre a base entre a janela atual e a anterior.
 *
 * O limiar de 2% não é arbitrário: abaixo disso a variação cabe dentro da
 * oscilação normal de medição da própria base, e chamar 0,4% de "melhora"
 * ensina o gestor a desconfiar da tela.
 */
function readTrend(deltaPercent: number | null): {
  trend: PulseModel['trend'];
  percent: number | null;
} {
  if (deltaPercent === null) return { trend: 'estável', percent: null };
  if (deltaPercent <= -2) return { trend: 'melhorou', percent: Math.abs(deltaPercent) };
  if (deltaPercent >= 2) return { trend: 'piorou', percent: deltaPercent };
  return { trend: 'estável', percent: deltaPercent };
}

function priorityOf(snapshot: CockpitSnapshot): PulsePriority {
  const { operations, cases } = snapshot;

  if (operations.outSla > 0) {
    return {
      key: 'sla',
      label: operations.outSla === 1 ? 'caso fora do prazo' : 'casos fora do prazo',
      count: operations.outSla,
      cta: 'Abrir a fila com SLA vencendo',
      route: 'fila',
      param: 'vencendo-sla',
      why: 'O prazo de primeiro contato é a única promessa que a operação faz para fora. Um caso fora do prazo vem antes de qualquer volume.',
    };
  }

  if (cases.highRisk > 0) {
    return {
      key: 'alto-risco',
      label: cases.highRisk === 1 ? 'caso de alto risco' : 'casos de alto risco',
      count: cases.highRisk,
      cta: 'Abrir os casos da equipe',
      route: 'fila',
      param: 'equipe',
      why: 'Sem SLA estourado na janela, o alto risco é o que decide o mês: é dele que sai a evasão que a operação ainda pode evitar.',
    };
  }

  if (cases.attention > 0) {
    return {
      key: 'fila',
      label: cases.attention === 1 ? 'caso em atenção humana' : 'casos em atenção humana',
      count: cases.attention,
      cta: 'Abrir os casos da equipe',
      route: 'fila',
      param: 'equipe',
      why: 'Nenhum prazo estourado e nenhum alto risco na janela. O que resta é a fila corrente.',
    };
  }

  return {
    key: 'nenhuma',
    label: 'nenhum caso aberto',
    count: 0,
    cta: 'Abrir a base de alunos',
    route: 'alunos',
    param: null,
    why: 'Nenhuma exceção humana no escopo selecionado.',
  };
}

/**
 * A frase da primeira dobra.
 *
 * Duas orações, sempre na mesma ordem: o que aconteceu com a base, e o que
 * exige ação. A conjunção muda com a combinação — "recuou, mas" quando a
 * notícia boa convive com pendência, "permanece estável, e" quando não há
 * contradição a marcar. É a diferença entre uma frase que informa e um rótulo
 * montado por concatenação.
 */
function headlineOf(
  trend: PulseModel['trend'],
  percent: number | null,
  priority: PulsePriority,
): string {
  const move =
    trend === 'melhorou' && percent !== null
      ? `A pressão sobre a base recuou ${decimal(percent, 1)}%`
      : trend === 'piorou' && percent !== null
        ? `A pressão sobre a base subiu ${decimal(percent, 1)}%`
        : 'A base permanece estável';

  if (priority.key === 'nenhuma') {
    return `${move} e nenhum caso está aberto no escopo selecionado.`;
  }

  const verb = priority.count === 1 ? 'exige' : 'exigem';
  const joiner = trend === 'melhorou' ? ', mas' : trend === 'piorou' ? ', e' : ', e';
  return `${move}${joiner} ${int(priority.count)} ${priority.label} ${verb} ação prioritária.`;
}

function callsOf(snapshot: CockpitSnapshot): PulseCall[] {
  const { cases, operations } = snapshot;

  return [
    {
      key: 'alto-risco',
      label: 'Casos de alto risco',
      value: cases.highRisk,
      detail: `de ${int(cases.attention)} em atenção humana`,
      tone: cases.highRisk > 0 ? 'crit' : 'ink',
      route: 'fila',
      param: 'equipe',
    },
    {
      key: 'sla',
      label: 'Fora do prazo de 1º contato',
      value: operations.outSla,
      detail: `de ${int(operations.concluded)} com desfecho apurado`,
      tone: operations.outSla > 0 ? 'warn' : 'ink',
      route: 'fila',
      param: 'vencendo-sla',
    },
    {
      key: 'intervencoes',
      label: 'Intervenções abertas',
      value: operations.received,
      detail: `${int(operations.pending)} ainda sem desfecho`,
      tone: 'ink',
      route: 'fila',
      param: 'equipe',
    },
  ];
}

/**
 * O funil de atenção.
 *
 * Cinco degraus, e o segundo NÃO é pai do terceiro — ver a nota do topo do
 * arquivo. `relation` carrega essa diferença para a tela, que a desenha com
 * outro conector e a diz por escrito. Um funil que finge que 1.741 vira 163
 * está errado mesmo com os dois números certos.
 */
function funnelOf(snapshot: CockpitSnapshot): FunnelStage[] {
  const { base, cases } = snapshot;

  /* Faixa de atenção ou pior = tudo que não está em "Estável". As faixas vêm
     de SCORE_BANDS na ordem estável → crítico, então é a soma da posição 1 em
     diante. Somar índices soltos aqui quebraria silenciosamente se a rampa
     ganhasse uma faixa. */
  const belowStable = base.bands.slice(1).reduce((sum, n) => sum + n, 0);
  const lowestAttentionBand = SCORE_BANDS[1];
  const attentionCeiling = lowestAttentionBand.range[1];

  return [
    {
      key: 'monitorada',
      label: 'Base monitorada',
      count: base.monitored,
      meaning:
        'Toda a graduação presencial e híbrida sob leitura automática de sinais. É a população, não uma fila.',
      relation: 'subset',
      ofLabel: 'da base',
      ofValue: base.monitored,
      route: 'alunos',
      param: null,
      tone: 'ink',
    },
    {
      key: 'faixa',
      label: `Faixa de atenção ou pior`,
      count: belowStable,
      meaning: `Alunos com Health Score de 0 a ${attentionCeiling} — as três faixas abaixo de "Estável". É uma classificação de score: nenhum destes alunos foi necessariamente acionado.`,
      relation: 'subset',
      ofLabel: 'da base monitorada',
      ofValue: base.monitored,
      route: 'alunos',
      param: STATUS_SLUG[lowestAttentionBand.status],
      tone: 'warn',
    },
    {
      key: 'humana',
      label: 'Casos em atenção humana',
      count: cases.attention,
      meaning:
        'Casos abertos com uma pessoa responsável. Outra medida, não um subconjunto da faixa acima: um caso pode existir para um aluno em faixa estável, e a maioria dos alunos na faixa de atenção não tem caso aberto.',
      relation: 'other-measure',
      ofLabel: 'da base monitorada',
      ofValue: base.monitored,
      route: 'fila',
      param: 'equipe',
      tone: 'risk',
    },
    {
      key: 'alto-risco',
      label: 'Casos de alto risco',
      count: cases.highRisk,
      meaning:
        'Subconjunto dos casos em atenção humana classificado como risco elevado de não permanência.',
      relation: 'subset',
      ofLabel: 'dos casos em atenção humana',
      ofValue: cases.attention,
      route: 'fila',
      param: 'equipe',
      tone: 'crit',
    },
    {
      key: 'retencao',
      label: 'Roteados para Retenção',
      count: snapshot.retention,
      meaning:
        'Subconjunto do alto risco encaminhado para a fila especializada de Retenção.',
      relation: 'subset',
      ofLabel: 'dos casos de alto risco',
      ofValue: cases.highRisk,
      route: 'fila',
      param: 'equipe',
      tone: 'crit',
    },
  ];
}

/* -- Movimento dos sinais ------------------------------------------------- */

export interface SignalMovement {
  key: string;
  label: string;
  description: string;
  count: number;
  previous: number;
  delta: number;
  /** Participação no total de casos em atenção humana. */
  share: number;
  highRisk: number;
  /** Quanto deste sinal termina em alto risco. É a coluna que ordena a ação. */
  conversion: number;
}

/**
 * Ranking dos gatilhos com volume, variação e conversão para alto risco.
 *
 * O delta por sinal é derivado do MESMO jeito que o delta dos indicadores da
 * faixa: recorta-se o agregado no sinal (`focusOnSignal`) e pergunta-se à série
 * histórica o valor daquele recorte na janela anterior. Não é uma proporção
 * aplicada por cima do total — se fosse, todos os cinco sinais variariam na
 * mesma direção e na mesma intensidade, e a coluna não informaria nada.
 *
 * `conversion` é a coluna mais útil das três e a única sem histórico: dela sai
 * a decisão de calibrar um radar. "Onboarding" com volume alto e conversão zero
 * é uma régua funcionando; "Queda de acesso" com conversão de 25% é onde a
 * evasão nasce.
 *
 * TODAS AS CONTAS SAEM DE `snapshot.base`, NUNCA DE `snapshot.cases`, E ISSO É
 * O QUE FAZ A LISTA SER UM CONTROLE EM VEZ DE UM ESPELHO.
 *
 * `snapshot.cases` já vem recortado pelo foco. Ler dali significava que clicar
 * em "Queda de acesso" zerava os outros quatro sinais, mudava os quatro deltas
 * e — porque a lista é ordenada por módulo da variação — REORDENAVA as linhas
 * embaixo do dedo que acabou de tocar. O sintoma que se via era um salto da
 * página no clique; a causa era um filtro que se refiltrava.
 *
 * Um seletor não muda de conteúdo quando é usado. A lista publica sempre o
 * ranking do escopo inteiro, e o recorte ativo aparece como estado da linha
 * (marca, destaque), que é onde a informação de seleção pertence.
 */
export function signalMovement(snapshot: CockpitSnapshot): SignalMovement[] {
  const meta = periodMeta(snapshot.period);
  const backDays = snapshot.period === 'hoje' ? 7 : meta.days;
  const base = scopeKey(snapshot.scope);
  const attention = snapshot.base.attention;

  return snapshot.signals
    .map((signal, i) => {
      const cut = focusOnSignal(snapshot.base, signal.key);
      const key = base + '#' + signal.key;
      const previous = snapshotAt(cut, key, -backDays).attention;
      const count = snapshot.base.signals[i];
      const highRisk = snapshot.base.highRiskSignals[i];
      return {
        key: signal.key,
        label: signal.label,
        description: signal.description,
        count,
        previous,
        delta: count - previous,
        share: attention > 0 ? (count / attention) * 100 : 0,
        highRisk,
        conversion: count > 0 ? (highRisk / count) * 100 : 0,
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.count - a.count);
}

/* -- Microtendências ------------------------------------------------------ */

/**
 * Série curta por indicador, para a microtendência da faixa de KPIs.
 *
 * Existe porque o pedido de "microtendência" só vale se ela for medida: uma
 * sparkline desenhada com números plausíveis é a forma mais barata de mentir
 * num dashboard, e a mais difícil de auditar depois. Aqui cada ponto sai das
 * MESMAS funções que alimentam o gráfico de evolução e o total de intervenções
 * — `snapshotAt` para estoque, `interventionsAt` para fluxo —, então o último
 * ponto de cada série vale exatamente o número impresso ao lado dela.
 *
 * A aderência ao prazo não aparece aqui porque ela é o protagonista da dobra de
 * cima, com a própria série em colunas — repeti-la como sparkline de 14 dias
 * seria mostrar o mesmo dado duas vezes na mesma tela.
 */
export function kpiSparks(
  snapshot: CockpitSnapshot,
  days = 14,
): Partial<Record<Kpi['key'], number[]>> {
  const key =
    scopeKey(snapshot.scope) +
    '#' +
    (snapshot.focus.kind === 'signal' ? snapshot.focus.key : snapshot.focus.kind);

  const monitored: number[] = [];
  const attention: number[] = [];
  const highRisk: number[] = [];
  const interventions: number[] = [];

  for (let d = -(days - 1); d <= 0; d += 1) {
    monitored.push(snapshotAt(snapshot.base, key, d).monitored);
    const cut = snapshotAt(snapshot.cases, key, d);
    attention.push(cut.attention);
    highRisk.push(cut.highRisk);
    interventions.push(interventionsAt(snapshot.cases, key, d));
  }

  return {
    monitorados: monitored,
    atencao: attention,
    'alto-risco': highRisk,
    intervencoes: interventions,
  };
}

/* -- A série do protagonista ---------------------------------------------- */

export interface HeroColumn {
  /** Rótulo curto do dia, para o leitor de tela e o tooltip. */
  label: string;
  /** A aderência ao prazo de primeiro contato daquele dia, 0–100. */
  value: number;
  /** `true` no último dia — o dia mais recente da série. */
  current: boolean;
}

/**
 * A aderência ao prazo de primeiro contato, dia a dia.
 *
 * Existe porque o cartão protagonista do Dashboard desenha COLUNAS atrás do
 * vidro, e uma coluna precisa ser um dado. A alternativa — barras decorativas
 * com alturas escolhidas por gosto — seria um gráfico falso na primeira dobra
 * de um painel institucional, e o custo disso não é estético: é que a próxima
 * pessoa a olhar a tela acredita nele.
 *
 * A conta é a MESMA do hero, aplicada a um dia em vez de à janela: o número em
 * corpo grande é a média ponderada destes pontos ao longo da janela escolhida,
 * e não um sexto valor calculado por outro caminho.
 */
export function heroSeries(snapshot: CockpitSnapshot, days = 12): HeroColumn[] {
  const key =
    scopeKey(snapshot.scope) +
    '#' +
    (snapshot.focus.kind === 'signal' ? snapshot.focus.key : snapshot.focus.kind);

  const out: HeroColumn[] = [];
  for (let d = -(days - 1); d <= 0; d += 1) {
    out.push({
      label: dateAt(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      value: slaAdherenceAt(key, d) * 100,
      current: d === 0,
    });
  }
  return out;
}

export function pulseModel(snapshot: CockpitSnapshot): PulseModel {
  const meta = periodMeta(snapshot.period);
  const attentionKpi = snapshot.kpis.find((k) => k.key === 'atencao');
  const { trend, percent } = readTrend(attentionKpi?.deltaPercent ?? null);
  const priority = priorityOf(snapshot);
  const outcomes = snapshot.operations.outcomes;
  const operations = snapshot.operations;

  /* O protagonista é a aderência ao prazo de primeiro contato, e a escolha é de
     dado. Ela é genuinamente 0–100 (então a altura da coluna é honesta), o
     denominador é auditável e — o ponto que decidiu — os dois lados da fração
     são registros do próprio sistema: o caso foi aberto aqui e o primeiro
     contato foi carimbado aqui. Nenhuma integração pendente, nenhum
     contrafactual, nenhuma atribuição de mérito. */
  const hero: PulseHero = {
    label: 'Contato dentro do prazo',
    value: operations.slaAdherence,
    numerator: operations.inSla,
    denominator: operations.concluded,
    numeratorLabel: 'contatados no prazo',
    denominatorLabel: 'casos com desfecho apurado',
    deltaPP:
      operations.concluded > 0 ? operations.slaAdherence - snapshot.previousSlaAdherence : null,
    comparison: meta.compare,
    definition:
      'Casos cujo primeiro contato humano aconteceu dentro do SLA do radar que os abriu, sobre os casos com desfecho apurado na janela. O prazo é contado em horas úteis e definido por radar em Governança. É a única promessa que a operação faz para fora, e o sistema registra os dois lados da conta.',
  };

  const tone: PulseModel['tone'] =
    priority.key === 'sla' ? 'crit' : priority.key === 'alto-risco' ? 'warn' : 'ok';

  const funnel = funnelOf(snapshot);

  const summary = [
    headlineOf(trend, percent, priority),
    `Na janela "${meta.label}", ${int(operations.received)} intervenções foram abertas e ${int(outcomes.settled)} tiveram desfecho apurado, das quais ${int(operations.inSla)} tiveram o primeiro contato dentro do prazo — ${decimal(operations.slaAdherence, 1)}%.`,
    `${int(funnel[1].count)} alunos estão na faixa de atenção ou pior por Health Score, e ${int(snapshot.cases.attention)} casos estão com uma pessoa responsável. As duas medidas descrevem a mesma base de ${int(snapshot.base.monitored)} alunos de formas diferentes.`,
  ].join(' ');

  return {
    windowLabel: meta.label,
    windowInline: meta.inline,
    trend,
    trendPercent: percent,
    tone,
    headline: headlineOf(trend, percent, priority),
    hero,
    priority,
    calls: callsOf(snapshot),
    funnel,
    summary,
  };
}
