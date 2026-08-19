import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type {
  CaseStatus,
  Cohort,
  HealthStatus,
  Modality,
  Priority,
  RadarKey,
  Trend,
} from '../../types';
import { STATUS_META } from '../../lib/caseFlow';
import { RADARS } from '../../lib/radars';
import { signed } from '../../lib/format';

/* ==========================================================================
   Status vocabulary
   --------------------------------------------------------------------------
   Colour is load-bearing here, so it is spent carefully: a dot carries the
   status hue, the label stays in ink. That keeps a dense table readable — ten
   rows of saturated pills would be unreadable, ten rows of dotted labels scan
   instantly and still let a critical row jump out.
   ========================================================================== */

type Tone = 'ok' | 'warn' | 'risk' | 'crit' | 'info' | 'neutral' | 'muted';

const DOT: Record<Tone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  risk: 'bg-risk',
  crit: 'bg-crit',
  info: 'bg-brand-2',
  neutral: 'bg-ink-4',
  muted: 'bg-ink-4',
};

const SOLID: Record<Tone, string> = {
  ok: 'border-ok-border bg-ok-soft text-ok-ink',
  warn: 'border-warn-border bg-warn-soft text-warn-ink',
  risk: 'border-risk-border bg-risk-soft text-risk-ink',
  crit: 'border-crit-border bg-crit-soft text-crit-ink',
  info: 'border-info-border bg-info-soft text-brand-text',
  neutral: 'border-hairline bg-surface-2 text-ink-2',
  muted: 'border-hairline bg-surface-2 text-ink-3',
};

export function Pill({
  tone = 'neutral',
  children,
  dot = true,
  solid = false,
  mono = false,
  className = '',
  title,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  solid?: boolean;
  mono?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={[
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-[3px] text-[11px] font-semibold whitespace-nowrap',
        solid ? SOLID[tone] : 'border-hairline bg-surface text-ink-2',
        mono ? 'font-mono' : '',
        className,
      ].join(' ')}
    >
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[tone]}`} />}
      {children}
    </span>
  );
}

/* -- Health status -------------------------------------------------------- */

export const HEALTH_TONE: Record<HealthStatus, Tone> = {
  Estável: 'ok',
  Atenção: 'warn',
  Risco: 'risk',
  Crítico: 'crit',
};

export function HealthBadge({
  status,
  solid = false,
  className = '',
}: {
  status: HealthStatus;
  solid?: boolean;
  className?: string;
}) {
  return (
    <Pill tone={HEALTH_TONE[status]} solid={solid} className={className}>
      {status}
    </Pill>
  );
}

/* -- Priority ------------------------------------------------------------- */

export const PRIORITY_TONE: Record<Priority, Tone> = {
  Crítico: 'crit',
  Alto: 'risk',
  Médio: 'warn',
  Baixo: 'neutral',
};

export function PriorityBadge({ priority, solid = false }: { priority: Priority; solid?: boolean }) {
  return (
    <Pill tone={PRIORITY_TONE[priority]} solid={solid}>
      {priority}
    </Pill>
  );
}

/* -- Case status ---------------------------------------------------------- */

const STATUS_TONE_MAP: Record<string, Tone> = {
  neutral: 'neutral',
  info: 'info',
  warn: 'warn',
  ok: 'ok',
  crit: 'crit',
  muted: 'muted',
};

export function CaseStatusBadge({ status, solid = false }: { status: CaseStatus; solid?: boolean }) {
  const meta = STATUS_META[status];
  return (
    <Pill tone={STATUS_TONE_MAP[meta.tone] ?? 'neutral'} solid={solid} title={meta.hint}>
      {status}
    </Pill>
  );
}

/* -- Radar ---------------------------------------------------------------- */

export function RadarBadge({ radar, full = false }: { radar: RadarKey; full?: boolean }) {
  const def = RADARS[radar];
  return (
    <span
      title={def.label}
      className="inline-flex shrink-0 items-center gap-1.5 rounded border border-hairline bg-surface-2 px-1.5 py-[2px] font-mono text-[10px] font-bold tracking-[0.06em] whitespace-nowrap text-ink-3 uppercase"
    >
      {full ? def.label : def.shortLabel}
    </span>
  );
}

/* -- Cohort — the 90-day rule made visible -------------------------------- */

export function CohortBadge({ cohort, days }: { cohort: Cohort; days?: number }) {
  if (cohort === 'Calouro') {
    return (
      <Pill
        tone="info"
        solid
        dot={false}
        title={`Calouro em onboarding${days !== undefined ? ` — ${days} dias de matrícula` : ''}. Fora da fila de evasão.`}
      >
        Calouro {days !== undefined ? `· ${days}d` : ''}
      </Pill>
    );
  }
  return (
    <Pill tone="neutral" dot={false} title="Veterano — monitoramento contínuo">
      Veterano
    </Pill>
  );
}

/* -- Modality ------------------------------------------------------------- */

export function ModalityBadge({ modality }: { modality: Modality }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded border border-hairline bg-surface-2 px-1.5 py-[2px] font-mono text-[10px] font-bold tracking-[0.06em] text-ink-3 uppercase">
      {modality === 'EaD' ? 'EaD 100%' : modality}
    </span>
  );
}

/* -- Trend ---------------------------------------------------------------- */

export function TrendIndicator({
  trend,
  delta,
  className = '',
}: {
  trend: Trend;
  delta?: number;
  className?: string;
}) {
  const config = {
    up: { Icon: ArrowUpRight, color: 'text-ok' },
    down: { Icon: ArrowDownRight, color: 'text-crit' },
    flat: { Icon: Minus, color: 'text-ink-4' },
  }[trend];

  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-[11.5px] font-bold ${config.color} ${className}`}
    >
      <config.Icon className="h-3 w-3" />
      {delta !== undefined && delta !== 0 ? signed(delta) : null}
    </span>
  );
}

/* -- Avatar: initials, not stock photography ------------------------------
   Real internal tools show initials. Stock portraits of strangers standing in
   for actual students read as a mockup and, with real data, as a privacy leak. */

const AVATAR_SIZE = {
  xs: 'h-6 w-6 text-[9.5px]',
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-[12.5px]',
  lg: 'h-14 w-14 text-[16px]',
} as const;

export function Avatar({
  initials,
  size = 'sm',
  tone = 'neutral',
  className = '',
}: {
  initials: string;
  size?: keyof typeof AVATAR_SIZE;
  tone?: 'neutral' | 'brand' | HealthStatus;
  className?: string;
}) {
  const toneClass =
    tone === 'brand'
      ? 'border-brand-border bg-brand-soft text-brand-text'
      : tone === 'Crítico'
        ? 'border-crit-border bg-crit-soft text-crit-ink'
        : tone === 'Risco'
          ? 'border-risk-border bg-risk-soft text-risk-ink'
          : tone === 'Atenção'
            ? 'border-warn-border bg-warn-soft text-warn-ink'
            : tone === 'Estável'
              ? 'border-ok-border bg-ok-soft text-ok-ink'
              : 'border-hairline bg-surface-3 text-ink-2';

  return (
    <span
      aria-hidden="true"
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-full border font-mono font-bold select-none',
        AVATAR_SIZE[size],
        toneClass,
        className,
      ].join(' ')}
    >
      {initials}
    </span>
  );
}
