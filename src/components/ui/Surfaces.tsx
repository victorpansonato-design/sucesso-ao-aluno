import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Inbox } from 'lucide-react';
import { emphasis, press } from '../../lib/motion';

/* ==========================================================================
   Surfaces & layout primitives
   --------------------------------------------------------------------------
   A card is a hairline and a radius. Elevation is reserved for things that
   genuinely float. The `band` variant is the one place the institutional royal
   blue takes over a whole surface, and it is used sparingly and deliberately:
   the primary KPI row, a critical case header, a section hero. If it appeared
   everywhere it would stop meaning "pay attention here".
   ========================================================================== */

export function Card({
  children,
  className = '',
  padded = true,
  tone = 'plain',
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  tone?: 'plain' | 'inset' | 'band';
  as?: 'section' | 'div' | 'article' | 'aside';
}) {
  const toneClass =
    tone === 'band'
      ? 'band-surface band-grid relative border-band-line text-band-ink shadow-band'
      : tone === 'inset'
        ? 'border-hairline bg-surface-2'
        : 'border-hairline bg-surface';

  return (
    <Tag
      className={[
        'rounded-xl border',
        toneClass,
        padded ? 'p-5' : '',
        className,
      ].join(' ')}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  eyebrow,
  action,
  tone = 'plain',
  className = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  tone?: 'plain' | 'band';
  className?: string;
}) {
  const onBand = tone === 'band';
  return (
    <div className={`relative flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <div
            className={[
              'mb-1.5 font-mono text-[10px] font-bold tracking-[0.1em] uppercase',
              onBand ? 'text-band-ink-2' : 'text-ink-4',
            ].join(' ')}
          >
            {eyebrow}
          </div>
        )}
        <h2
          className={[
            'text-[14.5px] leading-tight font-bold',
            onBand ? 'text-band-ink' : 'text-ink',
          ].join(' ')}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className={[
              'mt-1 max-w-2xl text-[12px] leading-relaxed',
              onBand ? 'text-band-ink-2' : 'text-ink-3',
            ].join(' ')}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/* -- Page header ---------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  /** Filter bar or segmented controls belonging to this page. */
  children?: ReactNode;
}) {
  return (
    <header className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-2 flex items-center gap-2 font-mono text-[10.5px] font-bold tracking-[0.1em] text-ink-4 uppercase">
              {eyebrow}
            </div>
          )}
          <h1 className="text-[26px] leading-[1.1] font-bold text-ink sm:text-[30px]">{title}</h1>
          {description && (
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-3">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/* -- Section divider with a label ---------------------------------------- */

export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline pb-2">
      <h2 className="font-mono text-[10.5px] font-bold tracking-[0.1em] text-ink-3 uppercase">
        {children}
      </h2>
      {action}
    </div>
  );
}

/* -- Stat tile ------------------------------------------------------------ */

export function StatTile({
  label,
  value,
  detail,
  footer,
  icon,
  tone = 'plain',
  onClick,
  accent,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  footer?: ReactNode;
  icon?: ReactNode;
  tone?: 'plain' | 'band';
  onClick?: () => void;
  /** Status hue for the value, when the metric carries a verdict. */
  accent?: string;
}) {
  const onBand = tone === 'band';
  const interactive = Boolean(onClick);

  const body = (
    <>
      <div className="relative flex items-start justify-between gap-3">
        <span
          className={[
            'font-mono text-[10px] font-bold tracking-[0.1em] uppercase',
            onBand ? 'text-band-ink-2' : 'text-ink-4',
          ].join(' ')}
        >
          {label}
        </span>
        {icon && (
          <span className={onBand ? 'text-band-ink-2' : 'text-ink-4'}>{icon}</span>
        )}
      </div>

      <div className="relative mt-2.5 flex items-baseline gap-2">
        <span
          className="font-mono text-[27px] leading-none font-bold tracking-tight"
          style={accent ? { color: accent } : undefined}
        >
          <span className={accent ? '' : onBand ? 'text-band-ink' : 'text-ink'}>{value}</span>
        </span>
        {detail && (
          <span
            className={[
              'text-[12px] font-semibold',
              onBand ? 'text-band-ink-2' : 'text-ink-3',
            ].join(' ')}
          >
            {detail}
          </span>
        )}
      </div>

      {footer && (
        <div
          className={[
            'relative mt-3 flex items-center justify-between gap-2 border-t pt-2.5 text-[11.5px]',
            onBand ? 'border-band-line text-band-ink-2' : 'border-hairline text-ink-3',
          ].join(' ')}
        >
          {footer}
        </div>
      )}
    </>
  );

  if (interactive) {
    return (
      <motion.button
        whileTap={press}
        onClick={onClick}
        className={[
          'flex flex-col rounded-xl border p-4 text-left transition-colors',
          onBand
            ? 'border-band-line bg-band-inset hover:bg-white/10'
            : 'border-hairline bg-surface hover:border-ink-4',
        ].join(' ')}
      >
        {body}
      </motion.button>
    );
  }

  return (
    <div
      className={[
        'flex flex-col rounded-xl border p-4',
        onBand ? 'border-band-line bg-band-inset' : 'border-hairline bg-surface',
      ].join(' ')}
    >
      {body}
    </div>
  );
}

/* -- Row: the clickable list item used across queues and directories ------ */

export function Row({
  children,
  onClick,
  active = false,
  className = '',
  tone = 'plain',
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  tone?: 'plain' | 'crit';
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={[
        'relative block w-full text-left transition-colors',
        onClick ? 'cursor-pointer' : '',
        active
          ? 'bg-brand-soft'
          : onClick
            ? 'hover:bg-surface-hover'
            : '',
        className,
      ].join(' ')}
    >
      {/* Left rail marks the active row and, in red, a breached one. */}
      {(active || tone === 'crit') && (
        <span
          className={[
            'absolute inset-y-0 left-0 w-[3px]',
            active ? 'bg-brand' : 'bg-crit',
          ].join(' ')}
        />
      )}
      {children}
    </Tag>
  );
}

/* -- Empty state ---------------------------------------------------------- */

export function EmptyState({
  title,
  message,
  icon,
  action,
  compact = false,
}: {
  title: string;
  message?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-6 py-10' : 'gap-3 px-6 py-16',
      ].join(' ')}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-ink-4">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <div>
        <p className="text-[13px] font-bold text-ink">{title}</p>
        {message && <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-ink-3">{message}</p>}
      </div>
      {action}
    </div>
  );
}

/* -- Skeleton ------------------------------------------------------------- */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded-md ${className}`} />;
}

/* -- Definition list ------------------------------------------------------ */

export function DataList({
  items,
  columns = 2,
  className = '',
}: {
  items: { label: string; value: ReactNode; tone?: 'plain' | 'crit' | 'ok' }[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const grid = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' }[
    columns
  ];
  return (
    <dl className={`grid gap-x-5 gap-y-3 ${grid} ${className}`}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="font-mono text-[9.5px] font-bold tracking-[0.08em] text-ink-4 uppercase">
            {item.label}
          </dt>
          <dd
            className={[
              'mt-1 text-[13px] font-semibold',
              item.tone === 'crit' ? 'text-crit-ink' : item.tone === 'ok' ? 'text-ok-ink' : 'text-ink',
            ].join(' ')}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* -- Callout -------------------------------------------------------------- */

export function Callout({
  children,
  tone = 'info',
  icon,
  title,
}: {
  children?: ReactNode;
  tone?: 'info' | 'warn' | 'crit' | 'ok';
  icon?: ReactNode;
  title?: ReactNode;
}) {
  const toneClass = {
    info: 'border-info-border bg-info-soft',
    warn: 'border-warn-border bg-warn-soft',
    crit: 'border-crit-border bg-crit-soft',
    ok: 'border-ok-border bg-ok-soft',
  }[tone];

  const textClass = {
    info: 'text-brand-text',
    warn: 'text-warn-ink',
    crit: 'text-crit-ink',
    ok: 'text-ok-ink',
  }[tone];

  return (
    <div className={`flex gap-2.5 rounded-lg border p-3.5 ${toneClass}`}>
      {icon && <span className={`mt-px shrink-0 ${textClass}`}>{icon}</span>}
      <div className="min-w-0 text-[12px] leading-relaxed">
        {title && <p className={`font-bold ${textClass}`}>{title}</p>}
        {children && <div className={`${title ? 'mt-1' : ''} text-ink-2`}>{children}</div>}
      </div>
    </div>
  );
}

/* -- Tab bar (underline style) ------------------------------------------- */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  layoutId,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  layoutId: string;
}) {
  return (
    <div role="tablist" className="scroll-slim -mb-px flex gap-1 overflow-x-auto border-b border-hairline">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={[
              'relative shrink-0 px-3.5 py-2.5 text-[12.5px] font-semibold transition-colors',
              active ? 'text-ink' : 'text-ink-3 hover:text-ink',
            ].join(' ')}
          >
            <span className="flex items-center gap-1.5">
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={[
                    'rounded px-1.5 py-px font-mono text-[10px] font-bold',
                    active ? 'bg-brand-soft text-brand-text' : 'bg-surface-3 text-ink-4',
                  ].join(' ')}
                >
                  {tab.count}
                </span>
              )}
            </span>
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ duration: 0.22, ease: emphasis }}
                className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-brand"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -- Disclosure ----------------------------------------------------------- */

export function ChevronAffordance({ className = '' }: { className?: string }) {
  return (
    <ChevronRight
      className={`h-4 w-4 shrink-0 text-ink-4 transition-transform group-hover:translate-x-0.5 ${className}`}
    />
  );
}
