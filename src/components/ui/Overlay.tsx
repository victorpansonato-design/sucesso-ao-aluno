import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { drawerVariants, modalVariants, scrimVariants } from '../../lib/motion';

/* ==========================================================================
   Modal & Drawer
   --------------------------------------------------------------------------
   One overlay implementation, so every dialog in the app behaves identically:

     · The app behind is blurred and desaturated, not just dimmed — the sheet
       reads as floating glass over the workspace rather than a box on a grey
       rectangle.
     · Escape closes. Clicking the scrim closes. The close button closes.
     · Focus moves into the sheet on open, is trapped inside while open, and
       returns to the trigger on close.
     · Body scroll is locked with the scrollbar width compensated, so the page
       underneath does not shift sideways when the dialog appears.
     · Exit animations actually run, because the AnimatePresence boundary lives
       here rather than around an early `return null`.
   ========================================================================== */

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

function useOverlayBehaviour(open: boolean, onClose: () => void) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;

    // Lock scroll and compensate for the disappearing scrollbar.
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    const focusFirst = window.setTimeout(() => {
      const node = sheetRef.current;
      if (!node) return;
      const target =
        node.querySelector<HTMLElement>('[data-autofocus]') ??
        node.querySelector<HTMLElement>(FOCUSABLE) ??
        node;
      target.focus({ preventScroll: true });
    }, 60);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const node = sheetRef.current;
      if (!node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      window.clearTimeout(focusFirst);
      document.removeEventListener('keydown', onKeyDown, true);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
      restoreTo.current?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  return sheetRef;
}

/* -- Modal ---------------------------------------------------------------- */

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const MODAL_WIDTH: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  icon?: ReactNode;
  size?: ModalSize;
  /** Sticky footer — action row. */
  footer?: ReactNode;
  children: ReactNode;
  /** Renders the header on the royal-blue band for high-stakes dialogs. */
  tone?: 'plain' | 'band';
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  eyebrow,
  icon,
  size = 'md',
  footer,
  children,
  tone = 'plain',
}: ModalProps) {
  const sheetRef = useOverlayBehaviour(open, onClose);
  const titleId = useId();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="scrim fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-[6vh] sm:p-6 sm:py-[8vh]"
          variants={scrimVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={[
              'relative flex w-full flex-col overflow-hidden outline-none',
              'rounded-2xl border border-hairline bg-surface shadow-overlay',
              'max-h-[86vh]',
              MODAL_WIDTH[size],
            ].join(' ')}
          >
            <header
              className={[
                'flex shrink-0 items-start justify-between gap-4 px-5 py-4',
                tone === 'band'
                  ? 'band-surface band-grid relative border-b border-band-line'
                  : 'border-b border-hairline bg-surface-2/60',
              ].join(' ')}
            >
              <div className="relative flex min-w-0 items-start gap-3">
                {icon && (
                  <div
                    className={[
                      'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      tone === 'band'
                        ? 'border border-band-line bg-band-inset text-band-ink'
                        : 'border border-brand-border bg-brand-soft text-brand-text',
                    ].join(' ')}
                  >
                    {icon}
                  </div>
                )}
                <div className="min-w-0">
                  {eyebrow && (
                    <div
                      className={[
                        'mb-1 font-mono text-[10px] font-bold tracking-[0.1em] uppercase',
                        tone === 'band' ? 'text-band-ink-2' : 'text-ink-4',
                      ].join(' ')}
                    >
                      {eyebrow}
                    </div>
                  )}
                  <h2
                    id={titleId}
                    className={[
                      'text-[15px] leading-tight font-bold',
                      tone === 'band' ? 'text-band-ink' : 'text-ink',
                    ].join(' ')}
                  >
                    {title}
                  </h2>
                  {subtitle && (
                    <p
                      className={[
                        'mt-1 text-[12px] leading-relaxed',
                        tone === 'band' ? 'text-band-ink-2' : 'text-ink-3',
                      ].join(' ')}
                    >
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className={[
                  'relative -mt-0.5 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
                  tone === 'band'
                    ? 'text-band-ink-2 hover:bg-white/15 hover:text-band-ink'
                    : 'text-ink-4 hover:bg-surface-3 hover:text-ink',
                ].join(' ')}
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">{children}</div>

            {footer && (
              <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-hairline bg-surface-2/60 px-5 py-3.5">
                {footer}
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* -- Drawer --------------------------------------------------------------- */

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Rendered inside the sheet; drawers own their own header layout. */
  children: ReactNode;
  width?: 'md' | 'lg' | 'xl';
  label: string;
}

const DRAWER_WIDTH = {
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-3xl',
} as const;

export function Drawer({ open, onClose, children, width = 'lg', label }: DrawerProps) {
  const sheetRef = useOverlayBehaviour(open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="scrim fixed inset-0 z-50 flex justify-end"
          variants={scrimVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.aside
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            variants={drawerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={[
              'relative flex h-full w-full flex-col overflow-hidden outline-none',
              'border-l border-hairline bg-surface shadow-overlay',
              DRAWER_WIDTH[width],
            ].join(' ')}
          >
            {children}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* -- Confirm dialog ------------------------------------------------------- */

export interface ConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}
