import type { Cohort, HealthStatus, Modality } from '../types';
import { SCORE_BANDS } from '../lib/healthScore';

/* ==========================================================================
   Censo institucional
   --------------------------------------------------------------------------
   The app ships a curated sample of students — a few dozen records rich enough
   to carry a real dossier, a real timeline and a real case. That sample is what
   the queue, the dossiers and the radars work on.

   It is *not* what the operation looks like. An attendant opening the cockpit
   needs to know how the whole institution is doing, and "54 alunos" is not that
   number. So the aggregate view reads this census instead: the real headcount,
   broken down by the two segmentations that matter and by Health Score band.

   Why a table of absolute counts rather than percentages applied to a total:
   every filter combination (modality × cohort) must add up exactly. Percentages
   drift on rounding and the donut ends up showing 8.599.
   ========================================================================== */

/** Counts per modality → cohort → Health Score band. Authored, not derived. */
const CENSUS: Record<'Presencial' | 'Híbrido', Record<Cohort, Record<HealthStatus, number>>> = {
  Presencial: {
    // 7.621 em avaliação contínua
    Veterano: { 'Estável': 4867, 'Atenção': 1694, 'Risco': 733, 'Crítico': 327 },
    // 1.061 dentro dos primeiros 90 dias
    Calouro: { 'Estável': 603, 'Atenção': 287, 'Risco': 124, 'Crítico': 47 },
  },
  'Híbrido': {
    // 954 em avaliação contínua
    Veterano: { 'Estável': 547, 'Atenção': 241, 'Risco': 113, 'Crítico': 53 },
    // 139 dentro dos primeiros 90 dias
    Calouro: { 'Estável': 71, 'Atenção': 43, 'Risco': 16, 'Crítico': 9 },
  },
};

const ACTIVE = ['Presencial', 'Híbrido'] as const satisfies readonly Modality[];

export type PopulationScope = {
  modality: 'Todas' | Modality;
  /** `'Todos'` sums both tracks; the cockpit narrows it to `'Veterano'`. */
  cohort: 'Todos' | Cohort;
};

function cellsFor({ modality, cohort }: PopulationScope): Record<HealthStatus, number>[] {
  const modalities = ACTIVE.filter((m) => modality === 'Todas' || m === modality);
  const cohorts: Cohort[] =
    cohort === 'Todos' ? ['Veterano', 'Calouro'] : [cohort];
  return modalities.flatMap((m) => cohorts.map((c) => CENSUS[m][c]));
}

/** Headcount in a scope. */
export function populationOf(scope: PopulationScope): number {
  return cellsFor(scope).reduce(
    (sum, cell) => sum + SCORE_BANDS.reduce((s, band) => s + cell[band.status], 0),
    0,
  );
}

/**
 * The distribution the cockpit donut draws: same shape `scoreDistribution`
 * returns for the sample, so the chart component does not care which source
 * it was handed.
 */
export function populationDistribution(scope: PopulationScope) {
  const cells = cellsFor(scope);
  const total = populationOf(scope);
  return SCORE_BANDS.map((band) => {
    const count = cells.reduce((sum, cell) => sum + cell[band.status], 0);
    return { ...band, count, percent: total > 0 ? (count / total) * 100 : 0 };
  });
}

/** Everyone enrolled, both tracks, every modality offered. */
export const TOTAL_ENROLLED = populationOf({ modality: 'Todas', cohort: 'Todos' });

/** Past the 90-day window — the population the Health Score actually judges. */
export const TOTAL_EVALUATED = populationOf({ modality: 'Todas', cohort: 'Veterano' });

/** Inside the 90-day window — the onboarding track, deliberately kept apart. */
export const TOTAL_ONBOARDING = populationOf({ modality: 'Todas', cohort: 'Calouro' });
