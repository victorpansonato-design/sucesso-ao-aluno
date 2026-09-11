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
  /**
   * Turma do aluno dentro da oferta. É o que resolve as linhas de calendário
   * que imprimem dois dias para uma prova ("21 e 22/08"): o PDF cobre duas
   * turmas, o aluno pertence a uma. Opcional porque a integração que traz esse
   * dado não existe para toda oferta — e onde ele falta, a trilha diz que não
   * sabe em vez de escolher uma das duas datas.
   */
  turma?: string;
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

/* ==========================================================================
   Gestão de PUSH — calendário acadêmico, réguas e disparos
   --------------------------------------------------------------------------
   O aplicativo Grupo Anchieta é o único canal que chega ao aluno sem depender
   de ele abrir alguma coisa. Duas famílias de mensagem passam por ele e não
   devem ser confundidas:

     · A RÉGUA (PushRule) é calendário. Nasce de um evento do calendário
       acadêmico do curso e vale para todo mundo daquele calendário. É previsível,
       é institucional e é o que evita o "ninguém me avisou" de segunda-feira.
     · O PERSONALIZADO (PushTemplate) é diagnóstico. Nasce dos parâmetros do
       aluno — Health Score, dias sem acesso, frequência, situação financeira —
       e só dispara para quem bate na condição.

   As duas terminam no mesmo lugar: PushDispatch, que é o histórico que o
   atendente lê antes de ligar para o aluno.
   ========================================================================== */

/** Quem recebe. "Ingressante" é a coorte Calouro sob a régua de 90 dias. */
export type PushAudience = 'Ingressante' | 'Veterano' | 'Ambos';

/**
 * A natureza do aviso. Não é decoração: a categoria decide a antecedência do
 * disparo, o horário e o tom do texto — uma prova avisa três dias antes às 9h,
 * um feriado avisa na véspera às 17h.
 */
export type PushCategory =
  | 'aula'
  | 'prova'
  | 'prazo'
  | 'evento'
  | 'feriado'
  | 'programa'
  | 'financeiro'
  | 'engajamento'
  | 'acolhimento';

/**
 * Quanto o evento importa para o aluno — e, por consequência, se ele vira
 * push. "baixa" é o que só interessa a monitores e à secretaria: fica
 * registrado no calendário digitalizado e não gera aviso.
 */
export type EventRelevance = 'alta' | 'media' | 'baixa';

export interface CalendarEvent {
  id: string;
  /** O rótulo exatamente como impresso no PDF: "13, 14, 27 e 28/11". */
  dateLabel: string;
  /** Datas resolvidas em ISO, na ordem em que aparecem no rótulo. */
  dates: string[];
  /** Primeira e última data — o que a régua usa para calcular D-3, D-1, D-0. */
  start: string;
  end: string;
  title: string;
  /** Linhas complementares impressas abaixo do título (local, horário, notas). */
  detail?: string;
  category: PushCategory;
  relevance: EventRelevance;
  /** Divergência encontrada no PDF de origem, preservada para conferência. */
  note?: string;
}

/**
 * Um dos PDFs publicados pela instituição. É o DOCUMENTO, não a oferta:
 * o mesmo calendário de quinzenais veteranos serve seis cursos diferentes.
 */
export interface AcademicCalendar {
  id: string;
  /** Título exatamente como impresso no cabeçalho do PDF. */
  name: string;
  /** Rótulo curto para chips, filtros e cabeçalhos de coluna. */
  shortName: string;
  modality: Modality;
  semester: string;
  /**
   * Início das aulas deste documento, em ISO. DECLARADO, não inferido.
   *
   * É a âncora de que a trilha precisa para saber quantos dias separam a
   * matrícula do primeiro dia de aula — a variável que decide o que faz
   * sentido mostrar a cada aluno. Deduzir por busca de texto não serve: só
   * dois dos onze PDFs escrevem «Início das aulas»; os híbridos escrevem
   * «Início, no AVA, da disciplina digital» e o EAD «Início das Disciplinas
   * Digitais Regulares». Uma expressão regular acertaria a maioria e erraria
   * em silêncio no resto, que é o pior modo de falha para uma data.
   */
  classesStart: string;
  /** Ritmo de encontros, que é o que separa dois calendários do mesmo curso. */
  rhythm: 'Diário' | 'Semanal' | 'Quinzenal' | 'A distância';
  /** Nome do arquivo no S3 da instituição, para rastrear de onde veio a linha. */
  source: string;
  /** Endereço público do PDF, para abrir o original ao lado da transcrição. */
  url: string;
  events: CalendarEvent[];
}

/** Os três blocos em que o site organiza os calendários. */
export type CalendarGroup = 'presencial' | 'hibrido' | 'ead';

/**
 * Uma linha da página de calendários do site: curso × público × PDF.
 *
 * O site não lista nove calendários; lista trinta e três combinações, e é assim
 * que a coordenação fala ("o calendário de Fonoaudiologia veterano"). Vários
 * apontam para o mesmo arquivo, e mesmo assim cada um existe por conta própria:
 * quando a instituição desmembrar um deles no semestre que vem, a mudança cai
 * numa linha só, sem ninguém ter de descobrir quais cursos estavam escondidos
 * dentro de um PDF compartilhado.
 */
export interface CalendarEntry {
  id: string;
  group: CalendarGroup;
  /** Rótulo do bloco, exatamente como escrito no site. */
  groupLabel: string;
  /** Nome do curso, exatamente como escrito no site. */
  course: string;
  audience: PushAudience;
  /** Rótulo do link no site: "Veteranos", "Ingressantes de janeiro à…". */
  audienceLabel: string;
  calendarId: string;
  /**
   * Vale para qualquer aluno da modalidade que não tenha entrada própria.
   * O site publica um único calendário para todos os presenciais diurnos e
   * noturnos, sem listar curso por curso, e é isto que representa esse caso.
   */
  catchAll?: boolean;
}

/**
 * Um aviso agendado da régua. `offset` guarda a distância em dias do evento
 * (negativo = antes), porque é isso que precisa ser recalculado quando alguém
 * corrige a data de um evento no calendário.
 */
export interface PushRule {
  id: string;
  calendarId: string;
  eventId: string;
  title: string;
  body: string;
  /** Data do disparo, ISO. */
  sendDate: string;
  /** Horário do disparo, HH:mm. */
  sendTime: string;
  offset: number;
  /** "3 dias antes", "na véspera", "no dia" — o que a tela mostra. */
  offsetLabel: string;
  category: PushCategory;
  audience: PushAudience;
  enabled: boolean;
}

/** Uma edição manual feita no lápis. Guardada à parte da régua gerada. */
export interface PushRuleOverride {
  title?: string;
  body?: string;
  sendDate?: string;
  sendTime?: string;
  enabled?: boolean;
}

/** Uma correção manual feita numa linha do calendário digitalizado. */
export interface CalendarEventOverride {
  dateLabel?: string;
  title?: string;
  detail?: string;
  relevance?: EventRelevance;
  category?: PushCategory;
}

/** Push personalizado: dispara pelos parâmetros do aluno, não pela data. */
export interface PushTemplate {
  id: string;
  /** Código curto usado na conversa da equipe: "ACD-02". */
  code: string;
  name: string;
  category: PushCategory;
  audience: PushAudience;
  /** A condição em português, do jeito que a operação fala. */
  trigger: string;
  title: string;
  body: string;
  /** Quantos dias esperar antes de repetir para o mesmo aluno. */
  cooldownDays: number;
  active: boolean;
}

export type PushStatus = 'Agendado' | 'Enviado' | 'Aberto' | 'Não entregue';

export interface PushDispatch {
  id: string;
  studentId: string;
  origin: 'regua' | 'personalizado';
  /** Ids de origem — um dos dois, conforme `origin`. */
  ruleId?: string;
  templateId?: string;
  calendarId?: string;
  title: string;
  body: string;
  category: PushCategory;
  /** ISO completo, com horário. */
  sentAt: string;
  status: PushStatus;
}

/* ==========================================================================
   Trilha do Aluno — a linha do tempo pessoal e a trilha de entrada
   --------------------------------------------------------------------------
   O calendário oficial responde «o que acontece no semestre». O aluno pergunta
   «o que acontece comigo». São perguntas diferentes, e a segunda não se
   responde apagando linhas da primeira.

   O QUE ESTA SEÇÃO MODELA, E POR QUE É UM MODELO E NÃO UMA TELA
   `TrilhaModel` é DADO. A partir dele saem três renderizações — a tela do
   aparelho, a página imprimível e a régua de push — e nenhuma delas escreve
   texto próprio. É a mesma disciplina que `lib/push.ts` já declara para a
   régua: derivar de uma fonte, nunca redigir em paralelo. Duas renderizações
   escritas à mão divergem, e o dia em que divergirem é o dia em que a citação
   do PDF deixa de valer.

   TRADUZIR, NÃO SUBTRAIR
   O valor não está em esconder linhas, está em resolver as que existem. O PDF
   diz «Segundo encontro presencial da 1ª disciplina – Prova 2». O aluno precisa
   de «Prova 2 de Gestão de Pessoas, sábado 22/08, 19h30». Por isso todo
   `TimelineItem` carrega o texto oficial ao lado do traduzido: o nosso está EM
   CIMA do oficial, nunca EM VEZ do oficial.

   O CONTADOR É O MECANISMO DE HONESTIDADE
   `shownCount` e `totalCount` existem para que a tela possa dizer «você está
   vendo 8 das 51 datas do seu curso». Um aluno que leu isso e não abriu o resto
   fez uma escolha informada. Um aluno que viu 8 sem saber que havia 51 foi
   induzido — e é essa diferença que separa priorizar de omitir.
   ========================================================================== */

/**
 * Distância entre a matrícula e o primeiro dia de aula, em faixas.
 *
 * Não é enfeite: é a variável que mais muda o conteúdo. Não faz sentido falar
 * de prazo de Atividades Complementares de dezembro para quem começa em
 * quatro meses, nem abrir a trilha completa de doze passos para quem começa na
 * semana que vem.
 */
export type TrilhaBand =
  /** Δ maior que 60. O calendário do semestre dele provavelmente não existe ainda. */
  | 'antecipada'
  /** Δ de 15 a 60. Cabe a trilha inteira e o primeiro mês de datas. */
  | 'confortavel'
  /** Δ de 3 a 14. Só o que tem de acontecer antes do primeiro dia. */
  | 'vespera'
  /** Δ menor que 3, incluindo negativo. As aulas começaram, ou começam agora. */
  | 'em-curso';

/**
 * Quanto o aluno perde se não souber.
 *
 * `irrecuperavel` é a única faixa que nenhuma configuração recolhe. Ela não
 * mede interesse, mede dano: prazo que fecha, prova que não se repete, janela
 * de 48 horas que expira. Ver `IRRECUPERAVEL` em `lib/trilha.ts`.
 */
export type Consequence = 'irrecuperavel' | 'alta' | 'media' | 'baixa';

/** Como o calendário deste aluno foi encontrado — e se foi. */
export type CalendarMatch =
  /** O site publica a linha exata deste curso para esta coorte. */
  | 'exata'
  /**
   * O site publica este curso, mas só para a outra coorte. O ritmo de encontros
   * é propriedade do curso, não da coorte, então o documento serve — com aviso.
   * Melhor que o vazio, e honesto sobre o que é.
   */
  | 'outra-coorte'
  /** O site não publica calendário para este curso. Nada a inventar. */
  | 'nenhuma';

export interface CalendarResolution {
  calendar?: AcademicCalendar;
  entry?: CalendarEntry;
  match: CalendarMatch;
  /** Por que a resolução é esta, em português, para aparecer na tela. */
  note?: string;
}

/**
 * As duas distâncias, que não são a mesma coisa e foram confundidas uma vez.
 *
 * `delta` é HISTÓRICO: quantos dias o aluno teve de folga entre assinar a
 * matrícula e o primeiro dia de aula. É a variável que decide quanta trilha
 * cabia — quem teve 90 dias pôde resolver tudo com calma, quem teve 5 chegou
 * correndo — e é o que a operação configura.
 *
 * `daysToClasses` é PRESENTE: quantos dias faltam, de hoje, para o primeiro
 * dia. É o que decide o que é acionável agora.
 *
 * A faixa sai do PRESENTE, não do histórico. Medir a faixa pelo histórico
 * colocava um veterano de quarto módulo em «matrícula antecipada», porque ele
 * se matriculou 662 dias antes deste semestre — verdade aritmética e absurdo
 * operacional.
 */
export interface DeltaInfo {
  /** Data da matrícula, ISO. */
  enrolledAt: string;
  /** Início das aulas do calendário aplicável, ISO. */
  classesStart: string;
  /** Matrícula → início das aulas. Negativo = matriculou-se com o semestre andando. */
  delta: number;
  /** Hoje → início das aulas. Negativo = as aulas já começaram. */
  daysToClasses: number;
  /**
   * Se `delta` diz algo sobre este aluno. Falso para veterano: a distância
   * entre a matrícula dele e o início DESTE semestre é um número sem sentido,
   * e a tela mostra o semestre de ingresso no lugar.
   */
  relevant: boolean;
  band: TrilhaBand;
  /** True quando a faixa vem do simulador da tela, não do dado do aluno. */
  simulated: boolean;
}

/**
 * Uma data da linha do tempo pessoal.
 *
 * Carrega as duas versões de propósito: `title` e `lines` é o que o aluno lê,
 * `officialTitle` e `officialDetail` é o que está impresso no PDF. Quando as
 * duas divergirem, a tela mostra as duas e o PDF ganha.
 */
export interface TimelineItem {
  id: string;
  eventId: string;
  /** Datas resolvidas do evento, ISO, na ordem do rótulo. */
  dates: string[];
  start: string;
  end: string;
  /** O rótulo exatamente como impresso: «13, 14, 27 e 28/11». */
  dateLabel: string;
  /** Título traduzido para a língua do aluno. */
  title: string;
  /** Contexto resolvido: horário do turno, local, disciplina, regra de falta. */
  lines: string[];
  consequence: Consequence;
  category: PushCategory;
  /** Texto oficial, literal. A citação que mantém o respaldo de pé. */
  officialTitle: string;
  officialDetail?: string;
  /** Divergência encontrada no PDF de origem, preservada da transcrição. */
  officialNote?: string;
  /** Nome curto e endereço do PDF, para abrir o original. */
  sourceName: string;
  sourceUrl: string;
  /**
   * True quando a linha imprime mais de um dia para um evento único e não
   * sabemos a turma do aluno. A tela diz que não sabe; nunca escolhe um dia.
   */
  ambiguousDay: boolean;
  /** Dias de hoje até `start`. Negativo = já passou. */
  inDays: number;
  /** Onde o item cai no recorte. */
  bucket: TrilhaBucket;
  /** Atalho para `bucket === 'agora' || bucket === 'guardado'`. */
  shown: boolean;
  /** Por que ficou fora do recorte. Texto curto, para a tela do completo. */
  hiddenReason?: string;
}

/**
 * Onde um item cai no recorte pessoal.
 *
 * `guardado` é o que resolve a tensão entre «nunca omitir o irrecuperável» e
 * «não encher a tela de dezembro em setembro»: o prazo de Atividades
 * Complementares de 07/12 não pode ser escondido de ninguém, mas também não é
 * uma «próxima data» em setembro. Ele fica numa faixa própria, sempre presente,
 * fora da fila cronológica.
 *
 * `recolhido` continua contado em `totalCount` e alcançável na tela do
 * calendário completo. Recolher não é apagar — é a diferença inteira entre
 * priorizar e omitir.
 */
export type TrilhaBucket =
  /** Entra na fila das próximas datas. */
  | 'agora'
  /** Irrecuperável fora da janela: faixa própria, sempre visível. */
  | 'guardado'
  /** Já aconteceu. Só aparece na tela do completo, ou na janela das 48 horas. */
  | 'passado'
  /** Fora do recorte por consequência baixa ou por configuração. */
  | 'recolhido';

/** Onde o aluno resolve um passo da trilha de entrada. */
export type StepPlace = 'portal' | 'app' | 'ava' | 'secretaria' | 'campus' | 'financeiro';

export interface TrilhaStep {
  id: string;
  title: string;
  /** O que o aluno faz, em imperativo curto. */
  action: string;
  place: StepPlace;
  /** Em que faixas este passo aparece. Vazio = todas. */
  bands: TrilhaBand[];
  /** Modalidades a que se aplica. Vazio = todas. */
  modalities: Modality[];
  /** Bloqueante trava o primeiro dia de aula se não for feito. */
  blocking: boolean;
  /** Marcado como concluído pelos sinais que o sistema já tem. */
  done: boolean;
  /** De onde veio o «done», para que a tela não minta sobre o que sabe. */
  evidence?: string;
}

/**
 * O artefato completo de um aluno. Uma fonte, três renderizações.
 */
export interface TrilhaModel {
  student: Student;
  resolution: CalendarResolution;
  delta: DeltaInfo;
  /** A trilha de entrada, já filtrada pela faixa e pela modalidade. */
  steps: TrilhaStep[];
  /** Tudo do calendário, traduzido. `shown` decide o que entra no recorte. */
  items: TimelineItem[];
  /** Quantos itens o recorte mostra e quantos o calendário tem. O contador. */
  shownCount: number;
  totalCount: number;
  /** A próxima data relevante, para o ícone e para a primeira dobra. */
  next?: TimelineItem;
  /** Data de referência do cálculo, ISO. */
  today: string;
}

/**
 * O que a operação pode ajustar sem tocar em código.
 *
 * Deliberadamente pequeno. A classificação de consequência já mora nos
 * overrides de evento da Gestão de PUSH (`CalendarEventOverride.relevance`) e
 * não é duplicada aqui — duas telas mandando na mesma classificação é o começo
 * de uma divergência silenciosa.
 */
export interface TrilhaConfig {
  /** Passos da trilha de entrada, na ordem em que o aluno os cumpre. */
  steps: TrilhaStep[];
  /**
   * Categorias que o recorte pessoal recolhe quando não são irrecuperáveis.
   * Recolher não é apagar: o item continua no calendário completo, contado.
   */
  collapsed: PushCategory[];
  /** Quantos dias à frente o recorte olha, por faixa. */
  horizonDays: Record<TrilhaBand, number>;
}
