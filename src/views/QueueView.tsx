import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Download,
  FilterX,
  Hand,
  Inbox,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import type { Case, Priority, RadarKey } from '../types';
import type { ShellActions } from '../App';
import { useApp } from '../state/AppContext';
import { pageVariants } from '../lib/motion';
import {
  Card,
  EmptyState,
  PageHeader,
  Row,
} from '../components/ui/Surfaces';
import { Button } from '../components/ui/Button';
import { Chip, SearchInput, Segmented, Select } from '../components/ui/Fields';
import { Avatar, PriorityBadge, RadarBadge } from '../components/ui/Badges';
import { SlaPill } from '../components/domain/SlaPill';
import { CaseWorkflow } from '../components/domain/CaseWorkflow';
import { RADARS, RADAR_ORDER } from '../lib/radars';
import { PRIORITY_ORDER, compareBySla, slaStatus, useClock } from '../lib/sla';
import { isOpen, isTerminal } from '../lib/caseFlow';
import { asQueuePreset } from '../lib/router';
import type { QueuePreset } from '../lib/router';
import { exportCases } from '../lib/exporters';
import { searchKey } from '../lib/format';

/* ==========================================================================
   Fila de Atendimento
   --------------------------------------------------------------------------
   The attendant's workspace: a master list on the left, the full case workflow
   on the right. Three decisions make it usable at real volume:

     · One tab for my work, not two. "Meus pendentes" and "Em tratativa" split
       the only pile an attendant actually owns, so a cockpit tile reading
       "12 na minha fila" had nowhere honest to land. The distinction survives as
       a filter inside the tab, which is what it always was.
     · "Sem dono" is scoped to the attendant's specialty by default. The pool of
       unowned cases across every specialty is a coordinator's number; the slice
       matching your niche is the one you can actually claim.
     · Sorting defaults to SLA, so the top of the list is always the case that
       will breach first. That is the whole job of a queue.

   Deep links carry working sets (`asQueuePreset`), and whatever a preset
   narrows is spelled out in a "recorte" strip above the list — a filtered list
   that does not say it is filtered is just a list with cases missing.
   ========================================================================== */

type Tab = 'minha-fila' | 'sem-dono' | 'equipe' | 'encerrados';
type SortKey = 'sla' | 'prioridade' | 'score' | 'abertura';

/** SLA lens, applicable to any list of open cases. */
type SlaScope = 'todos' | 'vencendo';
/** Where a case of mine stands: awaiting first contact, or already moving. */
type StatusScope = 'todas' | 'pendentes' | 'tratativa';
/** Which unowned cases: my specialty only, or every specialty. */
type SpecialtyScope = 'minha' | 'todas';
/** Closed cases: everything, or just what I closed in this shift. */
type ClosedScope = 'todos' | 'meus-hoje';

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Which tab a case lives in, given who owns it and where it is. */
function homeTabFor(kase: Case, userId: string): Tab {
  if (isTerminal(kase.status)) return 'encerrados';
  if (kase.assigneeId === null) return 'sem-dono';
  if (kase.assigneeId !== userId) return 'equipe';
  return 'minha-fila';
}

/**
 * Whether a case satisfies a tab's *defining* predicate. Deliberately blind to
 * radar, priority, SLA and search: those hide a case without moving it, and
 * yanking the user to another tab because they filtered something out would be
 * wrong. Note that "Toda a equipe" holds every open case, including ones whose
 * home tab is elsewhere.
 */
function belongsToTab(kase: Case, tab: Tab, userId: string): boolean {
  switch (tab) {
    case 'minha-fila':
      return kase.assigneeId === userId && isOpen(kase.status);
    case 'sem-dono':
      return kase.assigneeId === null && isOpen(kase.status);
    case 'equipe':
      return isOpen(kase.status);
    case 'encerrados':
      return isTerminal(kase.status);
  }
}

/** The working set a deep-link preset opens into. */
function stateForPreset(preset: QueuePreset | null): {
  tab: Tab;
  sla: SlaScope;
  closed: ClosedScope;
} {
  return {
    tab:
      preset === 'sem-dono'
        ? 'sem-dono'
        : preset === 'equipe'
          ? 'equipe'
          : preset === 'resolvidos-hoje'
            ? 'encerrados'
            : 'minha-fila',
    sla: preset === 'vencendo-sla' ? 'vencendo' : 'todos',
    closed: preset === 'resolvidos-hoje' ? 'meus-hoje' : 'todos',
  };
}

export function QueueView({
  actions,
  selectedCaseId,
}: {
  actions: ShellActions;
  selectedCaseId: string | null;
}) {
  const { scopedCases, getStudent, currentUser, cases, students, specialists, resetFilters, filtersActive } =
    useApp();
  const now = useClock();

  const initial = stateForPreset(asQueuePreset(selectedCaseId));

  const [tab, setTab] = useState<Tab>(initial.tab);
  const [query, setQuery] = useState('');
  const [radarFilter, setRadarFilter] = useState<RadarKey | 'todos'>('todos');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'todas'>('todas');
  const [slaScope, setSlaScope] = useState<SlaScope>(initial.sla);
  const [statusScope, setStatusScope] = useState<StatusScope>('todas');
  const [specialtyScope, setSpecialtyScope] = useState<SpecialtyScope>('minha');
  const [closedScope, setClosedScope] = useState<ClosedScope>(initial.closed);
  const [sort, setSort] = useState<SortKey>('sla');
  const [showFilters, setShowFilters] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(
    asQueuePreset(selectedCaseId) ? null : selectedCaseId,
  );

  /** Contextual scopes are per-tab, so switching tabs never leaves an inert
      filter silently applied to a list it does not describe. */
  const changeTab = useCallback((next: Tab) => {
    setTab(next);
    setActiveId(null);
    setSlaScope('todos');
    setStatusScope('todas');
    setClosedScope('todos');
  }, []);

  /* A deep link is either a working set (#/fila/vencendo-sla) or a single case
     (#/fila/case-0891). A case must land on a tab that actually contains it,
     otherwise the user arrives at an empty list.

     This runs during render rather than in an effect, which is the shape React
     sanctions for resetting state when a prop changes. An effect would fire
     *after* the list had already been computed from the previous tab, and the
     "keep the selected case on screen" effect below would then re-pin that
     stale case — leaving the list showing one working set while the panel showed
     a case from another. */
  const [routeParam, setRouteParam] = useState<string | null>(selectedCaseId);
  if (selectedCaseId !== routeParam) {
    setRouteParam(selectedCaseId);
    const preset = asQueuePreset(selectedCaseId);
    if (preset) {
      const next = stateForPreset(preset);
      setActiveId(null);
      setTab(next.tab);
      setSlaScope(next.sla);
      setClosedScope(next.closed);
      setStatusScope('todas');
      if (preset === 'sem-dono') setSpecialtyScope('minha');
    } else if (selectedCaseId) {
      const kase = cases.find((c) => c.id === selectedCaseId);
      if (kase) {
        setActiveId(selectedCaseId);
        setTab(homeTabFor(kase, currentUser.id));
      }
    }
  }

  /* Tab counts reflect only what *defines* each tab — ownership, terminality,
     and the specialty lens that decides which unowned pool is yours. Radar,
     priority, SLA and search are refinements; their effect shows in the list
     header instead, so the tabs stay a stable map of the workload. */
  const counts = useMemo(() => {
    const open = scopedCases.filter((c) => isOpen(c.status));
    const unowned = open.filter((c) => c.assigneeId === null);
    return {
      'minha-fila': open.filter((c) => c.assigneeId === currentUser.id).length,
      'sem-dono': (specialtyScope === 'minha'
        ? unowned.filter((c) => c.specialty === currentUser.specialty)
        : unowned
      ).length,
      equipe: open.length,
      encerrados: scopedCases.filter((c) => isTerminal(c.status)).length,
    } satisfies Record<Tab, number>;
  }, [scopedCases, currentUser.id, currentUser.specialty, specialtyScope]);

  const filtered = useMemo(() => {
    const dayStart = startOfToday();

    const list = scopedCases.filter((c) => {
      // Tab
      if (tab === 'minha-fila') {
        if (!(c.assigneeId === currentUser.id && isOpen(c.status))) return false;
        if (statusScope === 'pendentes' && c.status !== 'Pendente') return false;
        if (statusScope === 'tratativa' && c.status === 'Pendente') return false;
      }
      if (tab === 'sem-dono') {
        if (!(c.assigneeId === null && isOpen(c.status))) return false;
        if (specialtyScope === 'minha' && c.specialty !== currentUser.specialty) return false;
      }
      if (tab === 'equipe' && !isOpen(c.status)) return false;
      if (tab === 'encerrados') {
        if (!isTerminal(c.status)) return false;
        if (closedScope === 'meus-hoje') {
          if (c.assigneeId !== currentUser.id) return false;
          if (!c.closedAt || new Date(c.closedAt).getTime() < dayStart) return false;
        }
      }

      // The SLA clock only runs on open cases.
      if (slaScope === 'vencendo' && tab !== 'encerrados') {
        const state = slaStatus(c, now).state;
        if (state !== 'warning' && state !== 'breach') return false;
      }

      if (radarFilter !== 'todos' && c.radar !== radarFilter) return false;
      if (priorityFilter !== 'todas' && c.priority !== priorityFilter) return false;

      if (query.trim()) {
        const q = searchKey(query.trim());
        const student = getStudent(c.studentId);
        const hit =
          searchKey(c.title).includes(q) ||
          searchKey(c.protocol).includes(q) ||
          (student ? searchKey(student.name).includes(q) || student.ra.includes(query.trim()) : false);
        if (!hit) return false;
      }
      return true;
    });

    const sorted = [...list];
    if (sort === 'sla') sorted.sort((a, b) => compareBySla(a, b, now));
    else if (sort === 'prioridade')
      sorted.sort(
        (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || compareBySla(a, b, now),
      );
    else if (sort === 'score')
      sorted.sort(
        (a, b) => (getStudent(a.studentId)?.healthScore ?? 100) - (getStudent(b.studentId)?.healthScore ?? 100),
      );
    else sorted.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());

    return sorted;
  }, [
    scopedCases,
    tab,
    radarFilter,
    priorityFilter,
    slaScope,
    statusScope,
    specialtyScope,
    closedScope,
    query,
    sort,
    now,
    currentUser.id,
    currentUser.specialty,
    getStudent,
  ]);

  /**
   * The selected case is resolved from ALL scoped cases, not just the filtered
   * list. This matters because taking a case changes its status, which usually
   * drops it out of the current tab — and blanking the panel the instant an
   * attendant claims a case is precisely the wrong moment to lose their place.
   * The case stays on screen; the tab follows it.
   */
  const active = useMemo(() => {
    const byId = activeId ? scopedCases.find((c) => c.id === activeId) : undefined;
    return byId ?? filtered[0];
  }, [scopedCases, filtered, activeId]);

  useEffect(() => {
    if (active && active.id !== activeId) setActiveId(active.id);
  }, [active, activeId]);

  // Re-home the tab when the selected case moves *out* of it — claiming an
  // unowned case, closing one — so the list on the left always contains the case
  // shown on the right. Merely having a different home tab is not enough:
  // "Toda a equipe" legitimately holds cases that live elsewhere.
  const activeStatusKey = active ? `${active.id}:${active.status}:${active.assigneeId}` : '';
  useEffect(() => {
    if (!active) return;
    if (!belongsToTab(active, tab, currentUser.id)) setTab(homeTabFor(active, currentUser.id));
    // Keyed on the case's identity + status so this only fires on a real move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStatusKey]);

  /* -- What is narrowing this list, in words ----------------------------- */
  const refinements = useMemo(() => {
    const out: { label: string; clear: () => void }[] = [];
    if (slaScope === 'vencendo' && tab !== 'encerrados')
      out.push({ label: 'SLA vencendo ou estourado', clear: () => setSlaScope('todos') });
    if (tab === 'minha-fila' && statusScope !== 'todas')
      out.push({
        label: statusScope === 'pendentes' ? 'Aguardando 1º contato' : 'Já em tratativa',
        clear: () => setStatusScope('todas'),
      });
    if (tab === 'encerrados' && closedScope === 'meus-hoje')
      out.push({ label: 'Encerrados por mim hoje', clear: () => setClosedScope('todos') });
    if (radarFilter !== 'todos')
      out.push({ label: RADARS[radarFilter].shortLabel, clear: () => setRadarFilter('todos') });
    if (priorityFilter !== 'todas')
      out.push({ label: `Prioridade ${priorityFilter}`, clear: () => setPriorityFilter('todas') });
    return out;
  }, [slaScope, statusScope, closedScope, radarFilter, priorityFilter, tab]);

  const localFiltersActive = refinements.length > 0 || query.trim() !== '';

  const clearLocal = useCallback(() => {
    setRadarFilter('todos');
    setPriorityFilter('todas');
    setSlaScope('todos');
    setStatusScope('todas');
    setClosedScope('todos');
    setQuery('');
  }, []);

  const tabLabel: Record<Tab, string> = {
    'minha-fila': 'Minha fila',
    'sem-dono': specialtyScope === 'minha' ? `Sem dono · ${currentUser.specialty}` : 'Sem dono',
    equipe: 'Toda a equipe',
    encerrados: 'Encerrados',
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-4"
    >
      <PageHeader
        title="Fila de Atendimento"
        actions={
          <>
            <Button
              variant="ghost"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={() => exportCases(filtered, students, specialists)}
              title="Exportar a lista atual para CSV"
            >
              Exportar
            </Button>
            <Button
              variant="primary"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => actions.createCase()}
            >
              Abrir caso
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <Segmented<Tab>
            layoutId="queue-tabs"
            value={tab}
            onChange={changeTab}
            options={(Object.keys(tabLabel) as Tab[]).map((key) => ({
              value: key,
              label: tabLabel[key],
              count: counts[key],
            }))}
          />

          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder="Aluno, RA ou protocolo…"
            className="w-full sm:w-64"
          />

          <Button
            variant={showFilters || localFiltersActive ? 'secondary' : 'ghost'}
            icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            onClick={() => setShowFilters((v) => !v)}
          >
            Filtros
            {localFiltersActive && (
              <span className="ml-1 h-1.5 w-1.5 rounded-full bg-brand-2" />
            )}
          </Button>

          <label className="ml-auto flex shrink-0 items-center gap-2">
            <span className="text-[12px] text-ink-3">Ordenar</span>
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-8 w-[168px]"
              aria-label="Ordenar fila"
            >
              <option value="sla">SLA mais crítico</option>
              <option value="prioridade">Prioridade</option>
              <option value="score">Menor Health Score</option>
              <option value="abertura">Abertura mais recente</option>
            </Select>
          </label>
        </div>

        {/* The recorte strip. A list narrowed by a deep link has to say so. */}
        {refinements.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg bg-brand-soft px-3 py-2">
            <span className="text-[11px] font-medium text-brand-text">Recorte</span>
            {refinements.map((r) => (
              <button
                key={r.label}
                onClick={r.clear}
                title="Remover este recorte"
                className="inline-flex h-6 items-center gap-1.5 rounded-full bg-surface px-2.5 text-[11.5px] font-semibold text-ink-2 transition-colors hover:text-ink"
              >
                {r.label}
                <span className="text-ink-4">×</span>
              </button>
            ))}
            <button
              onClick={clearLocal}
              className="ml-auto shrink-0 text-[11.5px] font-semibold text-brand-text hover:text-brand-2"
            >
              Limpar recorte
            </button>
          </div>
        )}

        {showFilters && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-lg bg-surface-2 p-3.5">
            {/* Contextual lens: what this tab can legitimately be narrowed by */}
            {tab === 'encerrados' ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-medium text-ink-4">Encerramento</span>
                <Chip active={closedScope === 'todos'} onClick={() => setClosedScope('todos')}>
                  Todos
                </Chip>
                <Chip
                  active={closedScope === 'meus-hoje'}
                  onClick={() => setClosedScope('meus-hoje')}
                >
                  Meus de hoje
                </Chip>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-medium text-ink-4">SLA</span>
                <Chip active={slaScope === 'todos'} onClick={() => setSlaScope('todos')}>
                  Todos
                </Chip>
                <Chip
                  active={slaScope === 'vencendo'}
                  onClick={() => setSlaScope('vencendo')}
                  tone="crit"
                >
                  Vencendo
                </Chip>
              </div>
            )}

            {tab === 'minha-fila' && (
              <>
                <span className="hidden h-5 w-px bg-hairline sm:block" />
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[11px] font-medium text-ink-4">Situação</span>
                  <Chip active={statusScope === 'todas'} onClick={() => setStatusScope('todas')}>
                    Todas
                  </Chip>
                  <Chip
                    active={statusScope === 'pendentes'}
                    onClick={() => setStatusScope('pendentes')}
                  >
                    Aguardando 1º contato
                  </Chip>
                  <Chip
                    active={statusScope === 'tratativa'}
                    onClick={() => setStatusScope('tratativa')}
                  >
                    Em tratativa
                  </Chip>
                </div>
              </>
            )}

            {tab === 'sem-dono' && (
              <>
                <span className="hidden h-5 w-px bg-hairline sm:block" />
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[11px] font-medium text-ink-4">Especialidade</span>
                  <Chip
                    active={specialtyScope === 'minha'}
                    onClick={() => setSpecialtyScope('minha')}
                  >
                    {currentUser.specialty}
                  </Chip>
                  <Chip
                    active={specialtyScope === 'todas'}
                    onClick={() => setSpecialtyScope('todas')}
                  >
                    Todas
                  </Chip>
                </div>
              </>
            )}

            <span className="hidden h-5 w-px bg-hairline sm:block" />

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-medium text-ink-4">
                Radar
              </span>
              <Chip active={radarFilter === 'todos'} onClick={() => setRadarFilter('todos')}>
                Todos
              </Chip>
              {RADAR_ORDER.map((key) => (
                <Chip
                  key={key}
                  active={radarFilter === key}
                  onClick={() => setRadarFilter(key)}
                  count={scopedCases.filter((c) => c.radar === key && isOpen(c.status)).length}
                >
                  {RADARS[key].shortLabel}
                </Chip>
              ))}
            </div>

            <span className="hidden h-5 w-px bg-hairline sm:block" />

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-medium text-ink-4">
                Prioridade
              </span>
              <Chip active={priorityFilter === 'todas'} onClick={() => setPriorityFilter('todas')}>
                Todas
              </Chip>
              {(['Crítico', 'Alto', 'Médio', 'Baixo'] as Priority[]).map((p) => (
                <Chip
                  key={p}
                  active={priorityFilter === p}
                  onClick={() => setPriorityFilter(p)}
                  tone={p === 'Crítico' ? 'crit' : 'neutral'}
                  count={scopedCases.filter((c) => c.priority === p && isOpen(c.status)).length}
                >
                  {p}
                </Chip>
              ))}
            </div>

            {(localFiltersActive || filtersActive) && (
              <Button
                size="xs"
                variant="ghost"
                className="ml-auto"
                icon={<FilterX className="h-3.5 w-3.5" />}
                onClick={() => {
                  clearLocal();
                  resetFilters();
                }}
              >
                Limpar tudo
              </Button>
            )}
          </div>
        )}
      </PageHeader>

      {/* ---- Split pane -------------------------------------------------- */}
      <div className="grid gap-5 xl:grid-cols-[minmax(340px,400px)_minmax(0,1fr)]">
        {/* Master list */}
        <Card padded={false} className="flex h-[calc(100vh-188px)] min-h-[480px] flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-hairline bg-surface-2 px-4 py-2.5">
            <span className="text-[11px] font-medium text-ink-3">
              {filtered.length} {filtered.length === 1 ? 'caso' : 'casos'}
            </span>
            <span className="font-mono text-[10.5px] text-ink-4">
              {sort === 'sla'
                ? 'por SLA'
                : sort === 'prioridade'
                  ? 'por prioridade'
                  : sort === 'score'
                    ? 'por score'
                    : 'por abertura'}
            </span>
          </div>

          <div className="scroll-slim min-h-0 flex-1 divide-y divide-hairline overflow-y-auto">
            {filtered.length === 0 ? (
              <EmptyState
                icon={
                  tab === 'minha-fila' ? (
                    <CheckCircle2 className="h-5 w-5 text-ok" />
                  ) : (
                    <Inbox className="h-5 w-5" />
                  )
                }
                title={
                  localFiltersActive
                    ? 'Nenhum caso neste recorte'
                    : tab === 'minha-fila'
                      ? 'Sua fila está limpa'
                      : tab === 'sem-dono'
                        ? 'Nenhum caso sem responsável'
                        : 'Nenhum caso neste recorte'
                }
                message={
                  localFiltersActive
                    ? 'O recorte aplicado não retornou casos. Limpe-o para ver a aba inteira.'
                    : tab === 'minha-fila'
                      ? 'Nenhum caso atribuído a você em aberto. Assuma um caso sem dono da sua especialidade.'
                      : tab === 'sem-dono'
                        ? specialtyScope === 'minha'
                          ? `Nenhum caso sem dono em ${currentUser.specialty}. Veja todas as especialidades para ajudar outra fila.`
                          : 'Todos os casos abertos têm responsável.'
                        : 'Ajuste os filtros no topo ou troque de aba.'
                }
                action={
                  localFiltersActive ? (
                    <Button size="sm" variant="secondary" onClick={clearLocal}>
                      Limpar recorte
                    </Button>
                  ) : tab === 'sem-dono' && specialtyScope === 'minha' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSpecialtyScope('todas')}
                    >
                      Ver todas as especialidades
                    </Button>
                  ) : counts['sem-dono'] > 0 && tab !== 'sem-dono' ? (
                    <Button size="sm" variant="secondary" onClick={() => changeTab('sem-dono')}>
                      Ver {counts['sem-dono']} casos sem dono
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              filtered.map((kase) => {
                const student = getStudent(kase.studentId);
                if (!student) return null;
                const sla = slaStatus(kase, now);
                const isActive = active?.id === kase.id;

                return (
                  <Row
                    key={kase.id}
                    onClick={() => setActiveId(kase.id)}
                    active={isActive}
                    tone={!isActive && sla.state === 'breach' ? 'crit' : 'plain'}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Avatar initials={student.initials} size="sm" tone={student.status} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] font-semibold text-ink">
                            {student.name}
                          </span>
                          <SlaPill kase={kase} size="xs" />
                        </div>
                        <div className="mt-0.5 flex items-center gap-2.5">
                          <span className="min-w-0 flex-1 truncate text-[12px] text-ink-3">
                            {kase.title}
                          </span>
                          <PriorityBadge priority={kase.priority} />
                          <RadarBadge radar={kase.radar} />
                        </div>
                      </div>
                    </div>
                  </Row>
                );
              })
            )}
          </div>
        </Card>

        {/* Detail */}
        <Card padded={false} className="flex h-[calc(100vh-188px)] min-h-[480px] flex-col overflow-hidden">
          {active ? (
            <CaseWorkflow
              kase={active}
              actions={{
                onRegister: (caseId) => {
                  const kase = cases.find((c) => c.id === caseId);
                  if (kase) actions.register({ studentId: kase.studentId, caseId });
                },
                onCopilot: (studentId, caseId) => actions.copilot(studentId, caseId),
                onForward: actions.forward,
                onClose: actions.closeCase,
                onReopen: actions.reopen,
                onFollowUp: (studentId, caseId) => actions.followUp(studentId, caseId),
                onOpenStudent: actions.openStudent,
              }}
            />
          ) : (
            <EmptyState
              icon={<Hand className="h-5 w-5" />}
              title="Selecione um caso"
              message="Escolha um protocolo na lista ao lado para ver os sinais, o diagnóstico e as ações disponíveis."
            />
          )}
        </Card>
      </div>
    </motion.div>
  );
}
