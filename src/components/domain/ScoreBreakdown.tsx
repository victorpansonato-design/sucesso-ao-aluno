import { Info } from 'lucide-react';
import type { HealthStatus, ScoreResult } from '../../types';
import { MeterBar } from '../ui/Charts';
import { HEALTH_TONE } from '../ui/Badges';

/* ==========================================================================
   Score composition
   --------------------------------------------------------------------------
   The score is worthless to an attendant as a bare number — what they need
   before picking up the phone is *which* dimension is dragging it down and
   why. Each row therefore shows points earned against the weight available,
   plus the plain-language rationale the engine produced. The weight profile is
   named at the bottom, because a hybrid student's 15-point attendance ceiling
   is itself information.
   ========================================================================== */

export function statusColor(status: HealthStatus, dark: boolean): string {
  const map: Record<HealthStatus, [string, string]> = {
    Estável: ['#15803d', '#3fb96b'],
    Atenção: ['#ca8a04', '#e0b341'],
    Risco: ['#ea580c', '#f0844a'],
    Crítico: ['#b42318', '#e0554b'],
  };
  return map[status][dark ? 1 : 0];
}

export function statusVar(status: HealthStatus): string {
  return `var(--${HEALTH_TONE[status]})`;
}

export function ScoreBreakdown({
  score,
  compact = false,
}: {
  score: ScoreResult;
  compact?: boolean;
}) {
  return (
    <div className="space-y-3">
      {score.factors.map((factor, index) => {
        const ratio = factor.weight > 0 ? factor.earned / factor.weight : 0;
        // Only a negative factor is red. A healthy one is ink, because there
        // is nothing to act on and a green bar would compete for the eye.
        const color =
          factor.impact === 'negative'
            ? 'var(--crit)'
            : factor.impact === 'neutral'
              ? 'var(--warn)'
              : 'var(--ink-4)';

        return (
          <div key={factor.dimension} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[12px] font-semibold text-ink">{factor.label}</span>
              <span className="shrink-0 font-mono text-[11.5px] font-semibold text-ink">
                {factor.earned}
                <span className="font-normal text-ink-4"> / {factor.weight}</span>
              </span>
            </div>
            <MeterBar value={ratio * 100} color={color} height={5} delay={index * 0.06} />
            {!compact && (
              <p className="text-[11px] leading-relaxed text-ink-3">{factor.rationale}</p>
            )}
          </div>
        );
      })}

      <div className="flex items-start gap-2 border-t border-hairline pt-3">
        <Info className="mt-px h-3.5 w-3.5 shrink-0 text-ink-4" />
        <p className="text-[11px] leading-relaxed text-ink-3">
          <span className="font-semibold text-ink-2">{score.profileLabel}.</span> O Health Score é um
          indicador para orientar a equipe — nunca uma sentença sobre o aluno. Os pesos são
          revisáveis em Governança.
        </p>
      </div>
    </div>
  );
}

/** Single-line summary of the composition, for dense contexts. */
export function ScoreChips({ score }: { score: ScoreResult }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {score.factors.map((f) => (
        <span
          key={f.dimension}
          title={`${f.label}: ${f.rationale}`}
          className={[
            'inline-flex items-center gap-1.5 rounded-sm bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium',
            f.impact === 'negative' ? 'text-crit-ink' : 'text-ink-3',
          ].join(' ')}
        >
          {f.label.split(' ')[0]}
          <span className="font-mono">
            {f.earned}/{f.weight}
          </span>
        </span>
      ))}
    </div>
  );
}
