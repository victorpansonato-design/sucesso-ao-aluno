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
import {
  Avatar,
  CaseStatusBadge,
  CohortBadge,
  ModalityBadge,
  PriorityBadge,
  RadarBadge,
} from '../components/ui/Badges';
import { SlaPill } from '../components/domain/SlaPill';
import { CaseWorkflow } from '../components/domain/CaseWorkflow';
import { RADARS, RADAR_ORDER } from '../lib/radars';
import { PRIORITY_ORDER, compareBySla, slaStatus, useClock } from '../lib/sla';
import { isOpen, isTerminal } from '../lib/caseFlow';
import { exportCases } from '../lib/exporters';
import { searchKey } from '../lib/format';

/* ==========================================================================
   Fila de Atendimento
   --------------------------------------------------------------------------
   The attendant's workspace: a master list on the left, the full case workflow
   on the right. Two things make it usable at real volume:

     · The default tab is "Meus pendentes", and it is guaranteed to contain the
       cases the state machine calls pending — the previous build filtered on
       statuses that no longer existed, so the landing tab was always empty.
     · Sorting defaults to SLA, so the top of the list is always the case that
       will breach first. That is the whole job of a queue.
   ========================================================================== */

type Tab = 'meus-pendentes' | 'meus-ativos' | 'sem-dono' | 'equipe' | 'encerrados';
type SortKey = 'sla' | 'prioridade' | 'score' | 'abertura';

const TAB_LABEL: Record<Tab, string> = {
  'meus-pendentes': 'Meus pendentes',
  'meus-ativos': 'Em tratativa',
  'sem-dono': 'Sem dono',
  equipe: 'Toda a equipe',
  encerrados: 'Encerrados',
};

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

  const [tab, setTab] = useState<Tab>('meus-pendentes');
  const [query, setQuery] = useState('');
  const [radarFilter, setRadarFilter] = useState<RadarKey | 'todos'>('todos');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'todas'>('todas');
  const [sort, setSort] = useState<SortKey>('sla');
  const [showFilters, setShowFilters] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(selectedCaseId);

  /* A deep link (#/fila/case-123) must select that case and switch to a tab
     that actually contains it — otherwise the user lands on an empty list. */
  useEffect(() => {
    if (!selectedCaseId) return;
    const kase = cases.find((c) => c.id === selectedCaseId);
    if (!kase) return;
    setActiveId(selectedCaseId);
    if (isTerminal(kase.status)) setTab('encerrados');
    else if (kase.assigneeId === null) setTab('sem-dono');
    else if (kase.assigneeId !== currentUser.id) setTab('equipe');
    else setTab(kase.status === 'Pendente' ? 'meus-pendentes' : 'meus-ativos');
  }, [selectedCaseId, cases, currentUser.id]);

  const counts = useMemo(() => {
    const mine = scopedCases.filter((c) => c.assigneeId === currentUser.id);
    return {
      'meus-pendentes': mine.filter((c) => c.status === 'Pendente').length,
      'meus-ativos': mine.filter((c) => isOpen(c.status) && c.status !== 'Pendente').length,
      'sem-dono': scopedCases.filter((c) => c.assigneeId === null && isOpen(c.status)).length,
      equipe: scopedCases.filter((c) => isOpen(c.status)).length,
      encerrados: scopedCases.filter((c) => isTerminal(c.status)).length,
    } satisfies Record<Tab, number>;
  }, [scopedCases, currentUser.id]);

  const filtered = useMemo(() => {
    const list = scopedCases.filter((c) => {
      // Tab
      if (tab === 'meus-pendentes' && !(c.assigneeId === currentUser.id && c.status === 'Pendente')) return false;
      if (
        tab === 'meus-ativos' &&
        !(c.assigneeId === currentUser.id && isOpen(c.status) && c.status !== 'Pendente')
      )
        return false;
      if (tab === 'sem-dono' && !(c.assigneeId === null && isOpen(c.status))) return false;
      if (tab === 'equipe' && !isOpen(c.status)) return false;
      if (tab === 'encerrados' && !isTerminal(c.status)) return false;

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
  }, [scopedCases, tab, radarFilter, priorityFilter, query, sort, now, currentUser.id, getStudent]);

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

  /** Which tab a case belongs in, given who owns it and where it is. */
  const tabOf = useCallback(
    (kase: Case): Tab => {
      if (isTerminal(kase.status)) return 'encerrados';
      if (kase.assigneeId === null) return 'sem-dono';
      if (kase.assigneeId !== currentUser.id) return 'equipe';
      return kase.status === 'Pendente' ? 'meus-pendentes' : 'meus-ativos';
    },
    [currentUser.id],
  );

  // Re-home the tab when the selected case moves out of it, so the list on the
  // left always contains the case shown on the right.
  const activeStatusKey = active ? `${active.id}:${active.status}:${active.assigneeId}` : '';
  useEffect(() => {
    if (!active) return;
    const home = tabOf(active);
    if (home !== tab) setTab(home);
    // Keyed on the case's identity + status so this only fires on a real move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStatusKey]);

  const localFiltersActive = radarFilter !== 'todos' || priorityFilter !== 'todas' || query.trim() !== '';

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Unidade de trabalho do especialista"
        title="Fila de Atendimento"
        description="Cada intervenção relevante vira um caso acompanhável, com SLA em horas úteis, freio de réguas concorrentes e registro obrigatório de causa, intervenção, resultado e próximo passo."
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
            onChange={(v) => {
              setTab(v);
              setActiveId(null);
            }}
            options={(Object.keys(TAB_LABEL) as Tab[]).map((key) => ({
              value: key,
              label: TAB_LABEL[key],
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

          <label className="ml-auto flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold tracking-[0.08em] text-ink-4 uppercase">
              Ordenar
            </span>
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

        {showFilters && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-lg border border-hairline bg-surface-2 p-3.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 font-mono text-[10px] font-bold tracking-[0.08em] text-ink-4 uppercase">
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
              <span className="mr-1 font-mono text-[10px] font-bold tracking-[0.08em] text-ink-4 uppercase">
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
                  setRadarFilter('todos');
                  setPriorityFilter('todas');
                  setQuery('');
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
        <Card padded={false} className="flex max-h-[calc(100vh-260px)] min-h-[420px] flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-hairline bg-surface-2 px-4 py-2.5">
            <span className="font-mono text-[10.5px] font-bold tracking-[0.08em] text-ink-3 uppercase">
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
                  tab === 'meus-pendentes' ? (
                    <CheckCircle2 className="h-5 w-5 text-ok" />
                  ) : (
                    <Inbox className="h-5 w-5" />
                  )
                }
                title={
                  tab === 'meus-pendentes'
                    ? 'Nenhum caso pendente seu'
                    : tab === 'sem-dono'
                      ? 'Todos os casos têm responsável'
                      : 'Nenhum caso neste recorte'
                }
                message={
                  localFiltersActive
                    ? 'Os filtros aplicados não retornaram resultados. Limpe-os para ver a fila completa.'
                    : tab === 'meus-pendentes'
                      ? 'Você não tem casos aguardando primeiro contato. Veja "Em tratativa" ou assuma um caso sem dono.'
                      : 'Ajuste os filtros no topo ou troque de aba.'
                }
                action={
                  localFiltersActive ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setRadarFilter('todos');
                        setPriorityFilter('todas');
                        setQuery('');
                      }}
                    >
                      Limpar filtros
                    </Button>
                  ) : counts['sem-dono'] > 0 && tab !== 'sem-dono' ? (
                    <Button size="sm" variant="secondary" onClick={() => setTab('sem-dono')}>
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
                    <div className="space-y-2 p-3.5 pl-4">
                      <div className="flex items-start gap-2.5">
                        <Avatar initials={student.initials} size="sm" tone={student.status} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[12.5px] font-bold text-ink">
                              {student.name}
                            </span>
                            <SlaPill kase={kase} size="xs" />
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-ink-3">
                            {kase.title}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <PriorityBadge priority={kase.priority} solid={kase.priority === 'Crítico'} />
                        <CaseStatusBadge status={kase.status} />
                        <RadarBadge radar={kase.radar} />
                        <ModalityBadge modality={student.modality} />
                        {student.cohort === 'Calouro' && <CohortBadge cohort="Calouro" />}
                      </div>

                      <div className="flex items-center justify-between font-mono text-[10px] text-ink-4">
                        <span>{kase.protocol}</span>
                        <span>
                          RA {student.ra} · score {student.healthScore}
                        </span>
                      </div>
                    </div>
                  </Row>
                );
              })
            )}
          </div>
        </Card>

        {/* Detail */}
        <Card padded={false} className="flex max-h-[calc(100vh-260px)] min-h-[420px] flex-col overflow-hidden">
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
