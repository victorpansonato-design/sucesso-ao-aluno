import { SCORE_BANDS } from '../../lib/healthScore';
import type { OutcomeKey } from '../../lib/cockpit';

/* ==========================================================================
   Cores dos gráficos do Cockpit
   --------------------------------------------------------------------------
   A regra do sistema é que estrutura é monocromática e cor é conquistada: o
   azul institucional aparece em três lugares (botão primário, item de menu
   ativo, arco principal do donut) e o vermelho só em SLA estourado e caso
   crítico. Tudo o mais é tinta.

   O Cockpit abre exatamente uma exceção, e é a mesma que `SCORE_BANDS` já
   documenta: a rampa verde → amarelo → laranja → vermelho da escala de risco.
   Ela vale para o donut de distribuição E para a linha de evolução, porque as
   duas codificam a MESMA variável ordinal — se a faixa "Crítico" fosse vermelha
   no donut e cinza no gráfico ao lado, seriam dois alfabetos para uma palavra.

   Fora dessa rampa, o resto desta paleta é tinta e semântica: âmbar para
   "ainda não fechou", vermelho para "furou o SLA", verde só onde significa
   "estabilizou".
   ========================================================================== */

/** A rampa de risco, na ordem de `SCORE_BANDS`. */
export function bandColors(dark: boolean): string[] {
  return SCORE_BANDS.map((band) => band.hex(dark));
}

/** Verde institucional da escala — reservado para "deu certo". */
export function goodColor(dark: boolean): string {
  return SCORE_BANDS[0].hex(dark);
}

/**
 * Desfecho de intervenção. Ordenado como uma escala: verde (estabilizou),
 * tinta (aberto ou repassado), âmbar (sem resposta), vermelho (não resolveu).
 */
export function outcomeColor(key: OutcomeKey, dark: boolean): string {
  switch (key) {
    case 'estabilizado':
      return goodColor(dark);
    case 'acompanhamento':
      return 'var(--ink-3)';
    case 'encaminhado':
      return 'var(--ink-4)';
    case 'sem-contato':
      return 'var(--warn)';
    case 'risco-mantido':
      return 'var(--crit)';
  }
}

/** Barras de intervenção: normal → atenção → falha. Uma cor por significado. */
export const SLA_COLOR = {
  inSla: 'var(--ink-3)',
  outSla: 'var(--crit)',
  pending: 'var(--warn)',
} as const;

/** Barra de sinal. Neutra por padrão; azul só quando é o recorte ativo. */
export const SIGNAL_COLOR = {
  idle: 'var(--ink-3)',
  active: 'var(--brand)',
} as const;

/**
 * Régua de onboarding: automático → pendência → humano.
 *
 * A fatia "humano" era azul institucional, e isso gastava o azul num sliver de
 * 6% enquanto a tela já tinha o seu único elemento azul no indicador de
 * estabilização. Aqui a rampa é a mesma dos outros gráficos — tinta para o caso
 * normal, âmbar para "a automação ainda está tentando", vermelho para "escalou
 * para uma pessoa". Não é juízo moral: é a fatia que a operação quer menor.
 */
export const AUTOMATION_COLOR = {
  auto: 'var(--ink-3)',
  pending: 'var(--warn)',
  human: 'var(--crit)',
} as const;
