/* ==========================================================================
   Persistence
   --------------------------------------------------------------------------
   Local-first prototype state. The version prefix is not decoration: without
   it, a shape change silently rehydrates stale objects and the app breaks in a
   way that looks like a bug in the new code. Bumping SCHEMA discards the old
   namespace and reseeds.
   ========================================================================== */

export const SCHEMA = 'v4';
const PREFIX = `csa.${SCHEMA}.`;

export const KEYS = {
  students: `${PREFIX}students`,
  cases: `${PREFIX}cases`,
  interactions: `${PREFIX}interactions`,
  followUps: `${PREFIX}followUps`,
  notifications: `${PREFIX}notifications`,
  specialists: `${PREFIX}specialists`,
  settings: `${PREFIX}settings`,
  theme: `${PREFIX}theme`,
  currentUser: `${PREFIX}currentUser`,
  seededAt: `${PREFIX}seededAt`,
} as const;

function available(): boolean {
  try {
    const probe = '__csa_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const OK = typeof window !== 'undefined' && available();

/** Drops every key from older schema namespaces. */
export function pruneOldSchemas(): void {
  if (!OK) return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('csa.') && !key.startsWith(PREFIX)) doomed.push(key);
      // Namespace used by the first generation of this prototype.
      if (key && key.startsWith('unianchieta_')) doomed.push(key);
    }
    doomed.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* nothing we can do, and nothing worth breaking the app over */
  }
}

export function load<T>(key: string, fallback: T): T {
  if (!OK) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  if (!OK) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded — the prototype keeps working from memory */
  }
}

export function readRaw(key: string): string | null {
  if (!OK) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Wipes the app's own namespace so the demo base can be restored. */
export function resetAll(): void {
  if (!OK) return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(PREFIX) && key !== KEYS.theme) doomed.push(key);
    }
    doomed.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
