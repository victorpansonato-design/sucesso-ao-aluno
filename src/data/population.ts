import type { Cohort, Modality } from '../types';
import { aggregate, bandSlices } from './institution';

/* ==========================================================================
   Censo institucional — fachada por modalidade e coorte
   --------------------------------------------------------------------------
   Este arquivo mantinha a sua própria tabela de headcount. Duas tabelas de
   população significam duas verdades: o Cockpit passou a ler o censo por
   célula (curso × modalidade × período × coorte) e teria começado a discordar
   da Jornada, do Onboarding e da Base de Alunos — que continuam lendo daqui.

   Agora a tabela é uma só (`data/institution.ts`) e este módulo é apenas o
   recorte de duas dimensões que as outras telas pedem. A assinatura antiga foi
   preservada de propósito: nenhuma view precisou mudar para passar a ver o
   mesmo número que o Cockpit.
   ========================================================================== */

export type PopulationScope = {
  modality: 'Todas' | Modality;
  /** `'Todos'` soma as duas trilhas; o Cockpit costuma pedir `'Veterano'`. */
  cohort: 'Todos' | Cohort;
};

function scopeOf({ modality, cohort }: PopulationScope) {
  return { modality, course: 'Todos' as const, period: 0, cohort };
}

/** Headcount monitorado no escopo. */
export function populationOf(scope: PopulationScope): number {
  return aggregate(scopeOf(scope)).monitored;
}

/**
 * A distribuição por faixa de Health Score. Devolve a mesma forma que
 * `scoreDistribution` produz para a amostra, então o donut não precisa saber de
 * qual fonte veio.
 */
export function populationDistribution(scope: PopulationScope) {
  return bandSlices(aggregate(scopeOf(scope)));
}

/** Todo mundo matriculado, as duas trilhas, todas as modalidades ofertadas. */
export const TOTAL_ENROLLED = populationOf({ modality: 'Todas', cohort: 'Todos' });

/** Fora da janela de 90 dias — a população que o Health Score julga de fato. */
export const TOTAL_EVALUATED = populationOf({ modality: 'Todas', cohort: 'Veterano' });

/** Dentro da janela de 90 dias — a trilha de onboarding, mantida à parte. */
export const TOTAL_ONBOARDING = populationOf({ modality: 'Todas', cohort: 'Calouro' });
