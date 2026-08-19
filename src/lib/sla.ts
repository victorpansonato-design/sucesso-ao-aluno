import { useEffect, useState } from 'react';
import type { Case, GovernanceSettings, Priority, RadarKey } from '../types';
import { duration } from './format';

/* ==========================================================================
   SLA — in business hours
   --------------------------------------------------------------------------
   The operating plan specifies "4 horas úteis", not four wall-clock hours. A
   critical case opened at 21:40 on a Friday must be due early Monday, not at
   01:40 Saturday morning when nobody is on shift. Everything below therefore
   counts only inside the service window.

   Window (institution runs a night-heavy campus):
     Mon–Fri  08:00 → 22:00   (14 h)
     Saturday 08:00 → 12:00   (4 h)
     Sunday   closed
   ========================================================================== */

export const DEFAULT_WINDOW = { start: 8, end: 22, saturdayEnd: 12 };

type Window = { start: number; end: number; saturdayEnd: number };

function dayCloseHour(date: Date, w: Window): number {
  const day = date.getDay();
  if (day === 0) return w.start; // Sunday: zero-length window
  if (day === 6) return w.saturdayEnd;
  return w.end;
}

function isOpenDay(date: Date, w: Window): boolean {
  return dayCloseHour(date, w) > w.start;
}

function atHour(date: Date, hour: number): Date {
  const d = new Date(date);
  d.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
  return d;
}

function nextOpening(from: Date, w: Window): Date {
  let cursor = new Date(from);
  for (let i = 0; i < 14; i += 1) {
    if (isOpenDay(cursor, w)) {
      const open = atHour(cursor, w.start);
      const close = atHour(cursor, dayCloseHour(cursor, w));
      if (cursor < open) return open;
      if (cursor < close) return cursor;
    }
    cursor = atHour(new Date(cursor.getTime() + 86_400_000), 0);
  }
  return from;
}

/** Adds N business hours to a timestamp, skipping closed periods. */
export function addBusinessHours(fromIso: string, hours: number, w: Window = DEFAULT_WINDOW): string {
  let cursor = nextOpening(new Date(fromIso), w);
  let remainingMs = hours * 3_600_000;

  for (let guard = 0; guard < 400 && remainingMs > 0; guard += 1) {
    const close = atHour(cursor, dayCloseHour(cursor, w));
    const availableMs = close.getTime() - cursor.getTime();

    if (availableMs >= remainingMs) {
      return new Date(cursor.getTime() + remainingMs).toISOString();
    }
    remainingMs -= Math.max(0, availableMs);
    cursor = nextOpening(atHour(new Date(close.getTime() + 86_400_000), 0), w);
  }
  return cursor.toISOString();
}

/** Business milliseconds between two timestamps (never negative). */
export function businessMsBetween(fromIso: string, toIso: string, w: Window = DEFAULT_WINDOW): number {
  const target = new Date(toIso).getTime();
  let cursor = nextOpening(new Date(fromIso), w);
  if (cursor.getTime() >= target) return 0;

  let total = 0;
  for (let guard = 0; guard < 400; guard += 1) {
    const close = atHour(cursor, dayCloseHour(cursor, w));
    const segmentEnd = Math.min(close.getTime(), target);
    total += Math.max(0, segmentEnd - cursor.getTime());
    if (segmentEnd >= target) break;
    cursor = nextOpening(atHour(new Date(close.getTime() + 86_400_000), 0), w);
    if (cursor.getTime() >= target) break;
  }
  return total;
}

/* -- SLA state ------------------------------------------------------------ */

export type SlaState = 'ok' | 'warning' | 'breach' | 'closed';

export interface SlaStatus {
  state: SlaState;
  /** Remaining business milliseconds; negative once breached. */
  remainingMs: number;
  /** "2 h 15 min restantes" · "Vence em 40 min" · "Estourado há 1 h 10 min". */
  label: string;
  /** Compact form for dense table cells: "2h15" · "−1h10". */
  compact: string;
  /** 0–1 progress through the SLA budget. */
  consumed: number;
}

export function slaStatus(
  kase: Pick<Case, 'openedAt' | 'slaDueAt' | 'slaHours' | 'status' | 'closedAt'>,
  now = Date.now(),
  w: Window = DEFAULT_WINDOW,
): SlaStatus {
  const isClosed =
    kase.status === 'Acordo Firmado' ||
    kase.status === 'Evasão Inevitável' ||
    kase.status === 'Cancelado';

  if (isClosed) {
    return { state: 'closed', remainingMs: 0, label: 'Encerrado', compact: '—', consumed: 1 };
  }

  const nowIso = new Date(now).toISOString();
  const budgetMs = kase.slaHours * 3_600_000;
  const overdue = now > new Date(kase.slaDueAt).getTime();

  if (overdue) {
    const overMs = businessMsBetween(kase.slaDueAt, nowIso, w);
    return {
      state: 'breach',
      remainingMs: -overMs,
      label: `Estourado há ${duration(overMs)}`,
      compact: `−${compact(overMs)}`,
      consumed: 1,
    };
  }

  const remainingMs = businessMsBetween(nowIso, kase.slaDueAt, w);
  const consumed = budgetMs > 0 ? 1 - remainingMs / budgetMs : 1;
  // "Warning" starts at 75% of the budget, or under 60 minutes, whichever first.
  const state: SlaState = consumed >= 0.75 || remainingMs <= 3_600_000 ? 'warning' : 'ok';

  return {
    state,
    remainingMs,
    label: state === 'warning' ? `Vence em ${duration(remainingMs)}` : `${duration(remainingMs)} restantes`,
    compact: compact(remainingMs),
    consumed: Math.min(1, Math.max(0, consumed)),
  };
}

function compact(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`;
  return `${Math.floor(hours / 24)}d${hours % 24}h`;
}

/**
 * Ticking clock shared by every SLA readout. One interval for the whole app
 * rather than one per row — a queue with 60 cases would otherwise run 60 timers.
 */
let subscribers = new Set<(t: number) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(fn: (t: number) => void) {
  subscribers.add(fn);
  if (!timer) {
    timer = setInterval(() => {
      const t = Date.now();
      subscribers.forEach((s) => s(t));
    }, 30_000);
  }
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Re-renders the caller every 30 s so countdowns stay honest. */
export function useClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => subscribe(setNow), []);
  return now;
}

/* -- Derivation ----------------------------------------------------------- */

export function slaHoursFor(radar: RadarKey, settings: GovernanceSettings): number {
  return settings.slaHours[radar];
}

/** Priority is derived from the radar's own severity plus how many fired. */
export function derivePriority(radar: RadarKey, signalCount: number): Priority {
  if (radar === 'evasao') return 'Crítico';
  if (signalCount >= 3) return 'Alto';
  if (radar === 'academico' || radar === 'financeiro' || radar === 'atendimento') return 'Alto';
  return signalCount >= 2 ? 'Médio' : 'Baixo';
}

export const PRIORITY_ORDER: Record<Priority, number> = {
  Crítico: 0,
  Alto: 1,
  Médio: 2,
  Baixo: 3,
};

/** Queue ordering: breached first, then priority, then least time remaining. */
export function compareBySla(a: Case, b: Case, now = Date.now()): number {
  const sa = slaStatus(a, now);
  const sb = slaStatus(b, now);
  const rank = (s: SlaStatus) => (s.state === 'breach' ? 0 : s.state === 'warning' ? 1 : s.state === 'ok' ? 2 : 3);
  if (rank(sa) !== rank(sb)) return rank(sa) - rank(sb);
  if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) {
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  }
  return sa.remainingMs - sb.remainingMs;
}
