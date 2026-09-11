import type {
  Case,
  FollowUp,
  GovernanceSettings,
  Interaction,
  RadarKey,
  Specialist,
  Student,
} from '../types';
import { RADARS, RADAR_ORDER } from './radars';
import { isOpen, isTerminal } from './caseFlow';
import { slaStatus } from './sla';
import { SCORE_BANDS, scoreDistribution } from './healthScore';
import { evasionBreakdown } from './exporters';
import type { EvasionRow } from './exporters';

/* ==========================================================================
   Indicadores — o modelo, separado da tela
   --------------------------------------------------------------------------
   Antes estas contas viviam dentro do componente. Com a tela virando um
   workspace de seis abas, isso passaria a significar recalcular a mesma coisa
   em seis lugares, ou pior: cada aba calculando a sua própria versão da mesma
   métrica. Uma taxa de reversão que muda de valor conforme a aba é o fim da
   utilidade de um painel executivo.

   Duas correções de fundo entraram nesta extração, e as duas são sobre não
   apresentar ausência de medida como medida:

     1. `avgHealthScore` é `number | null`. Era `0` quando o escopo não tinha
        aluno, e a tela imprimia `Health Score médio 0/100` — que não é "não
        sei", é "a base está no chão". Onde não há amostra, o modelo devolve
        `null` e a tela escreve "sem amostra no recorte".
     2. `precision` de radar já era `null` sem julgamento, mas a tela chamava
        isso de "sem verdicto", o que lê como falha do radar. É amostra
        insuficiente, e o modelo agora carrega essa distinção em
        `precisionState` para que a tela não precise inferi-la.

   Um ponto que o modelo deixa explícito de propósito, porque era a maior
   inconsistência real do produto: TODA MÉTRICA DAQUI VEM DA AMOSTRA
   OPERACIONAL, não do censo. São dezenas de alunos com dossiê completo, contra
   os 8.672 do censo que o Dashboard agrega. Os dois números estão certos e
   medem coisas diferentes — e é por isso que `sampleSize` acompanha cada bloco
   e a tela imprime o denominador em vez de deixar o leitor supor que "Health
   Score médio" é a média da instituição.
   ========================================================================== */

export interface RadarStat {
  key: RadarKey;
  label: string;
  slaHours: number;
  alerts: number;
  confirmed: number;
  rejected: number;
  judged: number;
  pending: number;
  /** `null` quando nenhum alerta foi julgado. Nunca 0 por ausência de dado. */
  precision: number | null;
  /**
   * Por que a precisão está ausente ou o que ela significa. Existe para que a
   * tela não trate "ninguém julgou ainda" como "o radar errou".
   */
  precisionState: 'ok' | 'insufficient';
  openCases: number;
  closedCases: number;
  totalCases: number;
}

export interface CourseRisk {
  course: string;
  total: number;
  risky: number;
  ratio: number;
}

export interface TeamRow {
  spec: Specialist;
  open: number;
  retained: number;
  total: number;
  /** Carga sobre capacidade, 0–1+. */
  load: number;
}

export interface OutcomeRow {
  key: string;
  label: string;
  value: number;
  total: number;
  percent: number;
  color: string;
}

export interface IndicatorsModel {
  /** Tamanho da amostra operacional no recorte. Denominador de quase tudo. */
  sampleSize: number;
  /** Tamanho da amostra completa, para comparação. */
  sampleTotal: number;

  /* -- Saúde da base ----------------------------------------------------- */
  distribution: ReturnType<typeof scoreDistribution>;
  /** `null` = sem aluno no recorte. Nunca 0. */
  avgHealthScore: number | null;
  courseRisk: CourseRisk[];

  /* -- Operação ---------------------------------------------------------- */
  openCases: Case[];
  closedCases: Case[];
  breached: Case[];
  reopened: Case[];
  pendingFollowUps: number;
  interactionCount: number;
  /** Aderência ao SLA sobre casos abertos + encerrados do recorte. */
  slaAdherence: number | null;
  slaDenominator: number;
  avgFirstContactHours: number | null;
  firstContactSample: number;
  contactOutcomes: OutcomeRow[];

  /* -- Retenção ---------------------------------------------------------- */
  retained: Case[];
  lost: Case[];
  dismissed: Case[];
  /** `null` = nenhum desfecho definitivo ainda. */
  reversionRate: number | null;
  reversionDenominator: number;
  caseEndings: OutcomeRow[];
  evasion: EvasionRow[];
  preservedRevenue: number;
  preservedRevenueBasis: number;

  /* -- Radares ----------------------------------------------------------- */
  radars: RadarStat[];

  /* -- Equipe ------------------------------------------------------------ */
  team: TeamRow[];
}

export interface IndicatorsInput {
  students: Student[];
  scopedStudents: Student[];
  cases: Case[];
  scopedCases: Case[];
  interactions: Interaction[];
  specialists: Specialist[];
  settings: GovernanceSettings;
  followUps: FollowUp[];
  now: number;
}

export function indicatorsModel({
  students,
  scopedStudents,
  cases,
  scopedCases,
  interactions,
  specialists,
  settings,
  followUps,
  now,
}: IndicatorsInput): IndicatorsModel {
  /* -- Saúde da base ----------------------------------------------------- */

  const distribution = scoreDistribution(scopedStudents);

  /* A média só existe se houver amostra. O `0` anterior era um fallback
     apresentado como leitura — ver a nota do topo. */
  const avgHealthScore =
    scopedStudents.length > 0
      ? Math.round(
          scopedStudents.reduce((sum, s) => sum + s.healthScore, 0) / scopedStudents.length,
        )
      : null;

  const byCourse = new Map<string, { total: number; risky: number }>();
  for (const s of scopedStudents) {
    const entry = byCourse.get(s.course) ?? { total: 0, risky: 0 };
    entry.total += 1;
    if (s.status === 'Risco' || s.status === 'Crítico') entry.risky += 1;
    byCourse.set(s.course, entry);
  }
  const courseRisk: CourseRisk[] = [...byCourse.entries()]
    .map(([course, v]) => ({ course, ...v, ratio: v.total > 0 ? v.risky / v.total : 0 }))
    .sort((a, b) => b.ratio - a.ratio || b.total - a.total);

  /* -- Operação ---------------------------------------------------------- */

  const openCases = scopedCases.filter((c) => isOpen(c.status));
  const closedCases = scopedCases.filter((c) => isTerminal(c.status));
  const breached = openCases.filter((c) => slaStatus(c, now).state === 'breach');
  const reopened = cases.filter((c) => c.reopenCount > 0);

  const slaDenominator = openCases.length + closedCases.length;
  const slaAdherence =
    slaDenominator > 0 ? ((slaDenominator - breached.length) / slaDenominator) * 100 : null;

  const withContact = cases.filter((c) => c.firstContactAt);
  const avgFirstContactHours =
    withContact.length > 0
      ? withContact.reduce(
          (sum, c) =>
            sum +
            (new Date(c.firstContactAt as string).getTime() - new Date(c.openedAt).getTime()) /
              3_600_000,
          0,
        ) / withContact.length
      : null;

  const contacted = new Set(interactions.map((i) => i.studentId)).size;
  const responded = interactions.filter(
    (i) => i.outcome !== 'Sem contato' && i.outcome !== 'Recusou atendimento',
  ).length;
  const noContact = interactions.filter((i) => i.outcome === 'Sem contato').length;
  const resolvedInteractions = interactions.filter((i) => i.outcome === 'Resolvido').length;

  const contactOutcomes: OutcomeRow[] = [
    {
      key: 'contatados',
      label: 'Alunos contatados',
      value: contacted,
      total: scopedStudents.length,
      color: 'var(--brand-2)',
    },
    {
      key: 'responderam',
      label: 'Interações com resposta',
      value: responded,
      total: interactions.length,
      color: 'var(--ink-3)',
    },
    {
      key: 'resolvidas',
      label: 'Resolvidas no próprio contato',
      value: resolvedInteractions,
      total: interactions.length,
      color: 'var(--ink-3)',
    },
    {
      key: 'sem-contato',
      label: 'Sem contato estabelecido',
      value: noContact,
      total: interactions.length,
      color: 'var(--crit)',
    },
  ].map((row) => ({
    ...row,
    percent: row.total > 0 ? (row.value / row.total) * 100 : 0,
  }));

  /* -- Retenção ---------------------------------------------------------- */

  const retained = cases.filter((c) => c.status === 'Acordo Firmado');
  const lost = cases.filter((c) => c.status === 'Evasão Inevitável');
  const dismissed = cases.filter((c) => c.status === 'Cancelado');

  const reversionDenominator = retained.length + lost.length;
  const reversionRate =
    reversionDenominator > 0 ? (retained.length / reversionDenominator) * 100 : null;

  const caseEndings: OutcomeRow[] = [
    { key: 'retido', label: 'Acordo firmado · retido', value: retained.length, color: 'var(--ink-3)' },
    { key: 'perdido', label: 'Saída inevitável', value: lost.length, color: 'var(--crit)' },
    { key: 'descartado', label: 'Alerta descartado', value: dismissed.length, color: 'var(--ink-4)' },
    { key: 'aberto', label: 'Ainda em aberto', value: openCases.length, color: 'var(--warn)' },
  ].map((row) => ({
    ...row,
    total: cases.length,
    percent: cases.length > 0 ? (row.value / cases.length) * 100 : 0,
  }));

  /* Receita preservada: mensalidade × 6 parcelas × períodos restantes dos
     retidos. A fórmula fica declarada porque um número institucional só é útil
     quando pode ser defendido em reunião — e porque ele é EXPOSIÇÃO EVITADA,
     não caixa realizado. `preservedRevenueBasis` é quantos casos entraram na
     conta, para que o valor nunca apareça sem o seu denominador. */
  let preservedRevenue = 0;
  let preservedRevenueBasis = 0;
  for (const c of retained) {
    const student = students.find((s) => s.id === c.studentId);
    if (!student) continue;
    const remainingPeriods = Math.max(1, student.totalPeriods - student.period + 1);
    preservedRevenue += student.financial.monthlyFee * 6 * remainingPeriods;
    preservedRevenueBasis += 1;
  }

  /* -- Radares ----------------------------------------------------------- */

  const radars: RadarStat[] = RADAR_ORDER.map((key) => {
    const alerts = students.flatMap((s) => s.alerts.filter((a) => a.radar === key));
    const confirmed = alerts.filter((a) => a.review === 'confirmado').length;
    const rejected = alerts.filter((a) => a.review === 'descartado').length;
    const judged = confirmed + rejected;
    const openForRadar = cases.filter((c) => c.radar === key && isOpen(c.status)).length;
    const closedForRadar = cases.filter((c) => c.radar === key && isTerminal(c.status)).length;

    return {
      key,
      label: RADARS[key].shortLabel,
      slaHours: settings.slaHours[key],
      alerts: alerts.length,
      confirmed,
      rejected,
      judged,
      pending: alerts.length - judged,
      precision: judged > 0 ? (confirmed / judged) * 100 : null,
      precisionState: judged > 0 ? 'ok' : 'insufficient',
      openCases: openForRadar,
      closedCases: closedForRadar,
      totalCases: openForRadar + closedForRadar,
    };
  });

  /* -- Equipe ------------------------------------------------------------ */

  const team: TeamRow[] = specialists
    .map((spec) => {
      const specCases = cases.filter((c) => c.assigneeId === spec.id);
      const specOpen = specCases.filter((c) => isOpen(c.status)).length;
      return {
        spec,
        open: specOpen,
        retained: specCases.filter((c) => c.status === 'Acordo Firmado').length,
        total: specCases.length,
        load: spec.capacity > 0 ? specOpen / spec.capacity : 0,
      };
    })
    .sort((a, b) => b.load - a.load);

  return {
    sampleSize: scopedStudents.length,
    sampleTotal: students.length,
    distribution,
    avgHealthScore,
    courseRisk,
    openCases,
    closedCases,
    breached,
    reopened,
    pendingFollowUps: followUps.filter((f) => f.status === 'Agendado').length,
    interactionCount: interactions.length,
    slaAdherence,
    slaDenominator,
    avgFirstContactHours,
    firstContactSample: withContact.length,
    contactOutcomes,
    retained,
    lost,
    dismissed,
    reversionRate,
    reversionDenominator,
    caseEndings,
    evasion: evasionBreakdown(cases, students),
    preservedRevenue,
    preservedRevenueBasis,
    radars,
    team,
  };
}

/**
 * A faixa de Health Score em que uma média cai, para dar veredito a um número
 * que sozinho é só um índice. `null` entra e `null` sai — sem amostra não há
 * faixa, e inventar "Estável" para uma base vazia seria pior que não dizer nada.
 */
export function bandOfScore(score: number | null) {
  if (score === null) return null;
  return SCORE_BANDS.find((b) => score >= b.range[0] && score <= b.range[1]) ?? null;
}
