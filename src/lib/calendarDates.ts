/* ==========================================================================
   Datas do calendário acadêmico
   --------------------------------------------------------------------------
   Os calendários da instituição escrevem data em prosa, não em ISO:

     09/07                    um dia
     01/07 a 21/08            um período
     12 e 13/10               dois dias soltos
     13, 14, 27 e 28/11       uma lista
     04, 11, 18 e 25/08       uma lista com o mês só no fim

   O rótulo é preservado palavra por palavra na tela — é assim que o aluno vê
   no PDF e é assim que a coordenação confere. Mas a régua precisa de datas de
   verdade para calcular "três dias antes", então o rótulo é resolvido aqui, uma
   vez, e nunca mais reinterpretado.

   O mês vem sempre do último token da lista, porque é lá que ele é impresso.
   Por isso a resolução corre da direita para a esquerda.
   ========================================================================== */

/** Ano letivo dos calendários carregados. Todos os eventos são 2026. */
export const CALENDAR_YEAR = 2026;

const SEPARATORS = /\s*(?:,|\se\s|\sa\s|\s&\s)\s*/;

interface Token {
  day: number;
  month: number | null;
}

function tokenize(label: string): Token[] {
  return label
    .split(SEPARATORS)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const full = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
      if (full) return { day: Number(full[1]), month: Number(full[2]) };
      const bare = raw.match(/^(\d{1,2})$/);
      if (bare) return { day: Number(bare[1]), month: null };
      return null;
    })
    .filter((t): t is Token => t !== null);
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Resolve o rótulo impresso em datas ISO, na ordem em que aparecem.
 * Devolve lista vazia quando o rótulo não é uma data — o que acontece em
 * legendas e rodapés, e é justamente o que o carregador usa para descartá-los.
 */
export function parseDateLabel(label: string, year = CALENDAR_YEAR): string[] {
  const tokens = tokenize(label);
  if (tokens.length === 0) return [];

  let month: number | null = null;
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    if (tokens[i].month !== null) month = tokens[i].month;
    else tokens[i].month = month;
  }

  return tokens
    .filter((t) => t.month !== null && t.day >= 1 && t.day <= 31)
    .map((t) => iso(year, t.month as number, t.day));
}

/* -- Aritmética de dias ---------------------------------------------------
   Datas de calendário não têm fuso: 2026-09-28 é 28 de setembro em Jundiaí e
   em qualquer outro lugar. Construir com `new Date(iso)` traria UTC junto e o
   "três dias antes" viraria quatro dependendo do horário. Por isso a conta é
   feita em UTC puro e formatada de volta à mão. */

export function shiftDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const base = Date.UTC(y, m - 1, d) + days * 86_400_000;
  const out = new Date(base);
  return iso(out.getUTCFullYear(), out.getUTCMonth() + 1, out.getUTCDate());
}

export function daysBetween(from: string, to: string): number {
  const [ay, am, ad] = from.split('-').map(Number);
  const [by, bm, bd] = to.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function weekdayOf(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "28 de setembro" — usado dentro do texto do push. */
export function longDay(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]}`;
}

/** "28/09" — usado nas colunas das tabelas. */
export function shortDay(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/** Data de hoje em ISO, sem horário. Isolada para facilitar teste e congelamento. */
export function todayIso(now = new Date()): string {
  return iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Junta data ISO e horário HH:mm num timestamp local comparável. */
export function atTime(isoDate: string, time: string): string {
  return `${isoDate}T${time}:00`;
}
