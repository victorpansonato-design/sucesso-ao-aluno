import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion } from 'motion/react';
import { press } from '../../lib/motion';

/* ==========================================================================
   Button
   --------------------------------------------------------------------------
   Five variants, and each one carries a meaning rather than a look:

     primary   — the single most important action on the surface. One per view.
     secondary — a real alternative to primary. Bordered, not filled.
     ghost     — tertiary; lives inside dense rows and toolbars.
     danger    — destructive or irreversible (registering an evasion, resetting).
     onBand    — the same grammar, but legible on the royal-blue contrast band.

   Press feedback is uniform across the app: a 2.5% scale-down. Nothing else.
   ========================================================================== */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'onBand' | 'onBandGhost';
type Size = 'xs' | 'sm' | 'md';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-hover shadow-raised',
  secondary:
    'bg-surface text-ink border border-hairline-strong hover:bg-surface-2 hover:border-ink-4',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-crit text-white hover:brightness-110 shadow-raised',
  onBand: 'bg-white text-brand hover:bg-white/90 shadow-raised',
  onBandGhost:
    'text-band-ink border border-band-line bg-band-inset hover:bg-white/15 backdrop-blur-sm',
};

const SIZE: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-[11.5px] gap-1.5 rounded-md',
  sm: 'h-8 px-3 text-[12.5px] gap-1.5 rounded-md',
  md: 'h-9.5 px-4 text-[13px] gap-2 rounded-lg',
};

/**
 * React's native drag/animation handlers collide with Framer Motion's
 * same-named props, so they are omitted rather than cast away — nothing in the
 * app drags a button, and silencing the clash with `any` would hide real errors.
 */
type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'
>;

export interface ButtonProps extends NativeButtonProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  /** Renders as a square icon-only control. */
  square?: boolean;
  full?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'sm',
    icon,
    iconRight,
    square = false,
    full = false,
    className = '',
    children,
    disabled,
    ...rest
  },
  ref,
) {
  const squarePad = square ? (size === 'xs' ? 'w-7 px-0' : size === 'sm' ? 'w-8 px-0' : 'w-9.5 px-0') : '';

  return (
    <motion.button
      ref={ref}
      whileTap={disabled ? undefined : press}
      disabled={disabled}
      className={[
        'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap',
        'transition-colors duration-150 select-none',
        'disabled:pointer-events-none disabled:opacity-45',
        SIZE[size],
        VARIANT[variant],
        squarePad,
        full ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </motion.button>
  );
});

/** Text link styled as an inline action — used at the end of card footers. */
export function LinkButton({
  children,
  icon,
  iconRight,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode; iconRight?: ReactNode }) {
  return (
    <button
      className={[
        'inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-text',
        'transition-colors hover:text-brand-2 disabled:opacity-45',
        className,
      ].join(' ')}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
}
