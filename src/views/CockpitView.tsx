import { useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2, Hand, ListChecks, Plus, Sparkles } from 'lucide-react';
import type { ShellActions } from '../App';
import { useApp, useQueueStats } from '../state/AppContext';
import { pageVariants } from '../lib/motion';
import { Card, CardHeader, EmptyState, Metric, PageHeader, Row } from '../components/ui/Surfaces';
import { Button, LinkButton } from '../components/ui/Button';
import { Donut } from '../components/ui/Charts';
import { Avatar, PriorityBadge } from '../components/ui/Badges';
import { SlaPill } from '../components/domain/SlaPill';
import { scoreDistribution } from '../lib/healthScore';
import { compareBySla, slaStatus, useClock } from '../lib/sla';
import { int, percent } from '../lib/format';

/* ==========================================================================
   Cockpit
   --------------------------------------------------------------------------
   One question, three blocks: "quem precisa de mim agora?"

   The previous version answered that in the first screenful and then answered
   five questions nobody had asked — a radar matrix, a bar chart of causes, a
   follow-up agenda, a second copy of the same queue. Everything removed here
   still exists on its own screen, reachable in one click. Repeating it on the
   home screen only pushed the answer further down the page.

   What survives:
     1. Four numbers that decide whether the shift is calm or on fire.
     2. The shape of the base, so a coordinator can see the trend behind them.
     3. The queue itself — the actual answer to the question.
   ========================================================================== */

export function CockpitView({ actions }: { actions: ShellActions }) {
  const {
    scopedStudents,
    theme,
    currentUser,
    getStudent,
    modalityFilter,
    cohortFilter,
  } = useApp();
  const stats = useQueueStats();
  const now = useClock();
  const dark = theme === 'dark';

  const distribution = useMemo(() => scoreDistribution(scopedStudents), [scopedStudents]);

  /* -- The four numbers -------------------------------------------------- */
  const dueSoon = useMemo(
    () =>
      stats.open.filter((c) => {
        const state = slaStatus(c, now).state;
        return state === 'warning' || state === 'breach';
      }).length,
    [stats.open, now],
  );

  const solvedToday = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return stats.closed.filter((c) => c.closedAt && new Date(c.closedAt).getTime() >= start.getTime())
      .length;
  }, [stats.closed]);

  /* -- The queue: SLA first, then priority ------------------------------- */
  const priorityQueue = useMemo(
    () => [...stats.open].sort((a, b) => compareBySla(a, b, now)).slice(0, 6),
    [stats.open, now],
  );

  const firstName = currentUser.name.split(' ')[0];
  const scopeLabel =
    modalityFilter === 'Todas' && cohortFilter === 'Todos'
      ? 'Base completa'
      : [
          modalityFilter !== 'Todas' ? modalityFilter : null,
          cohortFilter !== 'Todos' ? `${cohortFilter}s` : null,
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-8"
    >
      <PageHeader
        eyebrow={
          <>
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-ink-4 text-ink-4" />
            {scopeLabel} · {int(scopedStudents.length)} alunos no escopo
          </>
        }
        title={`Bom dia, ${firstName}`}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => actions.createCase()}
            >
              Abrir caso
            </Button>
            <Button
              variant="primary"
              icon={<ListChecks className="h-3.5 w-3.5" />}
              iconRight={<ArrowRight className="h-3.5 w-3.5" />}
              onClick={() => actions.goto('fila')}
            >
              Abrir fila ({stats.openCount})
            </Button>
          </>
        }
      />

      {/* ---- Four numbers. No boxes: whitespace separates them. ---------- */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4 lg:gap-x-12">
        <Metric
          label="na minha fila"
          value={int(stats.mineCount)}
          onClick={() => actions.goto('fila')}
        />
        <Metric
          label="vencendo o SLA"
          value={int(dueSoon)}
          tone={dueSoon > 0 ? 'crit' : 'plain'}
          onClick={() => actions.goto('fila')}
        />
        <Metric
          label="sem dono"
          value={int(stats.unassigned)}
          onClick={() => actions.goto('fila')}
        />
        <Metric label="resolvidos hoje" value={int(solvedToday)} />
      </div>

      {/* ---- Base health + the queue ------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Saúde da base"
            subtitle="Clique numa faixa para abrir a base filtrada."
          />

          <div className="mt-5 flex flex-col items-center gap-5">
            <Donut
              segments={distribution.map((band) => ({
                key: band.status,
                label: band.label,
                value: band.count,
                color: band.hex(dark),
              }))}
              centerValue={scopedStudents.length}
              centerLabel="alunos"
              onSegmentClick={() => actions.goto('alunos')}
            />

            <div className="w-full min-w-0 space-y-1">
              {distribution.map((band) => (
                <button
                  key={band.status}
                  onClick={() => actions.goto('alunos')}
                  className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: band.hex(dark) }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">
                    {band.label}
                  </span>
                  <span className="shrink-0 font-mono text-[13px] font-medium text-ink">
                    {int(band.count)}
                  </span>
                  <span className="w-11 shrink-0 text-right font-mono text-[11px] text-ink-4">
                    {percent(band.percent, 0)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card padded={false}>
          <div className="p-5 pb-4">
            <CardHeader
              title="Precisam de mim agora"
              subtitle="SLA estourado primeiro, depois prioridade. Assuma ou abra o dossiê daqui."
              action={
                <LinkButton
                  onClick={() => actions.goto('fila')}
                  iconRight={<ArrowRight className="h-3.5 w-3.5" />}
                >
                  Ver fila ({stats.openCount})
                </LinkButton>
              }
            />
          </div>

          {priorityQueue.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="Nenhum caso aberto no escopo"
              message="Todos os protocolos deste recorte estão encerrados. Ajuste os filtros no topo para ver outro segmento da base."
            />
          ) : (
            <ul className="divide-y divide-hairline border-t border-hairline">
              {priorityQueue.map((kase) => {
                const student = getStudent(kase.studentId);
                if (!student) return null;
                const sla = slaStatus(kase, now);
                const mine = kase.assigneeId === currentUser.id;

                return (
                  <li key={kase.id}>
                    <Row tone={sla.state === 'breach' ? 'crit' : 'plain'}>
                      <div className="flex items-center gap-4 px-5 py-3.5">
                        <button
                          onClick={() => actions.openStudent(student.id)}
                          className="group flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <Avatar initials={student.initials} size="sm" tone={student.status} />
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                              <span className="truncate text-[13.5px] font-semibold text-ink group-hover:underline">
                                {student.name}
                              </span>
                              <PriorityBadge priority={kase.priority} />
                              <span
                                className="font-mono text-[12px] text-ink-3"
                                title={`Health Score ${student.healthScore} · ${student.status}`}
                              >
                                {student.healthScore}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                              {kase.title}
                            </span>
                          </span>
                        </button>

                        <div className="hidden shrink-0 sm:block">
                          <SlaPill kase={kase} />
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            square
                            title="Copiloto de abordagem"
                            onClick={() => actions.copilot(student.id, kase.id)}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                          </Button>
                          {kase.status === 'Pendente' ? (
                            <Button
                              size="sm"
                              variant="primary"
                              icon={<Hand className="h-3.5 w-3.5" />}
                              onClick={() => actions.openCase(kase.id)}
                            >
                              Assumir
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant={mine ? 'primary' : 'secondary'}
                              onClick={() => actions.openCase(kase.id)}
                            >
                              {mine ? 'Continuar' : 'Abrir'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </Row>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
