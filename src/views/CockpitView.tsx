import { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  Hand,
  ListChecks,
  Plus,
  Sparkles,
  Sprout,
} from 'lucide-react';
import type { ShellActions } from '../App';
import { useApp, useQueueStats } from '../state/AppContext';
import { pageVariants } from '../lib/motion';
import { Card, CardHeader, EmptyState, Metric, PageHeader, Row } from '../components/ui/Surfaces';
import { Button, LinkButton } from '../components/ui/Button';
import { Donut } from '../components/ui/Charts';
import { Avatar, PriorityBadge } from '../components/ui/Badges';
import { SlaPill } from '../components/domain/SlaPill';
import { STATUS_SLUG } from '../lib/healthScore';
import { compareBySla, slaStatus, useClock } from '../lib/sla';
import { populationDistribution, populationOf } from '../data/population';
import { int, percent } from '../lib/format';

/* ==========================================================================
   Cockpit
   --------------------------------------------------------------------------
   Two questions, in this order:

     1. "Como estamos?" — the whole institution, every student the score engine
        judges. Not the few dozen with an open dossier: the 8.600.
     2. "Quem precisa de mim agora?" — and here *me* is literal. The four
        numbers under the title are the attendant's own shift: their queue,
        their SLA, the unowned cases in their specialty, their closures today.
        A number nobody on this screen can act on does not belong on the screen
        they open first.

   Every number is a link, and every link lands on exactly the set it counted.
   A tile reading "3 vencendo o SLA" that opens a list of forty is worse than no
   tile at all, so the queue grew real working sets (`lib/router.ts`) instead of
   four buttons pointing at the same default tab.
   ========================================================================== */

export function CockpitView({ actions }: { actions: ShellActions }) {
  const { theme, currentUser, getStudent, modalityFilter, cohortFilter, settings } = useApp();
  const stats = useQueueStats();
  const now = useClock();
  const dark = theme === 'dark';

  /* -- Block 1: the whole base ------------------------------------------- */

  /**
   * Which population the donut describes. The 90-day rule decides it: while
   * onboarding is segregated, freshmen are on the welcome track and are not
   * being judged by the Health Score, so counting them here would inflate the
   * denominator of every percentage on screen. An explicit cohort filter in the
   * header always wins.
   */
  const scope = useMemo(
    () => ({
      modality: modalityFilter,
      cohort:
        cohortFilter !== 'Todos'
          ? cohortFilter
          : settings.segregateOnboarding
            ? ('Veterano' as const)
            : ('Todos' as const),
    }),
    [modalityFilter, cohortFilter, settings.segregateOnboarding],
  );

  const distribution = useMemo(() => populationDistribution(scope), [scope]);
  const evaluated = useMemo(() => populationOf(scope), [scope]);
  const onboarding = useMemo(
    () => populationOf({ modality: modalityFilter, cohort: 'Calouro' }),
    [modalityFilter],
  );

  const needAttention = distribution
    .filter((band) => band.status === 'Risco' || band.status === 'Crítico')
    .reduce((sum, band) => sum + band.count, 0);

  /* -- Block 2: my shift -------------------------------------------------- */

  /** My cases already inside the SLA warning band, or past it. */
  const myDueSoon = useMemo(
    () =>
      stats.mine.filter((c) => {
        const state = slaStatus(c, now).state;
        return state === 'warning' || state === 'breach';
      }).length,
    [stats.mine, now],
  );

  const solvedToday = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return stats.closed.filter(
      (c) =>
        c.assigneeId === currentUser.id &&
        c.closedAt &&
        new Date(c.closedAt).getTime() >= start.getTime(),
    ).length;
  }, [stats.closed, currentUser.id]);

  /* -- Block 3: the work I can actually pick up ---------------------------
     My open cases plus the unowned ones in my specialty — the two piles an
     attendant can act on right now. The rest of the team's load is one click
     away and does not belong in a list titled "precisam de mim". */
  const actionable = useMemo(
    () => [...stats.mine, ...stats.unownedMine].sort((a, b) => compareBySla(a, b, now)),
    [stats.mine, stats.unownedMine, now],
  );
  const priorityQueue = useMemo(() => actionable.slice(0, 6), [actionable]);

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
            {currentUser.specialty} · {scopeLabel}
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
              onClick={() => actions.goto('fila', 'minha-fila')}
            >
              Abrir fila ({stats.mineCount})
            </Button>
          </>
        }
      />

      {/* ---- My shift. No boxes: whitespace separates them. -------------- */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4 lg:gap-x-12">
        <Metric
          label="na minha fila"
          value={int(stats.mineCount)}
          onClick={() => actions.goto('fila', 'minha-fila')}
        />
        <Metric
          label="vencendo o meu SLA"
          value={int(myDueSoon)}
          tone={myDueSoon > 0 ? 'crit' : 'plain'}
          onClick={() => actions.goto('fila', 'vencendo-sla')}
        />
        <Metric
          label={`sem dono · ${currentUser.specialty}`}
          value={int(stats.unownedMineCount)}
          onClick={() => actions.goto('fila', 'sem-dono')}
        />
        <Metric
          label="resolvidos hoje"
          value={int(solvedToday)}
          onClick={() => actions.goto('fila', 'resolvidos-hoje')}
        />
      </div>

      {/* ---- The base + the queue ---------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Como está a base" />

          <div className="mt-5 flex flex-col items-center gap-5">
            <Donut
              segments={distribution.map((band) => ({
                key: band.status,
                label: band.label,
                value: band.count,
                color: band.hex(dark),
              }))}
              centerValue={evaluated}
              centerLabel="avaliados"
              onSegmentClick={(key) => {
                const band = distribution.find((b) => b.status === key);
                if (band) actions.goto('alunos', STATUS_SLUG[band.status]);
              }}
            />

            <div className="w-full min-w-0 space-y-1">
              {distribution.map((band) => (
                <button
                  key={band.status}
                  onClick={() => actions.goto('alunos', STATUS_SLUG[band.status])}
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

            {/* The verdict in one line, plus the track deliberately kept out
                of the chart above. */}
            <div className="w-full space-y-2 border-t border-hairline pt-4">
              <p className="px-1.5 text-[12.5px] leading-relaxed text-ink-2">
                <span className="font-mono font-medium text-ink">{int(needAttention)}</span> em risco
                ou crítico —{' '}
                <span className="font-mono">
                  {percent(evaluated > 0 ? (needAttention / evaluated) * 100 : 0, 1)}
                </span>{' '}
                da base avaliada.
              </p>
              <button
                onClick={() => actions.goto('onboarding')}
                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2"
              >
                <Sprout className="h-3.5 w-3.5 shrink-0 text-ink-4" />
                <span className="min-w-0 flex-1 text-[12px] text-ink-3">
                  <span className="font-mono font-medium text-ink-2">{int(onboarding)}</span>{' '}
                  calouros na trilha de 90 dias
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-4" />
              </button>
            </div>
          </div>
        </Card>

        <Card padded={false}>
          <div className="p-5 pb-4">
            <CardHeader
              title="Precisam de mim agora"
              subtitle={`Seus casos e os sem dono em ${currentUser.specialty}. SLA estourado primeiro, depois prioridade.`}
              action={
                <LinkButton
                  onClick={() => actions.goto('fila', 'minha-fila')}
                  iconRight={<ArrowRight className="h-3.5 w-3.5" />}
                >
                  Ver minha fila ({stats.mineCount})
                </LinkButton>
              }
            />
          </div>

          {priorityQueue.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="Nada esperando por você"
              message={`Sem casos seus em aberto e sem casos sem dono em ${currentUser.specialty}. A equipe tem ${int(stats.openCount)} protocolos abertos no escopo.`}
              action={
                stats.openCount > 0 ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => actions.goto('fila', 'equipe')}
                  >
                    Ver a fila da equipe ({int(stats.openCount)})
                  </Button>
                ) : undefined
              }
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

          {actionable.length > priorityQueue.length && (
            <div className="border-t border-hairline px-5 py-3">
              <LinkButton
                onClick={() => actions.goto('fila', 'minha-fila')}
                iconRight={<ArrowRight className="h-3.5 w-3.5" />}
              >
                Mais {int(actionable.length - priorityQueue.length)} na fila
              </LinkButton>
            </div>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
