import { useState } from 'react';
import { motion } from 'motion/react';
import {
  BarChart3,
  BellRing,
  BookMarked,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Compass,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Moon,
  PieChart,
  Radar as RadarIcon,
  Route,
  SlidersHorizontal,
  Sprout,
  Sun,
  Users2,
} from 'lucide-react';
import type { RouteName } from '../../lib/router';
import { useApp, useQueueStats } from '../../state/AppContext';
import { BrandLockup } from '../brand/AnchietaLogo';
import { Avatar } from '../ui/Badges';
import { RoleSwitcher } from './RoleSwitcher';
import { roleLabel } from '../../lib/routing';
import { press, spring } from '../../lib/motion';

/* ==========================================================================
   Sidebar
   --------------------------------------------------------------------------
   Eleven destinations is what the app has. Six is what an attendant opens in a
   day. The other five — dashboard, indicators, team load, journey by modality,
   governance — belong to whoever runs the operation, not to whoever works it,
   and they were making the daily six harder to find.

   So the daily six are flat and visible, and the management five live behind
   one collapsed group that remembers nothing: it opens when you are on one of
   its screens and otherwise stays shut. No sub-headings above three items each,
   no "Diretrizes" section holding a single link.

   The badge on "Fila" is the only number in the navigation, because it is the
   only one that changes what you do next.
   ========================================================================== */

interface NavItem {
  route: RouteName;
  label: string;
  Icon: typeof LayoutDashboard;
  badge?: number;
  urgent?: boolean;
}

/**
 * Dashboard e Indicadores convivem porque respondem a pedidos diferentes:
 * Dashboard é para *olhar* (índices, pizzas, evolução, jornada, operação) e
 * Indicadores é para *levar embora* (tabelas e as exportações em CSV e o
 * relatório executivo). Fundi-los daria uma tela que rola por dois minutos.
 */
const MANAGEMENT: NavItem[] = [
  { route: 'dashboard', label: 'Dashboard', Icon: PieChart },
  { route: 'indicadores', label: 'Indicadores', Icon: BarChart3 },
  { route: 'equipe', label: 'Equipe', Icon: Users2 },
  { route: 'jornada', label: 'Jornada por Modalidade', Icon: Route },
  { route: 'governanca', label: 'Governança', Icon: SlidersHorizontal },
];

const MANAGEMENT_ROUTES = MANAGEMENT.map((i) => i.route);

export function Sidebar({
  route,
  onNavigate,
}: {
  route: RouteName;
  onNavigate: (name: RouteName) => void;
}) {
  const { currentUser, theme, toggleTheme } = useApp();
  const stats = useQueueStats();
  const [collapsed, setCollapsed] = useState(false);
  const inManagement = MANAGEMENT_ROUTES.includes(route);
  const [managementOpen, setManagementOpen] = useState(inManagement);

  const daily: NavItem[] = [
    { route: 'cockpit', label: 'Cockpit', Icon: LayoutDashboard },
    {
      route: 'fila',
      label: 'Fila de Atendimento',
      Icon: ListChecks,
      badge: stats.openCount,
      urgent: stats.critical > 0,
    },
    { route: 'alunos', label: 'Base de Alunos', Icon: GraduationCap },
    { route: 'radares', label: 'Radares', Icon: RadarIcon },
    { route: 'onboarding', label: 'Onboarding 90 dias', Icon: Sprout, badge: stats.onboarding },
    { route: 'push', label: 'Gestão de PUSH', Icon: BellRing },
    /* Vizinha de PUSH de propósito: as duas nascem do mesmo calendário
       acadêmico e terminam no mesmo celular. PUSH é a metade que fala, a
       Trilha é a metade que responde quando o aluno vai olhar. Lidas juntas na
       navegação, dizem a coisa certa. */
    { route: 'trilha', label: 'Trilha do Aluno', Icon: Compass },
    { route: 'playbook', label: 'Playbook', Icon: BookMarked },
  ];

  const renderItem = (item: NavItem, nested = false) => {
    const active = route === item.route;
    return (
      <motion.button
        key={item.route}
        whileTap={press}
        onClick={() => onNavigate(item.route)}
        title={collapsed ? item.label : undefined}
        className={[
          'relative flex w-full items-center gap-2.5 rounded-md py-2 text-left transition-colors',
          collapsed ? 'justify-center px-2.5' : nested ? 'pr-2.5 pl-8' : 'px-2.5',
          active ? 'text-on-brand' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        ].join(' ')}
      >
        {active && (
          <motion.span
            layoutId="sidebar-active"
            transition={spring}
            className="absolute inset-0 rounded-md bg-brand"
          />
        )}
        <item.Icon
          className={`relative z-10 h-4 w-4 shrink-0 ${active ? 'text-on-brand' : 'text-ink-4'}`}
        />
        {!collapsed && (
          <>
            <span
              className={`relative z-10 min-w-0 flex-1 truncate text-[13px] ${
                active ? 'font-semibold' : 'font-medium'
              }`}
            >
              {item.label}
            </span>
            {item.badge !== undefined && item.badge > 0 && (
              <span
                className={[
                  'relative z-10 shrink-0 rounded-sm px-1.5 py-px font-mono text-[11px] font-medium',
                  item.urgent && !active
                    ? 'bg-crit text-white'
                    : active
                      ? 'bg-white/20 text-on-brand'
                      : 'bg-surface-2 text-ink-3',
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
              item.urgent ? 'bg-crit' : 'bg-ink-4',
            ].join(' ')}
          />
        )}
      </motion.button>
    );
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 244 }}
      transition={spring}
      className="sticky top-0 z-30 flex h-screen shrink-0 flex-col bg-surface select-none print:hidden"
    >
      {/* Brand */}
      <div className="flex h-[74px] shrink-0 items-center px-4">
        {collapsed ? (
          <button
            onClick={() => onNavigate('cockpit')}
            title="Centro de Sucesso ao Aluno"
            className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--brand-mark)] font-mono text-[15px] font-semibold text-white"
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
      <nav className="scroll-slim min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
        <div className="space-y-0.5">{daily.map((item) => renderItem(item))}</div>

        <div className="mt-4 space-y-0.5">
          {collapsed ? (
            MANAGEMENT.map((item) => renderItem(item))
          ) : (
            <>
              <button
                onClick={() => setManagementOpen((v) => !v)}
                className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                aria-expanded={managementOpen}
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                    managementOpen ? '' : '-rotate-90'
                  }`}
                />
                Gestão
                {!managementOpen && inManagement && (
                  <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                )}
              </button>
              {managementOpen && (
                <div className="space-y-0.5">
                  {MANAGEMENT.map((item) => renderItem(item, true))}
                </div>
              )}
            </>
          )}
        </div>
      </nav>

      {/* Footer: identity, theme, collapse */}
      <div className="shrink-0 space-y-2 p-2.5">
        {!collapsed && <RoleSwitcher />}
        {collapsed && (
          <div className="flex justify-center" title={`${currentUser.name} · ${roleLabel(currentUser)}`}>
            <Avatar initials={currentUser.initials} size="sm" tone="brand" />
          </div>
        )}

        <div className={`flex gap-1.5 ${collapsed ? 'flex-col' : ''}`}>
          <button
            onClick={(e) => {
              // O circulo de revelacao nasce no centro do proprio botao.
              const r = e.currentTarget.getBoundingClientRect();
              toggleTheme({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
            }}
            title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full bg-surface-2 text-[12px] font-medium text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {!collapsed && (theme === 'dark' ? 'Claro' : 'Escuro')}
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
          >
            {collapsed ? (
              <ChevronsRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronsLeft className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
