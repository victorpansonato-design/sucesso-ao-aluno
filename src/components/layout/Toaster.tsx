import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { ToastKind } from '../../types';
import { useApp } from '../../state/AppContext';
import { toastVariants } from '../../lib/motion';

/* Toasts confirm that a mutation landed and, where useful, offer the one
   follow-on action the attendant is most likely to want next. They never carry
   information that exists nowhere else. */

const META: Record<ToastKind, { Icon: typeof Info; tone: string; bar: string }> = {
  success: { Icon: CheckCircle2, tone: 'text-ok', bar: 'bg-ok' },
  info: { Icon: Info, tone: 'text-brand-2', bar: 'bg-brand-2' },
  warning: { Icon: AlertTriangle, tone: 'text-warn', bar: 'bg-warn' },
  error: { Icon: XCircle, tone: 'text-crit', bar: 'bg-crit' },
};

export function Toaster() {
  const { toasts, dismissToast } = useApp();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(384px,calc(100vw-2rem))] flex-col gap-2 sm:right-6 sm:bottom-6 print:hidden"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const meta = META[toast.kind];
          return (
            <motion.div
              key={toast.id}
              layout
              variants={toastVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="pointer-events-auto relative flex gap-3 overflow-hidden rounded-xl border border-hairline bg-surface p-3.5 pl-4 shadow-overlay"
            >
              <span className={`absolute inset-y-0 left-0 w-[3px] ${meta.bar}`} />
              <meta.Icon className={`mt-px h-4 w-4 shrink-0 ${meta.tone}`} />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] leading-snug font-bold text-ink">{toast.title}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-3">{toast.detail}</p>
                {toast.action && (
                  <button
                    onClick={() => {
                      toast.action?.run();
                      dismissToast(toast.id);
                    }}
                    className="mt-2 text-[11.5px] font-bold text-brand-text hover:text-brand-2"
                  >
                    {toast.action.label} →
                  </button>
                )}
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                aria-label="Fechar"
                className="-mt-0.5 -mr-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-4 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
