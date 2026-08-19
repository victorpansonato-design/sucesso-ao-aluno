import {
  Activity,
  BadgeCheck,
  BookOpen,
  Flag,
  GraduationCap,
  HeartHandshake,
  MessageSquare,
  Radar as RadarIcon,
  Wallet,
} from 'lucide-react';
import type { TimelineEvent } from '../../types';
import { stamp } from '../../lib/format';
import { EmptyState } from '../ui/Surfaces';

/* ==========================================================================
   Unified timeline
   --------------------------------------------------------------------------
   One chronological thread across academic records, finance, AVA activity,
   support contacts, radar alerts and interventions. The whole point of a 360°
   view is that the attendant reads one story instead of five tabs, so the
   icon carries the source and the author label makes clear whether a human,
   a radar or the student produced the entry.
   ========================================================================== */

const KIND_META: Record<
  TimelineEvent['kind'],
  { Icon: typeof Activity; tone: string; ring: string }
> = {
  matricula: { Icon: GraduationCap, tone: 'text-brand-text', ring: 'border-brand-border bg-brand-soft' },
  academico: { Icon: BookOpen, tone: 'text-ink-2', ring: 'border-hairline bg-surface-2' },
  financeiro: { Icon: Wallet, tone: 'text-ink-2', ring: 'border-hairline bg-surface-2' },
  engajamento: { Icon: Activity, tone: 'text-ink-2', ring: 'border-hairline bg-surface-2' },
  atendimento: { Icon: MessageSquare, tone: 'text-ink-2', ring: 'border-hairline bg-surface-2' },
  alerta: { Icon: RadarIcon, tone: 'text-crit-ink', ring: 'border-crit-border bg-crit-soft' },
  intervencao: { Icon: HeartHandshake, tone: 'text-brand-text', ring: 'border-brand-border bg-brand-soft' },
  marco: { Icon: Flag, tone: 'text-ok-ink', ring: 'border-ok-border bg-ok-soft' },
};

export function Timeline({ events, limit }: { events: TimelineEvent[]; limit?: number }) {
  if (events.length === 0) {
    return (
      <EmptyState
        compact
        icon={<Flag className="h-5 w-5" />}
        title="Nenhum evento registrado"
        message="A linha do tempo é alimentada por matrícula, notas, financeiro, uso do AVA, atendimentos e intervenções."
      />
    );
  }

  const shown = limit ? events.slice(0, limit) : events;

  return (
    <ol className="relative space-y-0">
      {/* The rail stops at the last node instead of running past it. */}
      <span
        className="absolute top-4 left-[13px] w-px bg-hairline"
        style={{ height: `calc(100% - ${shown.length > 1 ? '2rem' : '100%'})` }}
        aria-hidden="true"
      />

      {shown.map((event) => {
        const meta = KIND_META[event.kind];
        return (
          <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
            <span
              className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${meta.ring}`}
            >
              <meta.Icon className={`h-3.5 w-3.5 ${meta.tone}`} />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-[12.5px] leading-snug font-bold text-ink">{event.title}</p>
                <span className="shrink-0 font-mono text-[10.5px] text-ink-4">{stamp(event.at)}</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-3">{event.detail}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold tracking-[0.06em] text-ink-4 uppercase">
                  <BadgeCheck className="h-3 w-3" />
                  {event.author}
                </span>
                {event.tag && (
                  <span className="rounded border border-hairline bg-surface-2 px-1.5 py-px font-mono text-[9.5px] font-bold tracking-[0.06em] text-ink-4 uppercase">
                    {event.tag}
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
