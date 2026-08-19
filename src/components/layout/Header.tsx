import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  Building2,
  CheckCheck,
  FilterX,
  HeartHandshake,
  Laptop,
  Layers,
  Plus,
  School,
  Search,
  ShieldAlert,
  Sparkles,
  Timer,
  UserCheck,
  Users,
} from 'lucide-react';
import type { AppNotification, Cohort, Modality } from '../../types';
import { useApp } from '../../state/AppContext';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Fields';
import { popoverVariants } from '../../lib/motion';
import { relative } from '../../lib/format';
import { CAMPUSES } from '../../data/catalog';

/* ==========================================================================
   Header
   --------------------------------------------------------------------------
   Carries the two segmentations that define this operation — modality and
   cohort — because almost every question an attendant asks is scoped by them.
   Both are global: switching modality re-scopes the cockpit, the queue, the
   base, the radars and the indicators at once, which is the only way the
   numbers on different screens can be trusted to agree.
   ========================================================================== */

const NOTIF_META: Record<AppNotification['kind'], { Icon: typeof Bell; tone: string }> = {
  critico: { Icon: ShieldAlert, tone: 'text-crit' },
  sla: { Icon: Timer, tone: 'text-warn' },
  atribuicao: { Icon: UserCheck, tone: 'text-brand-2' },
  resposta: { Icon: HeartHandshake, tone: 'text-brand-2' },
  followup: { Icon: Timer, tone: 'text-warn' },
  sucesso: { Icon: CheckCheck, tone: 'text-ok' },
};

export function Header({
  onOpenPalette,
  onOpenCase,
  onOpenStudent,
  onCreateCase,
}: {
  onOpenPalette: () => void;
  onOpenCase: (caseId: string) => void;
  onOpenStudent: (studentId: string) => void;
  onCreateCase: () => void;
}) {
  const {
    modalityFilter,
    setModalityFilter,
    cohortFilter,
    setCohortFilter,
    campusFilter,
    setCampusFilter,
    semester,
    setSemester,
    filtersActive,
    resetFilters,
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useApp();

  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bellOpen) return;
    const onDown = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBellOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [bellOpen]);

  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-surface/85 backdrop-blur-xl print:hidden">
      <div className="flex h-[74px] items-center gap-3 px-4 sm:px-6">
        {/* Search trigger — the command palette */}
        <button
          onClick={onOpenPalette}
          className="group flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-hairline bg-surface-2 px-3 text-left transition-colors hover:border-ink-4 sm:max-w-md"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-4 transition-colors group-hover:text-brand-2" />
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-4">
            Buscar aluno, RA, curso, caso…
          </span>
          <kbd className="hidden shrink-0 rounded border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink-4 sm:block">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-2">
          {/* Modality — drives the Health Score weight profile */}
          <div className="hidden xl:block">
            <Segmented<'Todas' | Modality>
              layoutId="header-modality"
              value={modalityFilter}
              onChange={setModalityFilter}
              options={[
                { value: 'Todas', label: 'Todas' },
                { value: 'Presencial', label: 'Presencial', icon: <School className="h-3 w-3" /> },
                { value: 'Híbrido', label: 'Híbrido', icon: <Layers className="h-3 w-3" /> },
                { value: 'EaD', label: 'EaD', icon: <Laptop className="h-3 w-3" /> },
              ]}
            />
          </div>

          {/* Cohort — the 90-day rule, made operational */}
          <div className="hidden lg:block">
            <Segmented<'Todos' | Cohort>
              layoutId="header-cohort"
              value={cohortFilter}
              onChange={setCohortFilter}
              options={[
                { value: 'Todos', label: 'Todos' },
                { value: 'Veterano', label: 'Veteranos', icon: <Users className="h-3 w-3" /> },
                { value: 'Calouro', label: 'Calouros', icon: <Sparkles className="h-3 w-3" /> },
              ]}
            />
          </div>

          {/* Campus + cycle */}
          <div className="hidden 2xl:flex items-center gap-2">
            <label className="flex h-8 items-center gap-1.5 rounded-lg border border-hairline bg-surface-2 px-2.5">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-ink-4" />
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
                aria-label="Campus"
                className="max-w-[130px] cursor-pointer truncate bg-transparent text-[11.5px] font-semibold text-ink focus:outline-none"
              >
                <option value="Todos">Todos os campi</option>
                {CAMPUSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex h-8 items-center gap-1.5 rounded-lg border border-hairline bg-surface-2 px-2.5">
              <span className="font-mono text-[9.5px] font-bold tracking-[0.08em] text-ink-4 uppercase">
                Ciclo
              </span>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                aria-label="Ciclo letivo"
                className="cursor-pointer bg-transparent font-mono text-[11.5px] font-bold text-ink focus:outline-none"
              >
                <option value="2026/2">2026/2</option>
                <option value="2026/1">2026/1</option>
                <option value="2025/2">2025/2</option>
              </select>
            </label>
          </div>

          {filtersActive && (
            <Button
              size="sm"
              variant="ghost"
              square
              onClick={resetFilters}
              title="Limpar filtros globais"
            >
              <FilterX className="h-3.5 w-3.5" />
            </Button>
          )}

          <span className="mx-0.5 hidden h-6 w-px bg-hairline lg:block" />

          {/* Notifications */}
          <div className="relative" ref={bellRef}>
            <Button
              size="sm"
              variant="secondary"
              square
              onClick={() => setBellOpen((v) => !v)}
              title="Notificações"
              className="relative"
            >
              <Bell className="h-3.5 w-3.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-crit px-1 font-mono text-[9.5px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Button>

            <AnimatePresence>
              {bellOpen && (
                <motion.div
                  variants={popoverVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="absolute right-0 z-50 mt-2 w-[368px] origin-top-right overflow-hidden rounded-xl border border-hairline bg-surface shadow-overlay"
                >
                  <div className="flex items-center justify-between border-b border-hairline bg-surface-2 px-4 py-2.5">
                    <p className="text-[12.5px] font-bold text-ink">
                      Notificações
                      {unreadCount > 0 && (
                        <span className="ml-1.5 font-mono text-[11px] font-bold text-crit">
                          {unreadCount} novas
                        </span>
                      )}
                    </p>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllNotificationsRead}
                        className="text-[11.5px] font-semibold text-brand-text hover:text-brand-2"
                      >
                        Marcar todas como lidas
                      </button>
                    )}
                  </div>

                  <div className="scroll-slim max-h-[400px] divide-y divide-hairline overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-6 text-center text-[12px] text-ink-4">
                        Nenhuma notificação no ciclo.
                      </p>
                    ) : (
                      notifications.map((n) => {
                        const meta = NOTIF_META[n.kind];
                        return (
                          <button
                            key={n.id}
                            onClick={() => {
                              markNotificationRead(n.id);
                              setBellOpen(false);
                              if (n.caseId) onOpenCase(n.caseId);
                              else if (n.studentId) onOpenStudent(n.studentId);
                            }}
                            className={[
                              'flex w-full gap-2.5 p-3.5 text-left transition-colors hover:bg-surface-hover',
                              n.read ? '' : 'bg-brand-soft/40',
                            ].join(' ')}
                          >
                            <meta.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.tone}`} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline justify-between gap-2">
                                <span
                                  className={`truncate text-[12px] ${n.read ? 'font-semibold text-ink-2' : 'font-bold text-ink'}`}
                                >
                                  {n.title}
                                </span>
                                <span className="shrink-0 font-mono text-[10px] text-ink-4">
                                  {relative(n.at)}
                                </span>
                              </span>
                              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-3">
                                {n.detail}
                              </span>
                            </span>
                            {!n.read && (
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-2" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={onCreateCase}
            icon={<Plus className="h-3.5 w-3.5" />}
          >
            <span className="hidden sm:inline">Abrir caso</span>
          </Button>
        </div>
      </div>

      {/* Scope strip — states the active scope in words, so no chart is read
          out of context after a filter change. */}
      {filtersActive && (
        <div className="flex items-center gap-2 border-t border-hairline bg-brand-soft px-4 py-1.5 sm:px-6">
          <span className="font-mono text-[10px] font-bold tracking-[0.08em] text-brand-text uppercase">
            Escopo ativo
          </span>
          <span className="truncate text-[11.5px] font-semibold text-ink-2">
            {[
              modalityFilter !== 'Todas' ? modalityFilter : null,
              cohortFilter !== 'Todos' ? `${cohortFilter}s` : null,
              campusFilter !== 'Todos' ? campusFilter : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <button
            onClick={resetFilters}
            className="ml-auto shrink-0 text-[11.5px] font-semibold text-brand-text hover:text-brand-2"
          >
            Limpar
          </button>
        </div>
      )}
    </header>
  );
}
