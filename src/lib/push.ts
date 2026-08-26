import type {
  AcademicCalendar,
  CalendarEvent,
  PushAudience,
  PushDispatch,
  PushRule,
  PushStatus,
  PushTemplate,
  Student,
} from '../types';
import { noise } from '../data/institution';
import { firstName } from './format';
import { longDay, shiftDays, shortDay, todayIso, weekdayOf } from './calendarDates';

/* ==========================================================================
   Motor de PUSH
   --------------------------------------------------------------------------
   Três perguntas, três funções, e nada além disso:

     1. Qual calendário é o deste aluno?          calendarForStudent
     2. Que avisos esse calendário gera?          rulesFor
     3. O que já chegou no celular dele?          historyFor

   A régua é DERIVADA do calendário, nunca escrita à mão. Se alguém corrigir a
   data de uma prova na tela, os avisos daquela prova se movem junto — que é o
   motivo inteiro de o calendário e a régua morarem na mesma aba. As edições
   manuais vivem por fora, num mapa de overrides, e são reaplicadas por cima:
   corrigir o calendário nunca apaga um texto que alguém escreveu à mão.

   CADÊNCIA
   Um aviso por evento, na hora em que ele ainda dá para agir. Só o que custa
   nota, dinheiro ou prazo ganha um segundo toque antecipado. Três toques em
   tudo — que era a alternativa — treina o aluno a silenciar o aplicativo, e aí
   perdemos o único canal que temos.
   ========================================================================== */

/* -- Quem recebe ---------------------------------------------------------- */

export function audienceOf(student: Student): Exclude<PushAudience, 'Ambos'> {
  return student.cohort === 'Calouro' ? 'Ingressante' : 'Veterano';
}

export function audienceLabel(audience: PushAudience): string {
  return audience === 'Ingressante' ? 'Ingressante 2026' : audience;
}

/**
 * O calendário do aluno é o cruzamento de modalidade, curso e coorte.
 *
 * Quando existe um calendário dedicado à coorte (os quinzenais têm um para
 * ingressante e outro para veterano) ele ganha do genérico — é mais específico
 * e é o que a coordenação de fato entrega àquela turma.
 */
export function calendarForStudent(
  student: Student,
  calendars: AcademicCalendar[],
): AcademicCalendar | undefined {
  const audience = audienceOf(student);
  return calendars
    .filter(
      (c) =>
        c.modality === student.modality &&
        c.courses.includes(student.course) &&
        (c.audience === 'Ambos' || c.audience === audience),
    )
    .sort((a, b) => Number(a.audience === 'Ambos') - Number(b.audience === 'Ambos'))[0];
}

/* -- Composição do texto --------------------------------------------------
   O corpo do push cita o calendário quase palavra por palavra. Reescrever com
   outras palavras seria mais bonito e criaria a pior falha possível: o aviso
   dizendo uma coisa e o PDF oficial dizendo outra. */

function trimDot(text: string): string {
  return text.replace(/\.\s*$/, '');
}

/** "Horário: 19h30." extraído do detalhe impresso, quando existe. */
function timeHint(event: CalendarEvent): string {
  const match = event.detail?.match(/Horário[^.]*\./);
  return match ? match[0] : '';
}

/** Hora de início do evento, em minutos, quando o PDF a imprime. */
function eventStartMinutes(event: CalendarEvent): number | null {
  const match = event.detail?.match(/Horário:\s*(\d{1,2})h(\d{2})?/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2] ?? 0);
}

/**
 * Horário de disparo, preso à janela civil.
 *
 * Sem o piso, um evento marcado para as 9h gerava push às 6h da manhã — que é
 * a forma mais rápida conhecida de fazer alguém desligar as notificações.
 */
function clock(minutes: number): string {
  const m = Math.max(7 * 60 + 30, Math.min(21 * 60, minutes));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** "na terça, 28 de setembro" — como uma pessoa diria. */
function whenPhrase(isoDate: string): string {
  const day = weekdayOf(isoDate);
  const article = day === 'sábado' || day === 'domingo' ? 'no' : 'na';
  return `${article} ${day}, ${longDay(isoDate)}`;
}

/**
 * "8 de agosto", "de 28 de setembro a 9 de outubro", "nos dias 04, 11, 18 e 25/08".
 *
 * A diferença entre período e lista está no rótulo impresso, não nas datas:
 * «04 a 31/08» é um período contínuo e «04, 11, 18 e 25/08» são quatro terças
 * separadas. Tratar as duas como "de 4 a 25 de agosto" dizia ao aluno que ele
 * tem encontro todo dia do mês — que é falso e o faz ignorar o aviso.
 */
function spanPhrase(event: CalendarEvent): string {
  if (event.dates.length <= 1) return longDay(event.start);
  if (/\sa\s/.test(event.dateLabel)) {
    return `de ${longDay(event.start)} a ${longDay(event.end)}`;
  }
  if (event.dates.length === 2) return `em ${longDay(event.start)} e ${longDay(event.end)}`;
  return `nos dias ${event.dateLabel}`;
}

/** Uma lista de datas soltas — encontros presenciais são quase sempre assim. */
function isSeries(event: CalendarEvent): boolean {
  return event.dates.length > 1 && !/\sa\s/.test(event.dateLabel);
}

const SUBSTITUTIVA_LEMBRETE =
  'Se faltar, você tem 48h para pedir substitutiva pela secretaria virtual com documento anexado.';

interface Copy {
  title: string;
  body: string;
}

function composeProva(event: CalendarEvent, early: boolean): Copy {
  const hint = timeHint(event);
  if (early) {
    if (/on-line|no AVA/i.test(event.title)) {
      return {
        title: '#NOME#, prova on-line em 3 dias',
        body: `${trimDot(event.title)} — abre ${whenPhrase(event.start)}. São três tentativas pelo AVA, sem substitutiva nem recuperação. Organize o seu tempo.`.replace(
          /\s+/g,
          ' ',
        ),
      };
    }
    return {
      title: '#NOME#, prova daqui a 3 dias',
      body: `${trimDot(event.title)} — ${whenPhrase(event.start)}. ${hint} Confira sala e horário no App Grupo Anchieta e organize seu estudo desde já.`.replace(
        /\s+/g,
        ' ',
      ),
    };
  }
  // Prova on-line no AVA não tem sala, não tem documento e não tem
  // substitutiva — dizer o contrário manda o aluno para a portaria à toa.
  if (/on-line|no AVA/i.test(event.title)) {
    return {
      title: 'Sua prova on-line abriu, #NOME#',
      body: `${trimDot(event.title)} — ${spanPhrase(event)}. São três tentativas pelo AVA e, por isso, não há substitutiva nem recuperação. Não deixe para o último dia.`.replace(
        /\s+/g,
        ' ',
      ),
    };
  }

  const needsSub = /48 horas/.test(event.detail ?? '');
  return {
    title: 'Hoje tem prova, #NOME#',
    body: `${trimDot(event.title)} — ${spanPhrase(event)}. ${hint} Leve documento com foto e chegue com antecedência. ${
      needsSub ? SUBSTITUTIVA_LEMBRETE : ''
    }`.replace(/\s+/g, ' '),
  };
}

function composeAula(event: CalendarEvent): Copy {
  const t = event.title;
  let title = 'Amanhã começa uma etapa nova';
  let tail = 'Confira os detalhes no App Grupo Anchieta.';

  if (/^Início das aulas/.test(t)) {
    title = 'As aulas começam amanhã, #NOME#';
    tail = 'Veja dias, horários e salas no App Grupo Anchieta, em «Horários das Aulas».';
  } else if (/encontro/i.test(t)) {
    // "presenciais" não casa com /presencial/, e por isso a série de encontros
    // — que é o aviso mais valioso do calendário híbrido — caía no genérico.
    title = isSeries(event) ? 'Seus encontros presenciais, #NOME#' : 'Amanhã tem encontro presencial';
    tail = 'É no encontro presencial que acontecem as atividades avaliativas — confira o horário no app e não perca nenhum.';
  } else if (/^Início, no AVA/.test(t)) {
    title = 'Sua nova disciplina abre amanhã';
    tail = 'Entre no AVA para ver o plano de ensino e os prazos das primeiras atividades.';
  } else if (/e-book/i.test(t)) {
    title = 'Seu e-book é liberado amanhã';
    tail = 'Baixe assim que abrir: ele é a base das atividades avaliativas do bimestre.';
  } else if (/disciplinas digitais regulares/i.test(t)) {
    title = 'Suas digitais começam amanhã';
    tail = 'As disciplinas digitais correm pelo AVA, no seu ritmo — mas com prazo. Entre e veja o cronograma.';
  } else if (/Digitais Especiais|Estudo Dirigido/i.test(t)) {
    title = 'Novas disciplinas amanhã, #NOME#';
    tail = 'Estudo Dirigido e Digitais Especiais têm prova própria — comece pelo cronograma no AVA.';
  }

  return {
    title,
    body: `${trimDot(t)} — ${spanPhrase(event)}. ${tail}`.replace(/\s+/g, ' '),
  };
}

function composeFeriado(event: CalendarEvent): Copy {
  const multi = event.start !== event.end || /Recesso/i.test(event.title);
  return {
    title: multi ? 'Feriado e recesso, #NOME#' : 'Amanhã não tem aula, #NOME#',
    body: `${trimDot(event.title)}, em ${event.dateLabel}. As atividades presenciais ficam suspensas, mas os prazos do AVA continuam valendo: confira o que vence nesta semana.`,
  };
}

function composePrazo(event: CalendarEvent, early: boolean): Copy {
  const t = event.title;
  const fim = longDay(event.end);

  if (/Fim do semestre/i.test(t)) {
    return early
      ? {
          title: 'Última semana de aula, #NOME#',
          body: `O semestre letivo se encerra em ${fim}. Confira notas, faltas e pendências no app enquanto ainda dá tempo de resolver.`,
        }
      : {
          title: 'Amanhã encerra o semestre',
          body: `${trimDot(t)} — ${fim}. Verifique se ficou alguma pendência de nota, atividade ou documento antes do fechamento.`,
        };
  }

  if (early) {
    return {
      title: 'Falta uma semana, #NOME#',
      body: `${trimDot(t)}. O prazo vai até ${fim}. Resolver agora evita fila e pedido fora do prazo.`,
    };
  }

  // A ameaça de "só com processo na secretaria" é verdadeira para prazo que
  // custa diploma ou nota. Num prazo de eleição de representante ela é só
  // rispidez — e rispidez repetida é o que faz o aluno silenciar o app.
  const heavy = event.relevance === 'alta';
  return {
    title: 'Amanhã é o último dia, #NOME#',
    body: heavy
      ? `${trimDot(t)}. O prazo termina em ${fim}. Depois disso só com processo na secretaria — e nem sempre é aceito.`
      : `${trimDot(t)}. O prazo termina em ${fim} e leva poucos minutos no app.`,
  };
}

function composeEvento(event: CalendarEvent): Copy {
  const hint = timeHint(event);
  // A URL inteira dentro de um push é ruído: o aluno toca na notificação, não
  // digita um endereço. Fica o nome do canal, que é o que ele procura.
  // A URL sai ANTES do recorte: o ponto dentro de "youtube.com" cortava a
  // frase no meio e o push terminava em "Canal do Youtube do UniAnchieta (youtube.".
  const local = (event.detail ?? '').replace(/\s*\([^)]*\)/g, '').match(/Local:[^.]*\./)?.[0] ?? '';
  const isSemana = /Semana Jurídica/i.test(event.title);

  return {
    title: isSemana ? 'Começa hoje a Semana Jurídica' : 'Hoje tem evento, #NOME#',
    body: `${trimDot(event.title)} — ${spanPhrase(event)}. ${hint} ${local}`.replace(/\s+/g, ' ').trim(),
  };
}

function composePrograma(event: CalendarEvent): Copy {
  const t = event.title;
  const range = event.start !== event.end ? ` As inscrições vão até ${longDay(event.end)}.` : '';

  let title = 'Novidade para você, #NOME#';
  let tail = 'Confira os detalhes no App Grupo Anchieta.';

  if (/Monitoria/i.test(t) && /inscrição/i.test(t)) {
    title = 'Inscrições da monitoria abertas';
    tail = 'Ser monitor conta horas, dá desconto e fortalece o currículo.';
  } else if (/Início da Monitoria/i.test(t)) {
    title = 'A monitoria começou, #NOME#';
    tail = 'Monitoria é gratuita e para todo mundo — veja os horários no app e agende sua dúvida.';
  } else if (/Prática Extensionista/i.test(t)) {
    title = 'Suas horas de extensão abriram';
    tail = 'A Prática Extensionista é obrigatória para colar grau. Veja quantas horas faltam no app.';
  } else if (/Optativa de Libras|Bagagem/i.test(t)) {
    title = 'Cursos extras liberados, #NOME#';
    tail = 'Libras, Português, Matemática, Inglês e Excel — sem custo e no seu ritmo.';
  } else if (/Divulgação/i.test(t)) {
    title = 'Saiu o resultado da monitoria';
    tail = 'Confira a lista no Mural do App Grupo Anchieta.';
  }

  return { title, body: `${trimDot(t)}.${range} ${tail}`.replace(/\s+/g, ' ') };
}

/* -- Geração da régua ----------------------------------------------------- */

interface Plan {
  /** Dias em relação à data-âncora. Negativo = antes. */
  offset: number;
  /** De onde parte a contagem: início ou fim do evento. */
  anchor: 'start' | 'end';
  time: string;
  label: string;
  copy: Copy;
}

/**
 * Um evento do calendário vira zero, um ou dois avisos.
 *
 * Zero quando a relevância é baixa: relatório de monitoria e data-limite de
 * lançamento de nota são trabalho de docente e de secretaria, e um push sobre
 * eles só ensina o aluno a ignorar os próximos.
 */
function planFor(event: CalendarEvent): Plan[] {
  if (event.relevance === 'baixa') return [];

  switch (event.category) {
    case 'prova': {
      const primary: Plan = {
        offset: 0,
        anchor: 'start',
        time: '07:00',
        label: 'no dia',
        copy: composeProva(event, false),
      };
      if (event.relevance !== 'alta') return [primary];
      return [
        {
          offset: -3,
          anchor: 'start',
          time: '09:00',
          label: '3 dias antes',
          copy: composeProva(event, true),
        },
        primary,
      ];
    }

    case 'aula':
      return [
        {
          offset: -1,
          anchor: 'start',
          time: '18:00',
          label: 'na véspera',
          copy: composeAula(event),
        },
      ];

    case 'feriado':
      return [
        {
          offset: -1,
          anchor: 'start',
          time: '17:00',
          label: 'na véspera',
          copy: composeFeriado(event),
        },
      ];

    case 'prazo': {
      const primary: Plan = {
        offset: -1,
        anchor: 'end',
        time: '10:00',
        label: 'véspera do prazo',
        copy: composePrazo(event, false),
      };
      if (event.relevance !== 'alta') return [primary];
      return [
        {
          offset: -7,
          anchor: 'end',
          time: '10:00',
          label: '1 semana antes',
          copy: composePrazo(event, true),
        },
        primary,
      ];
    }

    case 'evento': {
      // Três horas antes, quando o PDF diz a hora. Um evento das 19h30 avisado
      // às 9h da manhã é esquecido antes do almoço.
      const start = eventStartMinutes(event);
      return [
        {
          offset: 0,
          anchor: 'start',
          time: start === null ? '09:00' : clock(start - 180),
          label: 'no dia',
          copy: composeEvento(event),
        },
      ];
    }

    case 'programa':
      return [
        {
          offset: 0,
          anchor: 'start',
          time: '09:00',
          label: 'no dia',
          copy: composePrograma(event),
        },
      ];

    default:
      return [];
  }
}

/** A régua completa de um calendário, em ordem cronológica de disparo. */
export function rulesFor(calendar: AcademicCalendar): PushRule[] {
  const rules: PushRule[] = [];

  calendar.events.forEach((event) => {
    planFor(event).forEach((plan, index) => {
      const anchorDate = plan.anchor === 'start' ? event.start : event.end;
      rules.push({
        id: `${event.id}-r${index + 1}`,
        calendarId: calendar.id,
        eventId: event.id,
        title: plan.copy.title,
        body: plan.copy.body.trim(),
        sendDate: shiftDays(anchorDate, plan.offset),
        sendTime: plan.time,
        offset: plan.offset,
        offsetLabel: plan.label,
        category: event.category,
        audience: calendar.audience,
        enabled: true,
      });
    });
  });

  return rules.sort((a, b) =>
    a.sendDate === b.sendDate
      ? a.sendTime.localeCompare(b.sendTime)
      : a.sendDate.localeCompare(b.sendDate),
  );
}

/* -- Personalização ------------------------------------------------------- */

/** Troca #NOME# pelo primeiro nome. É o único marcador do sistema. */
export function render(text: string, student: Student | null): string {
  if (!student) return text;
  return text.replace(/#NOME#/g, firstName(student.name));
}

/**
 * A condição de cada push personalizado, em código.
 *
 * O texto de `trigger` no catálogo é a mesma regra em português — as duas
 * precisam contar a mesma história, porque é o texto que a coordenação lê para
 * aprovar e é o código que decide quem recebe.
 */
const MATCHERS: Record<string, (s: Student) => boolean> = {
  'ACO-01': (s) => s.cohort === 'Calouro' && s.journey.daysSinceEnrollment <= 7,
  'ACO-02': (s) =>
    s.cohort === 'Calouro' &&
    s.journey.daysSinceEnrollment <= 30 &&
    s.engagement.lastAccessDaysAgo > 5,
  'ACO-03': (s) =>
    s.cohort === 'Calouro' &&
    s.journey.daysSinceEnrollment > 30 &&
    s.journey.onboardingSteps.filter((x) => !x.done).length >= 3,
  'ACO-04': (s) => s.cohort === 'Calouro' && s.academic.gpa < 6,
  'ACO-05': (s) => !s.engagement.appInstalled,
  'ACO-06': (s) => s.cohort === 'Calouro' && s.journey.daysSinceEnrollment <= 60,

  'ENG-01': (s) => s.engagement.lastAccessDaysAgo >= 7 && s.engagement.lastAccessDaysAgo < 14,
  'ENG-02': (s) => s.engagement.lastAccessDaysAgo >= 14,
  'ENG-03': (s) =>
    s.engagement.accessesPrev30Days > 0 &&
    s.engagement.accessesLast30Days / s.engagement.accessesPrev30Days <= 0.6,
  'ENG-04': (s) => s.engagement.deliveryRate < 60,
  'ENG-05': (s) => s.modality === 'Híbrido',
  'ENG-06': (s) => s.journey.progressPercent > 15 && s.academic.lateAssignments > 0,

  'ACD-01': (s) => s.academic.attendancePercent >= 75 && s.academic.attendancePercent < 80,
  'ACD-02': (s) => s.academic.attendancePercent < 75,
  'ACD-03': (s) => s.academic.disciplines.some((d) => d.grade < 6),
  'ACD-04': (s) => s.cohort === 'Veterano' && s.academic.dependencies > 0,
  'ACD-05': (s) => s.academic.disciplines.some((d) => d.status === 'Em risco'),
  'ACD-06': (s) => s.academic.failingSubjects > 0,
  'ACD-07': (s) => s.cohort === 'Veterano' && s.journey.progressPercent >= 60,

  'FIN-01': (s) => s.financial.situation === 'Regular',
  'FIN-02': (s) => s.financial.overdueCount === 1 && s.financial.insidePreventiveWindow,
  'FIN-03': (s) => s.financial.overdueCount >= 2 && !s.financial.hasNegotiation,
  'FIN-04': (s) => s.financial.hasNegotiation,
  'FIN-05': (s) =>
    s.financial.overdueCount > 0 && !s.financial.hasNegotiation && s.financial.scholarshipPercent === 0,

  'RET-01': (s) => s.scoreDelta30d <= -10,
  'RET-02': (s) => s.engagement.visitedCancellationPage,
  'RET-03': (s) => s.healthScore < 40,
  'RET-04': (s) => s.status === 'Estável' || s.status === 'Atenção',

  'REC-01': (s) => s.academic.attendancePercent >= 95,
  'REC-02': (s) => s.scoreDelta30d >= 10,
  'REC-03': (s) => s.cohort === 'Veterano' && s.journey.progressPercent >= 50,
};

export function matchesTemplate(template: PushTemplate, student: Student): boolean {
  if (!template.active) return false;
  const audience = audienceOf(student);
  if (template.audience !== 'Ambos' && template.audience !== audience) return false;
  return MATCHERS[template.code]?.(student) ?? false;
}

export function templatesForStudent(
  templates: PushTemplate[],
  student: Student,
): PushTemplate[] {
  return templates.filter((t) => matchesTemplate(t, student));
}

/* -- Histórico ------------------------------------------------------------ */

/**
 * Status de entrega, estável para o mesmo par aluno × mensagem.
 *
 * Sem app instalado nada chega — e isso não é detalhe de simulação: é a
 * primeira coisa que o atendente precisa saber antes de perguntar "você não
 * recebeu o aviso?".
 */
function deliveryStatus(student: Student, key: string): PushStatus {
  if (!student.engagement.appInstalled) return 'Não entregue';
  const n = noise(`${student.id}:${key}`);
  if (n < 0.58) return 'Aberto';
  if (n < 0.94) return 'Enviado';
  return 'Não entregue';
}

export interface PushHistory {
  sent: PushDispatch[];
  scheduled: PushDispatch[];
}

/**
 * O que já chegou e o que ainda vai chegar no celular deste aluno.
 *
 * A régua é a mesma para toda a turma; o que muda por aluno é o nome no texto,
 * a entrega e os personalizados. Por isso o histórico é montado aqui e não
 * guardado: qualquer edição na régua se reflete no dossiê na hora seguinte.
 */
export function historyFor(
  student: Student,
  calendar: AcademicCalendar | undefined,
  rules: PushRule[],
  templates: PushTemplate[],
  today = todayIso(),
): PushHistory {
  const sent: PushDispatch[] = [];
  const scheduled: PushDispatch[] = [];

  rules
    .filter((r) => r.enabled)
    .forEach((rule) => {
      const dispatch: PushDispatch = {
        id: `${student.id}-${rule.id}`,
        studentId: student.id,
        origin: 'regua',
        ruleId: rule.id,
        calendarId: calendar?.id,
        title: render(rule.title, student),
        body: render(rule.body, student),
        category: rule.category,
        sentAt: `${rule.sendDate}T${rule.sendTime}:00`,
        status: rule.sendDate <= today ? deliveryStatus(student, rule.id) : 'Agendado',
      };
      (rule.sendDate <= today ? sent : scheduled).push(dispatch);
    });

  templatesForStudent(templates, student).forEach((template) => {
    // Espalhado nos últimos 45 dias de forma estável: o mesmo aluno vê sempre
    // o mesmo histórico, em qualquer sessão e em qualquer máquina.
    const daysAgo = Math.floor(noise(`${student.id}:${template.id}:d`) * 45);
    const hour = 8 + Math.floor(noise(`${student.id}:${template.id}:h`) * 11);
    const date = shiftDays(today, -daysAgo);
    sent.push({
      id: `${student.id}-${template.id}`,
      studentId: student.id,
      origin: 'personalizado',
      templateId: template.id,
      title: render(template.title, student),
      body: render(template.body, student),
      category: template.category,
      sentAt: `${date}T${String(hour).padStart(2, '0')}:00:00`,
      status: deliveryStatus(student, template.id),
    });
  });

  sent.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  scheduled.sort((a, b) => a.sentAt.localeCompare(b.sentAt));

  return { sent, scheduled };
}

/* -- Rótulos -------------------------------------------------------------- */

export const CATEGORY_LABEL: Record<string, string> = {
  aula: 'Aula',
  prova: 'Avaliação',
  prazo: 'Prazo',
  evento: 'Evento',
  feriado: 'Feriado',
  programa: 'Programa',
  financeiro: 'Financeiro',
  engajamento: 'Engajamento',
  acolhimento: 'Acolhimento',
};

export const RELEVANCE_LABEL: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

/**
 * O próximo aviso que ainda vai sair.
 *
 * É o único item de uma régua de setenta linhas que muda o que alguém faz hoje,
 * e por isso é o único que a tela pinta de azul. A lista já chega ordenada por
 * data, então o primeiro que não passou é a resposta.
 */
export function nextRule(rules: PushRule[], today = todayIso()): PushRule | undefined {
  return rules.find((r) => r.enabled && r.sendDate >= today);
}

/** "26/08 · 09:00" — como a régua mostra o disparo na lista. */
export function stampOf(rule: Pick<PushRule, 'sendDate' | 'sendTime'>): string {
  return `${shortDay(rule.sendDate)} · ${rule.sendTime}`;
}
