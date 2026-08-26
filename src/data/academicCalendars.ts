import type {
  AcademicCalendar,
  CalendarEntry,
  CalendarEvent,
  EventRelevance,
  PushCategory,
} from '../types';
import { parseDateLabel } from '../lib/calendarDates';

/* ==========================================================================
   Calendários acadêmicos 2026/2 — o que a instituição publica
   --------------------------------------------------------------------------
   Fonte: anchieta.br/calendario-academico-segundo-semestre e a página de
   híbridos ligada a partir dela. Os PDFs foram baixados do S3 da instituição e
   conferidos linha a linha contra a transcrição que está aqui.

   DUAS COISAS DIFERENTES, E É IMPORTANTE NÃO CONFUNDIR:

     CALENDARS  são os onze PDFs. É o documento.
     ENTRIES    são as trinta e três linhas do site: curso × público × PDF.

   Vários cursos compartilham o mesmo arquivo (seis usam o quinzenal de
   veteranos). Ainda assim cada linha existe por conta própria, porque é assim
   que o site publica e é assim que a coordenação fala: ninguém pede "o PDF dos
   quinzenais", pede "o calendário de Fonoaudiologia veterano". Quando a
   instituição desmembrar um desses arquivos no semestre que vem, a mudança cai
   numa linha só.

   TRANSCRIÇÃO
   Cada linha é uma linha do PDF, como está impressa, inclusive quando o PDF se
   contradiz. Onde a data não fecha com o dia da semana da própria grade, a
   linha entra igual e ganha um `note`, que a tela mostra como divergência a
   validar. Corrigir em silêncio seria pior: quem confere confere contra o
   arquivo, não contra o nosso palpite.

   O QUE VIRA PUSH
   `relevance` é a única coisa aqui que não vem do PDF, é juízo operacional:
     alta   → o aluno perde nota, dinheiro ou prazo se não souber. Vira push.
     média  → ajuda e evita ligação no suporte. Vira push.
     baixa  → só interessa a monitor e secretaria. Fica registrado, não vira push.
   ========================================================================== */

const S3 = 'https://anchieta-ead.s3-sa-east-1.amazonaws.com/2026_258_calendario_2026_2sem';

/* -- Textos que se repetem em quase todo calendário ----------------------- */

const SUB48 =
  'O aluno tem 48 horas, a partir da data da prova perdida, para solicitar substitutiva por meio da secretaria virtual, anexando o documento comprobatório, conforme legislação e os Critérios de Rendimento Acadêmico disponível no Mural do App Grupo Anchieta.';

const HORARIO_PROVA = 'Horário de início. Diurno: 07h30. Noturno: 19h30.';

const TRES_TENTATIVAS =
  'Como há três tentativas para a realização da prova, não haverá substitutiva ou recuperação.';

const YT_EVENTOS = 'Local: Canal do Youtube do UniAnchieta (youtube.com/@eventosunianchieta).';
const YT_TV = 'Local: Canal do Youtube TV UniAnchieta (youtube.com/@TVUniAnchieta).';

const APP_HORARIOS =
  'Verificar dias e horários das aulas por meio do App Grupo Anchieta, em «Horários das Aulas».';

const EXTENSIONISTA_APP =
  'Verifique quantas horas você ainda precisa cumprir, no App Grupo Anchieta.';

const AVA_ATENTO =
  'Acompanhe os prazos de entrega das atividades e as aulas ao vivo (Conteúdo Ponto a Ponto) diretamente pelo AVA.';

const NOTA_27_10 =
  'Transcrito como está impresso. Pela sequência do calendário, a 1ª híbrida do segundo bimestre começou em 29/09, então esta deveria ser a 2ª do SEGUNDO bimestre.';

/* -- Forma compacta de uma linha do PDF -----------------------------------
   [rótulo de data, título, categoria, relevância, detalhe?, divergência?] */

type Raw = readonly [string, string, PushCategory, EventRelevance, string?, string?];

function build(calendarId: string, rows: readonly Raw[]): CalendarEvent[] {
  return rows
    .map(([dateLabel, title, category, relevance, detail, note], index) => {
      const dates = parseDateLabel(dateLabel);
      return {
        id: `${calendarId}-e${String(index + 1).padStart(2, '0')}`,
        dateLabel,
        dates,
        start: dates[0] ?? '',
        end: dates[dates.length - 1] ?? '',
        title,
        detail,
        category,
        relevance,
        note,
      } satisfies CalendarEvent;
    })
    .filter((e) => e.start !== '')
    .sort((a, b) =>
      a.start === b.start ? a.end.localeCompare(b.end) : a.start.localeCompare(b.start),
    );
}

/* -- Blocos comuns --------------------------------------------------------
   Abertura e fechamento institucional são idênticos nos onze PDFs. Repetir as
   linhas onze vezes convidava a divergência silenciosa: alguém corrige
   "Atividades Complementares" num calendário e esquece dos outros dez.

   Tudo o que entra num bloco compartilhado foi verificado por busca literal nos
   onze arquivos. O que não passou nessa verificação saiu do bloco e voltou a
   ser declarado calendário a calendário. */

const ABERTURA: readonly Raw[] = [
  ['01/07 a 21/08', 'Período de inscrição em DP (Dependência) e Adaptação.', 'prazo', 'alta'],
  ['01/07 a 07/12', 'Período de inscrição e realização para calouros e veteranos - Optativa de Libras e Bagagem de Português, Matemática, Inglês e Excel.', 'programa', 'media'],
  ['09/07', 'Feriado Estadual – Revolução Constitucionalista de 1932.', 'feriado', 'alta'],
];

const FECHAMENTO: readonly Raw[] = [
  ['07/12', 'Último dia para protocolar as Atividades Complementares.', 'prazo', 'alta'],
  ['07/12', 'Último dia para realizar atividades do programa Bagagem.', 'prazo', 'alta'],
  ['07 a 11/12', 'Período para entrega do relatório final de Monitoria do primeiro semestre.', 'programa', 'baixa'],
  ['23/12', 'Fim do semestre letivo.', 'prazo', 'alta'],
  ['25/12', 'Feriado – Natal.', 'feriado', 'media'],
];

const FERIADOS: readonly Raw[] = [
  ['15/08', 'Feriado Municipal – Dia da Padroeira de Jundiaí.', 'feriado', 'alta'],
  ['07/09', 'Feriado – Dia da Independência do Brasil.', 'feriado', 'alta'],
  ['12 e 13/10', 'Feriado e Recesso – Nossa Senhora Aparecida e Dia do Professor.', 'feriado', 'alta'],
  ['02/11', 'Feriado – Dia de Finados.', 'feriado', 'alta'],
  ['20 e 21/11', 'Feriado e Recesso – Dia Nacional de Zumbi e da Consciência Negra.', 'feriado', 'alta'],
];

const MONITORIA_EVENTO: Raw = ['03/08', 'Evento on-line: O que é monitoria?', 'evento', 'media', `${YT_EVENTOS} Horário: 19h30.`];

const ELEICAO: Raw = ['04 a 31/08', 'Período para eleição dos representantes e vice-representantes de classe.', 'prazo', 'media'];

const EXTENSIONISTA_INICIO: Raw = ['25/08', 'Início da Prática Extensionista e Eletiva via sistema disponíveis no App Grupo Anchieta.', 'programa', 'alta', EXTENSIONISTA_APP];

const EXTENSIONISTA_FIM: Raw = ['23/11', 'Último dia para submeter os relatórios de Prática Extensionista via sistema.', 'prazo', 'alta'];

const DIGITAIS_ESPECIAIS: Raw = ['06/10', 'Início das Disciplinas Digitais Especiais e Estudo Dirigido.', 'aula', 'alta'];

/**
 * O evento de Prática Extensionista é transmitido em duas sessões, de manhã e à
 * noite. Estão separados porque a sessão das 19h NÃO consta do calendário das
 * sextas e sábados (exceto Direito): um bloco compartilhado que a incluísse
 * mandaria aquele curso para uma transmissão que ele não tem.
 */
const EVENTO_PRATICA_MANHA: Raw = ['29/08', 'Evento on-line: Prática Extensionista – Tudo o que você precisa saber.', 'evento', 'media', `${YT_EVENTOS} Horário: 09h (horário de Brasília).`];

const EVENTO_PRATICA_NOITE: Raw = ['03/09', 'Evento on-line: Prática Extensionista – Tudo o que você precisa saber.', 'evento', 'media', `${YT_EVENTOS} Horário: 19h (horário de Brasília).`];

const AMBIENTACAO_MANHA: Raw = ['01/08', 'Evento on-line para Ingressantes: Ambientação - Ambiente Virtual de Aprendizagem (AVA) e Biblioteca Virtual.', 'evento', 'alta', `${YT_TV} Horário: 10h (horário de Brasília).`];

const AMBIENTACAO_NOITE: Raw = ['04/08', 'Evento on-line para Ingressantes: Ambientação - Ambiente Virtual de Aprendizagem (AVA) e Biblioteca Virtual.', 'evento', 'alta', `${YT_TV} Horário: 19h30 (horário de Brasília).`];

/* ==========================================================================
   PRESENCIAL · Direito
   ========================================================================== */

const R_PRES_DIREITO: readonly Raw[] = [
  ...ABERTURA,
  ['20/07 a 10/08', 'Período de inscrição para Monitoria.', 'programa', 'media'],
  MONITORIA_EVENTO,
  ['04/08', 'Início das aulas para Calouros.', 'aula', 'alta', APP_HORARIOS],
  ELEICAO,
  ['05/08', 'Início das aulas para Veteranos.', 'aula', 'alta', APP_HORARIOS],
  ['08/08', 'Evento on-line: Estratégias de Estudo e Sucesso.', 'evento', 'media', `${YT_TV} Horário: 13h (horário de Brasília).`],
  ['14/08', 'Divulgação dos nomes dos alunos classificados para a Monitoria do segundo semestre.', 'programa', 'media'],
  ['17/08', 'Ambientação Vida do Monitor.', 'programa', 'baixa', 'Local: On-line, às 18h30. Será notificado apenas aos alunos monitores.'],
  ['17/08', 'Início da Monitoria do segundo semestre.', 'programa', 'media'],
  EXTENSIONISTA_INICIO,
  ['25/08', 'Início das disciplinas digitais regulares.', 'aula', 'alta'],
  EVENTO_PRATICA_MANHA,
  EVENTO_PRATICA_NOITE,
  ['28/09 a 03/10', 'Período de aplicação da P1.', 'prova', 'alta', `${HORARIO_PROVA} ${SUB48}`],
  ['28/09 a 02/10', 'Período de entrega do relatório parcial de Monitoria.', 'programa', 'baixa'],
  ['05 a 09/10', 'Semana Jurídica.', 'evento', 'alta'],
  DIGITAIS_ESPECIAIS,
  ['17/10', 'Aplicação da Prova Substitutiva da P1.', 'prova', 'alta'],
  ['19/10', 'Data máxima para lançamento de nota da N1.', 'prazo', 'baixa'],
  ['26/10 a 06/11', 'Período institucional para aplicação da Prova Integrativa.', 'prova', 'alta', 'Verificar o dia e horário da sua prova com o seu coordenador de curso.'],
  ['13 e 14/11', 'Aplicação da Prova Oficial das disciplinas Digitais Especiais.', 'prova', 'alta'],
  ['13, 14, 27 e 28/11', 'Aplicação da Prova Oficial das disciplinas de Estudo Dirigido.', 'prova', 'alta'],
  EXTENSIONISTA_FIM,
  ['23/11 a 03/12', 'Período de aplicação da P2.', 'prova', 'alta', `${HORARIO_PROVA} ${SUB48}`],
  ['01 a 14/12', 'Período de realização on-line, por meio do AVA, da prova das Disciplinas Digitais Regulares de Formação Geral.', 'prova', 'alta', TRES_TENTATIVAS],
  ['04/12', 'Término do Programa de Monitoria.', 'programa', 'baixa'],
  ['05/12', 'Aplicação da Prova Substitutiva da P2 das Disciplinas Presenciais, Remotas e Estudo Dirigido.', 'prova', 'alta'],
  ['07/12', 'Data máxima para lançamento de nota da N2 e N3.', 'prazo', 'baixa'],
  ['11 e 12/12', 'Aplicação da Prova de Recuperação do Estudo Dirigido.', 'prova', 'alta'],
  ['14 a 18/12', 'Período de aplicação da Prova de Recuperação das Disciplinas Presenciais e Remotas.', 'prova', 'alta'],
  ...FERIADOS,
  ...FECHAMENTO,
];

/* ==========================================================================
   PRESENCIAL · Diurno e noturno (exceto Direito)
   ========================================================================== */

const R_PRES_GERAL: readonly Raw[] = [
  ...ABERTURA,
  ['20/07 a 10/08', 'Período de inscrição para Monitoria.', 'programa', 'media'],
  AMBIENTACAO_MANHA,
  MONITORIA_EVENTO,
  ['04/08', 'Início das aulas para Calouros.', 'aula', 'alta', APP_HORARIOS],
  ELEICAO,
  ['05/08', 'Início das aulas para Veteranos.', 'aula', 'alta', APP_HORARIOS],
  ['08/08', 'Cerimônia do Jaleco.', 'evento', 'alta'],
  ['08/08', 'Evento on-line: Estratégias de Estudo e Sucesso.', 'evento', 'media', `${YT_TV} Horário: 13h (horário de Brasília).`],
  ['14/08', 'Divulgação dos nomes dos alunos classificados para a Monitoria do segundo semestre.', 'programa', 'media'],
  ['17/08', 'Ambientação Vida do Monitor.', 'programa', 'baixa', 'Local: On-line, às 18h30. Será notificado apenas aos alunos monitores.'],
  ['17/08', 'Início da Monitoria do segundo semestre.', 'programa', 'media'],
  EXTENSIONISTA_INICIO,
  ['25/08', 'Início das disciplinas digitais regulares.', 'aula', 'alta'],
  ['25/08', 'Início, no AVA, do bloco 1 das atividades on-line das disciplinas presenciais com carga horária EaD.', 'aula', 'alta'],
  EVENTO_PRATICA_MANHA,
  EVENTO_PRATICA_NOITE,
  ['28/09 a 09/10', 'Período de aplicação da P1.', 'prova', 'alta', `${HORARIO_PROVA} ${SUB48}`],
  ['28/09 a 02/10', 'Período de entrega do relatório parcial de Monitoria.', 'programa', 'baixa'],
  DIGITAIS_ESPECIAIS,
  ['17/10', 'Aplicação da Prova Substitutiva da P1.', 'prova', 'alta'],
  ['19/10', 'Data máxima para lançamento de nota da N1.', 'prazo', 'baixa'],
  ['20/10', 'Início, no AVA, do bloco 2 das atividades on-line das disciplinas presenciais com carga horária EaD.', 'aula', 'alta'],
  ['26/10 a 06/11', 'Período institucional para aplicação da Prova Integrativa.', 'prova', 'alta', 'Verificar o dia e horário da sua prova com o seu coordenador de curso.'],
  ['13 e 14/11', 'Aplicação da Prova Oficial das disciplinas Digitais Especiais.', 'prova', 'alta'],
  ['13, 14, 27 e 28/11', 'Aplicação da Prova Oficial das disciplinas de Estudo Dirigido e Digitais Especiais.', 'prova', 'alta'],
  EXTENSIONISTA_FIM,
  ['23/11 a 03/12', 'Período de aplicação da P2.', 'prova', 'alta', `${HORARIO_PROVA} ${SUB48}`],
  ['01 a 14/12', 'Período de realização on-line, por meio do AVA, da prova das Disciplinas Digitais Regulares.', 'prova', 'alta', TRES_TENTATIVAS],
  ['04/12', 'Término do Programa de Monitoria.', 'programa', 'baixa'],
  ['05/12', 'Aplicação da Prova Substitutiva da P2 das Disciplinas Presenciais, Remotas e Estudo Dirigido.', 'prova', 'alta'],
  ['07/12', 'Data máxima para lançamento de nota da N2 e N3.', 'prazo', 'baixa'],
  ['11 e 12/12', 'Aplicação da Prova de Recuperação do Estudo Dirigido.', 'prova', 'alta'],
  ['14 a 18/12', 'Período de aplicação da Prova de Recuperação das Disciplinas Presenciais e Remotas.', 'prova', 'alta'],
  ...FERIADOS,
  ...FECHAMENTO,
];

/* -- Espinha comum dos semipresenciais ----------------------------------- */

const HIBRIDO_ABERTURA: readonly Raw[] = [
  ...ABERTURA,
  ['20/07 a 10/08', 'Período de inscrição para Monitoria do primeiro bimestre.', 'programa', 'media'],
  MONITORIA_EVENTO,
  ['04/08', 'Início, no AVA, da disciplina digital do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO],
  ELEICAO,
  ['13/08', 'Evento on-line: Estratégias de Estudo e Sucesso.', 'evento', 'media', `${YT_TV} Horário: 19h30 (horário de Brasília).`],
  ['17/08', 'Início da Monitoria do primeiro bimestre.', 'programa', 'media'],
  EVENTO_PRATICA_MANHA,
];

const DIGITAL_2BIM: Raw = ['29/09', 'Início, no AVA, da disciplina digital do segundo bimestre.', 'aula', 'alta', AVA_ATENTO];

const HIBRIDO_VIRADA: readonly Raw[] = [
  ['29/09 a 05/10', 'Período de realização on-line, por meio do AVA, da prova das Disciplinas Digitais Regulares do primeiro bimestre.', 'prova', 'alta', TRES_TENTATIVAS],
  ['02/10', 'Término do Programa de Monitoria do primeiro bimestre.', 'programa', 'baixa'],
  ['03/10', 'Aplicação das provas substitutivas das disciplinas híbridas do primeiro bimestre.', 'prova', 'alta'],
  ['05 a 09/10', 'Período para entrega do relatório final de Monitoria do primeiro bimestre.', 'programa', 'baixa'],
  DIGITAIS_ESPECIAIS,
  ['24/10', 'Aplicação das provas de recuperação das disciplinas híbridas do primeiro bimestre.', 'prova', 'alta'],
];

const HIBRIDO_FECHAMENTO: readonly Raw[] = [
  EXTENSIONISTA_FIM,
  ['27 e 28/11', 'Aplicação da Prova Oficial das disciplinas de Estudo Dirigido e Digitais Especiais.', 'prova', 'alta'],
  ['01 a 14/12', 'Período de realização on-line, por meio do AVA, da prova das Disciplinas Digitais Regulares do segundo bimestre.', 'prova', 'alta', TRES_TENTATIVAS],
  ['04/12', 'Término do Programa de Monitoria do segundo bimestre.', 'programa', 'baixa'],
  ['19/12', 'Aplicação das provas de recuperação das disciplinas híbridas do segundo bimestre.', 'prova', 'alta'],
  ...FERIADOS,
  ...FECHAMENTO,
];

/* ==========================================================================
   SEMIPRESENCIAL · Bissemanais (terças e quintas)
   ========================================================================== */

const R_BISSEMANAL: readonly Raw[] = [
  ...HIBRIDO_ABERTURA,
  DIGITAL_2BIM,
  EXTENSIONISTA_INICIO,
  EVENTO_PRATICA_NOITE,
  ['04/08', 'Início, no AVA, das disciplinas híbridas 1 e 2 do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO],
  AMBIENTACAO_NOITE,
  ['04, 11, 18 e 25/08', 'Encontros presenciais da disciplina híbrida 1 do primeiro bimestre.', 'aula', 'alta'],
  ['06, 13, 20 e 27/08', 'Encontros presenciais da disciplina híbrida 2 do primeiro bimestre.', 'aula', 'alta'],
  ['25/08', 'Prova 1 (P1) da disciplina híbrida 1 do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['27/08', 'Prova 1 (P1) da disciplina híbrida 2 do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['01, 08, 15 e 22/09', 'Encontros presenciais da disciplina híbrida 1 do primeiro bimestre.', 'aula', 'alta'],
  ['01, 10, 17 e 24/09', 'Encontros presenciais da disciplina híbrida 2 do primeiro bimestre.', 'aula', 'alta', undefined, 'O PDF imprime «01, 10, 17 e 24/09», mas a híbrida 2 se encontra às quintas e 01/09 é terça. Provável erro de digitação de 03/09 na origem.'],
  ['22/09', 'Prova 2 (P2) da disciplina híbrida 1 do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['24/09', 'Prova 2 (P2) da disciplina híbrida 2 do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['29/09', 'Início, no AVA, das disciplinas híbridas 1 e 2 do segundo bimestre.', 'aula', 'alta', AVA_ATENTO],
  ['29/09', 'Encontro presencial da disciplina híbrida 1 do segundo bimestre.', 'aula', 'alta'],
  ...HIBRIDO_VIRADA,
  ['06, 20 e 27/10', 'Encontros presenciais da disciplina híbrida 1 do segundo bimestre.', 'aula', 'alta'],
  ['01, 08, 15, 22 e 29/10', 'Encontros presenciais da disciplina híbrida 2 do segundo bimestre.', 'aula', 'alta'],
  ['06/10', 'Início da Monitoria do segundo bimestre.', 'programa', 'media'],
  ['20/10', 'Prova 1 (P1) da disciplina híbrida 1 do segundo bimestre.', 'prova', 'alta', SUB48],
  ['22/10', 'Prova 1 (P1) da disciplina híbrida 2 do segundo bimestre.', 'prova', 'alta', SUB48],
  ['03, 10, 17 e 24/11', 'Encontros presenciais da disciplina híbrida 1 do segundo bimestre.', 'aula', 'alta'],
  ['05, 12, 19 e 26/11', 'Encontros presenciais da disciplina híbrida 2 do segundo bimestre.', 'aula', 'alta'],
  ['24/11', 'Prova 2 (P2) da disciplina híbrida 1 do segundo bimestre.', 'prova', 'alta', SUB48],
  ['26/11', 'Prova 2 (P2) da disciplina híbrida 1 do segundo bimestre.', 'prova', 'alta', SUB48, 'O PDF repete «híbrida 1» nas duas linhas (24/11 e 26/11). Pela grade de quintas, esta é a híbrida 2.'],
  ['01, 08 e 15/12', 'Encontros presenciais da disciplina híbrida 1 do segundo bimestre.', 'aula', 'alta'],
  ['03, 10 e 17/12', 'Encontros presenciais da disciplina híbrida 2 do segundo bimestre.', 'aula', 'alta'],
  ['05/12', 'Aplicação das provas substitutivas das disciplinas híbridas do segundo bimestre.', 'prova', 'alta'],
  ...HIBRIDO_FECHAMENTO,
];

/* ==========================================================================
   SEMIPRESENCIAL · Quinzenal às sextas e sábados (ADS) veteranos
   ========================================================================== */

const R_ADS: readonly Raw[] = [
  ...HIBRIDO_ABERTURA,
  DIGITAL_2BIM,
  EXTENSIONISTA_INICIO,
  EVENTO_PRATICA_NOITE,
  ['31/07', 'Liberação, no AVA, do e-book da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'media'],
  ['04/08', 'Início, no AVA, da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO],
  ['07 e 08/08', 'Primeiro encontro presencial da 1ª disciplina híbrida – Atividades Avaliativas e Prova 1 (P1) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['21 e 22/08', 'Segundo encontro presencial da 1ª disciplina híbrida – Atividades Avaliativas e Prova 2 (P2) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['25/08', 'Liberação, no AVA, do e-book da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'media'],
  ['01/09', 'Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO],
  ['04 e 05/09', 'Primeiro encontro presencial da 2ª disciplina híbrida – Atividades Avaliativas e Prova 1 (P1) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['18 e 19/09', 'Segundo encontro presencial da 2ª disciplina híbrida – Atividades Avaliativas e Prova 2 (P2) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['22/09', 'Liberação, no AVA, do e-book da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'media'],
  ['29/09', 'Início, no AVA, da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'alta', AVA_ATENTO],
  ...HIBRIDO_VIRADA,
  ['02 e 03/10', 'Primeiro encontro presencial da 1ª disciplina híbrida – Atividades Avaliativas e Prova 1 (P1) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['16 e 17/10', 'Segundo encontro presencial da 1ª disciplina híbrida – Atividades Avaliativas e Prova 2 (P2) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['20/10', 'Liberação, no AVA, do e-book da 2ª disciplina híbrida do segundo bimestre.', 'aula', 'media'],
  ['27/10', 'Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO, NOTA_27_10],
  ['30 e 31/10', 'Primeiro encontro presencial da 2ª disciplina híbrida – Atividades Avaliativas e Prova 1 (P1) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['13 e 14/11', 'Segundo encontro presencial da 2ª disciplina – Atividades Avaliativas e Prova 1 (P1) do segundo bimestre.', 'prova', 'alta', SUB48, 'O PDF imprime «Prova 1 (P1)» no segundo encontro. Pelo padrão dos demais encontros, é a P2.'],
  ['05/12', 'Aplicação das provas substitutivas das disciplinas híbridas do segundo bimestre.', 'prova', 'alta'],
  ...HIBRIDO_FECHAMENTO,
];

/* ==========================================================================
   SEMIPRESENCIAL · Semanais aos sábados
   ========================================================================== */

const R_SABADOS: readonly Raw[] = [
  ...HIBRIDO_ABERTURA,
  DIGITAL_2BIM,
  EXTENSIONISTA_INICIO,
  EVENTO_PRATICA_NOITE,
  ['31/07', 'Liberação, no AVA, do e-book da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'media'],
  AMBIENTACAO_MANHA,
  ['04/08', 'Início, no AVA, da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO],
  AMBIENTACAO_NOITE,
  ['08/08', 'Primeiro encontro presencial da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta'],
  ['22/08', 'Terceiro encontro presencial da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta'],
  ['25/08', 'Liberação, no AVA, do e-book da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'media'],
  ['29/08', 'Quarto encontro presencial da 1ª disciplina híbrida do primeiro bimestre – Atividades Avaliativas e Provas 1 e 2 (P1 e P2) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['01/09', 'Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO],
  ['05/09', 'Primeiro encontro presencial da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta'],
  ['12/09', 'Segundo encontro presencial da 2ª disciplina híbrida – Atividades Avaliativas e Prova 1 (P1) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['19/09', 'Terceiro encontro presencial da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta'],
  ['22/09', 'Liberação, no AVA, do e-book da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'media'],
  ['26/09', 'Quarto encontro presencial da 2ª disciplina híbrida – Atividades Avaliativas e Prova 2 (P2) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['29/09', 'Início, no AVA, da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'alta', AVA_ATENTO],
  ...HIBRIDO_VIRADA,
  ['03/10', 'Primeiro encontro presencial da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'alta'],
  ['06/10', 'Início da Monitoria do segundo bimestre.', 'programa', 'media'],
  ['10/10', 'Segundo encontro presencial da 2ª disciplina – Atividades Avaliativas e Prova 1 (P1) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['17/10', 'Terceiro encontro presencial da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'alta'],
  ['20/10', 'Liberação, no AVA, do e-book da 2ª disciplina híbrida do segundo bimestre.', 'aula', 'media'],
  ['24/10', 'Quarto encontro presencial da 1ª disciplina híbrida – Atividades Avaliativas e Prova 2 (P2) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['27/10', 'Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO, NOTA_27_10],
  ['31/10', 'Primeiro encontro presencial da 2ª disciplina híbrida do segundo bimestre.', 'aula', 'alta'],
  ['07/11', 'Segundo encontro presencial da 2ª disciplina – Atividades Avaliativas e Prova 1 (P1) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['14/11', 'Terceiro encontro presencial da 2ª disciplina híbrida do segundo bimestre.', 'aula', 'alta'],
  ['28/11', 'Quarto encontro presencial da 2ª disciplina híbrida – Atividades Avaliativas e Prova 2 (P2) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['05/12', 'Aplicação das provas substitutivas das disciplinas híbridas do segundo bimestre.', 'prova', 'alta'],
  ...HIBRIDO_FECHAMENTO,
];

/* ==========================================================================
   SEMIPRESENCIAL · Semanais às sextas e sábados (exceto Direito)
   ========================================================================== */

const R_SEX_SAB: readonly Raw[] = [
  ...HIBRIDO_ABERTURA,
  DIGITAL_2BIM,
  // Este PDF escreve a linha da Prática diferente dos outros dez: não cita a
  // Eletiva e manda consultar os projetos disponíveis.
  ['25/08', 'Início da Prática Extensionista via sistema disponível no App Grupo Anchieta.', 'programa', 'alta', 'Verifique quantas horas você ainda precisa cumprir e consulte os projetos disponíveis.'],
  ['31/07', 'Liberação, no AVA, do e-book da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'media'],
  AMBIENTACAO_MANHA,
  ['04/08', 'Início, no AVA, da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO],
  AMBIENTACAO_NOITE,
  ['07 e 08/08', 'Primeiro encontro presencial da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta'],
  ['21 e 22/08', 'Terceiro encontro presencial da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta'],
  ['25/08', 'Liberação, no AVA, do e-book da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'media'],
  ['28 e 29/08', 'Quarto encontro presencial da 1ª disciplina híbrida do primeiro bimestre – Atividades Avaliativas e Provas 1 e 2 (P1 e P2) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['01/09', 'Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO],
  ['04 e 05/09', 'Primeiro encontro presencial da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta'],
  ['11 e 12/09', 'Segundo encontro presencial da 2ª disciplina – Atividades Avaliativas e Prova 1 (P1) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['18 e 19/09', 'Terceiro encontro presencial da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta'],
  ['22/09', 'Liberação, no AVA, do e-book da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'media'],
  ['25 e 26/09', 'Quarto encontro presencial da 2ª disciplina híbrida – Atividades Avaliativas e Prova 2 (P2) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['29/09', 'Início, no AVA, da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'alta', AVA_ATENTO],
  ...HIBRIDO_VIRADA,
  ['02 e 03/10', 'Primeiro encontro presencial da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'alta'],
  ['09 e 10/10', 'Segundo encontro presencial da 2ª disciplina – Atividades Avaliativas e Prova 1 (P1) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['16 e 17/10', 'Terceiro encontro presencial da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'alta'],
  ['20/10', 'Liberação, no AVA, do e-book da 2ª disciplina híbrida do segundo bimestre.', 'aula', 'media'],
  ['23 e 24/10', 'Quarto encontro presencial da 1ª disciplina híbrida – Atividades Avaliativas e Prova 2 (P2) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['27/10', 'Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO, NOTA_27_10],
  ['30 e 31/10', 'Primeiro encontro presencial da 2ª disciplina híbrida do segundo bimestre.', 'aula', 'alta'],
  ['06 e 07/11', 'Segundo encontro presencial da 2ª disciplina – Atividades Avaliativas e Prova 1 (P1) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['13 e 14/11', 'Terceiro encontro presencial da 2ª disciplina híbrida do segundo bimestre.', 'aula', 'alta'],
  ['27 e 28/11', 'Quarto encontro presencial da 2ª disciplina híbrida – Atividades Avaliativas e Prova 2 (P2) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['05/12', 'Aplicação das provas substitutivas das disciplinas híbridas do segundo bimestre.', 'prova', 'alta'],
  ...HIBRIDO_FECHAMENTO,
];

/* ==========================================================================
   SEMIPRESENCIAL · Direito às sextas e sábados
   ========================================================================== */

const MODULO_PROFESSOR =
  'As atividades presenciais serão realizadas dentro do módulo, a critério do professor.';

const R_DIREITO_SEX_SAB: readonly Raw[] = [
  ...HIBRIDO_ABERTURA,
  EXTENSIONISTA_INICIO,
  EVENTO_PRATICA_NOITE,
  ['31/07', 'Liberação, no AVA, do e-book da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'media'],
  AMBIENTACAO_MANHA,
  ['04/08', 'Início, no AVA, da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO],
  AMBIENTACAO_NOITE,
  ['07 e 08/08', 'Primeiro encontro presencial da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', MODULO_PROFESSOR],
  ['21 e 22/08', 'Terceiro encontro presencial da 1ª disciplina híbrida – Prova 1 (P1) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['25/08', 'Liberação, no AVA, do e-book da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'media'],
  ['28 e 29/08', 'Quarto encontro presencial da 1ª disciplina híbrida – Prova 2 (P2) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['29/08', 'Aplicação da P1 da disciplina digital de formação específica.', 'prova', 'alta', 'Horário: Pós-aula às 13h10.'],
  ['01/09', 'Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO],
  ['04 e 05/09', 'Primeiro encontro presencial da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', MODULO_PROFESSOR],
  ['11 e 12/09', 'Segundo encontro presencial da 2ª disciplina – Prova 1 (P1) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['18 e 19/09', 'Terceiro encontro presencial da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', MODULO_PROFESSOR],
  ['22/09', 'Liberação, no AVA, do e-book da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'media'],
  ['25 e 26/09', 'Quarto encontro presencial da 2ª disciplina híbrida – Prova 2 (P2) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['26/09', 'Aplicação da P2 da disciplina digital de formação específica.', 'prova', 'alta', 'Horário: Pós-aula às 13h10.'],
  ['29/09 a 05/10', 'Período de realização on-line, por meio do AVA, da prova das Disciplinas Digitais Regulares de Formação Geral do primeiro bimestre.', 'prova', 'alta', TRES_TENTATIVAS],
  ['29/09', 'Início, no AVA, da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'alta', AVA_ATENTO],
  ['29/09', 'Início, no AVA, da disciplina digital do segundo bimestre.', 'aula', 'alta', AVA_ATENTO],
  ['02/10', 'Término do Programa de Monitoria do primeiro bimestre.', 'programa', 'baixa'],
  ['02 e 03/10', 'Primeiro encontro presencial da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'alta', MODULO_PROFESSOR],
  ['03/10', 'Aplicação das provas substitutivas das disciplinas híbridas e da disciplina digital de formação específica do primeiro bimestre.', 'prova', 'alta', 'Horário: Pré-aula às 8h.'],
  ['05 a 08/10', 'Semana Jurídica.', 'evento', 'alta'],
  ['05 a 09/10', 'Período para entrega do relatório final de Monitoria do primeiro bimestre.', 'programa', 'baixa'],
  DIGITAIS_ESPECIAIS,
  ['06/10', 'Início da Monitoria do segundo bimestre.', 'programa', 'media'],
  ['09 e 10/10', 'Segundo encontro presencial da 2ª disciplina – Prova 1 (P1) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['16 e 17/10', 'Terceiro encontro presencial da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'alta', MODULO_PROFESSOR],
  ['20/10', 'Liberação, no AVA, do e-book da 2ª disciplina híbrida do segundo bimestre.', 'aula', 'media'],
  ['23 e 24/10', 'Quarto encontro presencial da 1ª disciplina híbrida – Atividades Avaliativas e Prova 2 (P2) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['24/10', 'Aplicação das provas de recuperação das disciplinas híbridas do primeiro bimestre.', 'prova', 'alta', 'Horário: Pré-aula às 8h.'],
  ['24/10', 'Aplicação da P1 da disciplina digital de formação específica.', 'prova', 'alta', 'Horário: Pós-aula às 13h10.'],
  ['27/10', 'Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO, NOTA_27_10],
  ['30 e 31/10', 'Primeiro encontro presencial da 2ª disciplina híbrida do segundo bimestre.', 'aula', 'alta', MODULO_PROFESSOR],
  ['06 e 07/11', 'Segundo encontro presencial da 2ª disciplina – Prova 1 (P1) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['13 e 14/11', 'Terceiro encontro presencial da 2ª disciplina híbrida do segundo bimestre.', 'aula', 'alta', MODULO_PROFESSOR],
  ['14 e 28/11', 'Aplicação da Prova Oficial das disciplinas de Estudo Dirigido e Digitais Especiais.', 'prova', 'alta', 'Horário: 08h às 12h.', 'O PDF imprime «14 e 28/11». Nos demais calendários a mesma prova cai em 27 e 28/11.'],
  ['27 e 28/11', 'Quarto encontro presencial da 2ª disciplina híbrida – Prova 2 (P2) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['28/11', 'Aplicação da P2 da disciplina digital de formação específica.', 'prova', 'alta', 'Horário: Pós-aula às 13h10.'],
  ['01 a 14/12', 'Período de realização on-line, por meio do AVA, da prova das Disciplinas Digitais Regulares de Formação Geral do segundo bimestre.', 'prova', 'alta', TRES_TENTATIVAS],
  ['04/12', 'Término do Programa de Monitoria do segundo bimestre.', 'programa', 'baixa'],
  ['04/12', 'Aplicação das provas substitutivas das disciplinas híbridas do segundo bimestre.', 'prova', 'alta'],
  ['05/12', 'Aplicação da prova substitutiva das disciplinas de Estudo Dirigido.', 'prova', 'alta', 'Horário: 08h às 12h.'],
  ['12/12', 'Aplicação das provas de recuperação das disciplinas de Estudo Dirigido.', 'prova', 'alta', 'Horário: 08h às 12h.'],
  ['19/12', 'Aplicação das provas de recuperação das disciplinas híbridas do segundo bimestre.', 'prova', 'alta'],
  EXTENSIONISTA_FIM,
  ...FERIADOS,
  ...FECHAMENTO,
];

/* ==========================================================================
   SEMIPRESENCIAL · Quinzenais ingressantes
   ========================================================================== */

const R_QUINZENAL_ING: readonly Raw[] = [
  ...HIBRIDO_ABERTURA,
  DIGITAL_2BIM,
  EXTENSIONISTA_INICIO,
  EVENTO_PRATICA_NOITE,
  ['31/07', 'Liberação, no AVA, do e-book da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'media'],
  AMBIENTACAO_MANHA,
  ['04/08', 'Início, no AVA, da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO],
  AMBIENTACAO_NOITE,
  ['08/08', 'Cerimônia do Jaleco.', 'evento', 'alta'],
  ['25/08', 'Liberação, no AVA, do e-book da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'media'],
  ['29/08', 'Primeiro encontro presencial da 1ª disciplina híbrida – Atividades Avaliativas e Prova 1 (P1) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['01/09', 'Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO],
  ['12/09', 'Segundo encontro presencial da 1ª disciplina – Atividades Avaliativas e Prova 2 (P2) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['22/09', 'Liberação, no AVA, do e-book da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'media'],
  ['26/09', 'Primeiro encontro presencial da 2ª disciplina híbrida – Atividades Avaliativas e Prova 1 (P1) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['29/09', 'Início, no AVA, da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'alta', AVA_ATENTO],
  ...HIBRIDO_VIRADA,
  ['06/10', 'Início da Monitoria do segundo bimestre.', 'programa', 'media'],
  ['10/10', 'Segundo encontro presencial da 2ª disciplina – Atividades Avaliativas e Prova 2 (P2) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['20/10', 'Liberação, no AVA, do e-book da 2ª disciplina híbrida do segundo bimestre.', 'aula', 'media'],
  ['24/10', 'Primeiro encontro presencial da 1ª disciplina híbrida – Atividades Avaliativas e Prova 1 (P1) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['27/10', 'Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO, NOTA_27_10],
  ['07/11', 'Segundo encontro presencial da 1ª disciplina – Atividades Avaliativas e Prova 2 (P2) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['28/11', 'Primeiro encontro presencial da 2ª disciplina híbrida – Atividades Avaliativas e Prova 1 (P1) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['05/12', 'Segundo encontro presencial da 2ª disciplina – Atividades Avaliativas e Prova 2 (P2) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['12/12', 'Aplicação das provas substitutivas das disciplinas híbridas do segundo bimestre.', 'prova', 'alta'],
  ...HIBRIDO_FECHAMENTO,
];

/* ==========================================================================
   SEMIPRESENCIAL · Quinzenais veteranos
   ========================================================================== */

const R_QUINZENAL_VET: readonly Raw[] = [
  ...HIBRIDO_ABERTURA,
  EXTENSIONISTA_INICIO,
  EVENTO_PRATICA_NOITE,
  ['31/07', 'Liberação, no AVA, do e-book da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'media'],
  ['04/08', 'Início, no AVA, da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO],
  ['08/08', 'Primeiro encontro presencial da 1ª disciplina híbrida – Atividades Avaliativas e Prova 1 (P1) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['22/08', 'Segundo encontro presencial da 1ª disciplina – Atividades Avaliativas e Prova 2 (P2) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['25/08', 'Liberação, no AVA, do e-book da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'media'],
  ['01/09', 'Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO],
  ['05/09', 'Primeiro encontro presencial da 2ª disciplina híbrida – Atividades Avaliativas e Prova 1 (P1) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['19/09', 'Segundo encontro presencial da 2ª disciplina – Atividades Avaliativas e Prova 2 (P2) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['22/09', 'Liberação, no AVA, do e-book da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'media'],
  ...HIBRIDO_VIRADA,
  ['03/10', 'Primeiro encontro presencial da 1ª disciplina híbrida – Atividades Avaliativas e Prova 1 (P1) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['06/10', 'Início da Monitoria do segundo bimestre.', 'programa', 'media'],
  ['17/10', 'Segundo encontro presencial da 1ª disciplina – Atividades Avaliativas e Prova 2 (P2) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['20/10', 'Liberação, no AVA, do e-book da 2ª disciplina híbrida do segundo bimestre.', 'aula', 'media'],
  ['27/10', 'Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO, NOTA_27_10],
  ['31/10', 'Primeiro encontro presencial da 2ª disciplina híbrida – Atividades Avaliativas e Prova 1 (P1) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['14/11', 'Segundo encontro presencial da 2ª disciplina – Atividades Avaliativas e Prova 2 (P2) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['05/12', 'Aplicação das provas substitutivas das disciplinas híbridas do segundo bimestre.', 'prova', 'alta'],
  ...HIBRIDO_FECHAMENTO,
];

/* ==========================================================================
   SEMIPRESENCIAL · Semanal de Estética e Cosmética
   ========================================================================== */

const R_ESTETICA: readonly Raw[] = [
  ...HIBRIDO_ABERTURA,
  DIGITAL_2BIM,
  EXTENSIONISTA_INICIO,
  EVENTO_PRATICA_NOITE,
  ['31/07', 'Liberação, no AVA, do e-book da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'media'],
  AMBIENTACAO_MANHA,
  ['04/08', 'Início, no AVA, da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO],
  AMBIENTACAO_NOITE,
  ['08/08', 'Cerimônia do Jaleco.', 'evento', 'alta'],
  ['10/08', 'Primeiro encontro presencial da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta'],
  ['17/08', 'Segundo encontro presencial da 1ª disciplina – Atividades Avaliativas e Prova 1 (P1) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['24/08', 'Terceiro encontro presencial da 1ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta'],
  ['25/08', 'Liberação, no AVA, do e-book da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'media'],
  ['31/08', 'Quarto encontro presencial da 1ª disciplina híbrida do primeiro bimestre – Atividades Avaliativas e Prova 2 (P2) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['01/09', 'Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO],
  ['14/09', 'Segundo encontro presencial da 2ª disciplina – Atividades Avaliativas e Prova 1 (P1) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['21/09', 'Terceiro encontro presencial da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta'],
  ['22/09', 'Liberação, no AVA, do e-book da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'media'],
  ['28/09', 'Quarto encontro presencial da 2ª disciplina híbrida – Atividades Avaliativas e Prova 2 (P2) do primeiro bimestre.', 'prova', 'alta', SUB48],
  ['29/09', 'Início, no AVA, da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'alta', AVA_ATENTO],
  ...HIBRIDO_VIRADA,
  ['05/10', 'Primeiro encontro presencial da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'alta'],
  ['06/10', 'Início da Monitoria do segundo bimestre.', 'programa', 'media'],
  ['19/10', 'Terceiro encontro presencial da 1ª disciplina híbrida do segundo bimestre.', 'aula', 'alta'],
  ['20/10', 'Liberação, no AVA, do e-book da 2ª disciplina híbrida do segundo bimestre.', 'aula', 'media'],
  ['26/10', 'Quarto encontro presencial da 1ª disciplina híbrida – Atividades Avaliativas e Provas 1 e 2 (P1 e P2) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['27/10', 'Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.', 'aula', 'alta', AVA_ATENTO, NOTA_27_10],
  ['09/11', 'Segundo encontro presencial da 2ª disciplina – Atividades Avaliativas e Prova 1 (P1) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['16/11', 'Terceiro encontro presencial da 2ª disciplina híbrida do segundo bimestre.', 'aula', 'alta'],
  ['23/11', 'Quarto encontro presencial da 2ª disciplina híbrida – Atividades Avaliativas e Prova 2 (P2) do segundo bimestre.', 'prova', 'alta', SUB48],
  ['05/12', 'Aplicação das provas substitutivas das disciplinas híbridas do segundo bimestre.', 'prova', 'alta'],
  ...HIBRIDO_FECHAMENTO,
];

/* ==========================================================================
   EAD
   ========================================================================== */

const R_EAD: readonly Raw[] = [
  ...ABERTURA,
  ['20/07 a 10/08', 'Período de inscrição para Monitoria do primeiro bimestre.', 'programa', 'media'],
  AMBIENTACAO_MANHA,
  MONITORIA_EVENTO,
  ['04/08', 'Início das Disciplinas Digitais Regulares, no AVA, para Calouros e Veteranos.', 'aula', 'alta'],
  AMBIENTACAO_NOITE,
  ELEICAO,
  ['04 a 17/08', 'Sugestão de Estudo: Unidade 1 e atividades avaliativas do primeiro bimestre.', 'aula', 'media'],
  ['11/08', 'Evento on-line para Ingressantes: Ambientação do Cenário EaD.', 'evento', 'alta', `${YT_TV} Horário: 19h30 (horário de Brasília).`],
  ['13/08', 'Evento on-line: Estratégias de Estudo e Sucesso.', 'evento', 'media', `${YT_TV} Horário: 19h30 (horário de Brasília).`],
  ['14/08', 'Divulgação dos nomes dos alunos classificados para a Monitoria do segundo semestre.', 'programa', 'media'],
  ['17/08', 'Ambientação Vida do Monitor.', 'programa', 'baixa', 'Local: On-line, às 18h30. Será notificado apenas aos alunos monitores.'],
  ['17/08', 'Início da Monitoria do primeiro bimestre.', 'programa', 'media'],
  ['18 a 31/08', 'Sugestão de Estudo: Unidade 2 e atividades avaliativas do primeiro bimestre.', 'aula', 'media'],
  EXTENSIONISTA_INICIO,
  EVENTO_PRATICA_MANHA,
  ['29/08', 'Evento on-line para Ingressantes: Ambientação do Cenário EaD.', 'evento', 'alta', `${YT_TV} Horário: 10h (horário de Brasília).`],
  ['01 a 14/09', 'Sugestão de Estudo: Unidade 3 e atividades avaliativas do primeiro bimestre.', 'aula', 'media'],
  EVENTO_PRATICA_NOITE,
  ['15 a 21/09', 'Sugestão de Estudo: Revisão e atividade avaliativa do primeiro bimestre.', 'aula', 'media'],
  ['21 a 30/09', 'Período de inscrição para Monitoria do segundo bimestre.', 'programa', 'media'],
  ['29/09 a 05/10', 'Período de realização on-line, por meio do AVA, da prova das Disciplinas Regulares do primeiro bimestre.', 'prova', 'alta'],
  ['02/10', 'Término do Programa de Monitoria do primeiro bimestre.', 'programa', 'baixa'],
  ['03/10', 'Evento on-line para Ingressantes: Ambientação - Ambiente Virtual de Aprendizagem (AVA) e Biblioteca Virtual.', 'evento', 'alta', `${YT_TV} Horário: 10h (horário de Brasília).`],
  ['05 a 09/10', 'Período para entrega do relatório final de Monitoria do primeiro bimestre.', 'programa', 'baixa'],
  ['06/10', 'Início das Disciplinas Digitais Regulares do segundo bimestre no AVA, para Calouros e Veteranos.', 'aula', 'alta'],
  ['06/10', 'Início das Disciplinas Digitais Especiais, no AVA, para Veterenos.', 'aula', 'alta', undefined, 'O PDF imprime «Veterenos», erro de digitação de «Veteranos» na origem.'],
  ['06/10', 'Evento on-line para Ingressantes: Ambientação do Cenário EaD.', 'evento', 'alta', `${YT_TV} Horário: 19h30 (horário de Brasília).`],
  ['06/10', 'Início da Monitoria do segundo bimestre.', 'programa', 'media'],
  ['06 a 19/10', 'Sugestão de Estudo: Unidade 1 e atividades avaliativas do segundo bimestre.', 'aula', 'media'],
  ['20/10 a 02/11', 'Sugestão de Estudo: Unidade 2 e atividades avaliativas do segundo bimestre.', 'aula', 'media'],
  ['03 a 16/11', 'Sugestão de Estudo: Unidade 3 e atividades avaliativas do segundo bimestre.', 'aula', 'media'],
  ['07/11', 'Evento on-line para Ingressantes: Ambientação do Cenário EaD.', 'evento', 'alta', `${YT_TV} Horário: 10h (horário de Brasília).`],
  ['17 a 30/11', 'Sugestão de Estudo: Revisão e atividade avaliativa do primeiro bimestre.', 'aula', 'media', undefined, 'O PDF imprime «primeiro bimestre» numa linha de novembro, que pertence ao segundo.'],
  ['01 a 14/12', 'Período de realização on-line, por meio do AVA, da prova das Disciplinas Regulares e Disciplinas Especiais do segundo bimestre.', 'prova', 'alta'],
  ['04/12', 'Término do Programa de Monitoria do segundo bimestre.', 'programa', 'baixa'],
  ...FERIADOS,
  ...FECHAMENTO,
];

/* ==========================================================================
   Os onze documentos
   ========================================================================== */

export const SEMESTER = '2026/2';

export const CALENDARS: AcademicCalendar[] = [
  {
    id: 'cal-presencial-geral',
    name: 'Cursos Presencial (exceto Direito) · 2º semestre',
    shortName: 'Presencial diurno e noturno',
    modality: 'Presencial',
    semester: SEMESTER,
    rhythm: 'Diário',
    source: 'calendario_presencial_2026_2.pdf',
    url: `${S3}/calendario_presencial_2026_2.pdf`,
    events: build('cal-presencial-geral', R_PRES_GERAL),
  },
  {
    id: 'cal-presencial-direito',
    name: 'Cursos Presencial de Direito · 2º semestre',
    shortName: 'Presencial Direito',
    modality: 'Presencial',
    semester: SEMESTER,
    rhythm: 'Diário',
    source: 'calendario_direito_presencial_2026_2.pdf',
    url: `${S3}/calendario_direito_presencial_2026_2.pdf`,
    events: build('cal-presencial-direito', R_PRES_DIREITO),
  },
  {
    id: 'cal-quinzenal-veteranos',
    name: 'Cursos Quinzenais · Veteranos · 2º semestre',
    shortName: 'Quinzenal veteranos',
    modality: 'Híbrido',
    semester: SEMESTER,
    rhythm: 'Quinzenal',
    source: 'calendario_semipresenciais_quinzenais_veteranos_2026_2.pdf',
    url: `${S3}/calendario_semipresenciais_quinzenais_veteranos_2026_2.pdf`,
    events: build('cal-quinzenal-veteranos', R_QUINZENAL_VET),
  },
  {
    id: 'cal-quinzenal-ingressantes',
    name: 'Cursos Quinzenais · Ingressantes · 2º semestre',
    shortName: 'Quinzenal ingressantes',
    modality: 'Híbrido',
    semester: SEMESTER,
    rhythm: 'Quinzenal',
    source: 'calendario_semipresenciais_quinzenais_ingressantes_2026_2.pdf',
    url: `${S3}/calendario_semipresenciais_quinzenais_ingressantes_2026_2.pdf`,
    events: build('cal-quinzenal-ingressantes', R_QUINZENAL_ING),
  },
  {
    id: 'cal-bissemanal',
    name: 'Cursos Semanais (Ingressantes e Veteranos) · terças e quintas · 2º semestre',
    shortName: 'Bissemanal terças e quintas',
    modality: 'Híbrido',
    semester: SEMESTER,
    rhythm: 'Semanal',
    source: 'calendario_semipresenciais_bissemanais_2026_2.pdf',
    url: `${S3}/calendario_semipresenciais_bissemanais_2026_2.pdf`,
    events: build('cal-bissemanal', R_BISSEMANAL),
  },
  {
    id: 'cal-semanal-sabados',
    name: 'Cursos Semanais aos sábados · 2º semestre',
    shortName: 'Semanal aos sábados',
    modality: 'Híbrido',
    semester: SEMESTER,
    rhythm: 'Semanal',
    source: 'calendario_semipresenciais_semanais_aos_sabados_2026_2.pdf',
    url: `${S3}/calendario_semipresenciais_semanais_aos_sabados_2026_2.pdf`,
    events: build('cal-semanal-sabados', R_SABADOS),
  },
  {
    id: 'cal-semanal-sex-sab',
    name: 'Cursos Semanais às sextas e sábados (exceto Direito) · 2º semestre',
    shortName: 'Semanal sextas e sábados',
    modality: 'Híbrido',
    semester: SEMESTER,
    rhythm: 'Semanal',
    source: 'calendario_semipresenciais_semanais_sextas_e_sabados_2026_2.pdf',
    url: `${S3}/calendario_semipresenciais_semanais_sextas_e_sabados_2026_2.pdf`,
    events: build('cal-semanal-sex-sab', R_SEX_SAB),
  },
  {
    id: 'cal-direito-sex-sab',
    name: 'Curso de Direito às sextas e sábados · 2º semestre',
    shortName: 'Semipresencial Direito',
    modality: 'Híbrido',
    semester: SEMESTER,
    rhythm: 'Semanal',
    source: 'calendario_semipresencial_direito_2026_2.pdf',
    url: `${S3}/calendario_semipresencial_direito_2026_2.pdf`,
    events: build('cal-direito-sex-sab', R_DIREITO_SEX_SAB),
  },
  {
    id: 'cal-quinzenal-ads',
    name: 'Cursos Quinzenais às sextas e sábados · (ADS) Veteranos · 2º semestre',
    shortName: 'Quinzenal ADS veteranos',
    modality: 'Híbrido',
    semester: SEMESTER,
    rhythm: 'Quinzenal',
    source: 'calendario_semipresencial_quinzenal_ADS_2026_2.pdf',
    url: `${S3}/calendario_semipresencial_quinzenal_ADS_2026_2.pdf`,
    events: build('cal-quinzenal-ads', R_ADS),
  },
  {
    id: 'cal-estetica',
    name: 'Curso Semanal de Estética e Cosmética · 2º semestre',
    shortName: 'Semanal Estética',
    modality: 'Híbrido',
    semester: SEMESTER,
    rhythm: 'Semanal',
    source: 'calendario_semipresencial_estetica_2026_2.pdf',
    url: `${S3}/calendario_semipresencial_estetica_2026_2.pdf`,
    events: build('cal-estetica', R_ESTETICA),
  },
  {
    id: 'cal-ead',
    name: 'Cursos EAD · 2º semestre',
    shortName: 'EAD',
    modality: 'EaD',
    semester: SEMESTER,
    rhythm: 'A distância',
    source: 'calendario_ead_2026_2.pdf',
    url: `${S3}/calendario_ead_2026_2.pdf`,
    events: build('cal-ead', R_EAD),
  },
];

export function calendarById(id: string): AcademicCalendar | undefined {
  return CALENDARS.find((c) => c.id === id);
}

/* ==========================================================================
   As trinta e três linhas do site
   ========================================================================== */

const G_PRESENCIAL = 'Cursos Presenciais Diurno/Noturno';
const G_PRESENCIAL_DIREITO = 'Curso Presencial Direito';
const G_HIBRIDO = 'Cursos Híbridos (Semipresenciais e Presenciais Intensivos)';
const G_EAD = 'Cursos EAD';

const ING = 'Ingressantes de janeiro à dezembro de 2026';
const VET = 'Veteranos';

function slugOf(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Uma linha do bloco de híbridos, na ordem alfabética em que o site publica. */
function hib(course: string, audienceLabel: string, calendarId: string): CalendarEntry {
  const audience = audienceLabel === VET ? 'Veterano' : 'Ingressante';
  return {
    id: `entry-${slugOf(course)}-${audience === 'Veterano' ? 'vet' : 'ing'}`,
    group: 'hibrido',
    groupLabel: G_HIBRIDO,
    course,
    audience,
    audienceLabel,
    calendarId,
  };
}

export const CALENDAR_ENTRIES: CalendarEntry[] = [
  {
    id: 'entry-presencial-geral',
    group: 'presencial',
    groupLabel: G_PRESENCIAL,
    course: 'Todos os cursos presenciais diurnos e noturnos',
    audience: 'Ambos',
    audienceLabel: 'Exibir Calendário',
    calendarId: 'cal-presencial-geral',
    catchAll: true,
  },
  {
    id: 'entry-presencial-direito',
    group: 'presencial',
    groupLabel: G_PRESENCIAL_DIREITO,
    course: 'Direito',
    audience: 'Ambos',
    audienceLabel: 'Exibir Calendário',
    calendarId: 'cal-presencial-direito',
  },

  hib('Administração', VET, 'cal-quinzenal-veteranos'),
  hib('Análise e Desenvolvimento de Sistemas', VET, 'cal-quinzenal-ads'),
  hib('Biomedicina', ING, 'cal-quinzenal-ingressantes'),
  hib('Biomedicina', VET, 'cal-quinzenal-veteranos'),
  hib('Ciências Biológicas', ING, 'cal-quinzenal-ingressantes'),
  hib('Ciências Biológicas', VET, 'cal-quinzenal-veteranos'),
  hib('Ciências Contábeis', VET, 'cal-quinzenal-veteranos'),
  hib('Direito', ING, 'cal-direito-sex-sab'),
  hib('Direito', VET, 'cal-direito-sex-sab'),
  hib('Educação Física (Sábados)', ING, 'cal-quinzenal-ingressantes'),
  hib('Educação Física (Sábados)', VET, 'cal-quinzenal-veteranos'),
  hib('Educação Física (Terça e Quinta)', ING, 'cal-bissemanal'),
  hib('Enfermagem', ING, 'cal-semanal-sabados'),
  hib('Enfermagem', VET, 'cal-semanal-sabados'),
  hib('Engenharia Civil', VET, 'cal-semanal-sex-sab'),
  hib('Eng. Controle e Automação (Terça e Quinta)', ING, 'cal-bissemanal'),
  hib('Engenharia de Produção', VET, 'cal-semanal-sex-sab'),
  hib('Estética e Cosmética', VET, 'cal-estetica'),
  hib('Fisioterapia', VET, 'cal-quinzenal-veteranos'),
  hib('Fonoaudiologia', ING, 'cal-quinzenal-ingressantes'),
  hib('Fonoaudiologia', VET, 'cal-semanal-sabados'),
  hib('Nutrição', ING, 'cal-quinzenal-ingressantes'),
  hib('Nutrição', VET, 'cal-quinzenal-veteranos'),
  hib('Pedagogia', ING, 'cal-ead'),
  hib('Psicologia', ING, 'cal-semanal-sabados'),
  hib('Psicologia', VET, 'cal-semanal-sabados'),
  hib('Recursos Humanos', VET, 'cal-quinzenal-veteranos'),
  hib('Serviço Social', ING, 'cal-ead'),
  hib('Terapia Ocupacional', ING, 'cal-quinzenal-ingressantes'),
  hib('Terapia Ocupacional', VET, 'cal-semanal-sabados'),

  {
    id: 'entry-ead',
    group: 'ead',
    groupLabel: G_EAD,
    course: 'Todos os cursos EAD',
    audience: 'Ambos',
    audienceLabel: 'Exibir Calendário',
    calendarId: 'cal-ead',
    catchAll: true,
  },
];

/** Todas as linhas do site que usam um mesmo PDF. */
export function entriesOfCalendar(calendarId: string): CalendarEntry[] {
  return CALENDAR_ENTRIES.filter((e) => e.calendarId === calendarId);
}

export function entryById(id: string): CalendarEntry | undefined {
  return CALENDAR_ENTRIES.find((e) => e.id === id);
}

export const SOURCE_PAGES = {
  principal: 'https://anchieta.br/calendario-academico-segundo-semestre/',
  hibridos: 'https://anchieta.br/calendario-academico-hibridos-segundo-semestre/',
};
