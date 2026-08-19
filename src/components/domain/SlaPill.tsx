import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { Case } from '../../types';
import { slaStatus, useClock } from '../../lib/sla';
import { useApp } from '../../state/AppContext';

/* ==========================================================================
   SLA readout
   --------------------------------------------------------------------------
   The single most-read element in the queue, so it earns three things:
   a live countdown (one shared 30-second tick for the whole app), a state
   that changes colour only when it needs the attendant's attention, and a
   consumption bar that shows *how much budget is left* rather than just a
   number — a case at 3h of a 4h SLA and one at 3h of a 24h SLA are not the
   same emergency.
   ========================================================================== */

export function SlaPill({
  kase,
  showBar = false,
  size = 'sm',
}: {
  kase: Case;
  showBar?: boolean;
  size?: 'xs' | 'sm';
}) {
  const now = useClock();
  const { settings } = useApp();
  const sla = slaStatus(kase, now, settings.businessHours);

  const tone = {
    ok: { text: 'text-ink-2', bar: 'var(--ink-4)', Icon: Clock },
    warning: { text: 'text-warn-ink', bar: 'var(--warn)', Icon: AlertTriangle },
    breach: { text: 'text-crit-ink', bar: 'var(--crit)', Icon: AlertTriangle },
    closed: { text: 'text-ink-4', bar: 'var(--ink-4)', Icon: CheckCircle2 },
  }[sla.state];

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span
        title={`SLA de ${kase.slaHours} h úteis · ${sla.label}`}
        className={[
          'inline-flex items-center gap-1.5 font-mono font-medium whitespace-nowrap',
          size === 'xs' ? 'text-[11px]' : 'text-[12.5px]',
          tone.text,
        ].join(' ')}
      >
        <tone.Icon className={size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        {sla.state === 'closed' ? 'Encerrado' : sla.compact}
      </span>
      {showBar && sla.state !== 'closed' && (
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-track">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${Math.max(3, sla.consumed * 100)}%`, backgroundColor: tone.bar }}
          />
        </div>
      )}
    </div>
  );
}

/** Verbose variant for a case header, where there is room to spell it out.
    A countdown, not a badge: ink and weight carry the state. Only a breach
    earns a fill, because only a breach is an emergency. */
export function SlaBanner({ kase }: { kase: Case }) {
  const now = useClock();
  const { settings } = useApp();
  const sla = slaStatus(kase, now, settings.businessHours);

  if (sla.state === 'closed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Caso encerrado
      </span>
    );
  }

  const style =
    sla.state === 'breach'
      ? 'rounded-full bg-crit px-2.5 py-1 text-white'
      : sla.state === 'warning'
        ? 'text-warn-ink'
        : 'text-ink-2';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-[12.5px] font-medium whitespace-nowrap ${style}`}
    >
      {sla.state === 'breach' ? (
        <AlertTriangle className="h-3.5 w-3.5" />
      ) : (
        <Clock className="h-3.5 w-3.5" />
      )}
      SLA {kase.slaHours}h · {sla.label}
    </span>
  );
}
