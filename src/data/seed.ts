import type {
  Case,
  Discipline,
  EngagementRecord,
  FinancialRecord,
  FollowUp,
  GovernanceSettings,
  Interaction,
  AppNotification,
  RadarAlert,
  Specialist,
  Student,
  TimelineEvent,
} from '../types';
import { DEFAULT_WEIGHTS } from '../lib/healthScore';
import { DEFAULT_WINDOW, addBusinessHours } from '../lib/sla';
import { RADARS } from '../lib/radars';
import { initialsOf, isoMinusMinutes, isoPlusDays } from '../lib/format';
import { CAMPUS, COURSES, courseInfo } from './catalog';

/* ==========================================================================
   Demonstration base
   --------------------------------------------------------------------------
   Fictional but internally consistent: every score is recomputed by the real
   engine at boot, every SLA is anchored to the moment the app loads (so
   countdowns are always live rather than permanently breached), and every
   signal that appears in a case is derivable from the student record it points
   at. Nothing here is decorative.
   ========================================================================== */

const BOOT = Date.now();

/* -- Team ---------------------------------------------------------------- */

export const SPECIALISTS: Specialist[] = [
  {
    id: 'spec-mariana',
    name: 'Mariana Ribeiro',
    initials: 'MR',
    role: 'Especialista de Retenção · Casos Críticos',
    email: 'mariana.ribeiro@anchieta.br',
    modality: 'Todas',
    specialty: 'Retenção',
    capacity: 14,
    resolvedThisCycle: 31,
    avgResponseHours: 1.6,
    slaAdherence: 97.2,
    csat: 4.8,
    presence: 'Disponível',
  },
  {
    id: 'spec-carlos',
    name: 'Carlos Eduardo Paiva',
    initials: 'CP',
    role: 'Especialista de Sucesso Acadêmico',
    email: 'carlos.paiva@anchieta.br',
    modality: 'Presencial',
    specialty: 'Acadêmico',
    capacity: 18,
    resolvedThisCycle: 44,
    avgResponseHours: 4.1,
    slaAdherence: 94.8,
    csat: 4.6,
    presence: 'Em atendimento',
  },
  {
    id: 'spec-fernanda',
    name: 'Fernanda Costa',
    initials: 'FC',
    role: 'Especialista de Engajamento · Híbrido e AVA',
    email: 'fernanda.costa@anchieta.br',
    modality: 'Híbrido',
    specialty: 'Engajamento',
    capacity: 20,
    resolvedThisCycle: 52,
    avgResponseHours: 3.4,
    slaAdherence: 96.0,
    csat: 4.7,
    presence: 'Disponível',
  },
  {
    id: 'spec-rodrigo',
    name: 'Rodrigo Martins',
    initials: 'RM',
    role: 'Especialista Financeiro · Mediação e Acordos',
    email: 'rodrigo.martins@anchieta.br',
    modality: 'Todas',
    specialty: 'Financeiro',
    capacity: 22,
    resolvedThisCycle: 61,
    avgResponseHours: 5.2,
    slaAdherence: 91.5,
    csat: 4.4,
    presence: 'Disponível',
  },
  {
    id: 'spec-larissa',
    name: 'Larissa Pereira',
    initials: 'LP',
    role: 'Especialista de Onboarding · Primeiros 90 dias',
    email: 'larissa.pereira@anchieta.br',
    modality: 'Todas',
    specialty: 'Onboarding',
    capacity: 16,
    resolvedThisCycle: 47,
    avgResponseHours: 2.2,
    slaAdherence: 98.4,
    csat: 4.9,
    presence: 'Disponível',
  },
  {
    id: 'spec-thiago',
    name: 'Thiago Nakamura',
    initials: 'TN',
    role: 'Especialista de Experiência · Ouvidoria e Secretaria',
    email: 'thiago.nakamura@anchieta.br',
    modality: 'Todas',
    specialty: 'Experiência',
    capacity: 14,
    resolvedThisCycle: 28,
    avgResponseHours: 3.9,
    slaAdherence: 93.1,
    csat: 4.5,
    presence: 'Ausente',
  },
  {
    id: 'spec-juliana',
    name: 'Juliana Alcântara',
    initials: 'JA',
    role: 'Coordenadora do Centro de Sucesso ao Aluno',
    email: 'juliana.alcantara@anchieta.br',
    modality: 'Todas',
    specialty: 'Retenção',
    capacity: 8,
    resolvedThisCycle: 12,
    avgResponseHours: 2.8,
    slaAdherence: 99.0,
    csat: 4.9,
    presence: 'Disponível',
  },
];

export const CURRENT_USER_ID = 'spec-mariana';

/* -- Builders ------------------------------------------------------------ */

function fin(partial: Partial<FinancialRecord> = {}): FinancialRecord {
  const base: FinancialRecord = {
    situation: 'Regular',
    monthlyFee: 850,
    dueDay: 10,
    outstanding: 0,
    overdueCount: 0,
    daysOverdue: 0,
    lastPayment: isoPlusDays(-9, BOOT),
    hasNegotiation: false,
    scholarshipPercent: 0,
    insidePreventiveWindow: false,
  };
  const merged = { ...base, ...partial };
  merged.insidePreventiveWindow = merged.daysOverdue >= 5 && merged.daysOverdue <= 20;
  return merged;
}

function eng(partial: Partial<EngagementRecord> = {}): EngagementRecord {
  return {
    lastAccessDaysAgo: 0,
    accessesLast30Days: 24,
    accessesPrev30Days: 24,
    weeklyHours: 5,
    deliveryRate: 94,
    forumInteractions: 6,
    accessTrend: [6, 6, 5, 6, 6, 5, 6, 6],
    appInstalled: true,
    visitedCancellationPage: false,
    ...partial,
  };
}

let disciplineSeq = 0;
function disc(partial: Partial<Discipline> & { name: string; code: string }): Discipline {
  disciplineSeq += 1;
  return {
    id: `disc-${disciplineSeq}`,
    teacher: 'Prof. Corpo Docente',
    format: 'Presencial',
    grade: 7.5,
    attendancePercent: 92,
    absences: 2,
    absenceLimit: 10,
    pendingActivities: 0,
    schedule: 'Seg e Qua · 19h00–22h30',
    status: 'Em curso',
    ...partial,
  };
}

let alertSeq = 0;
function alert(a: Omit<RadarAlert, 'id' | 'review'> & { review?: RadarAlert['review'] }): RadarAlert {
  alertSeq += 1;
  return { id: `alert-${alertSeq}`, review: 'pendente', ...a };
}

let eventSeq = 0;
function evt(e: Omit<TimelineEvent, 'id'>): TimelineEvent {
  eventSeq += 1;
  return { id: `evt-${eventSeq}`, ...e };
}

interface StudentSpec {
  id: string;
  ra: string;
  name: string;
  course: string;
  modality: Student['modality'];
  campus: string;
  period: number;
  shift: Student['shift'];
  daysSinceEnrollment: number;
  gpa: number;
  attendance: number;
  attendancePrev?: number;
  dependencies?: number;
  lateAssignments?: number;
  failingSubjects?: number;
  financial?: Partial<FinancialRecord>;
  engagement?: Partial<EngagementRecord>;
  disciplines?: Discipline[];
  alerts?: RadarAlert[];
  timeline?: TimelineEvent[];
  moduleName?: string;
  phone?: string;
  cpf?: string;
  onboardingSteps?: { label: string; done: boolean }[];
}

const ONBOARDING_WINDOW = 90;

const DEFAULT_ONBOARDING_STEPS = [
  { label: 'Contrato assinado', done: true },
  { label: 'Primeiro acesso ao portal', done: true },
  { label: 'Primeiro acesso ao AVA', done: true },
  { label: 'Reconheceu turma e horários', done: true },
  { label: 'Participou da integração', done: false },
  { label: 'Primeira atividade entregue', done: false },
];

function makeStudent(spec: StudentSpec): Student {
  const info = courseInfo(spec.course);
  const cohort = spec.daysSinceEnrollment <= ONBOARDING_WINDOW ? 'Calouro' : 'Veterano';
  const subjects = spec.disciplines?.length ?? 5;
  const progress = Math.min(
    97,
    Math.round(((spec.period - 1) / info.totalPeriods) * 100 + (100 / info.totalPeriods) * 0.35),
  );
  const yearsLeft = Math.ceil((info.totalPeriods - spec.period + 1) / 2);
  const forecastYear = new Date(BOOT).getFullYear() + yearsLeft;

  return {
    id: spec.id,
    ra: spec.ra,
    cpfMasked: spec.cpf ?? `${spec.ra.slice(0, 3)}.***.***-${spec.ra.slice(-2)}`,
    name: spec.name,
    email: `${spec.ra}@escolas.anchieta.br`,
    phone: spec.phone ?? '(11) 9****-****',
    initials: initialsOf(spec.name),
    course: spec.course,
    courseArea: info.area,
    modality: spec.modality,
    campus: spec.campus,
    period: spec.period,
    totalPeriods: info.totalPeriods,
    shift: spec.shift,
    cohort,
    healthScore: 0, // recomputed by the engine at boot
    status: 'Estável',
    trend: 'flat',
    scoreDelta30d: 0,
    academic: {
      gpa: spec.gpa,
      attendancePercent: spec.attendance,
      attendancePrevPercent: spec.attendancePrev ?? spec.attendance,
      subjects,
      dependencies: spec.dependencies ?? 0,
      lateAssignments: spec.lateAssignments ?? 0,
      failingSubjects: spec.failingSubjects ?? 0,
      disciplines: spec.disciplines ?? [],
    },
    financial: fin({ monthlyFee: info.fee, ...spec.financial }),
    engagement: eng(spec.engagement),
    journey: {
      progressPercent: progress,
      completionForecast: `12/${forecastYear}`,
      admissionSemester: cohort === 'Calouro' ? '2026/2' : '2025/1',
      daysSinceEnrollment: spec.daysSinceEnrollment,
      moduleName: spec.moduleName ?? `Módulo ${spec.period} — ciclo regular`,
      onboardingSteps: spec.onboardingSteps ?? DEFAULT_ONBOARDING_STEPS,
    },
    alerts: spec.alerts ?? [],
    timeline: spec.timeline ?? [],
  };
}

/* -- Flagship record: Victor Capitani ------------------------------------ */

const victor = makeStudent({
  id: 'st-victor',
  ra: '2607454',
  name: 'Victor Capitani',
  cpf: '458.***.***-12',
  phone: '(11) 98765-4321',
  course: 'Bacharelado em Ciências Contábeis',
  modality: 'Presencial',
  campus: CAMPUS,
  period: 2,
  shift: 'Noturno',
  daysSinceEnrollment: 183,
  gpa: 8.8,
  attendance: 100,
  attendancePrev: 100,
  moduleName: 'Módulo 2 — Estrutura Patrimonial e Demonstrações',
  financial: { situation: 'Regular', monthlyFee: 789, scholarshipPercent: 20, lastPayment: isoPlusDays(-11, BOOT) },
  engagement: eng({
    lastAccessDaysAgo: 0,
    accessesLast30Days: 21,
    accessesPrev30Days: 36,
    weeklyHours: 3.1,
    deliveryRate: 94,
    forumInteractions: 2,
    accessTrend: [9, 8, 9, 7, 5, 3, 2, 2],
  }),
  disciplines: [
    disc({
      code: 'CNT-201',
      name: 'Contabilidade Intermediária',
      teacher: 'Prof. Marcos Andrade',
      grade: 9.0,
      attendancePercent: 100,
      absences: 0,
      absenceLimit: 10,
      schedule: 'Seg e Qua · 19h00–22h30',
    }),
    disc({
      code: 'DIR-204',
      name: 'Legislação Tributária e Fiscal',
      teacher: 'Profa. Cláudia Valente',
      grade: 8.5,
      attendancePercent: 100,
      absences: 0,
      absenceLimit: 8,
      schedule: 'Ter e Qui · 19h00–22h30',
    }),
    disc({
      code: 'MAT-105',
      name: 'Estatística Aplicada a Negócios',
      teacher: 'Prof. Renato Silveira',
      grade: 8.9,
      attendancePercent: 100,
      absences: 0,
      absenceLimit: 6,
      format: 'Híbrida',
      pendingActivities: 1,
      schedule: 'Sex · 19h00 (AVA + encontro quinzenal)',
    }),
  ],
  alerts: [
    alert({
      radar: 'engajamento',
      severity: 'Atenção',
      title: 'Queda de 42% nos acessos ao AVA',
      detail:
        'Média semanal de acessos caiu de 9 para 2 nas últimas três semanas. Desempenho e presença física seguem intactos, o que descarta dificuldade de conteúdo e aponta para mudança de rotina externa.',
      detectedAt: isoPlusDays(-2, BOOT),
      signals: [
        'Acessos ao AVA: 36 → 21 na comparação de 30 dias',
        'Média semanal caiu de 9 para 2 acessos',
        'Nenhuma pendência financeira ou acadêmica associada',
        '1 atividade complementar de Estatística sem envio',
      ],
      suggestedAction:
        'Acompanhar sem urgência. Contato leve de checagem para entender se houve mudança de rotina profissional.',
    }),
  ],
  timeline: [
    evt({
      at: isoPlusDays(-2, BOOT),
      kind: 'alerta',
      title: 'Radar de Engajamento acionado',
      detail: 'Queda de 42% nos acessos ao AVA nas últimas três semanas. Impacto médio, ação sugerida: acompanhar.',
      author: 'Radar',
      tag: 'Engajamento',
    }),
    evt({
      at: isoPlusDays(-3, BOOT),
      kind: 'atendimento',
      title: 'Aluno contatou o suporte',
      detail: 'Dúvida sobre datas do calendário acadêmico do segundo bimestre. Resolvida pela IA no primeiro contato.',
      author: 'Sistema',
      tag: 'Autoatendimento',
    }),
    evt({
      at: isoPlusDays(-8, BOOT),
      kind: 'atendimento',
      title: 'Orientação sobre acesso ao AVA',
      detail: 'Aluno orientado sobre a navegação nos materiais da disciplina híbrida de Estatística.',
      author: 'Especialista',
      tag: 'Suporte AVA',
    }),
    evt({
      at: isoPlusDays(-14, BOOT),
      kind: 'academico',
      title: 'Nota lançada: 9,0 em Contabilidade Intermediária',
      detail: 'Avaliação A1 acima da média da turma (7,4).',
      author: 'Docente',
      tag: 'Acadêmico',
    }),
    evt({
      at: isoPlusDays(-24, BOOT),
      kind: 'marco',
      title: 'Início do semestre 2026/2',
      detail: 'Matrícula em 3 disciplinas confirmada. Turno noturno.',
      author: 'Sistema',
      tag: 'Jornada',
    }),
    evt({
      at: isoPlusDays(-41, BOOT),
      kind: 'financeiro',
      title: 'Rematrícula confirmada com bolsa de 20%',
      detail: 'Desconto de pontualidade mantido. Nenhuma pendência em aberto.',
      author: 'Sistema',
      tag: 'Financeiro',
    }),
    evt({
      at: isoPlusDays(-183, BOOT),
      kind: 'matricula',
      title: 'Matrícula efetivada',
      detail: 'Ingresso em Ciências Contábeis, modalidade presencial, turno noturno.',
      author: 'Sistema',
      tag: 'Matrícula',
    }),
  ],
});

/* -- Deep records -------------------------------------------------------- */

const deep: Student[] = [
  victor,

  makeStudent({
    id: 'st-ana',
    ra: '2589123',
    name: 'Ana Souza Rezende',
    phone: '(11) 99120-7788',
    course: 'Bacharelado em Administração',
    modality: 'Presencial',
    campus: CAMPUS,
    period: 4,
    shift: 'Matutino',
    daysSinceEnrollment: 560,
    gpa: 5.9,
    attendance: 68,
    attendancePrev: 91,
    lateAssignments: 4,
    failingSubjects: 2,
    financial: {
      situation: '2+ parcelas em atraso',
      overdueCount: 2,
      outstanding: 1700,
      daysOverdue: 38,
      lastPayment: isoPlusDays(-68, BOOT),
    },
    engagement: eng({
      lastAccessDaysAgo: 12,
      accessesLast30Days: 4,
      accessesPrev30Days: 26,
      weeklyHours: 0.6,
      deliveryRate: 48,
      forumInteractions: 0,
      accessTrend: [7, 6, 5, 3, 2, 1, 0, 0],
      visitedCancellationPage: true,
    }),
    disciplines: [
      disc({ code: 'ADM-402', name: 'Gestão Estratégica', teacher: 'Prof. Élcio Bueno', grade: 4.2, attendancePercent: 61, absences: 9, absenceLimit: 10, pendingActivities: 2, status: 'Em risco', schedule: 'Seg e Qua · 08h00–11h30' }),
      disc({ code: 'ECO-310', name: 'Economia Empresarial', teacher: 'Profa. Sandra Lopes', grade: 4.8, attendancePercent: 66, absences: 8, absenceLimit: 10, pendingActivities: 1, status: 'Em risco', schedule: 'Ter e Qui · 08h00–11h30' }),
      disc({ code: 'MKT-305', name: 'Marketing e Comportamento', teacher: 'Prof. Ivan Rocha', grade: 7.1, attendancePercent: 78, absences: 5, absenceLimit: 10, schedule: 'Sex · 08h00–11h30' }),
    ],
    alerts: [
      alert({
        radar: 'evasao',
        severity: 'Crítico',
        title: 'Intenção de saída com múltiplos sinais convergentes',
        detail:
          'Quatro vetores independentes acionaram ao mesmo tempo: ausência prolongada no AVA, inadimplência de 38 dias, queda de 23 p.p. na frequência e consulta ao formulário de trancamento. A combinação, e não cada item, é o alarme.',
        detectedAt: isoMinusMinutes(220, BOOT),
        signals: [
          '12 dias sem acesso ao AVA',
          '2 parcelas em aberto (R$ 1.700,00) há 38 dias',
          'Frequência caiu de 91% para 68%',
          'Baixou o formulário de trancamento de matrícula',
        ],
        suggestedAction: 'Contato telefônico humanizado imediato pelo Especialista de Retenção. Freio Concorrente já ativo.',
      }),
    ],
    timeline: [
      evt({ at: isoMinusMinutes(220, BOOT), kind: 'alerta', title: 'Radar de Evasão acionado — nível crítico', detail: 'Quatro sinais convergentes. Caso aberto e roteado para Retenção com SLA de 4 horas úteis.', author: 'Radar', tag: 'Evasão' }),
      evt({ at: isoMinusMinutes(218, BOOT), kind: 'intervencao', title: 'Freio Concorrente ativado', detail: 'Régua de cobrança, SMS promocional e e-mail de rematrícula suspensos para não conflitar com o contato humano.', author: 'Sistema', tag: 'Governança' }),
      evt({ at: isoPlusDays(-6, BOOT), kind: 'financeiro', title: 'Segunda parcela vencida sem pagamento', detail: 'Saldo acumulado de R$ 1.700,00. Nenhuma negociação registrada.', author: 'Sistema', tag: 'Financeiro' }),
      evt({ at: isoPlusDays(-19, BOOT), kind: 'academico', title: 'Frequência abaixo do mínimo em duas disciplinas', detail: 'Gestão Estratégica em 61% e Economia Empresarial em 66%.', author: 'Docente', tag: 'Acadêmico' }),
      evt({ at: isoPlusDays(-560, BOOT), kind: 'matricula', title: 'Matrícula efetivada', detail: 'Ingresso em Administração, presencial, turno matutino.', author: 'Sistema', tag: 'Matrícula' }),
    ],
  }),

  makeStudent({
    id: 'st-bruno',
    ra: '2619045',
    name: 'Bruno Henrique Vieira',
    phone: '(11) 98411-2233',
    course: 'Tecnologia em Logística',
    modality: 'Híbrido',
    campus: CAMPUS,
    period: 3,
    shift: 'Noturno',
    daysSinceEnrollment: 420,
    gpa: 7.4,
    attendance: 62,
    attendancePrev: 88,
    lateAssignments: 3,
    moduleName: 'Módulo 3 — Gestão de Suprimentos e Distribuição',
    financial: { situation: 'Regular', monthlyFee: 520, lastPayment: isoPlusDays(-7, BOOT) },
    engagement: eng({
      lastAccessDaysAgo: 15,
      accessesLast30Days: 3,
      accessesPrev30Days: 28,
      weeklyHours: 0.4,
      deliveryRate: 55,
      forumInteractions: 0,
      accessTrend: [8, 7, 6, 4, 2, 1, 0, 0],
    }),
    disciplines: [
      disc({ code: 'LOG-303', name: 'Gestão de Suprimentos', teacher: 'Prof. Alan Teles', grade: 7.8, attendancePercent: 62, absences: 3, absenceLimit: 4, format: 'Híbrida', pendingActivities: 2, status: 'Em risco', schedule: 'Encontro quinzenal · Sáb 08h00–12h00' }),
      disc({ code: 'LOG-305', name: 'Projeto Integrador III', teacher: 'Profa. Regina Alves', grade: 6.5, attendancePercent: 60, absences: 2, absenceLimit: 4, format: 'Digital', pendingActivities: 1, status: 'Em risco', schedule: 'AVA · entregas semanais' }),
    ],
    alerts: [
      alert({
        radar: 'engajamento',
        severity: 'Crítico',
        title: '15 dias sem login e entrega parcial do Projeto Integrador em aberto',
        detail:
          'No híbrido o login é o equivalente da presença. Aluno a um período da conclusão, com histórico anterior consistente — o padrão indica ruptura recente de rotina, não desinteresse acumulado.',
        detectedAt: isoMinusMinutes(160, BOOT),
        signals: [
          '15 dias sem login no AVA',
          'Faltou ao último encontro presencial quinzenal (3 de 4 permitidas)',
          'Entrega parcial do Projeto Integrador III não realizada',
          'Acessos: 28 → 3 na comparação de 30 dias',
        ],
        suggestedAction: 'WhatsApp acolhedor com o cronograma do módulo e prazo do Projeto Integrador. Reforçar proximidade da conclusão.',
      }),
    ],
    timeline: [
      evt({ at: isoMinusMinutes(160, BOOT), kind: 'alerta', title: 'Radar de Engajamento AVA acionado', detail: 'Inatividade de 15 dias combinada a entrega avaliativa pendente.', author: 'Radar', tag: 'Engajamento' }),
      evt({ at: isoPlusDays(-9, BOOT), kind: 'academico', title: 'Ausência no encontro quinzenal', detail: 'Terceira falta de um limite de quatro no módulo.', author: 'Docente', tag: 'Presença' }),
      evt({ at: isoPlusDays(-420, BOOT), kind: 'matricula', title: 'Matrícula efetivada', detail: 'Ingresso em Logística, modalidade híbrida.', author: 'Sistema', tag: 'Matrícula' }),
    ],
  }),

  makeStudent({
    id: 'st-camila',
    ra: '2567119',
    name: 'Camila Barbosa Lima',
    phone: '(11) 97655-3311',
    course: 'Bacharelado em Fisioterapia',
    modality: 'Presencial',
    campus: CAMPUS,
    period: 6,
    shift: 'Matutino',
    daysSinceEnrollment: 900,
    gpa: 8.1,
    attendance: 93,
    attendancePrev: 95,
    financial: {
      situation: '2+ parcelas em atraso',
      overdueCount: 3,
      outstanding: 3120,
      daysOverdue: 52,
      lastPayment: isoPlusDays(-84, BOOT),
    },
    engagement: eng({ lastAccessDaysAgo: 1, accessesLast30Days: 22, accessesPrev30Days: 24, deliveryRate: 91, weeklyHours: 4.6, accessTrend: [6, 5, 6, 5, 6, 5, 5, 6] }),
    disciplines: [
      disc({ code: 'FIS-601', name: 'Fisioterapia Traumato-Ortopédica', teacher: 'Profa. Denise Camargo', grade: 8.4, attendancePercent: 95, absences: 2, absenceLimit: 10, schedule: 'Seg e Qua · 08h00–12h00' }),
      disc({ code: 'FIS-604', name: 'Estágio Supervisionado II', teacher: 'Prof. Bruno Sato', grade: 7.9, attendancePercent: 92, absences: 3, absenceLimit: 8, schedule: 'Ter, Qui e Sex · 08h00–12h00' }),
    ],
    alerts: [
      alert({
        radar: 'financeiro',
        severity: 'Risco',
        title: 'Inadimplência recorrente com desempenho acadêmico preservado',
        detail:
          'Três mensalidades em aberto há 52 dias, já fora da janela preventiva. Frequência de 93% e média 8,1 mostram que o vínculo com o curso está intacto — o bloqueio é exclusivamente financeiro.',
        detectedAt: isoPlusDays(-1, BOOT),
        signals: [
          '3 mensalidades vencidas (R$ 3.120,00)',
          'Atraso de 52 dias — fora da janela preventiva',
          'Nenhuma negociação registrada',
          '6º período de 8, com estágio supervisionado em curso',
        ],
        suggestedAction: 'Proposta de repactuação em até 10x sem juros punitivos, preservando a matrícula no estágio.',
      }),
    ],
    timeline: [
      evt({ at: isoPlusDays(-1, BOOT), kind: 'alerta', title: 'Radar Financeiro acionado', detail: 'Terceira parcela vencida. Caso roteado para mediação financeira.', author: 'Radar', tag: 'Financeiro' }),
      evt({ at: isoPlusDays(-1, BOOT), kind: 'intervencao', title: 'Proposta de repactuação enviada', detail: 'Mensagem no WhatsApp com simulação em 10x. Aguardando retorno da aluna.', author: 'Especialista', tag: 'Negociação' }),
    ],
  }),

  makeStudent({
    id: 'st-lucas',
    ra: '2610482',
    name: 'Lucas Lima Ferreira',
    phone: '(11) 98277-4455',
    course: 'Engenharia de Software',
    modality: 'Híbrido',
    campus: CAMPUS,
    period: 3,
    shift: 'Noturno',
    daysSinceEnrollment: 400,
    gpa: 6.2,
    attendance: 84,
    attendancePrev: 90,
    lateAssignments: 3,
    failingSubjects: 2,
    moduleName: 'Módulo 3 — Estruturas de Dados e Algoritmos',
    engagement: eng({ lastAccessDaysAgo: 2, accessesLast30Days: 18, accessesPrev30Days: 25, deliveryRate: 68, weeklyHours: 3.2, forumInteractions: 3, accessTrend: [6, 6, 5, 4, 4, 3, 3, 4] }),
    disciplines: [
      disc({ code: 'ESW-302', name: 'Estruturas de Dados Avançadas', teacher: 'Prof. Daniel Ferraz', grade: 4.5, attendancePercent: 82, absences: 3, absenceLimit: 6, format: 'Híbrida', pendingActivities: 3, status: 'Em risco', schedule: 'Ter · 19h00 + AVA' }),
      disc({ code: 'ESW-304', name: 'Banco de Dados Relacional', teacher: 'Profa. Aline Prado', grade: 4.9, attendancePercent: 86, absences: 2, absenceLimit: 6, format: 'Digital', pendingActivities: 1, status: 'Em risco', schedule: 'AVA · entregas semanais' }),
      disc({ code: 'ESW-306', name: 'Engenharia de Requisitos', teacher: 'Prof. Otávio Lins', grade: 7.6, attendancePercent: 88, absences: 1, absenceLimit: 6, format: 'Híbrida', schedule: 'Qui · 19h00 + AVA' }),
    ],
    alerts: [
      alert({
        radar: 'academico',
        severity: 'Risco',
        title: 'Duas disciplinas abaixo de 5,0 com laboratórios pendentes',
        detail:
          'Dificuldade conceitual concentrada no eixo de dados. Presença preservada em 84%, o que indica esforço presente e problema de conteúdo, não de compromisso — cenário de alta resposta a monitoria.',
        detectedAt: isoPlusDays(-2, BOOT),
        signals: [
          'Estruturas de Dados Avançadas: 4,5',
          'Banco de Dados Relacional: 4,9',
          '3 atividades laboratoriais sem envio',
          'Frequência de 84% — presença preservada',
        ],
        suggestedAction: 'Encaminhar para monitoria do eixo de dados e montar plano de estudos com a coordenação.',
      }),
    ],
    timeline: [
      evt({ at: isoPlusDays(-2, BOOT), kind: 'alerta', title: 'Radar Acadêmico acionado', detail: 'Duas disciplinas abaixo da média mínima no eixo de dados.', author: 'Radar', tag: 'Acadêmico' }),
      evt({ at: isoPlusDays(-11, BOOT), kind: 'academico', title: 'Nota A1 lançada: 4,5', detail: 'Estruturas de Dados Avançadas. Média da turma: 6,8.', author: 'Docente', tag: 'Acadêmico' }),
    ],
  }),

  makeStudent({
    id: 'st-matheus',
    ra: '2640192',
    name: 'Matheus Henrique Silvano',
    phone: '(11) 99833-1020',
    course: 'Licenciatura em Pedagogia',
    modality: 'Híbrido',
    campus: CAMPUS,
    period: 1,
    shift: 'Noturno',
    daysSinceEnrollment: 22,
    gpa: 0,
    attendance: 50,
    attendancePrev: 100,
    moduleName: 'Módulo 1 — Fundamentos da Educação',
    financial: { situation: 'Regular', monthlyFee: 460, lastPayment: isoPlusDays(-4, BOOT) },
    engagement: eng({
      lastAccessDaysAgo: 9,
      accessesLast30Days: 2,
      accessesPrev30Days: 0,
      weeklyHours: 0.3,
      deliveryRate: 0,
      forumInteractions: 0,
      appInstalled: false,
      accessTrend: [0, 0, 0, 0, 1, 1, 0, 0],
    }),
    onboardingSteps: [
      { label: 'Contrato assinado', done: true },
      { label: 'Primeiro acesso ao portal', done: true },
      { label: 'Primeiro acesso ao AVA', done: true },
      { label: 'Reconheceu turma e horários', done: false },
      { label: 'Participou da integração', done: false },
      { label: 'Primeira atividade entregue', done: false },
    ],
    disciplines: [
      disc({ code: 'PED-101', name: 'Fundamentos da Educação', teacher: 'Profa. Marta Freitas', grade: 0, attendancePercent: 50, absences: 1, absenceLimit: 4, format: 'Digital', pendingActivities: 2, schedule: 'AVA · módulo 1' }),
    ],
    alerts: [
      alert({
        radar: 'atendimento',
        severity: 'Risco',
        title: 'Calouro sem ambientação no AVA após 22 dias',
        detail:
          'Ingressante do ciclo 2026/2 com apenas dois acessos desde a matrícula, sem entregas e sem app instalado. Dois chamados abertos sobre "como acessar minhas aulas" — o problema é de navegação, não de interesse.',
        detectedAt: isoPlusDays(-1, BOOT),
        signals: [
          '9 dias sem acesso ao AVA',
          'Apenas 2 acessos desde a matrícula',
          '2 chamados abertos sobre acesso às aulas',
          'Nenhuma etapa de integração concluída',
        ],
        suggestedAction: 'Chamada de onboarding com demonstração guiada do AVA pelo celular. Régua de acolhimento, não de retenção.',
      }),
    ],
    timeline: [
      evt({ at: isoPlusDays(-1, BOOT), kind: 'alerta', title: 'Radar de Onboarding acionado', detail: 'Calouro sem ambientação após 22 dias. Roteado para a régua de acolhimento — fora da fila de evasão.', author: 'Radar', tag: 'Onboarding' }),
      evt({ at: isoPlusDays(-5, BOOT), kind: 'atendimento', title: 'Segundo chamado sobre acesso às aulas', detail: 'Aluno relata não localizar as videoaulas do Módulo 1.', author: 'Aluno', tag: 'Atendimento' }),
      evt({ at: isoPlusDays(-22, BOOT), kind: 'matricula', title: 'Matrícula efetivada', detail: 'Ingresso em Pedagogia híbrida. Início da régua de onboarding de 90 dias.', author: 'Sistema', tag: 'Matrícula' }),
    ],
  }),

  makeStudent({
    id: 'st-felipe',
    ra: '2590031',
    name: 'Felipe Costa Ribeiro',
    phone: '(11) 98544-9911',
    course: 'Ciência da Computação',
    modality: 'Presencial',
    campus: CAMPUS,
    period: 3,
    shift: 'Noturno',
    daysSinceEnrollment: 410,
    gpa: 7.1,
    attendance: 74,
    attendancePrev: 89,
    lateAssignments: 1,
    financial: { situation: '1 parcela em atraso', overdueCount: 1, outstanding: 920, daysOverdue: 12, lastPayment: isoPlusDays(-42, BOOT) },
    engagement: eng({ lastAccessDaysAgo: 3, accessesLast30Days: 16, accessesPrev30Days: 22, deliveryRate: 82, weeklyHours: 3.4, accessTrend: [6, 5, 5, 4, 4, 3, 3, 3] }),
    disciplines: [
      disc({ code: 'MAT-210', name: 'Cálculo II', teacher: 'Prof. Hélio Barreto', grade: 5.8, attendancePercent: 71, absences: 7, absenceLimit: 8, pendingActivities: 1, status: 'Em risco', schedule: 'Seg e Qua · 19h00–22h30' }),
      disc({ code: 'CCP-305', name: 'Arquitetura de Computadores', teacher: 'Profa. Yara Nunes', grade: 8.0, attendancePercent: 79, absences: 4, absenceLimit: 8, schedule: 'Ter e Qui · 19h00–22h30' }),
    ],
    alerts: [
      alert({
        radar: 'academico',
        severity: 'Risco',
        title: 'Sétima falta em Cálculo II — uma do limite regimental',
        detail:
          'Três ausências consecutivas após o início de um novo estágio. Uma falta a mais reprova por frequência, independentemente da nota. Há também a primeira parcela em aberto há 12 dias.',
        detectedAt: isoPlusDays(-2, BOOT),
        signals: [
          'Cálculo II: 7 faltas de um limite de 8',
          'Frequência global em 74% — abaixo do mínimo de 75%',
          'Queda de 15 p.p. na frequência no ciclo',
          '1 parcela em aberto há 12 dias (janela preventiva)',
        ],
        suggestedAction: 'Contato imediato sobre risco de reprovação por falta. Avaliar reposição e ajuste de rotina com o estágio.',
      }),
    ],
    timeline: [
      evt({ at: isoPlusDays(-2, BOOT), kind: 'alerta', title: 'Radar Acadêmico acionado — risco de reprovação por falta', detail: 'Sétima falta em Cálculo II, limite regimental é 8.', author: 'Radar', tag: 'Acadêmico' }),
      evt({ at: isoPlusDays(-16, BOOT), kind: 'engajamento', title: 'Aluno informou início de estágio', detail: 'Relatou dificuldade de deslocamento até o campus no horário noturno.', author: 'Aluno', tag: 'Rotina' }),
    ],
  }),

  makeStudent({
    id: 'st-beatriz',
    ra: '2601188',
    name: 'Beatriz Alcântara Moura',
    phone: '(11) 97122-8877',
    course: 'Bacharelado em Enfermagem',
    modality: 'Híbrido',
    campus: CAMPUS,
    period: 5,
    shift: 'Noturno',
    daysSinceEnrollment: 720,
    gpa: 8.6,
    attendance: 94,
    attendancePrev: 79,
    moduleName: 'Módulo 5 — Saúde Coletiva e Práticas Clínicas',
    engagement: eng({ lastAccessDaysAgo: 0, accessesLast30Days: 31, accessesPrev30Days: 12, deliveryRate: 97, weeklyHours: 6.2, forumInteractions: 11, accessTrend: [2, 3, 4, 6, 7, 8, 8, 9] }),
    disciplines: [
      disc({ code: 'ENF-503', name: 'Saúde Coletiva', teacher: 'Profa. Lúcia Prado', grade: 8.8, attendancePercent: 96, absences: 1, absenceLimit: 6, format: 'Híbrida', schedule: 'Encontro quinzenal · Sáb 08h00–12h00' }),
      disc({ code: 'ENF-505', name: 'Práticas Clínicas Supervisionadas', teacher: 'Prof. André Kim', grade: 8.4, attendancePercent: 92, absences: 2, absenceLimit: 6, schedule: 'Qua · 19h00–22h30' }),
    ],
    timeline: [
      evt({ at: isoPlusDays(-4, BOOT), kind: 'marco', title: 'Aluna recuperada — saiu do radar de risco', detail: 'Health Score recuperou de 52 para 86 após acordo de plano de estudos e retomada do ritmo no AVA.', author: 'Sistema', tag: 'Recuperação' }),
      evt({ at: isoPlusDays(-26, BOOT), kind: 'intervencao', title: 'Acordo de permanência firmado', detail: 'Plano de estudos montado com a coordenação e monitoria de Saúde Coletiva ativada.', author: 'Especialista', tag: 'Retenção' }),
      evt({ at: isoPlusDays(-32, BOOT), kind: 'alerta', title: 'Radar de Engajamento acionado', detail: 'Queda de acessos no módulo 4. Caso aberto e resolvido em 3 dias.', author: 'Radar', tag: 'Engajamento' }),
    ],
  }),

  makeStudent({
    id: 'st-patricia',
    ra: '2639012',
    name: 'Patrícia Naves Godoy',
    phone: '(11) 99778-5544',
    course: 'Tecnologia em Gestão de Recursos Humanos',
    modality: 'Híbrido',
    campus: CAMPUS,
    period: 1,
    shift: 'Noturno',
    daysSinceEnrollment: 47,
    gpa: 8.3,
    attendance: 100,
    moduleName: 'Módulo 1 — Comportamento Organizacional',
    financial: { situation: 'Regular', monthlyFee: 490, lastPayment: isoPlusDays(-6, BOOT) },
    engagement: eng({ lastAccessDaysAgo: 0, accessesLast30Days: 27, accessesPrev30Days: 22, deliveryRate: 96, weeklyHours: 5.4, forumInteractions: 9, accessTrend: [4, 5, 6, 6, 7, 7, 6, 7] }),
    onboardingSteps: [
      { label: 'Contrato assinado', done: true },
      { label: 'Primeiro acesso ao portal', done: true },
      { label: 'Primeiro acesso ao AVA', done: true },
      { label: 'Reconheceu turma e horários', done: true },
      { label: 'Participou da integração', done: true },
      { label: 'Primeira atividade entregue', done: true },
    ],
    timeline: [
      evt({ at: isoPlusDays(-3, BOOT), kind: 'marco', title: 'Onboarding concluído com todas as etapas', detail: 'Calouro modelo: seis de seis marcos da régua de acolhimento cumpridos em 47 dias.', author: 'Sistema', tag: 'Onboarding' }),
      evt({ at: isoPlusDays(-47, BOOT), kind: 'matricula', title: 'Matrícula efetivada', detail: 'Ingresso em Gestão de RH, modalidade híbrida.', author: 'Sistema', tag: 'Matrícula' }),
    ],
  }),

  makeStudent({
    id: 'st-vanessa',
    ra: '2477810',
    name: 'Vanessa Regina Franco',
    phone: '(11) 97455-6611',
    course: 'Bacharelado em Direito',
    modality: 'Presencial',
    campus: CAMPUS,
    period: 9,
    shift: 'Matutino',
    daysSinceEnrollment: 1450,
    gpa: 9.5,
    attendance: 100,
    engagement: eng({ lastAccessDaysAgo: 0, accessesLast30Days: 38, accessesPrev30Days: 35, deliveryRate: 100, weeklyHours: 8.1, forumInteractions: 16, accessTrend: [8, 9, 8, 9, 9, 9, 8, 9] }),
    disciplines: [
      disc({ code: 'DIR-901', name: 'Prática Jurídica IV', teacher: 'Prof. Ricardo Sampaio', grade: 9.6, attendancePercent: 100, absences: 0, absenceLimit: 8, schedule: 'Seg a Qui · 08h00–12h00' }),
      disc({ code: 'DIR-905', name: 'Trabalho de Conclusão de Curso', teacher: 'Profa. Helena Duarte', grade: 9.4, attendancePercent: 100, absences: 0, absenceLimit: 4, schedule: 'Sex · 08h00–10h00' }),
    ],
    timeline: [
      evt({ at: isoPlusDays(-12, BOOT), kind: 'marco', title: 'Concluinte — TCC em fase final', detail: 'Aluna no 9º de 10 períodos com desempenho de excelência. Elegível para o programa de egressos.', author: 'Sistema', tag: 'Jornada' }),
    ],
  }),

  makeStudent({
    id: 'st-thiago-a',
    ra: '2612900',
    name: 'Thiago Almeida Prado',
    phone: '(11) 98600-7712',
    course: 'Tecnologia em Análise e Desenv. de Sistemas',
    modality: 'Híbrido',
    campus: CAMPUS,
    period: 4,
    shift: 'Noturno',
    daysSinceEnrollment: 520,
    gpa: 6.8,
    attendance: 100,
    lateAssignments: 2,
    moduleName: 'Módulo 4 — Desenvolvimento Web Full Stack',
    financial: { situation: 'Negociação em andamento', overdueCount: 1, outstanding: 590, daysOverdue: 9, hasNegotiation: true, lastPayment: isoPlusDays(-38, BOOT) },
    engagement: eng({ lastAccessDaysAgo: 8, accessesLast30Days: 9, accessesPrev30Days: 24, deliveryRate: 64, weeklyHours: 1.6, forumInteractions: 1, accessTrend: [7, 6, 5, 4, 3, 2, 1, 1] }),
    disciplines: [
      disc({ code: 'ADS-401', name: 'Desenvolvimento Web Full Stack', teacher: 'Prof. Vitor Salles', grade: 6.4, attendancePercent: 100, absences: 0, absenceLimit: 0, format: 'Digital', pendingActivities: 2, schedule: 'AVA · sprints quinzenais' }),
      disc({ code: 'ADS-403', name: 'Qualidade e Testes de Software', teacher: 'Profa. Bruna Reis', grade: 7.2, attendancePercent: 100, absences: 0, absenceLimit: 0, format: 'Digital', schedule: 'AVA · entregas semanais' }),
    ],
    alerts: [
      alert({
        radar: 'engajamento',
        severity: 'Risco',
        title: 'Queda de 62% nos acessos em curso 100% digital',
        detail:
          'No híbrido o AVA carrega o peso que a presença quinzenal não pode carregar — 27% do score. Oito dias sem login com duas entregas em aberto e negociação financeira ativa em paralelo.',
        detectedAt: isoPlusDays(-1, BOOT),
        signals: [
          '8 dias sem login no AVA',
          'Acessos: 24 → 9 na comparação de 30 dias',
          '2 sprints de Desenvolvimento Web sem entrega',
          'Negociação financeira ativa sem confirmação de pagamento',
        ],
        suggestedAction: 'Contato integrado: confirmar o acordo financeiro e liberar o cronograma das sprints em atraso.',
      }),
    ],
    timeline: [
      evt({ at: isoPlusDays(-1, BOOT), kind: 'alerta', title: 'Radar de Engajamento AVA acionado', detail: 'Queda de 62% nos acessos no AVA.', author: 'Radar', tag: 'Engajamento' }),
      evt({ at: isoPlusDays(-9, BOOT), kind: 'financeiro', title: 'Termo de negociação assinado', detail: 'Parcela repactuada com vencimento em 5 dias. Aguardando confirmação.', author: 'Especialista', tag: 'Financeiro' }),
    ],
  }),

  makeStudent({
    id: 'st-giovanna',
    ra: '2645501',
    name: 'Giovanna Peixoto Arruda',
    phone: '(11) 99011-3366',
    course: 'Bacharelado em Psicologia',
    modality: 'Presencial',
    campus: CAMPUS,
    period: 1,
    shift: 'Noturno',
    daysSinceEnrollment: 31,
    gpa: 7.9,
    attendance: 88,
    attendancePrev: 100,
    financial: { situation: '1 parcela em atraso', overdueCount: 1, outstanding: 1090, daysOverdue: 7, lastPayment: isoPlusDays(-37, BOOT) },
    engagement: eng({ lastAccessDaysAgo: 2, accessesLast30Days: 14, accessesPrev30Days: 6, deliveryRate: 85, weeklyHours: 3.1, forumInteractions: 4, accessTrend: [0, 2, 3, 4, 4, 3, 4, 4] }),
    onboardingSteps: [
      { label: 'Contrato assinado', done: true },
      { label: 'Primeiro acesso ao portal', done: true },
      { label: 'Primeiro acesso ao AVA', done: true },
      { label: 'Reconheceu turma e horários', done: true },
      { label: 'Participou da integração', done: false },
      { label: 'Primeira atividade entregue', done: true },
    ],
    disciplines: [
      disc({ code: 'PSI-101', name: 'Psicologia do Desenvolvimento', teacher: 'Profa. Teresa Vidal', grade: 8.2, attendancePercent: 90, absences: 2, absenceLimit: 10, schedule: 'Seg e Qua · 19h00–22h30' }),
      disc({ code: 'PSI-103', name: 'Bases Biológicas do Comportamento', teacher: 'Prof. Márcio Alencar', grade: 7.6, attendancePercent: 86, absences: 3, absenceLimit: 10, schedule: 'Ter e Qui · 19h00–22h30' }),
    ],
    alerts: [
      alert({
        radar: 'financeiro',
        severity: 'Atenção',
        title: 'Primeira mensalidade em aberto na janela preventiva',
        detail:
          'Calouro com sete dias de atraso — exatamente a janela D+5 a D+20 em que o problema ainda é conversa. Desempenho e presença dentro do esperado para o primeiro mês.',
        detectedAt: isoPlusDays(-1, BOOT),
        signals: [
          'Primeira mensalidade em aberto há 7 dias',
          'Aluna calouro (31 dias de matrícula)',
          'Sem histórico prévio de inadimplência',
        ],
        suggestedAction: 'Orientação sobre emissão de PIX/boleto e apresentação das opções de bolsa interna.',
      }),
    ],
    timeline: [
      evt({ at: isoPlusDays(-1, BOOT), kind: 'alerta', title: 'Radar Financeiro Preventivo acionado', detail: 'Primeiro atraso dentro da janela D+5/D+20.', author: 'Radar', tag: 'Financeiro' }),
      evt({ at: isoPlusDays(-31, BOOT), kind: 'matricula', title: 'Matrícula efetivada', detail: 'Ingresso em Psicologia presencial, turno noturno.', author: 'Sistema', tag: 'Matrícula' }),
    ],
  }),

  makeStudent({
    id: 'st-rafael',
    ra: '2555420',
    name: 'Rafael Monteiro Braga',
    phone: '(11) 98155-2244',
    course: 'Engenharia Civil',
    modality: 'Presencial',
    campus: CAMPUS,
    period: 7,
    shift: 'Noturno',
    daysSinceEnrollment: 1090,
    gpa: 6.9,
    attendance: 81,
    attendancePrev: 84,
    dependencies: 2,
    lateAssignments: 1,
    engagement: eng({ lastAccessDaysAgo: 4, accessesLast30Days: 13, accessesPrev30Days: 17, deliveryRate: 77, weeklyHours: 2.7, accessTrend: [4, 4, 3, 4, 3, 3, 2, 3] }),
    disciplines: [
      disc({ code: 'CIV-701', name: 'Estruturas de Concreto II', teacher: 'Prof. Nelson Vieira', grade: 6.1, attendancePercent: 80, absences: 5, absenceLimit: 8, pendingActivities: 1, schedule: 'Seg e Qua · 19h00–22h30' }),
      disc({ code: 'CIV-620', name: 'Hidrologia (dependência)', teacher: 'Profa. Íris Campos', grade: 5.4, attendancePercent: 76, absences: 6, absenceLimit: 8, status: 'Dependência', schedule: 'Sáb · 08h00–12h00' }),
    ],
    alerts: [
      alert({
        radar: 'academico',
        severity: 'Atenção',
        title: 'Duas dependências acumuladas com frequência no limite',
        detail:
          'Aluno no 7º período carregando duas dependências. O acúmulo compromete a integralização no prazo e é um preditor forte de desistência na reta final.',
        detectedAt: isoPlusDays(-5, BOOT),
        signals: [
          '2 dependências acumuladas de semestres anteriores',
          'Frequência global em 81%',
          'Estruturas de Concreto II com média 6,1',
        ],
        suggestedAction: 'Plano de integralização com a coordenação, priorizando a quitação das dependências.',
        review: 'confirmado',
        reviewedBy: 'Carlos Eduardo Paiva',
        reviewedAt: isoPlusDays(-4, BOOT),
      }),
    ],
    timeline: [
      evt({ at: isoPlusDays(-4, BOOT), kind: 'intervencao', title: 'Plano de integralização acordado', detail: 'Aluno inscrito em Hidrologia no sábado para quitar a primeira dependência.', author: 'Especialista', tag: 'Acadêmico' }),
    ],
  }),

  makeStudent({
    id: 'st-isabela',
    ra: '2559011',
    name: 'Isabela Martins Santos',
    phone: '(11) 97333-8899',
    course: 'Bacharelado em Nutrição',
    modality: 'Presencial',
    campus: CAMPUS,
    period: 4,
    shift: 'Matutino',
    daysSinceEnrollment: 620,
    gpa: 8.9,
    attendance: 98,
    engagement: eng({ lastAccessDaysAgo: 0, accessesLast30Days: 29, accessesPrev30Days: 27, deliveryRate: 98, weeklyHours: 5.6, forumInteractions: 8, accessTrend: [7, 7, 8, 7, 7, 8, 7, 8] }),
    disciplines: [
      disc({ code: 'NUT-401', name: 'Nutrição Clínica', teacher: 'Profa. Aline Duarte', grade: 9.1, attendancePercent: 100, absences: 0, absenceLimit: 8, schedule: 'Seg e Qua · 08h00–12h00' }),
    ],
  }),

  makeStudent({
    id: 'st-diego',
    ra: '2601994',
    name: 'Diego Fernandes Xavier',
    phone: '(11) 98112-9900',
    course: 'Bacharelado em Administração',
    modality: 'Presencial',
    campus: CAMPUS,
    period: 3,
    shift: 'Noturno',
    daysSinceEnrollment: 430,
    gpa: 7.2,
    attendance: 86,
    attendancePrev: 92,
    lateAssignments: 1,
    engagement: eng({ lastAccessDaysAgo: 3, accessesLast30Days: 15, accessesPrev30Days: 21, deliveryRate: 80, weeklyHours: 3.0, accessTrend: [5, 5, 4, 4, 3, 3, 3, 3] }),
    disciplines: [
      disc({ code: 'ADM-301', name: 'Gestão de Pessoas', teacher: 'Profa. Marta Vasques', grade: 7.4, attendancePercent: 88, absences: 3, absenceLimit: 10, schedule: 'Ter e Qui · 19h00–22h30' }),
    ],
  }),

  makeStudent({
    id: 'st-gustavo',
    ra: '2523419',
    name: 'Gustavo Mendonça Dias',
    phone: '(11) 98322-1100',
    course: 'Bacharelado em Educação Física',
    modality: 'Presencial',
    campus: CAMPUS,
    period: 5,
    shift: 'Matutino',
    daysSinceEnrollment: 780,
    gpa: 6.7,
    attendance: 79,
    attendancePrev: 88,
    lateAssignments: 2,
    failingSubjects: 1,
    engagement: eng({ lastAccessDaysAgo: 5, accessesLast30Days: 10, accessesPrev30Days: 18, deliveryRate: 70, weeklyHours: 2.1, accessTrend: [4, 4, 3, 3, 2, 2, 1, 2] }),
    disciplines: [
      disc({ code: 'EDF-502', name: 'Fisiologia do Exercício', teacher: 'Prof. Caio Bernardes', grade: 5.6, attendancePercent: 77, absences: 6, absenceLimit: 8, pendingActivities: 2, status: 'Em risco', schedule: 'Seg e Qua · 08h00–12h00' }),
    ],
    alerts: [
      alert({
        radar: 'academico',
        severity: 'Atenção',
        title: 'Frequência em queda com atividades acumuladas',
        detail: 'Queda de 9 p.p. na frequência e duas atividades pendentes em Fisiologia do Exercício.',
        detectedAt: isoPlusDays(-6, BOOT),
        signals: ['Frequência caiu de 88% para 79%', '2 atividades em atraso', 'Fisiologia do Exercício com média 5,6'],
        suggestedAction: 'Contato preventivo com oferta de monitoria.',
        review: 'descartado',
        reviewedBy: 'Carlos Eduardo Paiva',
        reviewedAt: isoPlusDays(-5, BOOT),
      }),
    ],
  }),
];

/* -- Breadth records ------------------------------------------------------
   Compact but individually plausible: the base needs enough spread across
   courses, campuses, shifts, cohorts and score bands that filters, the
   distribution donut and the risk heatmap all have something real to show. */

interface BreadthSpec {
  ra: string;
  name: string;
  courseIndex: number;
  modality: Student['modality'];
  period: number;
  shift: Student['shift'];
  days: number;
  gpa: number;
  att: number;
  attPrev?: number;
  overdue?: number;
  daysOverdue?: number;
  lastAccess: number;
  acc30: number;
  accPrev: number;
  delivery: number;
  deps?: number;
  late?: number;
  failing?: number;
  negotiation?: boolean;
  scholarship?: number;
  cancelPage?: boolean;
}

const BREADTH: BreadthSpec[] = [
  { ra: '2648770', name: 'Sofia Meireles Aguiar', courseIndex: 3, modality: 'Presencial', period: 1, shift: 'Noturno', days: 18, gpa: 8.4, att: 96, lastAccess: 0, acc30: 19, accPrev: 8, delivery: 92 },
  { ra: '2647120', name: 'Enzo Gabriel Nogueira', courseIndex: 8, modality: 'Híbrido', period: 1, shift: 'Noturno', days: 26, gpa: 7.1, att: 75, attPrev: 100, lastAccess: 6, acc30: 7, accPrev: 4, delivery: 55, late: 2 },
  { ra: '2646003', name: 'Manuela Ferraz Coelho', courseIndex: 15, modality: 'Híbrido', period: 1, shift: 'Noturno', days: 55, gpa: 8.8, att: 100, lastAccess: 0, acc30: 30, accPrev: 26, delivery: 99 },
  { ra: '2644891', name: 'Otávio Bastos Lemes', courseIndex: 12, modality: 'Híbrido', period: 1, shift: 'Noturno', days: 61, gpa: 5.4, att: 100, lastAccess: 17, acc30: 2, accPrev: 15, delivery: 30, late: 3, failing: 2 },
  { ra: '2643220', name: 'Helena Quintana Bruno', courseIndex: 6, modality: 'Presencial', period: 1, shift: 'Matutino', days: 72, gpa: 7.8, att: 92, lastAccess: 1, acc30: 21, accPrev: 18, delivery: 88 },
  { ra: '2641005', name: 'Caio Vinícius Tavares', courseIndex: 13, modality: 'Híbrido', period: 2, shift: 'Noturno', days: 88, gpa: 6.4, att: 70, attPrev: 92, lastAccess: 11, acc30: 5, accPrev: 20, delivery: 48, overdue: 1, daysOverdue: 14, late: 2 },

  { ra: '2596440', name: 'Larissa Fontes Medeiros', courseIndex: 2, modality: 'Presencial', period: 6, shift: 'Matutino', days: 980, gpa: 9.2, att: 99, lastAccess: 0, acc30: 34, accPrev: 32, delivery: 100 },
  { ra: '2588211', name: 'Pedro Henrique Salgado', courseIndex: 10, modality: 'Presencial', period: 5, shift: 'Noturno', days: 810, gpa: 7.6, att: 89, lastAccess: 2, acc30: 20, accPrev: 22, delivery: 86 },
  { ra: '2577309', name: 'Yasmin Torres Delgado', courseIndex: 4, modality: 'Híbrido', period: 6, shift: 'Noturno', days: 940, gpa: 8.2, att: 91, lastAccess: 1, acc30: 26, accPrev: 24, delivery: 94 },
  { ra: '2571002', name: 'Vitor Hugo Assunção', courseIndex: 16, modality: 'Presencial', period: 8, shift: 'Integral', days: 1210, gpa: 8.5, att: 95, lastAccess: 0, acc30: 28, accPrev: 27, delivery: 96 },
  { ra: '2566880', name: 'Nathália Bezerra Vaz', courseIndex: 1, modality: 'Presencial', period: 7, shift: 'Noturno', days: 1120, gpa: 6.1, att: 72, attPrev: 84, lastAccess: 9, acc30: 8, accPrev: 19, delivery: 58, overdue: 2, daysOverdue: 31, late: 3, failing: 1 },
  { ra: '2562144', name: 'Ricardo Estevão Lins', courseIndex: 9, modality: 'Presencial', period: 6, shift: 'Noturno', days: 990, gpa: 5.7, att: 66, attPrev: 88, lastAccess: 21, acc30: 1, accPrev: 16, delivery: 34, overdue: 3, daysOverdue: 61, deps: 1, failing: 2, cancelPage: true },
  { ra: '2558931', name: 'Aline Castro Peixoto', courseIndex: 5, modality: 'Presencial', period: 7, shift: 'Matutino', days: 1080, gpa: 8.7, att: 97, lastAccess: 0, acc30: 25, accPrev: 24, delivery: 95 },
  { ra: '2554700', name: 'Murilo Sant’Anna Reis', courseIndex: 11, modality: 'Híbrido', period: 4, shift: 'Noturno', days: 690, gpa: 7.3, att: 83, attPrev: 90, lastAccess: 4, acc30: 14, accPrev: 21, delivery: 74, late: 1 },
  { ra: '2549812', name: 'Bianca Ozório Falcão', courseIndex: 14, modality: 'Híbrido', period: 3, shift: 'Noturno', days: 610, gpa: 8.0, att: 100, lastAccess: 1, acc30: 23, accPrev: 22, delivery: 90 },
  { ra: '2545003', name: 'Leandro Bittencourt Sá', courseIndex: 12, modality: 'Híbrido', period: 3, shift: 'Noturno', days: 640, gpa: 6.3, att: 100, lastAccess: 13, acc30: 4, accPrev: 18, delivery: 44, overdue: 1, daysOverdue: 22, late: 2 },
  { ra: '2541190', name: 'Tainá Rodrigues Melo', courseIndex: 7, modality: 'Presencial', period: 6, shift: 'Matutino', days: 950, gpa: 7.9, att: 90, lastAccess: 2, acc30: 19, accPrev: 20, delivery: 87 },
  { ra: '2537744', name: 'Fábio Junqueira Neto', courseIndex: 0, modality: 'Presencial', period: 6, shift: 'Noturno', days: 960, gpa: 7.0, att: 85, lastAccess: 3, acc30: 17, accPrev: 19, delivery: 81, scholarship: 50 },
  { ra: '2532001', name: 'Priscila Amaral Guedes', courseIndex: 3, modality: 'Presencial', period: 8, shift: 'Noturno', days: 1300, gpa: 8.9, att: 98, lastAccess: 0, acc30: 31, accPrev: 30, delivery: 98 },
  { ra: '2528655', name: 'Anderson Klein Poli', courseIndex: 8, modality: 'Híbrido', period: 6, shift: 'Noturno', days: 1010, gpa: 6.6, att: 78, attPrev: 86, lastAccess: 8, acc30: 9, accPrev: 20, delivery: 62, late: 2, failing: 1 },
  { ra: '2524410', name: 'Débora Nascimento Pires', courseIndex: 4, modality: 'Híbrido', period: 7, shift: 'Noturno', days: 1150, gpa: 8.3, att: 93, lastAccess: 1, acc30: 24, accPrev: 23, delivery: 93 },
  { ra: '2519903', name: 'Wesley Portela Cunha', courseIndex: 13, modality: 'Híbrido', period: 4, shift: 'Noturno', days: 700, gpa: 5.9, att: 100, lastAccess: 19, acc30: 2, accPrev: 14, delivery: 36, overdue: 2, daysOverdue: 44, failing: 2, cancelPage: true },
  { ra: '2515220', name: 'Carolina Vasconcelos Dias', courseIndex: 6, modality: 'Híbrido', period: 5, shift: 'Noturno', days: 830, gpa: 8.6, att: 94, lastAccess: 0, acc30: 27, accPrev: 25, delivery: 96 },
  { ra: '2511008', name: 'Igor Sampaio Furtado', courseIndex: 10, modality: 'Presencial', period: 7, shift: 'Noturno', days: 1140, gpa: 7.2, att: 87, lastAccess: 3, acc30: 18, accPrev: 20, delivery: 83, deps: 1 },
  { ra: '2506611', name: 'Renata Bulhões Aquino', courseIndex: 1, modality: 'Presencial', period: 8, shift: 'Matutino', days: 1290, gpa: 9.0, att: 99, lastAccess: 0, acc30: 33, accPrev: 31, delivery: 99 },
  { ra: '2502244', name: 'Alexandre Prado Vilela', courseIndex: 11, modality: 'Presencial', period: 7, shift: 'Noturno', days: 1160, gpa: 6.8, att: 80, attPrev: 87, lastAccess: 6, acc30: 12, accPrev: 19, delivery: 70, late: 1, negotiation: true, overdue: 1, daysOverdue: 11 },
  { ra: '2498100', name: 'Sabrina Elias Moretti', courseIndex: 15, modality: 'Híbrido', period: 5, shift: 'Noturno', days: 880, gpa: 8.1, att: 100, lastAccess: 2, acc30: 21, accPrev: 20, delivery: 89 },
  { ra: '2493377', name: 'Douglas Cerqueira Rangel', courseIndex: 9, modality: 'Presencial', period: 9, shift: 'Noturno', days: 1420, gpa: 7.5, att: 88, lastAccess: 1, acc30: 22, accPrev: 21, delivery: 88, deps: 1 },
  { ra: '2488905', name: 'Milena Toscano Barreto', courseIndex: 5, modality: 'Presencial', period: 8, shift: 'Matutino', days: 1310, gpa: 8.8, att: 97, lastAccess: 0, acc30: 30, accPrev: 29, delivery: 97 },
  { ra: '2484412', name: 'Tomás Erthal Siqueira', courseIndex: 2, modality: 'Presencial', period: 8, shift: 'Noturno', days: 1330, gpa: 6.4, att: 74, attPrev: 83, lastAccess: 10, acc30: 7, accPrev: 17, delivery: 60, overdue: 1, daysOverdue: 18, failing: 1 },
  { ra: '2479008', name: 'Kelly Andrade Vilar', courseIndex: 16, modality: 'Presencial', period: 9, shift: 'Integral', days: 1470, gpa: 8.4, att: 95, lastAccess: 0, acc30: 26, accPrev: 25, delivery: 94 },
  { ra: '2474550', name: 'Eduardo Rezende Mota', courseIndex: 7, modality: 'Presencial', period: 7, shift: 'Matutino', days: 1180, gpa: 7.7, att: 91, lastAccess: 2, acc30: 20, accPrev: 21, delivery: 86 },
  { ra: '2470117', name: 'Juliana Prates Cordeiro', courseIndex: 0, modality: 'Híbrido', period: 5, shift: 'Noturno', days: 870, gpa: 8.0, att: 90, lastAccess: 1, acc30: 25, accPrev: 24, delivery: 92, scholarship: 30 },
  { ra: '2465990', name: 'Sérgio Bandeira Fialho', courseIndex: 14, modality: 'Híbrido', period: 4, shift: 'Noturno', days: 760, gpa: 5.2, att: 100, lastAccess: 24, acc30: 0, accPrev: 12, delivery: 22, overdue: 3, daysOverdue: 73, failing: 2, cancelPage: true },
  { ra: '2461203', name: 'Amanda Vilaça Brandão', courseIndex: 3, modality: 'Presencial', period: 9, shift: 'Noturno', days: 1490, gpa: 9.3, att: 100, lastAccess: 0, acc30: 35, accPrev: 34, delivery: 100 },
  { ra: '2457880', name: 'Rogério Pacheco Nunes', courseIndex: 8, modality: 'Híbrido', period: 8, shift: 'Noturno', days: 1350, gpa: 7.4, att: 86, lastAccess: 4, acc30: 16, accPrev: 20, delivery: 79 },
  { ra: '2452144', name: 'Letícia Marques Bomfim', courseIndex: 6, modality: 'Presencial', period: 8, shift: 'Matutino', days: 1290, gpa: 8.5, att: 96, lastAccess: 1, acc30: 24, accPrev: 23, delivery: 95 },
  { ra: '2448702', name: 'Cristiano Belfort Aguiar', courseIndex: 12, modality: 'Híbrido', period: 4, shift: 'Noturno', days: 720, gpa: 6.0, att: 68, attPrev: 82, lastAccess: 14, acc30: 3, accPrev: 15, delivery: 40, overdue: 2, daysOverdue: 36, late: 3 },
];

const breadth: Student[] = BREADTH.map((b, i) => {
  const course = COURSES[b.courseIndex] ?? COURSES[0];
  return makeStudent({
    id: `st-b${String(i + 1).padStart(2, '0')}`,
    ra: b.ra,
    name: b.name,
    course: course.name,
    modality: b.modality,
    campus: CAMPUS,
    period: b.period,
    shift: b.shift,
    daysSinceEnrollment: b.days,
    gpa: b.gpa,
    attendance: b.att,
    attendancePrev: b.attPrev ?? b.att,
    dependencies: b.deps ?? 0,
    lateAssignments: b.late ?? 0,
    failingSubjects: b.failing ?? 0,
    financial: {
      monthlyFee: course.fee,
      situation: b.scholarship === 100
        ? 'Bolsista integral'
        : b.negotiation
          ? 'Negociação em andamento'
          : (b.overdue ?? 0) >= 2
            ? '2+ parcelas em atraso'
            : (b.overdue ?? 0) === 1
              ? '1 parcela em atraso'
              : 'Regular',
      overdueCount: b.overdue ?? 0,
      outstanding: (b.overdue ?? 0) * course.fee,
      daysOverdue: b.daysOverdue ?? 0,
      hasNegotiation: b.negotiation ?? false,
      scholarshipPercent: b.scholarship ?? 0,
    },
    engagement: eng({
      lastAccessDaysAgo: b.lastAccess,
      accessesLast30Days: b.acc30,
      accessesPrev30Days: b.accPrev,
      deliveryRate: b.delivery,
      weeklyHours: Math.round((b.acc30 / 30) * 7 * 0.9 * 10) / 10,
      forumInteractions: Math.max(0, Math.round(b.acc30 / 4)),
      visitedCancellationPage: b.cancelPage ?? false,
      accessTrend: buildTrend(b.accPrev, b.acc30),
    }),
  });
});

/** Eight weekly buckets interpolating the previous window into the current one. */
function buildTrend(prev: number, current: number): number[] {
  const from = prev / 4.3;
  const to = current / 4.3;
  return Array.from({ length: 8 }, (_, i) => {
    const t = i / 7;
    return Math.max(0, Math.round(from + (to - from) * t));
  });
}

export const STUDENTS: Student[] = [...deep, ...breadth];

/* -- Cases --------------------------------------------------------------- */

function makeCase(input: {
  id: string;
  protocol: string;
  studentId: string;
  title: string;
  radar: Case['radar'];
  signals: string[];
  priority: Case['priority'];
  status: Case['status'];
  specialty: Case['specialty'];
  assigneeId: string | null;
  openedMinutesAgo: number;
  slaHours?: number;
  diagnosis: string;
  recommendedAction: string;
  hold?: Partial<Case['hold']>;
  notes?: { author: string; text: string; minutesAgo: number }[];
  firstContactMinutesAgo?: number;
  closedMinutesAgo?: number;
  closingReason?: string;
  reopenCount?: number;
}): Case {
  const openedAt = isoMinusMinutes(input.openedMinutesAgo, BOOT);
  const slaHours = input.slaHours ?? RADARS[input.radar].defaultSlaHours;
  const holdActive = input.hold?.active ?? false;

  const history: Case['history'] = [
    { id: `${input.id}-h0`, from: null, to: 'Pendente', at: openedAt, by: 'Radar' },
  ];
  if (input.firstContactMinutesAgo !== undefined) {
    history.push({
      id: `${input.id}-h1`,
      from: 'Pendente',
      to: 'Em Contato',
      at: isoMinusMinutes(input.firstContactMinutesAgo, BOOT),
      by: SPECIALISTS.find((s) => s.id === input.assigneeId)?.name ?? 'Sistema',
    });
  }
  if (input.status !== 'Pendente' && input.status !== 'Em Contato') {
    history.push({
      id: `${input.id}-h2`,
      from: 'Em Contato',
      to: input.status,
      at: isoMinusMinutes(input.closedMinutesAgo ?? Math.max(1, input.openedMinutesAgo - 60), BOOT),
      by: SPECIALISTS.find((s) => s.id === input.assigneeId)?.name ?? 'Sistema',
    });
  }

  return {
    id: input.id,
    protocol: input.protocol,
    studentId: input.studentId,
    title: input.title,
    radar: input.radar,
    signals: input.signals,
    priority: input.priority,
    status: input.status,
    specialty: input.specialty,
    assigneeId: input.assigneeId,
    openedAt,
    slaHours,
    slaDueAt: addBusinessHours(openedAt, slaHours, DEFAULT_WINDOW),
    ...(input.closedMinutesAgo !== undefined
      ? { closedAt: isoMinusMinutes(input.closedMinutesAgo, BOOT) }
      : {}),
    ...(input.firstContactMinutesAgo !== undefined
      ? { firstContactAt: isoMinusMinutes(input.firstContactMinutesAgo, BOOT) }
      : {}),
    ...(input.closingReason ? { closingReason: input.closingReason } : {}),
    diagnosis: input.diagnosis,
    recommendedAction: input.recommendedAction,
    hold: {
      active: holdActive,
      activatedBy: input.hold?.activatedBy ?? '',
      activatedAt: holdActive ? isoMinusMinutes(input.openedMinutesAgo - 2, BOOT) : '',
      suppressed: input.hold?.suppressed ?? [],
      blockedCount: input.hold?.blockedCount ?? 0,
    },
    notes: (input.notes ?? []).map((n, i) => ({
      id: `${input.id}-n${i}`,
      author: n.author,
      text: n.text,
      at: isoMinusMinutes(n.minutesAgo, BOOT),
    })),
    history,
    reopenCount: input.reopenCount ?? 0,
  };
}

export const CASES: Case[] = [
  makeCase({
    id: 'case-0891',
    protocol: 'CSA-2026-0891',
    studentId: 'st-ana',
    title: 'Intenção de saída — quatro sinais convergentes',
    radar: 'evasao',
    signals: [
      '12 dias sem acesso ao AVA',
      '2 parcelas em aberto (R$ 1.700,00) há 38 dias',
      'Frequência caiu de 91% para 68%',
      'Baixou o formulário de trancamento de matrícula',
    ],
    priority: 'Crítico',
    status: 'Pendente',
    specialty: 'Retenção',
    assigneeId: 'spec-mariana',
    openedMinutesAgo: 218,
    diagnosis:
      'A saída já está sendo processada pela aluna: o download do formulário de trancamento é o sinal terminal. O gatilho provável é financeiro (38 dias de atraso), com o desempenho acadêmico como consequência e não como causa. Abrir pela dívida encerra a conversa.',
    recommendedAction:
      'Ligação imediata do Especialista de Retenção. Escutar antes de propor. Condição de repactuação pré-autorizada em até 10x e plano de reposição de presença com a coordenação.',
    hold: {
      active: true,
      activatedBy: 'Sistema (regra Humano-Primeiro)',
      suppressed: ['Régua de cobrança D+30', 'SMS promocional de rematrícula', 'E-mail marketing institucional'],
      blockedCount: 7,
    },
    notes: [
      {
        author: 'Sistema de Governança',
        text: 'Freio Concorrente ativado automaticamente na abertura do caso. 7 disparos automáticos bloqueados até agora.',
        minutesAgo: 216,
      },
    ],
  }),

  makeCase({
    id: 'case-0892',
    protocol: 'CSA-2026-0892',
    studentId: 'st-bruno',
    title: 'Desengajamento a um período da conclusão',
    radar: 'engajamento',
    signals: [
      '15 dias sem login no AVA',
      'Terceira falta em encontro quinzenal (limite: 4)',
      'Entrega parcial do Projeto Integrador III não realizada',
      'Acessos: 28 → 3 na comparação de 30 dias',
    ],
    priority: 'Crítico',
    status: 'Em Contato',
    specialty: 'Engajamento',
    assigneeId: 'spec-fernanda',
    openedMinutesAgo: 158,
    firstContactMinutesAgo: 96,
    slaHours: 4,
    diagnosis:
      'Aluno no 3º de 4 períodos, sem qualquer pendência financeira e com histórico anterior consistente. O padrão — queda abrupta e total, sem gatilho econômico — aponta para ruptura de rotina externa. A proximidade da conclusão é o principal ativo da conversa.',
    recommendedAction:
      'WhatsApp acolhedor com cronograma do módulo e prazo real do Projeto Integrador. Reforçar que faltam poucos meses para o diploma.',
    hold: {
      active: true,
      activatedBy: 'Fernanda Costa',
      suppressed: ['Régua de engajamento automática', 'Push de atividade pendente'],
      blockedCount: 3,
    },
    notes: [
      {
        author: 'Fernanda Costa',
        text: 'Mensagem enviada no WhatsApp às 09:12 com o cronograma do módulo. Visualizada, sem resposta ainda. Se não responder até o fim do dia, tentar ligação.',
        minutesAgo: 92,
      },
    ],
  }),

  makeCase({
    id: 'case-0888',
    protocol: 'CSA-2026-0888',
    studentId: 'st-camila',
    title: 'Inadimplência recorrente com vínculo acadêmico preservado',
    radar: 'financeiro',
    signals: [
      '3 mensalidades vencidas (R$ 3.120,00)',
      'Atraso de 52 dias — fora da janela preventiva',
      'Nenhuma negociação registrada',
      'Frequência de 93% e média 8,1 mantidas',
    ],
    priority: 'Alto',
    status: 'Aguardando Retorno',
    specialty: 'Financeiro',
    assigneeId: 'spec-rodrigo',
    openedMinutesAgo: 1500,
    firstContactMinutesAgo: 1380,
    closedMinutesAgo: 1370,
    diagnosis:
      'Bloqueio exclusivamente financeiro. Frequência de 93%, média 8,1 e estágio supervisionado em curso mostram vínculo intacto — o risco aqui é o impedimento administrativo de rematrícula, não a desistência.',
    recommendedAction:
      'Repactuação em até 10x sem juros punitivos, preservando a matrícula no estágio supervisionado do 6º período.',
    hold: {
      active: true,
      activatedBy: 'Rodrigo Martins',
      suppressed: ['Régua de cobrança D+45', 'Notificação de bloqueio de portal'],
      blockedCount: 5,
    },
    notes: [
      {
        author: 'Rodrigo Martins',
        text: 'Proposta de 10x sem juros enviada por WhatsApp e e-mail. Aluna confirmou leitura e pediu até sexta para conversar com a família.',
        minutesAgo: 1365,
      },
    ],
  }),

  makeCase({
    id: 'case-0885',
    protocol: 'CSA-2026-0885',
    studentId: 'st-lucas',
    title: 'Duas disciplinas abaixo da média no eixo de dados',
    radar: 'academico',
    signals: [
      'Estruturas de Dados Avançadas: 4,5',
      'Banco de Dados Relacional: 4,9',
      '3 atividades laboratoriais sem envio',
      'Frequência de 84% — presença preservada',
    ],
    priority: 'Alto',
    status: 'Pendente',
    specialty: 'Acadêmico',
    assigneeId: 'spec-carlos',
    openedMinutesAgo: 640,
    diagnosis:
      'Dificuldade conceitual concentrada em um único eixo, com presença preservada em 84%. Esse é o cenário de maior taxa de resposta a monitoria: o aluno está tentando e não está conseguindo.',
    recommendedAction:
      'Encaminhar para monitoria do eixo de dados, ativar plantão de dúvidas e montar plano de estudos com a coordenação antes do fechamento do bimestre.',
  }),

  makeCase({
    id: 'case-0880',
    protocol: 'CSA-2026-0880',
    studentId: 'st-matheus',
    title: 'Calouro sem ambientação no AVA após 22 dias',
    radar: 'atendimento',
    signals: [
      '9 dias sem acesso ao AVA',
      'Apenas 2 acessos desde a matrícula',
      '2 chamados abertos sobre acesso às aulas',
      'Nenhuma etapa de integração concluída',
    ],
    priority: 'Alto',
    status: 'Pendente',
    specialty: 'Onboarding',
    assigneeId: 'spec-larissa',
    openedMinutesAgo: 1100,
    diagnosis:
      'Problema de navegação, não de interesse: dois chamados abertos pelo próprio aluno pedindo ajuda para encontrar as aulas. Régua de acolhimento — está dentro dos 90 dias e por isso fora da fila de evasão.',
    recommendedAction:
      'Chamada de onboarding com demonstração guiada do AVA pelo celular. Instalar o app junto com o aluno e confirmar a primeira entrega.',
  }),

  makeCase({
    id: 'case-0879',
    protocol: 'CSA-2026-0879',
    studentId: 'st-felipe',
    title: 'Sétima falta em Cálculo II — uma do limite regimental',
    radar: 'academico',
    signals: [
      'Cálculo II: 7 faltas de um limite de 8',
      'Frequência global em 74%',
      'Queda de 15 p.p. na frequência no ciclo',
      '1 parcela em aberto há 12 dias',
    ],
    priority: 'Alto',
    status: 'Em Contato',
    specialty: 'Acadêmico',
    assigneeId: 'spec-carlos',
    openedMinutesAgo: 900,
    firstContactMinutesAgo: 420,
    diagnosis:
      'Uma falta separa o aluno da reprovação por frequência, independentemente da nota. A causa é logística: novo estágio incompatível com o deslocamento noturno até o campus.',
    recommendedAction:
      'Contato imediato explicando o risco regimental. Avaliar reposição, ajuste de turma ou transferência de turno com a coordenação.',
    notes: [
      {
        author: 'Carlos Eduardo Paiva',
        text: 'Ligação atendida. Aluno explicou o conflito com o estágio novo. Vou levar à coordenação a possibilidade de transferência para a turma de sábado.',
        minutesAgo: 400,
      },
    ],
  }),

  makeCase({
    id: 'case-0877',
    protocol: 'CSA-2026-0877',
    studentId: 'st-thiago-a',
    title: 'Queda de 62% nos acessos em curso 100% digital',
    radar: 'engajamento',
    signals: [
      '8 dias sem login no AVA',
      'Acessos: 24 → 9 na comparação de 30 dias',
      '2 sprints de Desenvolvimento Web sem entrega',
      'Negociação financeira ativa sem confirmação',
    ],
    priority: 'Médio',
    status: 'Pendente',
    specialty: 'Engajamento',
    assigneeId: 'spec-fernanda',
    openedMinutesAgo: 1320,
    diagnosis:
      'No híbrido o AVA responde por 27% do Health Score, o que amplifica o impacto da ausência entre encontros. Há um segundo fio solto: o termo de negociação assinado há 9 dias sem confirmação de pagamento.',
    recommendedAction:
      'Contato único resolvendo os dois pontos: confirmar o acordo financeiro e liberar o cronograma das sprints em atraso. Evitar dois contatos separados.',
  }),

  makeCase({
    id: 'case-0874',
    protocol: 'CSA-2026-0874',
    studentId: 'st-giovanna',
    title: 'Primeiro atraso na janela preventiva D+7',
    radar: 'financeiro',
    signals: [
      'Primeira mensalidade em aberto há 7 dias',
      'Calouro com 31 dias de matrícula',
      'Sem histórico prévio de inadimplência',
    ],
    priority: 'Médio',
    status: 'Pendente',
    specialty: 'Financeiro',
    assigneeId: null,
    openedMinutesAgo: 1450,
    diagnosis:
      'Exatamente a janela em que o radar financeiro existe para atuar: D+7, primeiro atraso, sem recorrência. Resolver agora custa uma mensagem; resolver em D+45 custa a matrícula.',
    recommendedAction:
      'Orientação sobre emissão de PIX/boleto e apresentação das bolsas internas disponíveis para o primeiro período.',
  }),

  makeCase({
    id: 'case-0871',
    protocol: 'CSA-2026-0871',
    studentId: 'st-b12',
    title: 'Risco de evasão consolidado — três parcelas e 21 dias sem acesso',
    radar: 'evasao',
    signals: [
      '21 dias sem acesso ao AVA',
      '3 parcelas em aberto há 61 dias',
      'Frequência caiu de 88% para 66%',
      'Consultou a página de trancamento',
    ],
    priority: 'Crítico',
    status: 'Em Contato',
    specialty: 'Retenção',
    assigneeId: 'spec-mariana',
    openedMinutesAgo: 2600,
    firstContactMinutesAgo: 2400,
    diagnosis:
      'Todos os vetores acionados simultaneamente e uma dependência acumulada no histórico. Caso de altíssima criticidade, no 6º período de Engenharia Civil — a perda aqui é de um aluno com investimento de três anos.',
    recommendedAction:
      'Atendimento presencial com a coordenação e o financeiro na mesma mesa. Resolver dívida e integralização numa única sessão.',
    hold: {
      active: true,
      activatedBy: 'Mariana Ribeiro',
      suppressed: ['Régua de cobrança D+60', 'Notificação de bloqueio', 'E-mail marketing institucional'],
      blockedCount: 11,
    },
    notes: [
      {
        author: 'Mariana Ribeiro',
        text: 'Duas tentativas de ligação sem sucesso. Enviei WhatsApp com convite para atendimento presencial nesta quinta com o financeiro presente.',
        minutesAgo: 2380,
      },
    ],
  }),

  makeCase({
    id: 'case-0869',
    protocol: 'CSA-2026-0869',
    studentId: 'st-b22',
    title: 'Ausência total no AVA com histórico de inadimplência',
    radar: 'evasao',
    signals: [
      '19 dias sem acesso ao AVA',
      '2 parcelas em aberto há 44 dias',
      '2 disciplinas abaixo de 5,0',
      'Consultou a página de trancamento',
    ],
    priority: 'Crítico',
    status: 'Pendente',
    specialty: 'Retenção',
    assigneeId: null,
    openedMinutesAgo: 3100,
    diagnosis:
      'Aluno híbrido no 4º período com convergência completa de sinais. Sem responsável atribuído — este caso já consumiu 100% do SLA e precisa de dono agora.',
    recommendedAction: 'Atribuir imediatamente ao Especialista de Retenção e iniciar contato telefônico.',
  }),

  makeCase({
    id: 'case-0866',
    protocol: 'CSA-2026-0866',
    studentId: 'st-b34',
    title: 'Aluno sem qualquer acesso há 24 dias e três parcelas em aberto',
    radar: 'evasao',
    signals: [
      '24 dias sem acesso ao AVA',
      '3 parcelas em aberto há 73 dias',
      'Taxa de entrega em 22%',
      'Consultou a página de trancamento',
    ],
    priority: 'Crítico',
    status: 'Aguardando Retorno',
    specialty: 'Retenção',
    assigneeId: 'spec-mariana',
    openedMinutesAgo: 4300,
    firstContactMinutesAgo: 4100,
    closedMinutesAgo: 4080,
    diagnosis:
      'Situação mais grave da fila em termos absolutos. Contato feito, aluno pediu prazo para decidir. A janela de reversão está se fechando.',
    recommendedAction:
      'Aguardar o prazo pedido pelo aluno, mas com follow-up firme agendado. Não deixar o caso silenciar.',
    hold: {
      active: true,
      activatedBy: 'Mariana Ribeiro',
      suppressed: ['Régua de cobrança externa', 'Notificação de bloqueio'],
      blockedCount: 9,
    },
  }),

  makeCase({
    id: 'case-0861',
    protocol: 'CSA-2026-0861',
    studentId: 'st-rafael',
    title: 'Duas dependências acumuladas no 7º período',
    radar: 'academico',
    signals: [
      '2 dependências acumuladas',
      'Frequência global em 81%',
      'Estruturas de Concreto II com média 6,1',
    ],
    priority: 'Médio',
    status: 'Acordo Firmado',
    specialty: 'Acadêmico',
    assigneeId: 'spec-carlos',
    openedMinutesAgo: 7200,
    firstContactMinutesAgo: 7000,
    closedMinutesAgo: 5700,
    closingReason: 'Plano de estudos e monitoria acordados',
    diagnosis:
      'Acúmulo de dependências comprometendo a integralização no prazo — preditor forte de desistência na reta final do curso.',
    recommendedAction: 'Plano de integralização priorizando a quitação das dependências.',
  }),

  /* Closed inside the current shift by the attendant the app boots as — so
     "resolvidos hoje" is a live number from the first render, not a zero that
     only moves if someone closes a case during the demo. */
  makeCase({
    id: 'case-0894',
    protocol: 'CSA-2026-0894',
    studentId: 'st-b14',
    title: 'Queda de ritmo no AVA após mudança de turno no trabalho',
    radar: 'engajamento',
    signals: [
      'Acessos ao AVA caíram de 21 para 14 no ciclo',
      'Frequência de 90% para 83%',
      '1 atividade entregue em atraso',
    ],
    priority: 'Médio',
    status: 'Acordo Firmado',
    specialty: 'Retenção',
    assigneeId: 'spec-mariana',
    openedMinutesAgo: 400,
    firstContactMinutesAgo: 260,
    closedMinutesAgo: 90,
    closingReason: 'Plano de estudos reorganizado com o aluno',
    diagnosis:
      'Queda simultânea de acesso e frequência sem nenhum sinal financeiro ou acadêmico grave por trás. Perfil de sobrecarga de rotina, não de desistência.',
    recommendedAction:
      'Remanejar o estudo dirigido para o fim de semana e confirmar presença no próximo encontro quinzenal.',
    notes: [
      {
        author: 'Mariana Ribeiro',
        text: 'Mudou de turno no trabalho e perdeu a janela de estudo da noite. Combinamos sábado de manhã e ele confirmou o encontro quinzenal.',
        minutesAgo: 95,
      },
    ],
  }),

  makeCase({
    id: 'case-0855',
    protocol: 'CSA-2026-0855',
    studentId: 'st-beatriz',
    title: 'Queda de engajamento no módulo 4',
    radar: 'engajamento',
    signals: ['11 dias sem login no AVA', 'Duas atividades do módulo 4 em atraso'],
    priority: 'Médio',
    status: 'Acordo Firmado',
    specialty: 'Engajamento',
    assigneeId: 'spec-fernanda',
    openedMinutesAgo: 46_000,
    firstContactMinutesAgo: 45_800,
    closedMinutesAgo: 37_400,
    closingReason: 'Plano de estudos e monitoria acordados',
    diagnosis:
      'Sobrecarga de rotina no módulo 4 combinada a dificuldade em Saúde Coletiva. Vínculo com o curso preservado.',
    recommendedAction: 'Monitoria de Saúde Coletiva e replanejamento do cronograma de estudos.',
  }),

  makeCase({
    id: 'case-0848',
    protocol: 'CSA-2026-0848',
    studentId: 'st-b04',
    title: 'Desengajamento total em curso híbrido',
    radar: 'evasao',
    signals: ['17 dias sem acesso', 'Taxa de entrega em 30%', '2 disciplinas abaixo de 5,0'],
    priority: 'Crítico',
    status: 'Evasão Inevitável',
    specialty: 'Retenção',
    assigneeId: 'spec-mariana',
    openedMinutesAgo: 60_000,
    firstContactMinutesAgo: 59_600,
    closedMinutesAgo: 51_000,
    closingReason: 'Mudança de cidade ou de rotina de trabalho',
    diagnosis:
      'Aluno assumiu turno fixo incompatível com os encontros síncronos após mudança de emprego.',
    recommendedAction: 'Oferecida migração de turno e plano de recuperação. Aluno optou por trancar e retornar em 2027.',
  }),

  makeCase({
    id: 'case-0844',
    protocol: 'CSA-2026-0844',
    studentId: 'st-b11',
    title: 'Inadimplência com queda acadêmica associada',
    radar: 'evasao',
    signals: ['2 parcelas em aberto há 31 dias', 'Frequência caiu de 84% para 72%', '3 atividades em atraso'],
    priority: 'Crítico',
    status: 'Evasão Inevitável',
    specialty: 'Retenção',
    assigneeId: 'spec-rodrigo',
    openedMinutesAgo: 72_000,
    firstContactMinutesAgo: 71_600,
    closedMinutesAgo: 63_000,
    closingReason: 'Dificuldade financeira sem solução viável',
    diagnosis: 'Perda de renda familiar. Nenhuma das condições de repactuação disponíveis era sustentável.',
    recommendedAction: 'Trancamento orientado com direito a retorno preservado e reserva de vaga.',
    reopenCount: 1,
  }),

  makeCase({
    id: 'case-0839',
    protocol: 'CSA-2026-0839',
    studentId: 'st-gustavo',
    title: 'Frequência em queda com atividades acumuladas',
    radar: 'academico',
    signals: ['Frequência caiu de 88% para 79%', '2 atividades em atraso'],
    priority: 'Baixo',
    status: 'Cancelado',
    specialty: 'Acadêmico',
    assigneeId: 'spec-carlos',
    openedMinutesAgo: 8600,
    closedMinutesAgo: 8100,
    closingReason: 'Alerta improcedente — aluno já regularizado',
    diagnosis: 'Ausências justificadas por atestado médico já protocolado na secretaria.',
    recommendedAction: 'Nenhuma ação necessária. Alerta descartado e registrado para calibração do radar.',
  }),
];

/* -- Interaction history ------------------------------------------------- */

export const INTERACTIONS: Interaction[] = [
  {
    id: 'int-1',
    studentId: 'st-camila',
    caseId: 'case-0888',
    channel: 'WhatsApp',
    kind: 'Negociação Financeira',
    outcome: 'Aguardando aluno',
    cause: 'Redução de renda familiar após desemprego do cônjuge em junho.',
    intervention:
      'Apresentada simulação de repactuação do saldo de R$ 3.120,00 em 10x sem juros punitivos, com primeira parcela em 15 dias.',
    result: 'Aluna confirmou leitura e pediu até sexta para alinhar com a família antes de aceitar.',
    nextStep: 'Retomar contato na sexta para confirmar o aceite e emitir o termo.',
    nextStepDate: isoPlusDays(2, BOOT),
    specialistId: 'spec-rodrigo',
    specialistName: 'Rodrigo Martins',
    at: isoMinusMinutes(1365, BOOT),
    timestamp: BOOT - 1365 * 60_000,
    scoreDelta: 0,
  },
  {
    id: 'int-2',
    studentId: 'st-felipe',
    caseId: 'case-0879',
    channel: 'Telefone',
    kind: 'Orientação Pedagógica',
    outcome: 'Parcialmente resolvido',
    cause:
      'Início de estágio em Campinas tornou o deslocamento até o campus incompatível com o horário das aulas de segunda e quarta.',
    intervention:
      'Explicado o risco de reprovação por frequência (7 de 8 faltas). Levantada a possibilidade de transferência para a turma de sábado.',
    result:
      'Aluno entendeu a gravidade e concorda com a transferência. Depende de aprovação da coordenação do curso.',
    nextStep: 'Levar o pedido de transferência de turma à coordenação de Ciência da Computação.',
    nextStepDate: isoPlusDays(1, BOOT),
    specialistId: 'spec-carlos',
    specialistName: 'Carlos Eduardo Paiva',
    at: isoMinusMinutes(400, BOOT),
    timestamp: BOOT - 400 * 60_000,
    scoreDelta: 3,
  },
  {
    id: 'int-3',
    studentId: 'st-bruno',
    caseId: 'case-0892',
    channel: 'WhatsApp',
    kind: 'Acolhimento',
    outcome: 'Sem contato',
    cause: 'Ausência não explicada — sem gatilho financeiro ou acadêmico identificado nos dados.',
    intervention:
      'Mensagem acolhedora com cronograma do módulo 3 e prazo real do Projeto Integrador III, reforçando a proximidade da conclusão.',
    result: 'Mensagem visualizada, sem resposta até o momento.',
    nextStep: 'Se não responder até o fim do dia, tentar ligação no período noturno.',
    nextStepDate: isoPlusDays(1, BOOT),
    specialistId: 'spec-fernanda',
    specialistName: 'Fernanda Costa',
    at: isoMinusMinutes(92, BOOT),
    timestamp: BOOT - 92 * 60_000,
    scoreDelta: 0,
  },
  {
    id: 'int-4',
    studentId: 'st-beatriz',
    caseId: 'case-0855',
    channel: 'Telefone',
    kind: 'Retenção',
    outcome: 'Resolvido',
    cause:
      'Sobrecarga de rotina no módulo 4 somada a dificuldade específica em Saúde Coletiva.',
    intervention:
      'Monitoria de Saúde Coletiva ativada e cronograma de estudos replanejado junto com a coordenação do curso.',
    result:
      'Aluna retomou o ritmo de acessos na semana seguinte. Health Score recuperou de 52 para 86.',
    nextStep: 'Acompanhamento mensal até o fechamento do módulo 5.',
    nextStepDate: isoPlusDays(12, BOOT),
    specialistId: 'spec-fernanda',
    specialistName: 'Fernanda Costa',
    at: isoMinusMinutes(37_400, BOOT),
    timestamp: BOOT - 37_400 * 60_000,
    scoreDelta: 15,
  },
  {
    id: 'int-5',
    studentId: 'st-rafael',
    caseId: 'case-0861',
    channel: 'Presencial',
    kind: 'Orientação Pedagógica',
    outcome: 'Resolvido',
    cause: 'Duas dependências acumuladas comprometendo a integralização no prazo previsto.',
    intervention:
      'Montado plano de integralização com a coordenação de Engenharia Civil, priorizando Hidrologia na turma de sábado.',
    result: 'Aluno matriculado em Hidrologia e ciente do cronograma até a formatura.',
    nextStep: 'Verificar desempenho em Hidrologia no fechamento do primeiro bimestre.',
    nextStepDate: isoPlusDays(21, BOOT),
    specialistId: 'spec-carlos',
    specialistName: 'Carlos Eduardo Paiva',
    at: isoMinusMinutes(5700, BOOT),
    timestamp: BOOT - 5700 * 60_000,
    scoreDelta: 8,
  },
  {
    id: 'int-6',
    studentId: 'st-victor',
    channel: 'Portal',
    kind: 'Suporte AVA',
    outcome: 'Resolvido',
    cause: 'Dúvida sobre onde encontrar os materiais da disciplina híbrida de Estatística.',
    intervention: 'Enviado tutorial de navegação no AVA com o caminho direto para a sala virtual.',
    result: 'Dúvida resolvida no primeiro contato. Aluno confirmou acesso.',
    nextStep: 'Nenhuma ação pendente. Acompanhamento de rotina.',
    specialistId: 'spec-larissa',
    specialistName: 'Larissa Pereira',
    at: isoPlusDays(-8, BOOT),
    timestamp: BOOT - 8 * 86_400_000,
    scoreDelta: 2,
  },
  {
    id: 'int-7',
    studentId: 'st-b12',
    caseId: 'case-0871',
    channel: 'Telefone',
    kind: 'Retenção',
    outcome: 'Sem contato',
    cause: 'Não identificada — sem contato estabelecido.',
    intervention: 'Duas tentativas de ligação sem resposta. Enviado WhatsApp com convite para atendimento presencial.',
    result: 'Sem retorno até o momento.',
    nextStep: 'Terceira tentativa de contato e acionamento do contato secundário do cadastro.',
    nextStepDate: isoPlusDays(1, BOOT),
    specialistId: 'spec-mariana',
    specialistName: 'Mariana Ribeiro',
    at: isoMinusMinutes(2380, BOOT),
    timestamp: BOOT - 2380 * 60_000,
    scoreDelta: 0,
  },
];

/* -- Scheduled follow-ups ------------------------------------------------ */

export const FOLLOW_UPS: FollowUp[] = [
  {
    id: 'fu-1',
    studentId: 'st-camila',
    caseId: 'case-0888',
    title: 'Confirmar aceite da repactuação em 10x',
    dueDate: isoPlusDays(2, BOOT),
    notes: 'Aluna pediu prazo até sexta para alinhar com a família.',
    ownerId: 'spec-rodrigo',
    ownerName: 'Rodrigo Martins',
    status: 'Agendado',
    createdAt: isoMinusMinutes(1365, BOOT),
  },
  {
    id: 'fu-2',
    studentId: 'st-felipe',
    caseId: 'case-0879',
    title: 'Levar transferência de turma à coordenação',
    dueDate: isoPlusDays(1, BOOT),
    notes: 'Turma de sábado de Cálculo II. Verificar vaga disponível.',
    ownerId: 'spec-carlos',
    ownerName: 'Carlos Eduardo Paiva',
    status: 'Agendado',
    createdAt: isoMinusMinutes(400, BOOT),
  },
  {
    id: 'fu-3',
    studentId: 'st-bruno',
    caseId: 'case-0892',
    title: 'Tentar ligação no período noturno',
    dueDate: isoPlusDays(0, BOOT),
    notes: 'WhatsApp visualizado sem resposta. Escalar para ligação.',
    ownerId: 'spec-fernanda',
    ownerName: 'Fernanda Costa',
    status: 'Agendado',
    createdAt: isoMinusMinutes(90, BOOT),
  },
  {
    id: 'fu-4',
    studentId: 'st-victor',
    title: 'Checagem leve sobre queda de acesso ao AVA',
    dueDate: isoPlusDays(3, BOOT),
    notes: 'Contato de acompanhamento, sem urgência. Entender se houve mudança de rotina profissional.',
    ownerId: 'spec-mariana',
    ownerName: 'Mariana Ribeiro',
    status: 'Agendado',
    createdAt: isoPlusDays(-2, BOOT),
  },
  {
    id: 'fu-5',
    studentId: 'st-beatriz',
    caseId: 'case-0855',
    title: 'Acompanhamento mensal pós-recuperação',
    dueDate: isoPlusDays(12, BOOT),
    notes: 'Confirmar manutenção do ritmo até o fechamento do módulo 5.',
    ownerId: 'spec-fernanda',
    ownerName: 'Fernanda Costa',
    status: 'Agendado',
    createdAt: isoMinusMinutes(37_400, BOOT),
  },
];

/* -- Notifications ------------------------------------------------------- */

export const NOTIFICATIONS: AppNotification[] = [
  {
    id: 'ntf-1',
    kind: 'critico',
    title: 'Novo caso crítico de evasão',
    detail: 'Ana Souza Rezende (RA 2589123) baixou o formulário de trancamento com 2 parcelas em aberto.',
    at: isoMinusMinutes(218, BOOT),
    read: false,
    studentId: 'st-ana',
    caseId: 'case-0891',
  },
  {
    id: 'ntf-2',
    kind: 'sla',
    title: 'SLA estourado sem responsável',
    detail: 'CSA-2026-0869 (híbrido, 4º período) está sem atribuição e já passou do prazo de 4 horas úteis.',
    at: isoMinusMinutes(140, BOOT),
    read: false,
    caseId: 'case-0869',
  },
  {
    id: 'ntf-3',
    kind: 'sla',
    title: 'SLA próximo do vencimento',
    detail: 'CSA-2026-0892 de Bruno Henrique Vieira vence dentro da próxima hora útil.',
    at: isoMinusMinutes(95, BOOT),
    read: false,
    studentId: 'st-bruno',
    caseId: 'case-0892',
  },
  {
    id: 'ntf-4',
    kind: 'atribuicao',
    title: 'Caso atribuído a você',
    detail: 'CSA-2026-0891 (Ana Souza Rezende) foi roteado para sua fila com prioridade crítica.',
    at: isoMinusMinutes(216, BOOT),
    read: false,
    studentId: 'st-ana',
    caseId: 'case-0891',
  },
  {
    id: 'ntf-5',
    kind: 'followup',
    title: 'Acompanhamento vence hoje',
    detail: 'Tentar ligação noturna para Bruno Henrique Vieira — WhatsApp visualizado sem resposta.',
    at: isoMinusMinutes(60, BOOT),
    read: false,
    studentId: 'st-bruno',
    caseId: 'case-0892',
  },
  {
    id: 'ntf-6',
    kind: 'resposta',
    title: 'Aluna respondeu',
    detail: 'Camila Barbosa Lima confirmou leitura da proposta e pediu prazo até sexta.',
    at: isoMinusMinutes(1360, BOOT),
    read: true,
    studentId: 'st-camila',
    caseId: 'case-0888',
  },
  {
    id: 'ntf-7',
    kind: 'sucesso',
    title: 'Aluna recuperada',
    detail: 'Beatriz Alcântara Moura saiu do radar de risco: Health Score de 52 para 86.',
    at: isoPlusDays(-4, BOOT),
    read: true,
    studentId: 'st-beatriz',
  },
];

/* -- Governance defaults ------------------------------------------------- */

export const DEFAULT_SETTINGS: GovernanceSettings = {
  slaHours: {
    evasao: 4,
    academico: 24,
    engajamento: 48,
    financeiro: 24,
    atendimento: 12,
  },
  weights: DEFAULT_WEIGHTS,
  onboardingWindowDays: ONBOARDING_WINDOW,
  humanFirst: true,
  lgpdStrict: true,
  segregateOnboarding: true,
  businessHours: DEFAULT_WINDOW,
};
