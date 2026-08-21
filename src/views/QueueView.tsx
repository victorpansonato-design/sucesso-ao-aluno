import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
  const {
    scopedCases,
    getStudent,
    getSpecialist,
    currentUser,
    cases,
    students,
    specialists,
    resetFilters,
    filtersActive,
  } = useApp();
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
      } else {
        setActiveId(null);
      }
    } else {
      /* `#/fila` puro — é onde o botão voltar do navegador aterra depois de um
         atendimento. Sem este ramo o caso continuava aberto e o "voltar"
         parecia não fazer nada. */
      setActiveId(null);
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
   * O caso aberto, resolvido a partir de TODOS os casos no escopo e não da
   * lista filtrada. Isso importa porque assumir um caso muda o seu status, o
   * que normalmente o tira da aba corrente — e apagar a tela no instante em que
   * o atendente assume o caso é exatamente o pior momento para perder o lugar.
   *
   * Sem fallback para `filtered[0]`: quem abre a fila vê a LISTA. Selecionar
   * sozinho o primeiro caso fazia sentido quando o painel vivia ao lado da
   * lista; agora que o caso ocupa a tela, abrir a fila já dentro de um
   * atendimento que ninguém pediu seria simplesmente o destino errado.
   */
  const active = useMemo(
    () => (activeId ? scopedCases.find((c) => c.id === activeId) : undefined),
    [scopedCases, activeId],
  );

  /* Anterior/próximo dentro do recorte atual. Em tela cheia a lista sai de
     vista, e sem isto atender cinco casos seriam dez viagens de ida e volta. */
  const position = useMemo(() => {
    if (!active) return null;
    const index = filtered.findIndex((c) => c.id === active.id);
    if (index < 0) return null;
    return {
      index,
      total: filtered.length,
      previous: index > 0 ? filtered[index - 1] : null,
      next: index < filtered.length - 1 ? filtered[index + 1] : null,
    };
  }, [active, filtered]);

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

  /** Volta para a lista pela rota, para o botão voltar do navegador funcionar. */
  const backToList = useCallback(() => {
    const preset: QueuePreset | null =
      tab === 'minha-fila'
        ? 'minha-fila'
        : tab === 'sem-dono'
          ? 'sem-dono'
          : tab === 'equipe'
            ? 'equipe'
            : null;
    actions.goto('fila', preset);
  }, [actions, tab]);

  /* ======================================================================
     MODO CASO — a tela inteira para uma pessoa
     ----------------------------------------------------------------------
     Antes eram dois lugares: um painel estreito à direita da lista e, ao
     clicar no nome, o Dossiê 360° — uma página inteira repetindo identidade,
     sinais, score e timeline. Duas telas para o mesmo aluno significa ler
     tudo duas vezes e nunca saber qual está certa.

     Agora é um lugar só, com a largura toda. O que o dossiê tinha a mais
     virou aba aqui dentro.
     ====================================================================== */
  if (active) {
    return (
      <motion.div
        key="caso"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="secondary"
            icon={<ChevronLeft className="h-3.5 w-3.5" />}
            onClick={backToList}
          >
            {tabLabel[tab]} ({counts[tab]})
          </Button>

          {position && position.total > 1 && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11.5px] text-ink-4">
                {position.index + 1} de {position.total}
              </span>
              <Button
                size="sm"
                variant="ghost"
                square
                title="Caso anterior no recorte"
                disabled={!position.previous}
                onClick={() => position.previous && actions.openCase(position.previous.id)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                square
                title="Próximo caso no recorte"
                disabled={!position.next}
                onClick={() => position.next && actions.openCase(position.next.id)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        <Card padded={false} className="overflow-hidden">
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
            }}
          />
        </Card>
      </motion.div>
    );
  }

  /* ---- MODO LISTA ------------------------------------------------------ */
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

      {/* ---- A lista, em toda a largura ---------------------------------
              Ela ocupava uma coluna de 380px porque dividia a tela com o painel
              do caso. Com o caso em tela cheia, a lista herda a largura inteira
              — e o que era um cartão apertado de duas linhas cabe agora como
              tabela: aluno, caso, prioridade, score, SLA e responsável, na ordem
              em que a pergunta "pego qual?" é respondida. */}
      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-hairline bg-surface-2 px-4 py-2.5">
          <span className="text-[11.5px] font-medium text-ink-3">
            {filtered.length} {filtered.length === 1 ? 'caso' : 'casos'}
            {localFiltersActive && <span className="text-ink-4"> no recorte</span>}
          </span>
          <span className="font-mono text-[10.5px] text-ink-4">
            {sort === 'sla'
              ? 'ordenado por SLA'
              : sort === 'prioridade'
                ? 'ordenado por prioridade'
                : sort === 'score'
                  ? 'ordenado por score'
                  : 'ordenado por abertura'}
          </span>
        </div>

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
                <Button size="sm" variant="secondary" onClick={() => setSpecialtyScope('todas')}>
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
          <>
            {/* Cabeçalho de colunas. Só a partir de xl, onde todas aparecem. */}
            <div className="hidden items-center gap-4 border-b border-hairline px-4 py-2 text-[10.5px] font-medium tracking-wide text-ink-4 uppercase xl:flex">
              <span className="min-w-0 flex-[1.1]">Aluno</span>
              <span className="min-w-0 flex-[1.3]">Caso</span>
              <span className="w-24 shrink-0">Prioridade</span>
              <span className="w-12 shrink-0 text-right">Score</span>
              <span className="w-28 shrink-0">SLA</span>
              <span className="w-36 shrink-0">Responsável</span>
              <span className="w-24 shrink-0" />
            </div>

            <ul className="divide-y divide-hairline">
              {filtered.map((kase) => {
                const student = getStudent(kase.studentId);
                if (!student) return null;
                const sla = slaStatus(kase, now);
                const owner = getSpecialist(kase.assigneeId);
                const mine = kase.assigneeId === currentUser.id;

                return (
                  <li key={kase.id}>
                    {/* A linha inteira é clicável por um alvo esticado por baixo
                        do conteúdo, e não por um <button> em volta de tudo: o
                        botão de ação vive dentro da linha, e botão dentro de
                        botão é HTML inválido — o React reclama e o clique
                        interno passa a depender de stopPropagation para não
                        disparar os dois. Assim os dois alvos são irmãos. */}
                    <Row tone={sla.state === 'breach' ? 'crit' : 'plain'} className="group">
                      <button
                        onClick={() => actions.openCase(kase.id)}
                        aria-label={`Abrir o caso de ${student.name}`}
                        className="absolute inset-0 cursor-pointer transition-colors hover:bg-surface-hover"
                      />
                      <div className="pointer-events-none relative flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 xl:flex-nowrap">
                        <div className="flex min-w-0 flex-[1.1] items-center gap-3">
                          <Avatar initials={student.initials} size="sm" tone={student.status} />
                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-semibold text-ink">
                              {student.name}
                            </p>
                            <p className="mt-0.5 truncate text-[11.5px] text-ink-3">
                              {student.course} · {student.period}º · {student.modality}
                            </p>
                          </div>
                        </div>

                        <div className="min-w-0 flex-[1.3]">
                          <p className="truncate text-[13px] text-ink-2">{kase.title}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <RadarBadge radar={kase.radar} />
                            <span className="truncate font-mono text-[10.5px] text-ink-4">
                              {kase.protocol}
                            </span>
                          </div>
                        </div>

                        <div className="w-24 shrink-0">
                          <PriorityBadge priority={kase.priority} />
                        </div>

                        <div
                          className="w-12 shrink-0 text-right"
                          title={`Health Score ${student.healthScore} · ${student.status}`}
                        >
                          <span className="font-mono text-[13px] font-medium text-ink">
                            {student.healthScore}
                          </span>
                        </div>

                        <div className="w-28 shrink-0">
                          <SlaPill kase={kase} size="xs" />
                        </div>

                        <div className="hidden w-36 shrink-0 xl:block">
                          {owner ? (
                            <span className="truncate text-[12px] text-ink-3">
                              {mine ? <span className="font-semibold text-ink">você</span> : owner.name}
                            </span>
                          ) : (
                            <span className="text-[12px] font-semibold text-crit-ink">sem dono</span>
                          )}
                        </div>

                        {/* "Assumir" só quando não há dono. Antes o rótulo saía
                            de `status === 'Pendente'`, e um caso pendente da
                            Larissa aparecia com um botão azul me convidando a
                            assumir o caso dela. Quem decide o verbo é a posse,
                            não o estágio. */}
                        <div className="pointer-events-auto flex w-24 shrink-0 justify-end">
                          <Button
                            size="sm"
                            variant={kase.assigneeId === null || mine ? 'primary' : 'secondary'}
                            icon={
                              kase.assigneeId === null ? <Hand className="h-3.5 w-3.5" /> : undefined
                            }
                            onClick={() => actions.openCase(kase.id)}
                          >
                            {kase.assigneeId === null ? 'Assumir' : mine ? 'Continuar' : 'Abrir'}
                          </Button>
                        </div>
                      </div>
                    </Row>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </motion.div>
  );
}
