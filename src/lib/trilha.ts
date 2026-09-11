import type {
  AcademicCalendar,
  CalendarEntry,
  CalendarEvent,
  CalendarResolution,
  Consequence,
  DeltaInfo,
  Discipline,
  Student,
  StepPlace,
  TimelineItem,
  TrilhaBand,
  TrilhaBucket,
  TrilhaConfig,
  TrilhaModel,
  TrilhaStep,
} from '../types';
import { calendarGroupOf, entryForStudent, siteCourseOf } from './push';
import { daysBetween, shiftDays, shortDay, todayIso, weekdayOf } from './calendarDates';

/* ==========================================================================
   Motor da Trilha do Aluno
   --------------------------------------------------------------------------
   Quatro perguntas, e nada além disso:

     1. Qual calendário é o deste aluno — e se não é nenhum, dizer isso.
     2. Quantos dias separam a matrícula do primeiro dia de aula.
     3. O que cada linha do calendário QUER DIZER para este aluno.
     4. O que entra no recorte, e quantas linhas ficaram de fora.

   A REGRA QUE MANDA EM TODO O ARQUIVO: NUNCA INVENTAR.

   É fácil escrever um motor que resolve tudo. «Prova 1 de Gestão Estratégica
   de Pessoas, sábado, 19h30» lê muito melhor que «Prova 1 — sábado, 22/08».
   Mas o calendário de RH não imprime horário nenhum nessas linhas: o `detail`
   delas é a regra das 48 horas. O 19h30 sairia da nossa cabeça, e um aluno que
   chegasse às 19h30 numa prova das 08h perderia a prova por causa da nossa
   tela.

   Então cada afirmação aqui tem origem declarada:

     · dia da semana       → calculado da data. Verificável.
     · horário             → SÓ se o PDF imprimir. Duas formas: «Diurno: 07h30.
                             Noturno: 19h30.», que resolve pelo turno, e
                             «Horário: 19h30», que vale para todos.
     · disciplina          → só quando o ordinal do PDF casa com uma grade que
                             temos, e só no bimestre que a grade representa.
     · local               → só quando o PDF diz (campus, AVA, canal do YouTube).
     · turma               → nunca adivinhada. Sem o dado, a tela diz que não sabe.

   Onde não há origem, o item sai com o texto oficial e uma linha honesta. Um
   card que diz «não sei qual é a sua disciplina» é útil. Um card que adivinha é
   um passivo.
   ========================================================================== */

/* ==========================================================================
   1. Qual calendário é o deste aluno
   ========================================================================== */

/**
 * Resolve o calendário aplicável, com um degrau a mais que o motor de push.
 *
 * `entryForStudent` responde a pergunta do site: existe a linha «curso ×
 * coorte»? Para 24% da base o site não tem essa linha, e o push simplesmente
 * não sai. Para a trilha isso não serve: a tela precisa dizer POR QUE não sabe,
 * e precisa aproveitar o que existe antes de desistir.
 *
 * O degrau a mais é a OUTRA COORTE do mesmo curso. O ritmo de encontros —
 * quinzenal, semanal, aos sábados — é propriedade do curso, não da coorte:
 * Gestão de RH é quinzenal para quem entrou agora e para quem está no quarto
 * módulo. O site publica só a linha de veteranos, e usar esse documento para um
 * calouro de RH é melhor que não ter nada, desde que a tela diga que é o
 * documento da outra coorte. É por isso que `match` existe em vez de um
 * booleano: «achei» e «achei o do vizinho» não são a mesma resposta.
 *
 * O que este degrau NÃO faz é inventar um `catchAll` para o bloco de híbridos.
 * Logística, Engenharia de Software e Gestão Financeira não têm calendário
 * publicado em nenhuma coorte — apontá-los para o quinzenal porque é o mais
 * comum seria produzir datas plausíveis e erradas, que é o pior resultado
 * possível.
 */
export function resolveCalendar(
  student: Student,
  calendars: AcademicCalendar[],
  entries: CalendarEntry[],
): CalendarResolution {
  const exact = entryForStudent(student, entries);
  if (exact) {
    const calendar = calendars.find((c) => c.id === exact.calendarId);
    if (calendar) return { calendar, entry: exact, match: 'exata' };
  }

  const group = calendarGroupOf(student);
  const course = siteCourseOf(student);
  const sibling = entries.find((e) => e.group === group && !e.catchAll && e.course === course);
  if (sibling) {
    const calendar = calendars.find((c) => c.id === sibling.calendarId);
    if (calendar) {
      return {
        calendar,
        entry: sibling,
        match: 'outra-coorte',
        note:
          `O site publica o calendário de ${course} apenas para ${sibling.audienceLabel.toLowerCase()}. ` +
          'O ritmo de encontros é do curso, então este documento vale — mas confira com a coordenação ' +
          'antes de tratar as datas como definitivas para esta coorte.',
      };
    }
  }

  return {
    match: 'nenhuma',
    note:
      `O site não publica calendário de ${course} na modalidade ${student.modality}, ` +
      'em nenhuma coorte. Sem documento de origem, não há trilha de datas a gerar — ' +
      'e projetar as datas de um curso parecido produziria datas erradas com a nossa assinatura.',
  };
}

/* ==========================================================================
   2. Δ — dias entre a matrícula e o primeiro dia de aula
   ========================================================================== */

/**
 * Data da matrícula, ISO.
 *
 * DERIVADA de `daysSinceEnrollment`, que é o que a base guarda. Num sistema de
 * produção isto vem do registro de matrícula e não se deriva de nada; aqui a
 * derivação é exata porque as duas pontas estão ancoradas no mesmo «hoje», e
 * tem o efeito colateral desejado numa base de demonstração: o aluno continua
 * a «47 dias de matrícula» amanhã, em vez de envelhecer sozinho.
 */
export function enrolledAtOf(student: Student, today = todayIso()): string {
  return shiftDays(today, -student.journey.daysSinceEnrollment);
}

/**
 * As fronteiras das faixas, num lugar só.
 *
 * Recebe `daysToClasses` — dias de HOJE até o primeiro dia —, não o Δ
 * histórico. Ver o comentário de `DeltaInfo` em `types.ts`: medir a faixa pelo
 * Δ punha um veterano de quarto módulo em «matrícula antecipada».
 */
export function bandOf(daysToClasses: number): TrilhaBand {
  if (daysToClasses > 60) return 'antecipada';
  if (daysToClasses >= 15) return 'confortavel';
  if (daysToClasses >= 3) return 'vespera';
  return 'em-curso';
}

export function deltaFor(
  student: Student,
  calendar: AcademicCalendar | undefined,
  today = todayIso(),
  /** Faixa forçada pelo simulador da tela. Não altera o dado do aluno. */
  override?: TrilhaBand,
): DeltaInfo {
  const enrolledAt = enrolledAtOf(student, today);
  const classesStart = calendar?.classesStart ?? '';
  const delta = classesStart ? daysBetween(enrolledAt, classesStart) : 0;
  const daysToClasses = classesStart ? daysBetween(today, classesStart) : 0;
  const natural = bandOf(daysToClasses);
  return {
    enrolledAt,
    classesStart,
    delta,
    daysToClasses,
    relevant: student.cohort === 'Calouro',
    band: override ?? natural,
    simulated: override !== undefined && override !== natural,
  };
}

export const BAND_LABEL: Record<TrilhaBand, string> = {
  antecipada: 'Começa daqui a muito tempo',
  confortavel: 'Começa com folga',
  vespera: 'Começa na semana que vem',
  'em-curso': 'Semestre em curso',
};

export const BAND_DESCRIPTION: Record<TrilhaBand, string> = {
  antecipada:
    'O primeiro dia de aula está a mais de 60 dias. Não há linha do tempo a entregar: quem começa no semestre que vem não tem calendário publicado, e a trilha diz isso em vez de mostrar as datas do semestre errado. O risco aqui não é perder prazo, é esquecer que se matriculou.',
  confortavel:
    'De 15 a 60 dias até o primeiro dia. Cabe a trilha inteira, com contagem regressiva, e o primeiro mês de datas.',
  vespera:
    'De 3 a 14 dias até o primeiro dia. Só o que tem de estar pronto antes da aula 1, e duas semanas de calendário. O resto espera.',
  'em-curso':
    'As aulas já começaram. Nada de contagem regressiva para data que passou: a trilha mostra o que vem agora, o que está guardado para o fim do semestre e o que já ficou para trás.',
};

/**
 * A frase sobre a folga que o aluno teve na matrícula.
 *
 * Para veterano não existe frase: a distância entre a matrícula dele e o início
 * deste semestre é um número sem significado, e a tela mostra o semestre de
 * ingresso no lugar. Devolver `null` aqui é o que impede «matriculado 662 dias
 * antes do início das aulas» de chegar à tela.
 */
export function deltaPhrase(delta: DeltaInfo): string | null {
  if (!delta.relevant) return null;
  if (delta.delta === 0) return 'matriculou-se no dia em que as aulas começaram';
  const n = Math.abs(delta.delta);
  const dias = n === 1 ? '1 dia' : `${n} dias`;
  return delta.delta > 0
    ? `matriculou-se ${dias} antes do início das aulas`
    : `matriculou-se ${dias} depois de as aulas começarem`;
}

/** «faltam 9 dias para a primeira aula» · «38 dias de semestre corridos» */
export function classesPhrase(delta: DeltaInfo): string {
  const n = Math.abs(delta.daysToClasses);
  if (delta.daysToClasses === 0) return 'as aulas começam hoje';
  const dias = n === 1 ? '1 dia' : `${n} dias`;
  return delta.daysToClasses > 0
    ? `faltam ${dias} para a primeira aula`
    : `${dias} de semestre já corridos`;
}

/* ==========================================================================
   3. O conjunto irrecuperável
   --------------------------------------------------------------------------
   A lista que nenhuma configuração recolhe. Ela não mede interesse, mede dano:
   o que o aluno perde e não recupera se não souber.

   É `test` em vez de uma lista de ids porque a lista de ids envelheceria em
   silêncio: o calendário do semestre que vem traz linhas novas, e uma regra que
   procura «Último dia para» captura as novas sem ninguém ter de se lembrar. O
   número de eventos que cada regra captura é mostrado ao vivo na aba de
   Configuração, para que ninguém a esvazie sem perceber.
   ========================================================================== */

export interface IrrecuperavelRule {
  id: string;
  label: string;
  /** Por que esta classe não pode ser recolhida. Vai para a tela de governança. */
  why: string;
  test: (event: CalendarEvent) => boolean;
}

export const IRRECUPERAVEL: IrrecuperavelRule[] = [
  {
    id: 'prova',
    label: 'Provas, substitutivas e recuperações',
    why: 'Uma prova não se repete fora das datas do calendário. É a única família em que estar mal informado custa nota direta.',
    test: (e) => e.category === 'prova',
  },
  {
    id: 'sub48',
    label: 'Janela de 48 horas para substitutiva',
    why: 'O prazo conta da data da prova perdida, não do dia em que o aluno descobre que existe. Avisar depois de 48 horas é o mesmo que não avisar.',
    test: (e) => /48\s*horas/i.test(e.detail ?? ''),
  },
  {
    id: 'ultimo-dia',
    label: 'Toda linha «Último dia para…»',
    why: 'Atividades Complementares, Bagagem e relatórios de extensão travam formatura, e nenhuma aula lembra o aluno deles.',
    test: (e) => /[úu]ltimo dia/i.test(e.title),
  },
  {
    id: 'dp',
    label: 'Inscrição em DP e Adaptação',
    why: 'A janela fecha e não reabre no semestre. Quem perde repete a disciplina um semestre inteiro depois.',
    test: (e) => /\bDP\b|depend[êe]ncia|adapta[çc][ãa]o/i.test(e.title),
  },
  {
    id: 'extensionista',
    label: 'Prazos de Prática Extensionista',
    why: 'São horas obrigatórias para formar, e o próprio calendário manda o aluno conferir quantas faltam — o que quase ninguém faz por conta.',
    test: (e) => e.category === 'prazo' && /pr[áa]tica extensionista/i.test(e.title),
  },
  {
    id: 'fim-semestre',
    label: 'Fim do semestre e lançamento de notas',
    why: 'É a data que fecha qualquer pendência ainda aberta. Depois dela não há o que negociar.',
    test: (e) => /fim do semestre|lan[çc]amento d[ae]s? notas?/i.test(e.title),
  },
  {
    id: 'financeiro',
    label: 'Vencimentos e prazos de negociação',
    why: 'Perder a janela de negociação muda o valor da dívida. Nenhum calendário atual traz essas linhas, e a regra fica declarada para quando trouxerem.',
    test: (e) => e.category === 'financeiro',
  },
];

/** Quais regras do conjunto irrecuperável este evento dispara. */
export function irrecuperavelRulesFor(event: CalendarEvent): IrrecuperavelRule[] {
  return IRRECUPERAVEL.filter((r) => r.test(event));
}

/**
 * A consequência de não saber.
 *
 * Fora do conjunto irrecuperável, herda a classificação que a Gestão de PUSH já
 * mantém em `relevance` — que é onde ela deve morar. Duas telas mandando na
 * mesma classificação seria a divergência silenciosa de sempre.
 */
export function consequenceOf(event: CalendarEvent): Consequence {
  if (irrecuperavelRulesFor(event).length > 0) return 'irrecuperavel';
  if (event.relevance === 'alta') return 'alta';
  if (event.relevance === 'media') return 'media';
  return 'baixa';
}

export const CONSEQUENCE_LABEL: Record<Consequence, string> = {
  irrecuperavel: 'Não dá para recuperar',
  alta: 'Custa nota, dinheiro ou prazo',
  media: 'Ajuda a se organizar',
  baixa: 'Trabalho de monitoria e secretaria',
};

/* ==========================================================================
   4. Tradução — de posição na grade para nome de disciplina
   ========================================================================== */

/**
 * Em que bimestre a linha fala.
 *
 * Importa porque «1ª disciplina híbrida» do primeiro bimestre e do segundo são
 * disciplinas DIFERENTES: nos cursos quinzenais, duas híbridas correm por
 * bimestre e depois trocam. A grade que o sistema guarda é a do bimestre
 * corrente, então uma linha do segundo bimestre não pode ser resolvida com ela.
 */
function bimesterOf(title: string): 1 | 2 | null {
  if (/segundo bimestre/i.test(title)) return 2;
  if (/primeiro bimestre/i.test(title)) return 1;
  return null;
}

/**
 * A disciplina a que a linha se refere, quando dá para saber.
 *
 * Devolve `undefined` mais vezes do que resolve, e isso é o desenho certo:
 *
 *   · sem grade cadastrada           → não sabe
 *   · linha do segundo bimestre      → não sabe (a grade é do bimestre corrente)
 *   · duas candidatas para o ordinal → não sabe
 *   · ordinal que a grade não tem    → não sabe
 */
function disciplineFor(event: CalendarEvent, student: Student): Discipline | undefined {
  const grade = student.academic.disciplines;
  if (grade.length === 0) return undefined;
  if (bimesterOf(event.title) === 2) return undefined;

  const hibridas = grade.filter((d) => d.format === 'Híbrida');
  const digitais = grade.filter((d) => d.format === 'Digital');
  const title = event.title;

  // «Disciplinas Digitais Especiais» e «Estudo Dirigido» são outra oferta, não
  // a digital regular. Sem mapeamento, não se resolve.
  if (/especiais|estudo dirigido/i.test(title)) return undefined;

  if (/digitais? regulares?|disciplina digital/i.test(title)) {
    return digitais.length === 1 ? digitais[0] : undefined;
  }
  if (/\b1[ªa]\s+disciplina/i.test(title)) return hibridas[0];
  if (/\b2[ªa]\s+disciplina/i.test(title)) return hibridas[1];

  return undefined;
}

/**
 * Quando a linha fala de uma FAMÍLIA no plural, quais disciplinas do aluno ela
 * alcança.
 *
 * «Aplicação das provas substitutivas das disciplinas híbridas» não nomeia
 * nenhuma disciplina e não tem ordinal para resolver — mas a família é
 * explícita, e o aluno tem duas híbridas na grade. Dizer quais são é tradução
 * legítima: não há escolha a errar, porque a linha vale para todas.
 */
function familyLine(event: CalendarEvent, student: Student): string | null {
  const grade = student.academic.disciplines;
  if (grade.length === 0) return null;
  const title = event.title;

  const names = (format: Discipline['format']) =>
    grade.filter((d) => d.format === format).map((d) => d.name);

  const join = (list: string[]) =>
    list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]}`;

  if (/disciplinas h[íi]bridas/i.test(title)) {
    const list = names('Híbrida');
    if (list.length > 0) return `Vale para as suas híbridas: ${join(list)}.`;
  }
  if (/disciplinas digitais regulares/i.test(title)) {
    const list = names('Digital');
    if (list.length > 0) return `Vale para: ${join(list)}.`;
  }
  return null;
}

/** Qual avaliação é, em nome que o aluno usa. */
function assessmentLabel(title: string): string | null {
  if (/substitutiva/i.test(title)) return 'Prova substitutiva';
  if (/recupera[çc][ãa]o/i.test(title)) return 'Prova de recuperação';
  if (/prova oficial/i.test(title)) return 'Prova oficial';
  if (/prova 1|\(P1\)/i.test(title)) return 'Prova 1';
  if (/prova 2|\(P2\)/i.test(title)) return 'Prova 2';
  if (/prova/i.test(title)) return 'Prova';
  return null;
}

/**
 * O horário, e SÓ se o PDF imprimir.
 *
 * Duas formas aparecem nos onze arquivos:
 *   «Horário de início. Diurno: 07h30. Noturno: 19h30.»  → resolve pelo turno
 *   «Horário: 19h30 (horário de Brasília).»              → vale para todos
 *
 * Nenhuma das duas aparece nas provas dos cursos quinzenais, e é por isso que
 * esta função devolve `null` com frequência em vez de cair num padrão.
 */
function printedTime(event: CalendarEvent, student: Student): string | null {
  const detail = event.detail ?? '';

  const split = detail.match(/Diurno:\s*([\dh:]+)\.?\s*Noturno:\s*([\dh:]+)/i);
  if (split) {
    const [, diurno, noturno] = split;
    return student.shift === 'Noturno' ? noturno : diurno;
  }

  const flat = detail.match(/Hor[áa]rio:\s*([\dh:]+)/i);
  if (flat) return flat[1];

  return null;
}

/** O local, quando o PDF diz. */
function printedPlace(event: CalendarEvent): string | null {
  const detail = event.detail ?? '';
  const title = event.title;

  const yt = detail.match(/youtube\.com\/(@[\w-]+)/i);
  if (yt) return `On-line, no canal ${yt[1]} do YouTube`;

  if (/encontro presencial/i.test(title)) return 'Presencial, no campus';
  if (/no AVA|por meio do AVA|pelo AVA/i.test(title)) return 'On-line, no AVA';
  if (/secretaria virtual/i.test(title)) return 'Na secretaria virtual';
  return null;
}

/** Um rótulo de data é intervalo («01 a 14/12») ou enumeração («27 e 28/11»)? */
function isPeriod(dateLabel: string): boolean {
  return /\sa\s/.test(dateLabel);
}

/**
 * A linha imprime dois dias para uma prova e não sabemos a turma?
 *
 * Só vale para `prova`. Uma enumeração de feriados («12 e 13/10») são dois dias
 * de feriado de verdade, e uma enumeração de encontros («01, 10, 17 e 24/09»)
 * são todos os encontros do aluno — nenhuma das duas é uma escolha. Já duas
 * datas para uma prova são duas turmas, e o aluno pertence a uma.
 */
function isAmbiguousDay(event: CalendarEvent, student: Student): boolean {
  if (event.category !== 'prova') return false;
  if (isPeriod(event.dateLabel)) return false;
  if (event.dates.length < 2) return false;
  return !student.turma;
}

/** O título traduzido, e a origem de cada pedaço. */
function translateTitle(
  event: CalendarEvent,
  discipline: Discipline | undefined,
): string {
  const { title, category } = event;

  if (category === 'prova') {
    const assessment = assessmentLabel(title) ?? 'Prova';
    if (discipline) return `${assessment} de ${discipline.name}`;
    if (/digitais? regulares?/i.test(title)) return `${assessment} das disciplinas digitais`;
    if (/especiais|estudo dirigido/i.test(title)) return `${assessment} de Estudo Dirigido e Digitais Especiais`;
    return assessment;
  }

  if (category === 'aula') {
    if (/libera[çc][ãa]o.*e-?book/i.test(title)) {
      return discipline ? `E-book de ${discipline.name} liberado` : 'E-book da próxima disciplina liberado';
    }
    if (/^in[íi]cio das aulas/i.test(title)) {
      return /calouro/i.test(title) ? 'Primeiro dia de aula' : 'Começam as aulas';
    }
    /* Só reescreve quando há disciplina para nomear. Sem ela, o título oficial
       fica como está: a tentativa de costurar «Começa » na frase produzia
       «Começa das Disciplinas Digitais Especiais», e uma tradução com erro de
       concordância custa mais confiança do que a frase original custava. */
    if (discipline && /^in[íi]cio/i.test(title)) return `Começa ${discipline.name}`;
    return title.replace(/\.$/, '');
  }

  if (category === 'feriado') {
    return title.replace(/^Feriado(\s+Estadual|\s+Municipal)?\s*[–—-]\s*/i, 'Feriado: ')
      .replace(/^Feriado e Recesso\s*[–—-]\s*/i, 'Feriado e recesso: ')
      .replace(/\.$/, '');
  }

  if (category === 'evento') {
    return title.replace(/^Evento on-?line(\s+para\s+Ingressantes)?:\s*/i, '').replace(/\.$/, '');
  }

  if (category === 'prazo' && /[úu]ltimo dia/i.test(title)) {
    return title.replace(/^[ÚU]ltimo dia para\s*/i, 'Último dia: ').replace(/\.$/, '');
  }

  return title.replace(/\.$/, '');
}

/* ==========================================================================
   5. Montagem dos itens
   ========================================================================== */

/**
 * Dias de hoje até a data que importa.
 *
 * Para `prazo`, a data que importa é o FIM: num período «01/07 a 21/08» o que
 * o aluno precisa saber é quando fecha. Para o resto, é o começo — e um evento
 * em andamento hoje devolve 0 em vez de um número negativo que pareceria
 * passado.
 */
function daysToAnchor(event: CalendarEvent, today: string): number {
  if (event.category === 'prazo') return daysBetween(today, event.end);
  if (today >= event.start && today <= event.end) return 0;
  return today < event.start
    ? daysBetween(today, event.start)
    : daysBetween(today, event.end);
}

/** Onde o item cai no recorte, e por quê. */
function bucketFor(
  item: Omit<TimelineItem, 'bucket' | 'shown' | 'hiddenReason'>,
  band: TrilhaBand,
  config: TrilhaConfig,
  event: CalendarEvent,
): { bucket: TrilhaBucket; hiddenReason?: string } {
  const horizon = config.horizonDays[band];

  // A faixa antecipada não tem calendário para mostrar, e a tela diz isso.
  if (band === 'antecipada') {
    return { bucket: 'recolhido', hiddenReason: 'Seu semestre ainda não começou' };
  }

  const irrecuperavel = item.consequence === 'irrecuperavel';

  /* A janela das 48 horas. Uma prova perdida anteontem ainda é acionável: o
     prazo de substitutiva conta da data da prova, não do dia em que o aluno
     descobre. É o único caso em que algo que já passou continua na primeira
     dobra, e é o item de maior valor unitário da tela. */
  if (irrecuperavel && item.inDays < 0 && item.inDays >= -2 && /48\s*horas/i.test(event.detail ?? '')) {
    return { bucket: 'agora' };
  }

  if (item.inDays < 0) return { bucket: 'passado', hiddenReason: 'Já aconteceu' };

  /* Irrecuperável fora do horizonte não é recolhido nem enfiado na fila
     cronológica: vai para a faixa guardada, que está sempre visível. É o que
     permite o prazo de 07/12 existir para um aluno em setembro sem virar ruído. */
  if (item.inDays > horizon) {
    return irrecuperavel
      ? { bucket: 'guardado' }
      : { bucket: 'recolhido', hiddenReason: `Além dos próximos ${horizon} dias` };
  }

  if (irrecuperavel) return { bucket: 'agora' };

  if (item.consequence === 'baixa') {
    return { bucket: 'recolhido', hiddenReason: 'Só interessa a monitoria e à secretaria' };
  }
  if (config.collapsed.includes(item.category)) {
    return { bucket: 'recolhido', hiddenReason: 'Recolhido na configuração desta trilha' };
  }

  return { bucket: 'agora' };
}

function buildItem(
  event: CalendarEvent,
  student: Student,
  calendar: AcademicCalendar,
  band: TrilhaBand,
  config: TrilhaConfig,
  today: string,
): TimelineItem {
  const discipline = disciplineFor(event, student);
  const time = printedTime(event, student);
  const place = printedPlace(event);
  const ambiguousDay = isAmbiguousDay(event, student);
  const inDays = daysToAnchor(event, today);

  const lines: string[] = [];

  const family = familyLine(event, student);

  if (discipline) {
    lines.push(`${discipline.name} · ${discipline.teacher}`);
  } else if (family) {
    lines.push(family);
  } else if (event.category === 'prova' && student.academic.disciplines.length === 0) {
    lines.push('Confirme a disciplina no Portal do Aluno — a sua grade não está no sistema.');
  } else if (event.category === 'prova' && bimesterOf(event.title) === 2) {
    lines.push('A grade do segundo bimestre ainda não está definida no sistema.');
  }

  if (time) lines.push(`Começa às ${time}`);
  if (place) lines.push(place);

  if (ambiguousDay) {
    lines.push(
      `O calendário imprime ${event.dates.map(shortDay).join(' e ')} para esta prova, um dia por turma. ` +
        'O sistema não tem a sua turma — confirme com a coordenação qual é o seu dia.',
    );
  }

  if (/48\s*horas/i.test(event.detail ?? '')) {
    lines.push(
      'Se faltar, você tem 48 horas a partir da data da prova para pedir substitutiva na secretaria virtual, com documento comprobatório.',
    );
  }
  if (/tr[êe]s tentativas/i.test(event.detail ?? '')) {
    lines.push('São três tentativas no AVA. Por isso não há substitutiva nem recuperação desta prova.');
  }
  if (/quantas horas voc[êe] ainda precisa/i.test(event.detail ?? '')) {
    lines.push('Veja quantas horas ainda faltam em «Prática Extensionista», no app.');
  }

  if (event.category === 'feriado') {
    lines.push('Feriado não suspende prazo de entrega no AVA. Confira o que vence nesta semana.');
  }

  const base = {
    id: `trilha-${student.id}-${event.id}`,
    eventId: event.id,
    dates: event.dates,
    start: event.start,
    end: event.end,
    dateLabel: event.dateLabel,
    title: translateTitle(event, discipline),
    lines,
    consequence: consequenceOf(event),
    category: event.category,
    officialTitle: event.title,
    officialDetail: event.detail,
    officialNote: event.note,
    sourceName: calendar.shortName,
    sourceUrl: calendar.url,
    ambiguousDay,
    inDays,
  };

  const { bucket, hiddenReason } = bucketFor(base, band, config, event);

  return {
    ...base,
    bucket,
    shown: bucket === 'agora' || bucket === 'guardado',
    hiddenReason,
  };
}

/* ==========================================================================
   6. Trilha de entrada
   ========================================================================== */

export const PLACE_LABEL: Record<StepPlace, string> = {
  portal: 'Portal do Aluno',
  app: 'App Grupo Anchieta',
  ava: 'AVA',
  secretaria: 'Secretaria',
  campus: 'No campus',
  financeiro: 'Financeiro',
};

/**
 * Os passos desta faixa e desta modalidade, com `done` vindo de evidência.
 *
 * A evidência é citada em cada passo. Sem isso a lista seria uma opinião da
 * tela sobre o aluno, e a primeira vez que ela marcasse «AVA acessado» para
 * quem nunca entrou o aluno pararia de confiar em tudo o mais.
 *
 * Os quatro passos sem sinal próprio — boleto, DP, e-book, extensionista —
 * ficam abertos de propósito. O sistema não sabe se o aluno conferiu o boleto,
 * e marcar como feito por otimismo é pior que deixar em aberto.
 */
export function buildSteps(student: Student, band: TrilhaBand, config: TrilhaConfig): TrilhaStep[] {
  const marks = new Map(student.journey.onboardingSteps.map((s) => [s.label, s.done]));

  const evidenceFor = (id: string): { done: boolean; evidence?: string } => {
    switch (id) {
      case 'contrato': {
        const done = marks.get('Contrato assinado') ?? false;
        return { done, evidence: done ? 'Régua de acolhimento: contrato assinado' : undefined };
      }
      case 'app':
        return student.engagement.appInstalled
          ? { done: true, evidence: 'O app está instalado neste RA' }
          : { done: false, evidence: 'Nenhuma instalação do app registrada neste RA' };
      case 'portal': {
        const done = marks.get('Primeiro acesso ao portal') ?? false;
        return { done, evidence: done ? 'Régua de acolhimento: primeiro acesso ao portal' : undefined };
      }
      case 'ava': {
        const done = marks.get('Primeiro acesso ao AVA') ?? false;
        return {
          done,
          evidence: done
            ? `Régua de acolhimento: primeiro acesso ao AVA · ${student.engagement.accessesLast30Days} acessos em 30 dias`
            : undefined,
        };
      }
      case 'horarios': {
        const done = marks.get('Reconheceu turma e horários') ?? false;
        return { done, evidence: done ? 'Régua de acolhimento: turma e horários reconhecidos' : undefined };
      }
      case 'integracao': {
        const done = marks.get('Participou da integração') ?? false;
        return { done, evidence: done ? 'Régua de acolhimento: participou da integração' : undefined };
      }
      case 'primeira-entrega': {
        const done = marks.get('Primeira atividade entregue') ?? false;
        return {
          done,
          evidence: done ? `Régua de acolhimento · taxa de entrega em ${student.engagement.deliveryRate}%` : undefined,
        };
      }
      default:
        return { done: false };
    }
  };

  return config.steps
    .filter((s) => s.bands.length === 0 || s.bands.includes(band))
    .filter((s) => s.modalities.length === 0 || s.modalities.includes(student.modality))
    .map((s) => ({ ...s, ...evidenceFor(s.id) }));
}

/* ==========================================================================
   7. O artefato inteiro
   ========================================================================== */

export function buildTrilha(
  student: Student,
  calendars: AcademicCalendar[],
  entries: CalendarEntry[],
  config: TrilhaConfig,
  today = todayIso(),
  bandOverride?: TrilhaBand,
): TrilhaModel {
  const resolution = resolveCalendar(student, calendars, entries);
  const delta = deltaFor(student, resolution.calendar, today, bandOverride);
  const steps = buildSteps(student, delta.band, config);

  const items = resolution.calendar
    ? resolution.calendar.events
        .map((e) => buildItem(e, student, resolution.calendar as AcademicCalendar, delta.band, config, today))
        .sort((a, b) => (a.inDays === b.inDays ? a.start.localeCompare(b.start) : a.inDays - b.inDays))
    : [];

  const shown = items.filter((i) => i.shown);

  return {
    student,
    resolution,
    delta,
    steps,
    items,
    shownCount: shown.length,
    totalCount: items.length,
    next: items.find((i) => i.bucket === 'agora' && i.inDays >= 0),
    today,
  };
}

/* ==========================================================================
   8. Auxiliares de exibição
   --------------------------------------------------------------------------
   Moram aqui, e não em cada componente, porque as três renderizações — o
   aparelho, a folha impressa e a régua de push — precisam dizer a MESMA frase
   para a mesma data. Duas implementações de «em 3 dias» divergem no dia em que
   alguém corrigir só uma.
   ========================================================================== */

/** «sábado, 22/08» · «de 01/12 a 14/12» · «27/11 ou 28/11» */
export function datePhrase(item: TimelineItem): string {
  if (item.dates.length <= 1) {
    return `${weekdayOf(item.start)}, ${shortDay(item.start)}`;
  }
  if (isPeriod(item.dateLabel)) {
    return `de ${shortDay(item.start)} a ${shortDay(item.end)}`;
  }
  const joiner = item.ambiguousDay ? ' ou ' : ' e ';
  return item.dates.map(shortDay).join(joiner);
}

/** «hoje» · «amanhã» · «em 3 dias» · «há 2 dias» */
export function countdownPhrase(inDays: number): string {
  if (inDays === 0) return 'hoje';
  if (inDays === 1) return 'amanhã';
  if (inDays === -1) return 'ontem';
  return inDays > 0 ? `em ${inDays} dias` : `há ${Math.abs(inDays)} dias`;
}

/** O rótulo curto do ícone na tela inicial: «Prova 1 · sáb 22». */
export function nextBadge(item: TimelineItem | undefined): string {
  if (!item) return 'Nada marcado';
  const dia = weekdayOf(item.start).slice(0, 3);
  const [, , d] = item.start.split('-');
  return `${item.title.split(' de ')[0]} · ${dia} ${d}`;
}

export function bucketsOf(model: TrilhaModel): Record<TrilhaBucket, TimelineItem[]> {
  return {
    agora: model.items.filter((i) => i.bucket === 'agora'),
    guardado: model.items.filter((i) => i.bucket === 'guardado'),
    passado: model.items.filter((i) => i.bucket === 'passado'),
    recolhido: model.items.filter((i) => i.bucket === 'recolhido'),
  };
}

/** Quantos passos faltam, para a barra de progresso e para o ícone. */
export function stepProgress(steps: TrilhaStep[]): { done: number; total: number; blocking: number } {
  return {
    done: steps.filter((s) => s.done).length,
    total: steps.length,
    blocking: steps.filter((s) => s.blocking && !s.done).length,
  };
}
