import type { Discipline, Student } from '../types';
import { STUDENTS } from './seed';

/* ==========================================================================
   Perfis de demonstração da Trilha do Aluno
   --------------------------------------------------------------------------
   Cinco perfis prontos, um por SITUAÇÃO que a trilha precisa saber resolver.
   Não são alunos da base e não entram nela: são o conjunto mínimo de casos que
   alguém precisa ver lado a lado para responder «a tela funciona?».

     · híbrido ingressante  → quinzenal de ingressantes, dispensa na 1ª híbrida
     · híbrido veterano     → quinzenal de veteranos, outro PDF, outro ritmo
     · presencial calouro   → seis disciplinas diárias, calendário guarda-chuva
     · presencial veterano  → o mesmo calendário com duas disciplinas dispensadas
     · Direito híbrido vet. → sextas e sábados, o PDF que só Direito usa

   O QUE É OFICIAL E O QUE É ILUSTRATIVO, E POR QUE A DIVISÃO IMPORTA

   O calendário de cada perfil é o DOCUMENTO REAL: o curso e a coorte declarados
   aqui resolvem para o mesmo PDF que resolveriam se o aluno existisse, e todas
   as datas que o aparelho mostra saem dele. Nada de data escrita à mão.

   O que é ilustrativo é a GRADE — nome de disciplina, docente, horário, nota.
   Nenhuma instituição publica a grade nominal de um aluno inventado, e sem
   grade metade da tela não teria o que demonstrar: o card do dia, a dispensa, a
   tradução de «1ª disciplina híbrida» para um nome. A grade é o mínimo que
   torna o resto visível, e o aparelho carrega a tarja de prévia simulada em
   todas as telas para que nenhum print circule como se fosse um aluno real.

   A âncora dos horários é o TURNO, e a dos encontros é o RITMO do PDF: o
   quinzenal de veteranos se encontra aos sábados, o de Direito às sextas e
   sábados, e é isso que os campos `schedule` dizem.
   ========================================================================== */

export interface TrilhaPreview {
  /** RA de demonstração. Vai para o hash da URL e para a tela do aparelho. */
  ra: string;
  /** Rótulo do atalho, curto o bastante para caber numa fileira de cinco. */
  chip: string;
  /** Como o cabeçalho da aba nomeia o perfil, no lugar do nome do aluno. */
  label: string;
  /** O que este perfil existe para demonstrar. */
  note: string;
  student: Student;
}

/* -- Grade ilustrativa ---------------------------------------------------- */

let seq = 0;

function d(row: Partial<Discipline> & { name: string }): Discipline {
  seq += 1;
  return {
    id: `previa-d${seq}`,
    code: `DEMO-${String(seq).padStart(2, '0')}`,
    teacher: 'Docente a confirmar',
    format: 'Presencial',
    grade: 0,
    attendancePercent: 0,
    absences: 0,
    absenceLimit: 10,
    pendingActivities: 0,
    schedule: 'Consulte o calendário acadêmico',
    status: 'Em curso',
    ...row,
  };
}

/* -- Montagem do perfil ---------------------------------------------------
   `STUDENTS[0]` entra como molde da FORMA do registro — campus, totais, campos
   que o motor de score preenche — e não como fonte de dado nenhum: tudo o que
   a trilha lê está sobrescrito abaixo. */

interface PreviewSpec extends Omit<TrilhaPreview, 'student'> {
  name: string;
  initials: string;
  course: string;
  courseArea: Student['courseArea'];
  modality: Student['modality'];
  cohort: Student['cohort'];
  shift: Student['shift'];
  period: number;
  turma?: string;
  /** Dias entre a matrícula e hoje. Ancorado em «hoje», como no resto da base. */
  enrolledDaysAgo: number;
  admissionSemester: string;
  monthlyFee: number;
  disciplines: Discipline[];
}

function preview(spec: PreviewSpec): TrilhaPreview {
  const veterano = spec.cohort === 'Veterano';
  return {
    ra: spec.ra,
    chip: spec.chip,
    label: spec.label,
    note: spec.note,
    student: {
      ...STUDENTS[0],
      id: spec.ra,
      ra: spec.ra,
      name: spec.name,
      initials: spec.initials,
      cpfMasked: '',
      email: '',
      phone: '',
      course: spec.course,
      courseArea: spec.courseArea,
      modality: spec.modality,
      cohort: spec.cohort,
      shift: spec.shift,
      period: spec.period,
      turma: spec.turma,
      academic: {
        gpa: 0,
        attendancePercent: 0,
        attendancePrevPercent: 0,
        subjects: spec.disciplines.length,
        dependencies: 0,
        lateAssignments: 0,
        failingSubjects: 0,
        disciplines: spec.disciplines,
      },
      financial: {
        situation: 'Regular',
        monthlyFee: spec.monthlyFee,
        dueDay: 10,
        outstanding: 0,
        overdueCount: 0,
        daysOverdue: 0,
        lastPayment: '',
        hasNegotiation: false,
        scholarshipPercent: 0,
        insidePreventiveWindow: false,
      },
      engagement: {
        lastAccessDaysAgo: 0,
        accessesLast30Days: veterano ? 18 : 0,
        accessesPrev30Days: 0,
        weeklyHours: 0,
        deliveryRate: veterano ? 92 : 0,
        forumInteractions: 0,
        accessTrend: [],
        /* O veterano já tem o aplicativo; o ingressante é justamente quem a
           trilha precisa levar até a instalação. */
        appInstalled: veterano,
        visitedCancellationPage: false,
      },
      journey: {
        progressPercent: 0,
        completionForecast: '',
        admissionSemester: spec.admissionSemester,
        daysSinceEnrollment: spec.enrolledDaysAgo,
        moduleName: veterano ? `Módulo ${spec.period} — ciclo regular` : 'Módulo de ingresso',
        onboardingSteps: [
          { label: 'Contrato assinado', done: true },
          { label: 'Primeiro acesso ao portal', done: true },
          { label: 'Primeiro acesso ao AVA', done: veterano },
          { label: 'Reconheceu turma e horários', done: veterano },
          { label: 'Participou da integração', done: veterano },
          { label: 'Primeira atividade entregue', done: veterano },
        ],
      },
      alerts: [],
      timeline: [],
    },
  };
}

/* ==========================================================================
   1 · Fonoaudiologia — ingressante híbrido
   Quinzenal de ingressantes. A 1ª híbrida entra dispensada, que é o caso em que
   a trilha precisa manter a data oficial na lista e tirá-la do destaque.
   ========================================================================== */

const FONO = preview({
  ra: 'previa-fono',
  chip: 'Fono · ingressante',
  label: 'Fonoaudiologia · Ingressante híbrido',
  note: 'Quinzenal de ingressantes, com a 1ª disciplina híbrida dispensada.',
  name: 'Aluno ingressante',
  initials: 'AI',
  course: 'Fonoaudiologia',
  courseArea: 'Saúde',
  modality: 'Híbrido',
  cohort: 'Calouro',
  shift: 'Noturno',
  period: 1,
  enrolledDaysAgo: 68,
  admissionSemester: '2026/2',
  monthlyFee: 870,
  disciplines: [
    d({
      name: 'Anatomia Humana',
      format: 'Híbrida',
      exempted: true,
      calendarSlot: { bimester: 1, ordinal: 1 },
      schedule: 'Encontro quinzenal · Sáb 08h00–12h00',
      absenceLimit: 4,
    }),
    d({
      name: 'Introdução à Fonoaudiologia',
      format: 'Híbrida',
      calendarSlot: { bimester: 1, ordinal: 2 },
      schedule: 'Encontro quinzenal · Sáb 08h00–12h00',
      absenceLimit: 4,
    }),
    d({
      name: 'Leitura e Produção de Textos',
      format: 'Digital',
      schedule: 'AVA · entregas semanais',
      absenceLimit: 0,
    }),
  ],
});

/* ==========================================================================
   2 · Nutrição — veterano híbrido
   Outro PDF: o quinzenal de VETERANOS, que abre com encontro já em 08/08 e não
   tem a Cerimônia do Jaleco nem a ambientação de ingressante.
   ========================================================================== */

const NUTRICAO = preview({
  ra: 'previa-nutricao',
  chip: 'Nutrição · veterano',
  label: 'Nutrição · Veterano híbrido',
  note: 'Quinzenal de veteranos — o mesmo bloco do site, outro documento.',
  name: 'Aluno veterano',
  initials: 'AV',
  course: 'Bacharelado em Nutrição',
  courseArea: 'Saúde',
  modality: 'Híbrido',
  cohort: 'Veterano',
  shift: 'Noturno',
  period: 4,
  turma: 'NUT-4N',
  enrolledDaysAgo: 771,
  admissionSemester: '2024/2',
  monthlyFee: 870,
  disciplines: [
    d({
      name: 'Avaliação Nutricional',
      format: 'Híbrida',
      calendarSlot: { bimester: 1, ordinal: 1 },
      schedule: 'Encontro quinzenal · Sáb 08h00–12h00',
      grade: 7.8,
      attendancePercent: 88,
      absences: 1,
      absenceLimit: 4,
    }),
    d({
      name: 'Nutrição Clínica I',
      format: 'Híbrida',
      calendarSlot: { bimester: 1, ordinal: 2 },
      schedule: 'Encontro quinzenal · Sáb 08h00–12h00',
      grade: 8.4,
      attendancePercent: 92,
      absences: 1,
      absenceLimit: 4,
    }),
    d({
      name: 'Bioestatística Aplicada',
      format: 'Digital',
      schedule: 'AVA · entregas semanais',
      grade: 7.1,
      attendancePercent: 100,
      absenceLimit: 0,
    }),
  ],
});

/* ==========================================================================
   3 · Enfermagem — ingressante presencial
   O calendário guarda-chuva dos presenciais diurnos e noturnos, e a grade densa
   que justifica a tela de modalidade do presencial ser outra: seis disciplinas
   com dia da semana, contra duas híbridas por bimestre.
   ========================================================================== */

const ENFERMAGEM = preview({
  ra: 'previa-enfermagem',
  chip: 'Enfermagem · ingressante',
  label: 'Enfermagem · Ingressante presencial',
  note: 'Calendário presencial diurno e noturno, com grade diária de seis disciplinas.',
  name: 'Aluno ingressante',
  initials: 'AI',
  course: 'Bacharelado em Enfermagem',
  courseArea: 'Saúde',
  modality: 'Presencial',
  cohort: 'Calouro',
  shift: 'Matutino',
  period: 1,
  turma: 'ENF-1M',
  enrolledDaysAgo: 62,
  admissionSemester: '2026/2',
  monthlyFee: 980,
  disciplines: [
    d({ name: 'Anatomia e Fisiologia Humana', schedule: 'Seg e Qua · 08h00–11h30' }),
    d({ name: 'Fundamentos de Enfermagem', schedule: 'Ter e Qui · 08h00–11h30' }),
    d({ name: 'Microbiologia e Parasitologia', schedule: 'Qua · 08h00–11h30' }),
    d({ name: 'Bioquímica Aplicada à Saúde', schedule: 'Sex · 08h00–11h30' }),
    d({ name: 'Saúde Coletiva', schedule: 'Ter · 08h00–11h30' }),
    d({
      name: 'Leitura e Produção de Textos',
      format: 'Digital',
      schedule: 'AVA · entregas semanais',
      absenceLimit: 0,
    }),
  ],
});

/* ==========================================================================
   4 · Administração — veterano presencial, com duas dispensas
   O mesmo PDF do perfil anterior, e o contraste que interessa: aproveitamento
   de estudos tira duas disciplinas da rotina sem tirá-las da grade.
   ========================================================================== */

const ADMINISTRACAO = preview({
  ra: 'previa-administracao',
  chip: 'Administração · veterano',
  label: 'Administração · Veterano presencial',
  note: 'O mesmo calendário presencial, com duas disciplinas dispensadas por aproveitamento.',
  name: 'Aluno veterano',
  initials: 'AV',
  course: 'Bacharelado em Administração',
  courseArea: 'Negócios',
  modality: 'Presencial',
  cohort: 'Veterano',
  shift: 'Noturno',
  period: 5,
  turma: 'ADM-5N',
  enrolledDaysAgo: 892,
  admissionSemester: '2024/1',
  monthlyFee: 850,
  disciplines: [
    d({
      name: 'Gestão Estratégica de Pessoas',
      schedule: 'Seg e Qua · 19h00–22h30',
      grade: 8.1,
      attendancePercent: 94,
      absences: 2,
    }),
    d({
      name: 'Finanças Corporativas',
      schedule: 'Ter e Qui · 19h00–22h30',
      grade: 7.4,
      attendancePercent: 90,
      absences: 3,
    }),
    d({ name: 'Direito Empresarial', schedule: 'Sex · 19h00–22h30', exempted: true }),
    d({ name: 'Estatística Aplicada a Negócios', schedule: 'Qua · 19h00–22h30', exempted: true }),
    d({
      name: 'Projeto Integrador V',
      schedule: 'Seg · 19h00–22h30',
      grade: 8.8,
      attendancePercent: 96,
      absences: 1,
    }),
    d({
      name: 'Empreendedorismo e Inovação',
      format: 'Digital',
      schedule: 'AVA · entregas semanais',
      grade: 7.9,
      attendancePercent: 100,
      absenceLimit: 0,
    }),
  ],
});

/* ==========================================================================
   5 · Direito — veterano híbrido
   O único curso com PDF próprio nos dois blocos. Aqui é o híbrido de sextas e
   sábados: o encontro ocupa os DOIS dias, e por isso o perfil declara turma —
   sem ela a tela leria «21 e 22/08» como um dia por turma, que não é o caso.
   ========================================================================== */

const DIREITO = preview({
  ra: 'previa-direito',
  chip: 'Direito · veterano',
  label: 'Direito · Veterano híbrido',
  note: 'Semipresencial de Direito, às sextas e sábados — o PDF que só este curso usa.',
  name: 'Aluno veterano',
  initials: 'AV',
  course: 'Bacharelado em Direito',
  courseArea: 'Direito',
  modality: 'Híbrido',
  cohort: 'Veterano',
  shift: 'Noturno',
  period: 6,
  turma: 'DIR-6N',
  enrolledDaysAgo: 1075,
  admissionSemester: '2023/2',
  monthlyFee: 1180,
  disciplines: [
    d({
      name: 'Direito Processual Civil II',
      format: 'Híbrida',
      calendarSlot: { bimester: 1, ordinal: 1 },
      schedule: 'Sex · 19h00–22h30 e Sáb · 08h00–12h00',
      grade: 7.6,
      attendancePercent: 91,
      absences: 2,
      absenceLimit: 4,
    }),
    d({
      name: 'Direito Penal III',
      format: 'Híbrida',
      calendarSlot: { bimester: 1, ordinal: 2 },
      schedule: 'Sex · 19h00–22h30 e Sáb · 08h00–12h00',
      grade: 8.2,
      attendancePercent: 95,
      absences: 1,
      absenceLimit: 4,
    }),
    d({
      name: 'Ética e Estatuto da OAB',
      format: 'Digital',
      schedule: 'AVA · entregas semanais',
      grade: 8,
      attendancePercent: 100,
      absenceLimit: 0,
    }),
  ],
});

/** Os cinco perfis, na ordem em que a aba os oferece. */
export const TRILHA_PREVIEWS: TrilhaPreview[] = [FONO, NUTRICAO, ENFERMAGEM, ADMINISTRACAO, DIREITO];

/** O perfil que a aba abre quando ninguém pediu um RA. */
export const DEFAULT_PREVIEW = FONO;

export function previewByRa(ra: string | null | undefined): TrilhaPreview | undefined {
  return ra ? TRILHA_PREVIEWS.find((p) => p.ra === ra) : undefined;
}
