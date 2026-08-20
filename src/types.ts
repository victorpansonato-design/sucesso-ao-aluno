/* ==========================================================================
   Domain model — Centro de Sucesso ao Aluno
   --------------------------------------------------------------------------
   Single source of truth for every shape in the app. Nothing is optional
   unless the operation genuinely allows it to be missing.
   ========================================================================== */

/* -- Enrolment ------------------------------------------------------------ */

/**
 * The three delivery models, each with its own risk physics and score weights.
 * Only the ones in `MODALITIES` (data/catalog.ts) are offered in a given cycle —
 * EaD is not being delivered right now, so it appears in no filter, tab or form,
 * but its weight profile stays in the engine rather than being deleted and
 * re-derived when the offer returns.
 */
export type Modality = 'Presencial' | 'Híbrido' | 'EaD';

export type Shift = 'Matutino' | 'Vespertino' | 'Noturno' | 'Integral';

/**
 * The 90-day rule. Students inside the onboarding window belong to a distinct
 * welcome track and are deliberately excluded from the evasion queue so they
 * do not pollute retention metrics or steal SLA from veterans in real risk.
 */
export type Cohort = 'Calouro' | 'Veterano';

export type CourseArea = 'Negócios' | 'Saúde' | 'Tecnologia' | 'Direito' | 'Humanas' | 'Exatas';

/* -- Classification ------------------------------------------------------- */

export type HealthStatus = 'Estável' | 'Atenção' | 'Risco' | 'Crítico';
export type Trend = 'up' | 'down' | 'flat';

/** The five intelligence radars. */
export type RadarKey = 'evasao' | 'academico' | 'engajamento' | 'financeiro' | 'atendimento';

export type Priority = 'Crítico' | 'Alto' | 'Médio' | 'Baixo';

/** Which dimension of the student's life a score factor measures. */
export type ScoreDimension =
  | 'academico'
  | 'presenca'
  | 'engajamento'
  | 'financeiro'
  | 'relacionamento';

/* -- Case workflow -------------------------------------------------------- */

/**
 * Strict state machine. Legal transitions live in `lib/caseFlow.ts` — the UI
 * only ever offers a button for a transition the machine actually permits.
 */
export type CaseStatus =
  | 'Pendente'
  | 'Em Contato'
  | 'Aguardando Retorno'
  | 'Encaminhado'
  | 'Acordo Firmado'
  | 'Evasão Inevitável'
  | 'Cancelado';

export type Specialty =
  | 'Retenção'
  | 'Acadêmico'
  | 'Financeiro'
  | 'Engajamento'
  | 'Onboarding'
  | 'Experiência';

export type Channel = 'WhatsApp' | 'Telefone' | 'Presencial' | 'E-mail' | 'Portal';

export type InteractionKind =
  | 'Acolhimento'
  | 'Orientação Pedagógica'
  | 'Negociação Financeira'
  | 'Suporte AVA'
  | 'Retenção'
  | 'Follow-up';

export type InteractionOutcome =
  | 'Resolvido'
  | 'Parcialmente resolvido'
  | 'Aguardando aluno'
  | 'Encaminhado'
  | 'Sem contato'
  | 'Recusou atendimento';

/** Copilot approach angles required by the operating spec. */
export type ApproachAngle = 'pedagogica' | 'financeira' | 'carreira';

/* -- Student sub-records -------------------------------------------------- */

export interface Discipline {
  id: string;
  code: string;
  name: string;
  teacher: string;
  format: 'Presencial' | 'Digital' | 'Híbrida';
  /** Partial grade for the current assessment cycle (0–10). */
  grade: number;
  attendancePercent: number;
  absences: number;
  absenceLimit: number;
  pendingActivities: number;
  schedule: string;
  status: 'Em curso' | 'Em risco' | 'Dependência' | 'Aprovado';
}

export interface FinancialRecord {
  situation:
    | 'Regular'
    | '1 parcela em atraso'
    | '2+ parcelas em atraso'
    | 'Negociação em andamento'
    | 'Bolsista integral';
  monthlyFee: number;
  dueDay: number;
  outstanding: number;
  overdueCount: number;
  /** Days past due on the oldest open instalment. Drives the preventive radar. */
  daysOverdue: number;
  lastPayment: string;
  hasNegotiation: boolean;
  scholarshipPercent: number;
  /** True when the debt is still inside the institution's preventive window. */
  insidePreventiveWindow: boolean;
}

export interface EngagementRecord {
  lastAccessDaysAgo: number;
  accessesLast30Days: number;
  /** Same window, previous period — this is what makes "queda de X%" real. */
  accessesPrev30Days: number;
  weeklyHours: number;
  deliveryRate: number;
  forumInteractions: number;
  /** 8 weeks of AVA sessions, oldest first. Feeds the sparkline. */
  accessTrend: number[];
  appInstalled: boolean;
  visitedCancellationPage: boolean;
}

export interface JourneyRecord {
  progressPercent: number;
  completionForecast: string;
  admissionSemester: string;
  /** Days since enrolment — the 90-day rule reads this. */
  daysSinceEnrollment: number;
  moduleName: string;
  /** Onboarding checkpoints, only meaningful while `cohort === 'Calouro'`. */
  onboardingSteps: { label: string; done: boolean }[];
}

export interface TimelineEvent {
  id: string;
  at: string;
  kind:
    | 'matricula'
    | 'academico'
    | 'financeiro'
    | 'engajamento'
    | 'atendimento'
    | 'alerta'
    | 'intervencao'
    | 'marco';
  title: string;
  detail: string;
  author: 'Sistema' | 'Radar' | 'Copiloto' | 'Especialista' | 'Secretaria' | 'Docente' | 'Aluno';
  tag?: string;
}

export interface RadarAlert {
  id: string;
  radar: RadarKey;
  severity: 'Atenção' | 'Risco' | 'Crítico';
  title: string;
  detail: string;
  detectedAt: string;
  signals: string[];
  suggestedAction: string;
  /** Human verdict on the alert — this is the calibration feedback loop. */
  review: 'pendente' | 'confirmado' | 'descartado';
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface Interaction {
  id: string;
  studentId: string;
  caseId?: string;
  channel: Channel;
  kind: InteractionKind;
  outcome: InteractionOutcome;
  /** Registro mínimo: Causa → Intervenção → Resultado → Próximo passo. */
  cause: string;
  intervention: string;
  result: string;
  nextStep: string;
  nextStepDate?: string;
  specialistId: string;
  specialistName: string;
  at: string;
  timestamp: number;
  scoreDelta: number;
}

export interface FollowUp {
  id: string;
  studentId: string;
  caseId?: string;
  title: string;
  dueDate: string;
  notes: string;
  ownerId: string;
  ownerName: string;
  status: 'Agendado' | 'Concluído' | 'Cancelado';
  createdAt: string;
}

export interface Student {
  id: string;
  ra: string;
  cpfMasked: string;
  name: string;
  email: string;
  phone: string;
  initials: string;
  course: string;
  courseArea: CourseArea;
  modality: Modality;
  campus: string;
  period: number;
  totalPeriods: number;
  shift: Shift;
  cohort: Cohort;
  /** Derived from the score engine on every mutation — never hand-written. */
  healthScore: number;
  status: HealthStatus;
  trend: Trend;
  scoreDelta30d: number;
  academic: {
    gpa: number;
    attendancePercent: number;
    /** Same metric one cycle earlier, so "queda de frequência" is measurable. */
    attendancePrevPercent: number;
    subjects: number;
    dependencies: number;
    lateAssignments: number;
    failingSubjects: number;
    disciplines: Discipline[];
  };
  financial: FinancialRecord;
  engagement: EngagementRecord;
  journey: JourneyRecord;
  alerts: RadarAlert[];
  timeline: TimelineEvent[];
}

/* -- Case ---------------------------------------------------------------- */

export interface CaseNote {
  id: string;
  author: string;
  text: string;
  at: string;
}

/**
 * The Freio Concorrente. When a human takes a case, competing automated
 * rulers are suspended so the student never receives a dunning e-mail in the
 * middle of a retention conversation.
 */
export interface CommunicationHold {
  active: boolean;
  activatedBy: string;
  activatedAt: string;
  suppressed: string[];
  blockedCount: number;
}

export interface Case {
  id: string;
  protocol: string;
  studentId: string;
  title: string;
  radar: RadarKey;
  signals: string[];
  priority: Priority;
  status: CaseStatus;
  specialty: Specialty;
  assigneeId: string | null;
  /** ISO timestamps — SLA is computed live, never stored as prose. */
  openedAt: string;
  slaDueAt: string;
  slaHours: number;
  closedAt?: string;
  firstContactAt?: string;
  /** Recorded on close, this is what teaches the radars. */
  closingReason?: string;
  diagnosis: string;
  recommendedAction: string;
  hold: CommunicationHold;
  notes: CaseNote[];
  history: { id: string; from: CaseStatus | null; to: CaseStatus; at: string; by: string }[];
  reopenCount: number;
}

/* -- Team ---------------------------------------------------------------- */

export interface Specialist {
  id: string;
  name: string;
  initials: string;
  role: string;
  email: string;
  modality: Modality | 'Todas';
  specialty: Specialty;
  capacity: number;
  resolvedThisCycle: number;
  avgResponseHours: number;
  slaAdherence: number;
  csat: number;
  presence: 'Disponível' | 'Em atendimento' | 'Ausente';
}

/* -- Notifications & toasts --------------------------------------------- */

export type NotificationKind = 'critico' | 'sla' | 'atribuicao' | 'resposta' | 'followup' | 'sucesso';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  at: string;
  read: boolean;
  studentId?: string;
  caseId?: string;
}

export type ToastKind = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  detail: string;
  action?: { label: string; run: () => void };
}

/* -- Governance settings ------------------------------------------------- */

/** Editable score weights per modality. Editing these recomputes every score. */
export type WeightProfile = Record<ScoreDimension, number>;

export interface GovernanceSettings {
  slaHours: Record<RadarKey, number>;
  weights: Record<Modality, WeightProfile>;
  /** Days a student stays inside the onboarding track. */
  onboardingWindowDays: number;
  /** Auto-engage the Freio Concorrente the moment a case is claimed. */
  humanFirst: boolean;
  /** Mask CPF and log every read of sensitive data. */
  lgpdStrict: boolean;
  /** Exclude the onboarding cohort from the evasion queue and its metrics. */
  segregateOnboarding: boolean;
  businessHours: { start: number; end: number; saturdayEnd: number };
}

/* -- Computed score ------------------------------------------------------ */

export interface ScoreFactor {
  dimension: ScoreDimension;
  label: string;
  earned: number;
  weight: number;
  impact: 'positive' | 'neutral' | 'negative';
  rationale: string;
}

export interface ScoreResult {
  total: number;
  status: HealthStatus;
  factors: ScoreFactor[];
  profileLabel: string;
}
