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
   There are two kinds of small label in this app and they must not look alike:

     STATUS  — a verdict you may have to act on. Rendered as a coloured dot
               plus a word. No fill, no outline. Ten rows of tinted balloons
               with borders is a bag of sweets; ten rows of dotted words scan
               in one pass and still let a critical row jump out.

     TAG     — a fact about the record (modality, campus, radar). Rendered as a
               quiet filled chip in ink-3. It carries no urgency, so it gets no
               colour and no dot.

   `solid` used to mean "tinted background + border". It now means "this
   verdict is the point of the row", and spends ink weight instead of fill.
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

/** Ink for an emphasised verdict. Only `crit` gets red. */
const EMPHASIS_INK: Record<Tone, string> = {
  ok: 'text-ink-2',
  warn: 'text-warn-ink',
  risk: 'text-risk-ink',
  crit: 'text-crit-ink',
  info: 'text-brand-text',
  neutral: 'text-ink-2',
  muted: 'text-ink-3',
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
  /** A dot makes this a status. Without it, it is a tag. */
  dot?: boolean;
  /** Emphasise the verdict: status ink instead of neutral ink. */
  solid?: boolean;
  mono?: boolean;
  className?: string;
  title?: string;
}) {
  // Status: bare dot + word, sitting directly on the surface.
  if (dot) {
    return (
      <span
        title={title}
        className={[
          'inline-flex shrink-0 items-center gap-1.5 text-[12px] whitespace-nowrap',
          solid ? `font-semibold ${EMPHASIS_INK[tone]}` : 'font-medium text-ink-2',
          mono ? 'font-mono' : '',
          className,
        ].join(' ')}
      >
        <span className={`h-1.25 w-1.25 shrink-0 rounded-full ${DOT[tone]}`} />
        {children}
      </span>
    );
  }

  // Tag: a quiet chip. Filled, never outlined.
  return (
    <span
      title={title}
      className={[
        'inline-flex shrink-0 items-center rounded-sm bg-surface-2 px-1.5 py-0.5 text-[11px] whitespace-nowrap',
        solid ? `font-semibold ${EMPHASIS_INK[tone]}` : 'font-medium text-ink-3',
        mono ? 'font-mono' : '',
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}

/* -- Health status --------------------------------------------------------
   "Estável" gets no dot at all. There is nothing to do about a healthy
   student, so the row stays silent — which is exactly what makes the amber and
   red dots visible three rows further down. */

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
  if (status === 'Estável') {
    return (
      <span
        className={`inline-flex shrink-0 items-center text-[12px] font-medium whitespace-nowrap text-ink-3 ${className}`}
      >
        Estável
      </span>
    );
  }
  return (
    <Pill tone={HEALTH_TONE[status]} solid={solid || status === 'Crítico'} className={className}>
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
    <Pill tone={PRIORITY_TONE[priority]} solid={solid || priority === 'Crítico'}>
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
      className="inline-flex shrink-0 items-center rounded-sm bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-ink-3"
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
    <span className="inline-flex shrink-0 items-center rounded-sm bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-3">
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
    up: { Icon: ArrowUpRight, color: 'text-ink-2' },
    down: { Icon: ArrowDownRight, color: 'text-crit-ink' },
    flat: { Icon: Minus, color: 'text-ink-4' },
  }[trend];

  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-[11.5px] font-medium ${config.color} ${className}`}
    >
      <config.Icon className="h-3 w-3" />
      {delta !== undefined && delta !== 0 ? signed(delta) : null}
    </span>
  );
}

/* -- Avatar: initials, not stock photography ------------------------------
   Real internal tools show initials. Stock portraits of strangers standing in
   for actual students read as a mockup and, with real data, as a privacy leak.

   The tone is a step of fill, not a hue: a critical student's avatar is a
   shade darker, not red. The red dot beside the name already says it once. */

const AVATAR_SIZE = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-9 w-9 text-[12px]',
  lg: 'h-12 w-12 text-[15px]',
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
      ? 'bg-brand text-on-brand'
      : tone === 'Crítico'
        ? 'bg-surface-3 text-ink'
        : 'bg-surface-2 text-ink-2';

  return (
    <span
      aria-hidden="true"
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-full font-medium select-none',
        AVATAR_SIZE[size],
        toneClass,
        className,
      ].join(' ')}
    >
      {initials}
    </span>
  );
}
