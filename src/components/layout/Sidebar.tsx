import { useState } from 'react';
import { motion } from 'motion/react';
import {
  BarChart3,
  BookMarked,
  ChevronsLeft,
  ChevronsRight,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Moon,
  Radar as RadarIcon,
  Route,
  SlidersHorizontal,
  Sun,
  Sprout,
  Users2,
} from 'lucide-react';
import type { RouteName } from '../../lib/router';
import { useApp, useQueueStats } from '../../state/AppContext';
import { BrandLockup } from '../brand/AnchietaLogo';
import { Avatar } from '../ui/Badges';
import { press, spring } from '../../lib/motion';

/* ==========================================================================
   Sidebar
   --------------------------------------------------------------------------
   Ten destinations, each one a place an attendant or a coordinator actually
   goes. No calendar, no documents, no generic "tasks" — a menu entry that
   leads nowhere useful costs more than the space it saves.

   The badge on "Fila de Atendimento" is the only number in the navigation,
   because it is the only one that changes what you do next.
   ========================================================================== */

interface NavItem {
  route: RouteName;
  label: string;
  Icon: typeof LayoutDashboard;
  badge?: number;
  urgent?: boolean;
}

export function Sidebar({
  route,
  onNavigate,
}: {
  route: RouteName;
  onNavigate: (name: RouteName) => void;
}) {
  const { currentUser, theme, toggleTheme, scopedStudents } = useApp();
  const stats = useQueueStats();
  const [collapsed, setCollapsed] = useState(false);

  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: 'Operação',
      items: [
        { route: 'cockpit', label: 'Cockpit', Icon: LayoutDashboard },
        {
          route: 'fila',
          label: 'Fila de Atendimento',
          Icon: ListChecks,
          badge: stats.openCount,
          urgent: stats.critical > 0,
        },
        { route: 'radares', label: 'Radares', Icon: RadarIcon },
      ],
    },
    {
      label: 'Alunos',
      items: [
        { route: 'alunos', label: 'Base de Alunos', Icon: GraduationCap },
        { route: 'onboarding', label: 'Onboarding 90 dias', Icon: Sprout, badge: stats.onboarding },
        { route: 'jornada', label: 'Jornada por Modalidade', Icon: Route },
      ],
    },
    {
      label: 'Gestão',
      items: [
        { route: 'indicadores', label: 'Indicadores', Icon: BarChart3 },
        { route: 'equipe', label: 'Equipe', Icon: Users2 },
      ],
    },
    {
      label: 'Diretrizes',
      items: [
        { route: 'playbook', label: 'Playbook', Icon: BookMarked },
        { route: 'governanca', label: 'Governança', Icon: SlidersHorizontal },
      ],
    },
  ];

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 244 }}
      transition={spring}
      className="sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r border-hairline bg-surface select-none print:hidden"
    >
      {/* Brand */}
      <div className="flex h-[74px] shrink-0 items-center border-b border-hairline px-4">
        {collapsed ? (
          <button
            onClick={() => onNavigate('cockpit')}
            title="Centro de Sucesso ao Aluno"
            className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--brand-mark)] font-mono text-[15px] font-bold text-white"
          >
            A
          </button>
        ) : (
          <button onClick={() => onNavigate('cockpit')} className="min-w-0 text-left">
            <BrandLockup />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="scroll-slim min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        {groups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            {!collapsed && (
              <p className="px-2.5 pb-1.5 font-mono text-[9.5px] font-bold tracking-[0.12em] text-ink-4 uppercase">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = route === item.route;
                return (
                  <motion.button
                    key={item.route}
                    whileTap={press}
                    onClick={() => onNavigate(item.route)}
                    title={collapsed ? item.label : undefined}
                    className={[
                      'relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
                      collapsed ? 'justify-center' : '',
                      active ? 'text-brand-text' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                    ].join(' ')}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-active"
                        transition={spring}
                        className="absolute inset-0 rounded-md border border-brand-border bg-brand-soft"
                      />
                    )}
                    <item.Icon
                      className={`relative z-10 h-4 w-4 shrink-0 ${active ? 'text-brand-text' : 'text-ink-4'}`}
                    />
                    {!collapsed && (
                      <>
                        <span
                          className={`relative z-10 min-w-0 flex-1 truncate text-[12.5px] ${active ? 'font-bold' : 'font-medium'}`}
                        >
                          {item.label}
                        </span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span
                            className={[
                              'relative z-10 shrink-0 rounded px-1.5 py-px font-mono text-[10px] font-bold',
                              item.urgent
                                ? 'bg-crit text-white'
                                : active
                                  ? 'bg-brand text-on-brand'
                                  : 'bg-surface-3 text-ink-3',
                            ].join(' ')}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                    {collapsed && item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={[
                          'absolute top-1 right-1 z-10 h-1.5 w-1.5 rounded-full',
                          item.urgent ? 'bg-crit' : 'bg-brand-2',
                        ].join(' ')}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: identity, theme, collapse */}
      <div className="shrink-0 space-y-2 border-t border-hairline p-2.5">
        {!collapsed && (
          <div className="flex items-center gap-2.5 rounded-lg border border-hairline bg-surface-2 p-2.5">
            <Avatar initials={currentUser.initials} size="sm" tone="brand" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-bold text-ink">{currentUser.name}</p>
              <p className="truncate text-[10.5px] text-ink-3">{currentUser.specialty}</p>
            </div>
            <span
              className="pulse-dot h-1.5 w-1.5 shrink-0 rounded-full bg-ok text-ok"
              title={currentUser.presence}
            />
          </div>
        )}

        <div className={`flex gap-1.5 ${collapsed ? 'flex-col' : ''}`}>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-hairline bg-surface-2 text-[11.5px] font-semibold text-ink-3 transition-colors hover:text-ink"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {!collapsed && (theme === 'dark' ? 'Claro' : 'Escuro')}
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2 text-ink-3 transition-colors hover:text-ink"
          >
            {collapsed ? (
              <ChevronsRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronsLeft className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {!collapsed && (
          <p className="px-1 font-mono text-[9.5px] leading-relaxed text-ink-4">
            {scopedStudents.length} alunos no escopo · dados fictícios de demonstração
          </p>
        )}
      </div>
    </motion.aside>
  );
}
