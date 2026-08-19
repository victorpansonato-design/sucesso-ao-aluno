import type {
  HealthStatus,
  Modality,
  ScoreDimension,
  ScoreFactor,
  ScoreResult,
  Student,
  WeightProfile,
} from '../types';
import { accessDropPercent } from './radars';
import { clamp } from './format';

/* ==========================================================================
   Health Score engine
   --------------------------------------------------------------------------
   The score is an *indicator to guide the team, never a sentence on the
   student*. Three consequences follow, and all three are enforced here:

     1. It is always explainable. Every point is attributed to a dimension
        with a plain-language rationale the attendant can read aloud.
     2. It is parameterised by modality. Counting a hybrid student's
        fortnightly campus attendance the same way as a daily on-campus
        student's is simply wrong, so the weights shift and the AVA signal
        carries the load instead.
     3. It is derived, never stored. Recomputed after every interaction, so
        registering an outcome genuinely moves the number.
   ========================================================================== */

export const DEFAULT_WEIGHTS: Record<Modality, WeightProfile> = {
  // On campus, physical attendance is the highest-fidelity engagement signal.
  Presencial: { academico: 30, presenca: 25, engajamento: 15, financeiro: 20, relacionamento: 10 },
  // Hybrid attendance is fortnightly — a single miss must not read as abandonment.
  Híbrido: { academico: 28, presenca: 15, engajamento: 27, financeiro: 20, relacionamento: 10 },
  // Fully online: the AVA *is* the classroom.
  EaD: { academico: 28, presenca: 5, engajamento: 37, financeiro: 20, relacionamento: 10 },
};

export const PROFILE_LABEL: Record<Modality, string> = {
  Presencial: 'Perfil Presencial — presença física com peso alto',
  Híbrido: 'Perfil Híbrido — presença quinzenal, peso migrado para o AVA',
  EaD: 'Perfil EaD 100% — engajamento no AVA como eixo central',
};

export const DIMENSION_LABEL: Record<ScoreDimension, string> = {
  academico: 'Desempenho acadêmico',
  presenca: 'Presença',
  engajamento: 'Engajamento no AVA',
  financeiro: 'Situação financeira',
  relacionamento: 'Relacionamento & acolhimento',
};

/* -- Dimension scorers ----------------------------------------------------
   Each returns a 0–1 ratio plus the sentence that explains it. Keeping the
   ratio separate from the weight is what lets governance re-tune weights
   without touching the detection logic. */

type Scored = { ratio: number; rationale: string; impact: ScoreFactor['impact'] };

function scoreAcademic(s: Student): Scored {
  const gpa = s.academic.gpa;

  // A student with no assessment yet is not failing one. Scoring an ungraded
  // freshman as 0 would drop every new enrolment into "Crítico" on week three
  // and bury the real evasion risks under false alarms — so the dimension is
  // held neutral and says so, and the onboarding track carries the follow-up.
  if (gpa <= 0) {
    const pending = Math.min(s.academic.lateAssignments, 5) * 0.05;
    return {
      ratio: clamp(0.6 - pending, 0, 1),
      rationale:
        'sem nota lançada no período — avaliação pendente' +
        (s.academic.lateAssignments > 0
          ? ` · ${s.academic.lateAssignments} atividade(s) em atraso`
          : ''),
      impact: s.academic.lateAssignments > 0 ? 'negative' : 'neutral',
    };
  }

  // 10 → 1.0, 6.0 (passing) → 0.55, 0 → 0. Penalise dependencies and backlog.
  let ratio = clamp(gpa / 10, 0, 1);
  ratio -= s.academic.dependencies * 0.08;
  ratio -= Math.min(s.academic.lateAssignments, 5) * 0.03;
  ratio -= s.academic.failingSubjects * 0.07;
  ratio = clamp(ratio, 0, 1);

  const notes: string[] = [`média ${gpa.toFixed(1).replace('.', ',')}`];
  if (s.academic.failingSubjects > 0) notes.push(`${s.academic.failingSubjects} disciplina(s) abaixo de 5,0`);
  if (s.academic.dependencies > 0) notes.push(`${s.academic.dependencies} dependência(s)`);
  if (s.academic.lateAssignments > 0) notes.push(`${s.academic.lateAssignments} atividade(s) em atraso`);

  return {
    ratio,
    rationale: notes.join(' · '),
    impact: ratio >= 0.72 ? 'positive' : ratio >= 0.5 ? 'neutral' : 'negative',
  };
}

function scoreAttendance(s: Student): Scored {
  const attendance = s.academic.attendancePercent;
  // 75% is the regimental floor, so it must not read as "fine" — map it to 0.5.
  const ratio = clamp(attendance >= 75 ? 0.5 + ((attendance - 75) / 25) * 0.5 : (attendance / 75) * 0.5, 0, 1);
  const drop = s.academic.attendancePrevPercent - attendance;
  const notes = [`${Math.round(attendance)}% de presença`];
  if (drop >= 5) notes.push(`queda de ${Math.round(drop)} p.p. no ciclo`);
  if (attendance < 75) notes.push('abaixo do mínimo regimental');

  return {
    ratio,
    rationale: notes.join(' · '),
    impact: attendance >= 85 ? 'positive' : attendance >= 75 ? 'neutral' : 'negative',
  };
}

function scoreEngagement(s: Student): Scored {
  const e = s.engagement;
  // Three independent components: recency, volume and delivery.
  const recency = clamp(1 - e.lastAccessDaysAgo / 14, 0, 1);
  // Healthy is roughly one access per day; 28 in 30 days is the ceiling.
  const volume = clamp(e.accessesLast30Days / 28, 0, 1);
  const delivery = clamp(e.deliveryRate / 100, 0, 1);
  let ratio = recency * 0.35 + volume * 0.3 + delivery * 0.35;

  // A steep fall matters even when the absolute level still looks acceptable —
  // the "Radar de Mudança" logic folded into the score. The penalty is
  // proportional rather than stepped so the score always moves in the same
  // direction as the radar that is firing on this exact signal.
  const drop = accessDropPercent(s);
  if (drop >= 20) ratio -= Math.min(0.3, (drop / 100) * 0.6);
  ratio = clamp(ratio, 0, 1);

  const notes = [
    e.lastAccessDaysAgo === 0 ? 'acesso hoje' : `último acesso há ${e.lastAccessDaysAgo} d`,
    `${e.accessesLast30Days} acessos/30d`,
    `${Math.round(e.deliveryRate)}% de entregas`,
  ];
  if (drop >= 25) notes.push(`queda de ${drop}% vs. ciclo anterior`);

  return {
    ratio,
    rationale: notes.join(' · '),
    impact: ratio >= 0.72 ? 'positive' : ratio >= 0.5 ? 'neutral' : 'negative',
  };
}

function scoreFinancial(s: Student): Scored {
  const f = s.financial;
  let ratio: number;
  let note: string;

  if (f.situation === 'Bolsista integral') {
    ratio = 1;
    note = 'bolsa integral — sem pendência';
  } else if (f.overdueCount === 0 && f.daysOverdue === 0) {
    ratio = 1;
    note = 'mensalidades em dia';
  } else if (f.hasNegotiation) {
    // An active agreement is a resolution in progress, not a default.
    ratio = 0.68;
    note = `negociação ativa · ${f.overdueCount} parcela(s) repactuada(s)`;
  } else {
    ratio = clamp(1 - f.overdueCount * 0.3 - Math.min(f.daysOverdue, 60) / 120, 0, 1);
    note = `${f.overdueCount} parcela(s) em aberto há ${f.daysOverdue} d`;
  }

  return {
    ratio,
    rationale: note,
    impact: ratio >= 0.9 ? 'positive' : ratio >= 0.6 ? 'neutral' : 'negative',
  };
}

function scoreRelationship(s: Student, resolvedContacts: number, openComplaints: number): Scored {
  // Baseline is healthy; resolved contacts add trust, open complaints erode it.
  let ratio = 0.72 + clamp(resolvedContacts, 0, 3) * 0.09 - openComplaints * 0.22;
  if (s.engagement.appInstalled) ratio += 0.05;
  ratio = clamp(ratio, 0, 1);

  const notes: string[] = [];
  notes.push(resolvedContacts > 0 ? `${resolvedContacts} atendimento(s) resolvido(s)` : 'sem histórico recente de atendimento');
  if (openComplaints > 0) notes.push(`${openComplaints} pendência(s) de experiência em aberto`);

  return {
    ratio,
    rationale: notes.join(' · '),
    impact: ratio >= 0.8 ? 'positive' : ratio >= 0.55 ? 'neutral' : 'negative',
  };
}

/* -- Classification ------------------------------------------------------- */

export function classify(score: number): HealthStatus {
  if (score >= 81) return 'Estável';
  if (score >= 61) return 'Atenção';
  if (score >= 41) return 'Risco';
  return 'Crítico';
}

/**
 * The distribution ramp: green → yellow → orange → red.
 *
 * This is the one deliberate exception to the monochrome rule, and it is
 * confined to the distribution chart and its legend. A pie of four bands has to
 * be read as an ordered scale at a glance from across a desk, and the universal
 * traffic-light ramp does that with no legend lookup. Everywhere else — table
 * rows, badges, meters — status stays a dot plus a word, because there the
 * colour would repeat forty times per screen instead of four.
 */
export const SCORE_BANDS: {
  status: HealthStatus;
  label: string;
  range: [number, number];
  token: string;
  hex: (dark: boolean) => string;
}[] = [
  {
    status: 'Estável',
    label: 'Estável',
    range: [81, 100],
    token: 'ok',
    hex: (d) => (d ? '#3fb96b' : '#15803d'),
  },
  {
    status: 'Atenção',
    label: 'Atenção',
    range: [61, 80],
    token: 'warn',
    hex: (d) => (d ? '#e0b341' : '#ca8a04'),
  },
  {
    status: 'Risco',
    label: 'Risco',
    range: [41, 60],
    token: 'risk',
    hex: (d) => (d ? '#f0844a' : '#ea580c'),
  },
  {
    status: 'Crítico',
    label: 'Crítico',
    range: [0, 40],
    token: 'crit',
    hex: (d) => (d ? '#e0554b' : '#b42318'),
  },
];

/* -- Public API ----------------------------------------------------------- */

export interface ScoreContext {
  /** Interactions closed as resolved for this student. */
  resolvedContacts: number;
  /** Experience alerts still awaiting a verdict. */
  openComplaints: number;
  weights: Record<Modality, WeightProfile>;
}

/**
 * Computes the full, explainable score. `weights` come from governance so a
 * coordinator retuning a profile immediately re-ranks the whole base.
 */
export function computeScore(student: Student, ctx: ScoreContext): ScoreResult {
  const profile = ctx.weights[student.modality] ?? DEFAULT_WEIGHTS[student.modality];

  const scored: Record<ScoreDimension, Scored> = {
    academico: scoreAcademic(student),
    presenca: scoreAttendance(student),
    engajamento: scoreEngagement(student),
    financeiro: scoreFinancial(student),
    relacionamento: scoreRelationship(student, ctx.resolvedContacts, ctx.openComplaints),
  };

  const factors: ScoreFactor[] = (Object.keys(profile) as ScoreDimension[]).map((dimension) => {
    const weight = profile[dimension];
    const s = scored[dimension];
    return {
      dimension,
      label: DIMENSION_LABEL[dimension],
      earned: Math.round(s.ratio * weight),
      weight,
      impact: s.impact,
      rationale: s.rationale,
    };
  });

  const total = clamp(
    factors.reduce((sum, f) => sum + f.earned, 0),
    0,
    100,
  );

  return {
    total,
    status: classify(total),
    factors,
    profileLabel: PROFILE_LABEL[student.modality],
  };
}

/** Builds the score context for one student from the app's interaction log. */
export function scoreContextFor(
  student: Student,
  interactions: { studentId: string; outcome: string }[],
  weights: Record<Modality, WeightProfile>,
): ScoreContext {
  return {
    resolvedContacts: interactions.filter(
      (i) => i.studentId === student.id && (i.outcome === 'Resolvido' || i.outcome === 'Parcialmente resolvido'),
    ).length,
    openComplaints: student.alerts.filter((a) => a.radar === 'atendimento' && a.review === 'pendente')
      .length,
    weights,
  };
}

/**
 * Recomputes `healthScore`, `status` and `trend` for a student, returning a new
 * object. The previous score is used to derive the trend, which is why the
 * caller must pass the student *before* mutation.
 */
export function withRecomputedScore(
  student: Student,
  ctx: ScoreContext,
  previousScore = student.healthScore,
): Student {
  const result = computeScore(student, ctx);
  const delta = result.total - previousScore;
  return {
    ...student,
    healthScore: result.total,
    status: result.status,
    trend: delta > 1 ? 'up' : delta < -1 ? 'down' : 'flat',
    scoreDelta30d: student.scoreDelta30d + delta,
  };
}

/** The distribution used by the cockpit donut. */
export function scoreDistribution(students: Student[]) {
  return SCORE_BANDS.map((band) => {
    const count = students.filter(
      (s) => s.healthScore >= band.range[0] && s.healthScore <= band.range[1],
    ).length;
    return {
      ...band,
      count,
      percent: students.length > 0 ? (count / students.length) * 100 : 0,
    };
  });
}
