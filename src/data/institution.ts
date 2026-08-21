import type { Cohort, CourseArea, HealthStatus, Modality, RadarKey } from '../types';
import { COURSES, MODALITIES } from './catalog';
import { SCORE_BANDS } from '../lib/healthScore';

/* ==========================================================================
   Censo institucional — a única fonte de números agregados
   --------------------------------------------------------------------------
   O app trabalha com duas camadas de dados que não devem ser confundidas:

     · O SEED (data/seed.ts) traz algumas dezenas de alunos ricos — dossiê,
       timeline, caso aberto. É neles que a fila e o 360° operam.
     · O CENSO (este arquivo) descreve a instituição inteira. É o que o Cockpit
       precisa responder quando a diretoria pergunta "como estamos?".

   Por que uma tabela de CÉLULAS e não percentuais aplicados a um total:
   qualquer combinação de filtro (modalidade × curso × período × calouro) tem
   de fechar exatamente. Percentual derrapa no arredondamento e o donut termina
   mostrando 8.671. Aqui todo agregado é a soma de inteiros de células, então
   filtrar é somar um subconjunto — e a conta sempre fecha.

   Todos os números são DETERMINÍSTICOS. Nenhum Math.random em lugar algum: a
   mesma célula produz o mesmo valor em todo render, em toda sessão, para todo
   usuário. Quando o backend real existir, cada função exportada daqui vira uma
   chamada de API com a mesma assinatura.
   ========================================================================== */

/* -- Metas institucionais -------------------------------------------------
   Os únicos números escritos à mão no sistema. Tudo o mais é derivado deles.
   Trocar um destes valores re-espalha a base inteira de forma coerente. */

/**
 * Alunos sob monitoramento automático — graduação presencial e híbrida somadas.
 *
 * Este é o headcount real da operação. Um número redondo e inflado (dezoito mil)
 * fazia a tela inteira parecer uma maquete: com 8.672 as porcentagens batem com
 * o que a coordenação vê no sistema acadêmico, e os 163 casos humanos passam a
 * significar 1,9% da base em vez de um resíduo.
 */
export const TOTAL_MONITORED = 8_672;

/** Ingressantes do ciclo, dentro da janela de onboarding de 90 dias. */
export const TOTAL_FRESHMEN = 1_186;

/** Exceções que a automação não resolveu e que exigem ação humana. */
export const TOTAL_ATTENTION = 163;

/** Subconjunto de `TOTAL_ATTENTION` classificado como risco elevado. */
export const TOTAL_HIGH_RISK = 30;

/** Subconjunto de `TOTAL_HIGH_RISK` roteado para a fila de Retenção. */
export const TOTAL_RETENTION = 11;

/**
 * Ingressantes com pendência na régua automática: a pré-checagem falhou e a
 * automação está reagendando. Ainda NÃO é caso humano — é justamente o que a
 * régua tenta resolver sozinha antes de escalar.
 */
export const ONBOARDING_PENDING = 160;

/**
 * Ingressantes que viraram exceção humana na régua.
 *
 * Este número é o mesmo conjunto que o funil chama de "em atenção" dentro da
 * coorte Calouro — não uma segunda contagem. É o que mantém o bloco
 * "Automação × intervenção humana" e o indicador "Em atenção" falando a mesma
 * língua: 72 dos 163 casos humanos abertos são de ingressantes.
 */
export const ONBOARDING_HUMAN = 72;

/** Régua concluída sem qualquer toque humano. O resto é consequência. */
export const ONBOARDING_AUTO = TOTAL_FRESHMEN - ONBOARDING_PENDING - ONBOARDING_HUMAN;

/**
 * Intervenções abertas por aluno em atenção, por dia útil típico. Calibrado
 * para que a base completa produza ~39 intervenções num dia útil — cerca de
 * três contatos por especialista, que é o que uma equipe de treze cabe.
 */
export const DAILY_INTERVENTION_RATE = 0.2363;

/* -- Aleatoriedade determinística ---------------------------------------- */

function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Pseudoaleatório estável em [0, 1) a partir de uma chave textual. */
export function noise(key: string): number {
  let h = fnv1a(key);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4_294_967_296;
}

/** Pseudoaleatório estável em [-1, 1). */
export function signedNoise(key: string): number {
  return noise(key) * 2 - 1;
}

/**
 * Onda suave e determinística em ~[-1, 1], usada para dar movimento plausível
 * às séries históricas.
 *
 * Três frequências, e a mais rápida é a que importa: com apenas os dois termos
 * lentos originais (períodos de 58 e 149 dias), a janela de 7 dias saía uma
 * reta e o gráfico parecia morto justamente na visão mais consultada. O termo de
 * ~5 dias dá a variação do dia a dia, o de ~30 o movimento do mês, e o de ~150 a
 * tendência do semestre.
 */
export function wave(key: string, day: number): number {
  const p1 = noise(key + ':p1') * Math.PI * 2;
  const p2 = noise(key + ':p2') * Math.PI * 2;
  const p3 = noise(key + ':p3') * Math.PI * 2;
  return (
    Math.sin(day / 0.82 + p1) * 0.34 +
    Math.sin(day / 4.7 + p2) * 0.38 +
    Math.sin(day / 23.7 + p3) * 0.28
  );
}

/* -- Distribuição de inteiros -------------------------------------------- */

/**
 * Reparte `total` entre `weights` mantendo a soma EXATA, pelo método do maior
 * resto. `caps` limita cada posição — é o que garante que o funil nunca
 * inverta (alto risco jamais maior que em atenção na mesma célula).
 */
export function distribute(total: number, weights: number[], caps?: number[]): number[] {
  const n = weights.length;
  const out = new Array<number>(n).fill(0);
  if (n === 0 || total <= 0) return out;

  const capAt = (i: number) => (caps ? Math.max(0, Math.floor(caps[i])) : Number.MAX_SAFE_INTEGER);
  const w = weights.map((x, i) => (capAt(i) > 0 ? Math.max(0, x) : 0));
  const sum = w.reduce((a, b) => a + b, 0);

  // Sem peso utilizável: espalha de um em um por quem ainda tem folga.
  if (sum <= 0) {
    let left = total;
    for (let pass = 0; pass < n + 1 && left > 0; pass += 1) {
      for (let i = 0; i < n && left > 0; i += 1) {
        if (out[i] < capAt(i)) {
          out[i] += 1;
          left -= 1;
        }
      }
    }
    return out;
  }

  const remainder = new Array<number>(n).fill(0);
  let placed = 0;
  for (let i = 0; i < n; i += 1) {
    const quota = (total * w[i]) / sum;
    const base = Math.min(Math.floor(quota), capAt(i));
    out[i] = base;
    remainder[i] = quota - Math.floor(quota);
    placed += base;
  }

  let left = total - placed;
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => remainder[b] - remainder[a] || a - b,
  );

  let guard = 0;
  while (left > 0 && guard <= n) {
    let moved = false;
    for (const i of order) {
      if (left === 0) break;
      if (out[i] < capAt(i)) {
        out[i] += 1;
        left -= 1;
        moved = true;
      }
    }
    if (!moved) break;
    guard += 1;
  }
  return out;
}

/**
 * Reparte uma sequência de totais pequenos entre categorias mantendo a mistura
 * AGREGADA fiel às proporções pedidas.
 *
 * O maior resto, aplicado célula a célula de forma independente, enviesa: numa
 * célula com um único caso o ponto vai sempre para a categoria de maior peso, e
 * ao somar duzentas células a categoria menor termina praticamente zerada — foi
 * assim que "Acadêmico" quase zerou num universo de poucas centenas. Aqui a
 * fração que sobra é
 * CARREGADA para a célula seguinte (difusão de erro): a categoria preterida
 * acumula crédito e, algumas células depois, recebe o ponto que lhe cabia.
 *
 * O contrato de cada chamada continua o mesmo: a saída soma exatamente `total`.
 */
function makeDiffuser(
  n: number,
): (total: number, shares: number[], caps?: number[]) => number[] {
  const carry = new Array<number>(n).fill(0);

  return (total, shares, caps) => {
    const out = new Array<number>(n).fill(0);
    if (total <= 0) return out;
    const capAt = (k: number) => (caps ? Math.max(0, caps[k]) : Number.MAX_SAFE_INTEGER);
    const sum = shares.reduce((acc, s, k) => acc + (capAt(k) > 0 ? Math.max(0, s) : 0), 0);
    if (sum <= 0) return out;

    const want = shares.map((s, k) =>
      capAt(k) > 0 ? (total * Math.max(0, s)) / sum + carry[k] : 0,
    );
    let placed = 0;
    for (let k = 0; k < n; k += 1) {
      out[k] = Math.min(capAt(k), Math.max(0, Math.floor(want[k])));
      placed += out[k];
    }

    // Fecha a conta pelo maior/menor resíduo até bater exatamente em `total`.
    while (placed < total) {
      let best = -1;
      for (let k = 0; k < n; k += 1) {
        if (shares[k] <= 0 || out[k] >= capAt(k)) continue;
        if (best < 0 || want[k] - out[k] > want[best] - out[best]) best = k;
      }
      if (best < 0) break;
      out[best] += 1;
      placed += 1;
    }
    while (placed > total) {
      let worst = -1;
      for (let k = 0; k < n; k += 1) {
        if (out[k] <= 0) continue;
        if (worst < 0 || want[k] - out[k] < want[worst] - out[worst]) worst = k;
      }
      if (worst < 0) break;
      out[worst] -= 1;
      placed -= 1;
    }

    for (let k = 0; k < n; k += 1) carry[k] = want[k] - out[k];
    return out;
  };
}

/* -- Vocabulário --------------------------------------------------------- */

/** As cinco famílias de sinal que o Cockpit reporta. */
export type SignalKey = 'acesso' | 'frequencia' | 'financeiro' | 'academico' | 'onboarding';

export const SIGNALS: {
  key: SignalKey;
  label: string;
  radar: RadarKey;
  description: string;
}[] = [
  {
    key: 'acesso',
    label: 'Queda de acesso',
    radar: 'engajamento',
    description: 'Portal e AVA sem login na janela esperada, ou queda relevante de acessos.',
  },
  {
    key: 'frequencia',
    label: 'Frequência',
    radar: 'academico',
    description: 'Faltas em sequência, queda brusca de presença ou risco de reprovação por falta.',
  },
  {
    key: 'financeiro',
    label: 'Financeiro',
    radar: 'financeiro',
    description: 'Atraso dentro da janela preventiva, recorrência ou negociação sem confirmação.',
  },
  {
    key: 'academico',
    label: 'Acadêmico',
    radar: 'academico',
    description: 'Queda de notas, dependências e atividades avaliativas em atraso.',
  },
  {
    key: 'onboarding',
    label: 'Onboarding',
    radar: 'atendimento',
    description: 'Pré-checagem da régua falhou: contrato, documentos, primeiro acesso ou AVA.',
  },
];

export const SIGNAL_KEYS: SignalKey[] = SIGNALS.map((s) => s.key);

export function signalIndex(key: SignalKey): number {
  return SIGNAL_KEYS.indexOf(key);
}

/** As seis etapas da jornada, na ordem em que o aluno as atravessa. */
export type JourneyStageKey =
  | 'ingresso'
  | 'onboarding'
  | 'primeiro-acesso'
  | 'primeiras-aulas'
  | 'periodo-atual'
  | 'veterano';

export const JOURNEY_STAGES: {
  key: JourneyStageKey;
  label: string;
  /** O que "concluir" significa nesta etapa. */
  gate: string;
  /** `entrada` = funil do ingressante · `base` = população já estabilizada. */
  track: 'entrada' | 'base';
}[] = [
  {
    key: 'ingresso',
    label: 'Ingresso',
    gate: 'Contrato assinado e documentos aceitos',
    track: 'entrada',
  },
  {
    key: 'onboarding',
    label: 'Onboarding',
    gate: 'Régua de boas-vindas concluída',
    track: 'entrada',
  },
  {
    key: 'primeiro-acesso',
    label: 'Primeiro acesso',
    gate: 'Login no Portal e no AVA dentro da janela',
    track: 'entrada',
  },
  {
    key: 'primeiras-aulas',
    label: 'Primeiras aulas',
    gate: 'Presença nas duas primeiras semanas',
    track: 'entrada',
  },
  {
    key: 'periodo-atual',
    label: 'Período atual',
    gate: 'Frequência e notas no ritmo esperado',
    track: 'entrada',
  },
  {
    key: 'veterano',
    label: 'Veterano',
    gate: 'Renovação de matrícula no ciclo seguinte',
    track: 'base',
  },
];

/** Taxa de aprovação de cada porta do funil, na ordem das etapas. */
const STAGE_PASS_RATE = [0.968, 0.965, 0.968, 0.974, 0.974, 0.945];

/* -- Células -------------------------------------------------------------- */

export interface CensusCell {
  id: string;
  modality: Modality;
  course: string;
  area: CourseArea;
  /** Período acadêmico (1 = primeiro). */
  period: number;
  cohort: Cohort;
  monitored: number;
  /** Faixas de Health Score, na ordem de `SCORE_BANDS`. Soma = `monitored`. */
  bands: number[];
  /** Exceções encaminhadas para humano. Sempre ≤ `monitored`. */
  attention: number;
  /** Subconjunto de `attention`. */
  highRisk: number;
  /** Subconjunto de `highRisk`. */
  retention: number;
  /**
   * Tabela conjunta sinal × etapa da atenção, em ordem sinal-maior
   * (`sinal * 6 + etapa`). Soma = `attention`. É a fonte das duas marginais
   * abaixo, e o que permite recortar o Cockpit por sinal.
   */
  attentionGrid: number[];
  /** Mesma tabela para o risco elevado. Soma = `highRisk`, célula ≤ atenção. */
  highRiskGrid: number[];
  /** Marginal por sinal, na ordem de `SIGNALS`. Soma = `attention`. */
  signals: number[];
  /** Marginal por sinal do risco elevado. Soma = `highRisk`. */
  highRiskSignals: number[];
  /** Alunos posicionados em cada etapa da jornada. */
  stageCount: number[];
  /** Quantos passaram a porta da etapa. */
  stageCleared: number[];
  /** Marginal por etapa da atenção. Soma = `attention`. */
  stageAttention: number[];
  /** Marginal por etapa do risco elevado. Soma = `highRisk`. */
  stageHighRisk: number[];
  /** Régua de onboarding: [automático, pendência, humano]. Soma = monitored. */
  automation: number[];
}

const BAND_COUNT = SCORE_BANDS.length;

/** Perfil de risco base da instituição, na ordem de `SCORE_BANDS`. */
const BASE_BAND_SHARE = [0.716, 0.194, 0.065, 0.025];

/** Áreas com dinâmica de risco distinta. */
const AREA_RISK: Record<CourseArea, number> = {
  Negócios: 1.18,
  Tecnologia: 1.06,
  Saúde: 0.86,
  Direito: 0.82,
  Humanas: 1.02,
  Exatas: 1.12,
};

interface CellSeed {
  id: string;
  modality: Modality;
  course: string;
  area: CourseArea;
  period: number;
  cohort: Cohort;
  weight: number;
}

/** Esqueleto das células: um registro por curso × modalidade × período × coorte. */
function buildSeeds(): CellSeed[] {
  const seeds: CellSeed[] = [];

  for (const course of COURSES) {
    for (const modality of course.modality) {
      if (!MODALITIES.includes(modality)) continue;

      for (let period = 1; period <= course.totalPeriods; period += 1) {
        // Turmas mais cheias no início do curso: evasão natural ao longo dele.
        const decay = Math.pow(0.935, period - 1);
        const scale = modality === 'Presencial' ? 1 : 0.19;
        const jitter = 0.72 + noise('size:' + course.name + modality + period) * 0.62;
        const weight = decay * scale * jitter * (course.totalPeriods >= 10 ? 1.12 : 1);

        // O primeiro período abriga as duas coortes: o ingressante do ciclo e o
        // veterano que ficou retido. A janela de 90 dias é o que os separa.
        if (period === 1) {
          seeds.push({
            id: course.name + '|' + modality + '|1|Calouro',
            modality,
            course: course.name,
            area: course.area,
            period: 1,
            cohort: 'Calouro',
            weight,
          });
          seeds.push({
            id: course.name + '|' + modality + '|1|Veterano',
            modality,
            course: course.name,
            area: course.area,
            period: 1,
            cohort: 'Veterano',
            weight: weight * 0.22,
          });
        } else {
          seeds.push({
            id: course.name + '|' + modality + '|' + period + '|Veterano',
            modality,
            course: course.name,
            area: course.area,
            period,
            cohort: 'Veterano',
            weight,
          });
        }
      }
    }
  }

  return seeds;
}

/**
 * Constrói o censo completo. Roda uma vez, na carga do módulo: duas centenas de
 * células, cada uma fechando por construção.
 */
function buildCensus(): CensusCell[] {
  const seeds = buildSeeds();
  const freshIdx: number[] = [];
  const vetIdx: number[] = [];
  seeds.forEach((s, i) => (s.cohort === 'Calouro' ? freshIdx : vetIdx).push(i));

  /* 1. Headcount: as duas coortes fecham nas suas metas. */
  const monitored = new Array<number>(seeds.length).fill(0);
  const fresh = distribute(
    TOTAL_FRESHMEN,
    freshIdx.map((i) => seeds[i].weight),
  );
  freshIdx.forEach((i, k) => {
    monitored[i] = fresh[k];
  });

  const vets = distribute(
    TOTAL_MONITORED - TOTAL_FRESHMEN,
    vetIdx.map((i) => seeds[i].weight),
  );
  vetIdx.forEach((i, k) => {
    monitored[i] = vets[k];
  });

  /* 2. Faixas de Health Score por célula. */
  const bands = seeds.map((seed, i) => {
    const risk = AREA_RISK[seed.area];
    // Calouro tem mais "Atenção" (adaptação) e menos "Crítico": ainda não deu
    // tempo de acumular reprovação, dependência e inadimplência.
    const cohortSkew = seed.cohort === 'Calouro' ? [0.97, 1.22, 0.9, 0.62] : [1, 1, 1, 1];
    // O risco cresce discretamente do meio do curso em diante.
    const periodSkew = 1 + Math.min(seed.period, 8) * 0.018;

    const shares = BASE_BAND_SHARE.map((share, b) => {
      const riskFactor = b === 0 ? 1 / risk : risk * (b >= 2 ? periodSkew : 1);
      const jitter = 1 + signedNoise('band:' + seed.id + ':' + b) * (b === 0 ? 0.05 : 0.22);
      return Math.max(0.001, share * riskFactor * cohortSkew[b] * jitter);
    });

    return distribute(monitored[i], shares);
  });

  /* 3. O funil humano. Só uma fração dos desvios chega a uma pessoa — o resto
        a automação resolve. É por isso que 8.672 monitorados geram 163 casos.

        As duas coortes são repartidas separadamente porque o total de calouros
        em atenção é a MESMA coisa que a "intervenção humana" do bloco de
        automação. Distribuir 347 de uma vez faria os dois blocos discordarem. */
  const pressureOf = (i: number) => {
    const b = bands[i];
    return b[1] * 0.35 + b[2] * 2.1 + b[3] * 5.4;
  };

  const attention = new Array<number>(seeds.length).fill(0);
  const freshAttention = distribute(
    ONBOARDING_HUMAN,
    freshIdx.map((i) => pressureOf(i) * (0.75 + noise('att:' + seeds[i].id) * 0.5)),
    freshIdx.map((i) => monitored[i]),
  );
  freshIdx.forEach((i, k) => {
    attention[i] = freshAttention[k];
  });

  const vetAttention = distribute(
    TOTAL_ATTENTION - ONBOARDING_HUMAN,
    vetIdx.map((i) => pressureOf(i) * (0.75 + noise('att:' + seeds[i].id) * 0.5)),
    vetIdx.map((i) => monitored[i]),
  );
  vetIdx.forEach((i, k) => {
    attention[i] = vetAttention[k];
  });

  // Risco elevado concentra no veterano: o risco do calouro é adaptação, não
  // abandono, e misturar os dois é exatamente o que corrompe o funil.
  const highRiskWeights = seeds.map((seed, i) => {
    if (attention[i] === 0) return 0;
    const b = bands[i];
    const raw = b[3] * 3.2 + b[2] + noise('hr:' + seed.id) * 4;
    return seed.cohort === 'Calouro' ? raw * 0.16 : raw;
  });
  const highRisk = distribute(TOTAL_HIGH_RISK, highRiskWeights, attention);

  // Retenção é fila de evasão, e a régua de 90 dias mantém o calouro fora dela.
  const retentionWeights = seeds.map((seed, i) =>
    highRisk[i] > 0 && seed.cohort === 'Veterano'
      ? highRisk[i] * (0.7 + noise('ret:' + seed.id) * 0.6)
      : 0,
  );
  const retention = distribute(
    TOTAL_RETENTION,
    retentionWeights,
    seeds.map((seed, i) => (seed.cohort === 'Veterano' ? highRisk[i] : 0)),
  );

  /* 4. Sinal × etapa da jornada: UMA tabela conjunta por célula.
        Construir as duas marginais em separado as faria discordar — a soma por
        sinal não fecharia com a soma por etapa, e o Cockpit mostraria 347 num
        painel e 344 no outro. Aqui a tabela conjunta é a fonte, e as marginais
        são somas dela. Fecham por construção, e é isso que permite recortar o
        Cockpit por sinal sem inventar número nenhum. */
  const GRID = SIGNALS.length * JOURNEY_STAGES.length;
  const at = (k: number, s: number) => k * JOURNEY_STAGES.length + s;

  // No híbrido o AVA é a sala de aula, então "queda de acesso" domina; no
  // presencial a frequência física pesa mais. No calouro, a régua de entrada é
  // a causa mais comum — e ela não existe para o veterano.
  const signalWeightsOf = (seed: CellSeed) => {
    const digital = seed.modality !== 'Presencial';
    const base =
      seed.cohort === 'Calouro'
        ? [digital ? 2.1 : 1.6, digital ? 0.9 : 1.3, 1.2, 0.9, 3.4]
        : [digital ? 3.2 : 2.1, digital ? 1 : 2.2, 1.9, 1.8, 0];
    return base.map((x, k) =>
      x <= 0 ? 0 : Math.max(0.001, x * (0.82 + noise('sig:' + seed.id + ':' + k) * 0.36)),
    );
  };

  // O calouro está numa das cinco etapas de entrada; o veterano, na sexta.
  const stageWeightsOf = (seed: CellSeed) =>
    seed.cohort === 'Calouro'
      ? [
          ...[1.1, 2.4, 2.8, 1.9, 1.5].map(
            (x, s) => x * (0.82 + noise('stg:' + seed.id + ':' + s) * 0.36),
          ),
          0,
        ]
      : [0, 0, 0, 0, 0, 1];

  /** Quais sinais mais pesam quando o caso escala para risco elevado. */
  const SEVERITY = [1.4, 1.25, 1.6, 1, 0.5];

  const attentionDiffuser = makeDiffuser(GRID);
  const highRiskDiffuser = makeDiffuser(GRID);

  const attentionGrid = seeds.map((seed, i) => {
    const sw = signalWeightsOf(seed);
    const st = stageWeightsOf(seed);
    const w = new Array<number>(GRID).fill(0);
    for (let k = 0; k < SIGNALS.length; k += 1) {
      for (let s = 0; s < JOURNEY_STAGES.length; s += 1) w[at(k, s)] = sw[k] * st[s];
    }
    return attentionDiffuser(attention[i], w);
  });

  const highRiskGrid = seeds.map((seed, i) => {
    const sw = signalWeightsOf(seed);
    const st = stageWeightsOf(seed);
    const w = new Array<number>(GRID).fill(0);
    for (let k = 0; k < SIGNALS.length; k += 1) {
      for (let s = 0; s < JOURNEY_STAGES.length; s += 1) {
        w[at(k, s)] = sw[k] * SEVERITY[k] * st[s];
      }
    }
    // Teto na tabela de atenção: risco elevado é subconjunto, nunca excede.
    return highRiskDiffuser(highRisk[i], w, attentionGrid[i]);
  });

  const rowSums = (grid: number[]) =>
    Array.from({ length: SIGNALS.length }, (_, k) => {
      let sum = 0;
      for (let s = 0; s < JOURNEY_STAGES.length; s += 1) sum += grid[at(k, s)];
      return sum;
    });

  const colSums = (grid: number[]) =>
    Array.from({ length: JOURNEY_STAGES.length }, (_, s) => {
      let sum = 0;
      for (let k = 0; k < SIGNALS.length; k += 1) sum += grid[at(k, s)];
      return sum;
    });

  /* 5. O funil da jornada. Cada etapa recebe quem passou pela porta anterior. */
  const stageCount = seeds.map(() => new Array<number>(JOURNEY_STAGES.length).fill(0));
  const stageCleared = seeds.map(() => new Array<number>(JOURNEY_STAGES.length).fill(0));

  seeds.forEach((seed, i) => {
    if (seed.cohort === 'Calouro') {
      let atStage = monitored[i];
      for (let s = 0; s < 5; s += 1) {
        const rate = Math.min(
          0.999,
          Math.max(0.6, STAGE_PASS_RATE[s] + signedNoise('stage:' + seed.id + ':' + s) * 0.028),
        );
        stageCount[i][s] = atStage;
        stageCleared[i][s] = Math.round(atStage * rate);
        atStage = stageCleared[i][s];
      }
    } else {
      const rate = Math.min(
        0.995,
        Math.max(0.82, STAGE_PASS_RATE[5] + signedNoise('stage:' + seed.id + ':5') * 0.03),
      );
      stageCount[i][5] = monitored[i];
      stageCleared[i][5] = Math.round(monitored[i] * rate);
    }
  });

  /* 6. Automação × humano na régua de onboarding. Só o calouro tem régua, e a
        coluna "intervenção humana" É a atenção do calouro — mesmo conjunto,
        não uma segunda contagem. Por isso ela não é redistribuída aqui. */
  const human = seeds.map((seed, i) => (seed.cohort === 'Calouro' ? attention[i] : 0));

  const pendingWeights = seeds.map((seed, i) =>
    seed.cohort === 'Calouro'
      ? bands[i][1] * 1.4 + bands[i][2] * 2.2 + bands[i][3] * 2.6 + noise('pen:' + seed.id) * 2
      : 0,
  );
  const pendingCaps = seeds.map((seed, i) =>
    seed.cohort === 'Calouro' ? Math.max(0, monitored[i] - human[i]) : 0,
  );
  const pending = distribute(ONBOARDING_PENDING, pendingWeights, pendingCaps);

  /* 7. Materializa. */
  return seeds.map((seed, i) => ({
    id: seed.id,
    modality: seed.modality,
    course: seed.course,
    area: seed.area,
    period: seed.period,
    cohort: seed.cohort,
    monitored: monitored[i],
    bands: bands[i],
    attention: attention[i],
    highRisk: highRisk[i],
    retention: retention[i],
    attentionGrid: attentionGrid[i],
    highRiskGrid: highRiskGrid[i],
    signals: rowSums(attentionGrid[i]),
    highRiskSignals: rowSums(highRiskGrid[i]),
    stageCount: stageCount[i],
    stageCleared: stageCleared[i],
    stageAttention: colSums(attentionGrid[i]),
    stageHighRisk: colSums(highRiskGrid[i]),
    automation:
      seed.cohort === 'Calouro'
        ? [Math.max(0, monitored[i] - pending[i] - human[i]), pending[i], human[i]]
        : [0, 0, 0],
  }));
}

export const CENSUS: CensusCell[] = buildCensus();

/* -- Escopo --------------------------------------------------------------- */

export interface CensusScope {
  modality: 'Todas' | Modality;
  course: 'Todos' | string;
  /** Período acadêmico. `0` = todos. */
  period: number;
  cohort: 'Todos' | Cohort;
}

export const FULL_SCOPE: CensusScope = {
  modality: 'Todas',
  course: 'Todos',
  period: 0,
  cohort: 'Todos',
};

/** Chave estável do escopo — semeia as séries históricas e memoiza agregados. */
export function scopeKey(scope: CensusScope): string {
  return scope.modality + '|' + scope.course + '|' + scope.period + '|' + scope.cohort;
}

export function matches(cell: CensusCell, scope: CensusScope): boolean {
  if (scope.modality !== 'Todas' && cell.modality !== scope.modality) return false;
  if (scope.course !== 'Todos' && cell.course !== scope.course) return false;
  if (scope.period !== 0 && cell.period !== scope.period) return false;
  if (scope.cohort !== 'Todos' && cell.cohort !== scope.cohort) return false;
  return true;
}

/* -- Agregado ------------------------------------------------------------- */

export interface CensusAggregate {
  monitored: number;
  bands: number[];
  attention: number;
  highRisk: number;
  retention: number;
  attentionGrid: number[];
  highRiskGrid: number[];
  signals: number[];
  highRiskSignals: number[];
  stageCount: number[];
  stageCleared: number[];
  stageAttention: number[];
  stageHighRisk: number[];
  automation: number[];
  freshmen: number;
  veterans: number;
  /** Quantas células do censo compõem este agregado. 0 = escopo vazio. */
  cells: number;
}

function zeros(n: number): number[] {
  return new Array<number>(n).fill(0);
}

function addInto(target: number[], source: number[]): void {
  for (let i = 0; i < target.length; i += 1) target[i] += source[i];
}

const GRID_SIZE = SIGNALS.length * JOURNEY_STAGES.length;

export function aggregate(scope: CensusScope): CensusAggregate {
  const out: CensusAggregate = {
    monitored: 0,
    bands: zeros(BAND_COUNT),
    attention: 0,
    highRisk: 0,
    retention: 0,
    attentionGrid: zeros(GRID_SIZE),
    highRiskGrid: zeros(GRID_SIZE),
    signals: zeros(SIGNALS.length),
    highRiskSignals: zeros(SIGNALS.length),
    stageCount: zeros(JOURNEY_STAGES.length),
    stageCleared: zeros(JOURNEY_STAGES.length),
    stageAttention: zeros(JOURNEY_STAGES.length),
    stageHighRisk: zeros(JOURNEY_STAGES.length),
    automation: zeros(3),
    freshmen: 0,
    veterans: 0,
    cells: 0,
  };

  for (const cell of CENSUS) {
    if (!matches(cell, scope)) continue;
    out.cells += 1;
    out.monitored += cell.monitored;
    out.attention += cell.attention;
    out.highRisk += cell.highRisk;
    out.retention += cell.retention;
    if (cell.cohort === 'Calouro') out.freshmen += cell.monitored;
    else out.veterans += cell.monitored;
    addInto(out.bands, cell.bands);
    addInto(out.attentionGrid, cell.attentionGrid);
    addInto(out.highRiskGrid, cell.highRiskGrid);
    addInto(out.signals, cell.signals);
    addInto(out.highRiskSignals, cell.highRiskSignals);
    addInto(out.stageCount, cell.stageCount);
    addInto(out.stageCleared, cell.stageCleared);
    addInto(out.stageAttention, cell.stageAttention);
    addInto(out.stageHighRisk, cell.stageHighRisk);
    addInto(out.automation, cell.automation);
  }

  return out;
}

/**
 * Recorta um agregado por família de sinal. As duas marginais saem da tabela
 * conjunta, então o recorte não estima nada: "Queda de acesso" continua sabendo
 * exatamente quantos casos tem, quantos são risco elevado e em que etapa da
 * jornada estão.
 */
export function focusOnSignal(agg: CensusAggregate, key: SignalKey): CensusAggregate {
  const k = SIGNAL_KEYS.indexOf(key);
  if (k < 0) return agg;

  const stages = JOURNEY_STAGES.length;
  const rowAt = (grid: number[]) => grid.slice(k * stages, k * stages + stages);

  const attentionStages = rowAt(agg.attentionGrid);
  const highRiskStages = rowAt(agg.highRiskGrid);
  const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  const attentionGrid = zeros(GRID_SIZE);
  const highRiskGrid = zeros(GRID_SIZE);
  for (let s = 0; s < stages; s += 1) {
    attentionGrid[k * stages + s] = attentionStages[s];
    highRiskGrid[k * stages + s] = highRiskStages[s];
  }

  const signals = zeros(SIGNALS.length);
  const highRiskSignals = zeros(SIGNALS.length);
  signals[k] = total(attentionStages);
  highRiskSignals[k] = total(highRiskStages);

  return {
    ...agg,
    attention: signals[k],
    highRisk: highRiskSignals[k],
    // Retenção não é cruzada por sinal no censo, então o recorte não a afirma.
    retention: 0,
    attentionGrid,
    highRiskGrid,
    signals,
    highRiskSignals,
    stageAttention: attentionStages,
    stageHighRisk: highRiskStages,
  };
}

/**
 * Recorta um agregado para apenas o risco elevado — o "Alto risco" do primeiro
 * indicador, aplicado a toda a página.
 */
export function focusOnHighRisk(agg: CensusAggregate): CensusAggregate {
  return {
    ...agg,
    attention: agg.highRisk,
    attentionGrid: agg.highRiskGrid,
    signals: agg.highRiskSignals,
    stageAttention: agg.stageHighRisk,
  };
}

/* -- Distribuição por faixa (o que o donut desenha) ---------------------- */

export interface BandSlice {
  status: HealthStatus;
  label: string;
  token: string;
  range: [number, number];
  hex: (dark: boolean) => string;
  count: number;
  percent: number;
}

export function bandSlices(agg: CensusAggregate): BandSlice[] {
  return SCORE_BANDS.map((band, i) => ({
    status: band.status,
    label: band.label,
    token: band.token,
    range: band.range,
    hex: band.hex,
    count: agg.bands[i],
    percent: agg.monitored > 0 ? (agg.bands[i] / agg.monitored) * 100 : 0,
  }));
}

/* -- Catálogo derivado, para os filtros ---------------------------------- */

/** Cursos que existem na modalidade escolhida — nada de opção que zera a tela. */
export function coursesFor(modality: 'Todas' | Modality): string[] {
  const set = new Set<string>();
  for (const cell of CENSUS) {
    if (modality !== 'Todas' && cell.modality !== modality) continue;
    set.add(cell.course);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Períodos acadêmicos existentes no escopo de modalidade + curso. */
export function periodsFor(modality: 'Todas' | Modality, course: 'Todos' | string): number[] {
  const set = new Set<number>();
  for (const cell of CENSUS) {
    if (modality !== 'Todas' && cell.modality !== modality) continue;
    if (course !== 'Todos' && cell.course !== course) continue;
    set.add(cell.period);
  }
  return [...set].sort((a, b) => a - b);
}
