import { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  Hand,
  HeartHandshake,
  ListChecks,
  Radar as RadarIcon,
  ShieldAlert,
  Sparkles,
  Timer,
  TrendingDown,
  Users,
} from 'lucide-react';
import type { RadarKey } from '../types';
import type { ShellActions } from '../App';
import { useApp, useQueueStats } from '../state/AppContext';
import { pageVariants, staggerContainer, staggerItem } from '../lib/motion';
import { Card, CardHeader, EmptyState, PageHeader, Row, SectionLabel, StatTile } from '../components/ui/Surfaces';
import { Button, LinkButton } from '../components/ui/Button';
import { AnimatedNumber, Donut, MeterBar } from '../components/ui/Charts';
import {
  Avatar,
  CohortBadge,
  HealthBadge,
  ModalityBadge,
  PriorityBadge,
  RadarBadge,
} from '../components/ui/Badges';
import { SlaPill } from '../components/domain/SlaPill';
import { scoreDistribution } from '../lib/healthScore';
import { RADARS, RADAR_ORDER, activeRadars } from '../lib/radars';
import { compareBySla, slaStatus, useClock } from '../lib/sla';
import { isOpen } from '../lib/caseFlow';
import { int, percent } from '../lib/format';

/* ==========================================================================
   Cockpit
   --------------------------------------------------------------------------
   Answers one question in the first screenful: "quem precisa de mim agora?"
   Everything below that answers the follow-ups — how is the base doing, which
   radar is firing, what is dragging scores down — in that order.

   Every number here is computed from the live base, so switching modality or
   cohort in the header changes all of them consistently.
   ========================================================================== */

export function CockpitView({ actions }: { actions: ShellActions }) {
  const {
    scopedStudents,
    scopedCases,
    students,
    theme,
    settings,
    currentUser,
    getStudent,
    modalityFilter,
    cohortFilter,
    followUps,
  } = useApp();
  const stats = useQueueStats();
  const now = useClock();
  const dark = theme === 'dark';

  /* -- Base health ------------------------------------------------------- */
  const distribution = useMemo(() => scoreDistribution(scopedStudents), [scopedStudents]);
  const atRisk = scopedStudents.filter((s) => s.status === 'Risco' || s.status === 'Crítico').length;
  const avgScore =
    scopedStudents.length > 0
      ? Math.round(scopedStudents.reduce((sum, s) => sum + s.healthScore, 0) / scopedStudents.length)
      : 0;
  const falling = scopedStudents.filter((s) => s.trend === 'down').length;

  /* -- Queue ------------------------------------------------------------- */
  const breached = stats.open.filter((c) => slaStatus(c, now).state === 'breach').length;
  const warning = stats.open.filter((c) => slaStatus(c, now).state === 'warning').length;

  const priorityQueue = useMemo(
    () => [...stats.open].sort((a, b) => compareBySla(a, b, now)).slice(0, 6),
    [stats.open, now],
  );

  /* -- Radar counts ------------------------------------------------------ */
  const radarCounts = useMemo(() => {
    const counts = new Map<RadarKey, { students: number; cases: number }>(
      RADAR_ORDER.map((k) => [k, { students: 0, cases: 0 }]),
    );
    for (const student of scopedStudents) {
      for (const key of activeRadars(student, { segregateOnboarding: settings.segregateOnboarding })) {
        const entry = counts.get(key);
        if (entry) entry.students += 1;
      }
    }
    for (const kase of scopedCases) {
      if (!isOpen(kase.status)) continue;
      const entry = counts.get(kase.radar);
      if (entry) entry.cases += 1;
    }
    return counts;
  }, [scopedStudents, scopedCases, settings.segregateOnboarding]);

  /* -- Drivers: which dimension is actually dragging the base down ------- */
  const drivers = useMemo(() => {
    const rows = [
      {
        label: 'Frequência abaixo do mínimo regimental',
        count: scopedStudents.filter((s) => s.academic.attendancePercent < 75).length,
      },
      {
        label: 'Inatividade no AVA por 7 dias ou mais',
        count: scopedStudents.filter((s) => s.engagement.lastAccessDaysAgo >= 7).length,
      },
      {
        label: 'Mensalidade em aberto',
        count: scopedStudents.filter((s) => s.financial.overdueCount > 0).length,
      },
      {
        label: 'Duas ou mais disciplinas abaixo de 5,0',
        count: scopedStudents.filter((s) => s.academic.failingSubjects >= 2).length,
      },
      {
        label: 'Consulta à página de trancamento',
        count: scopedStudents.filter((s) => s.engagement.visitedCancellationPage).length,
      },
      {
        label: 'Dependência acumulada',
        count: scopedStudents.filter((s) => s.academic.dependencies > 0).length,
      },
    ]
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);

    const max = rows[0]?.count ?? 1;
    return rows.map((r) => ({ ...r, ratio: r.count / max }));
  }, [scopedStudents]);

  /* -- My day ------------------------------------------------------------ */
  const myFollowUpsToday = useMemo(() => {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return followUps.filter(
      (f) =>
        f.status === 'Agendado' &&
        f.ownerId === currentUser.id &&
        new Date(f.dueDate).getTime() <= endOfToday.getTime(),
    );
  }, [followUps, currentUser.id]);

  const scopeLabel =
    modalityFilter === 'Todas' && cohortFilter === 'Todos'
      ? 'Base completa'
      : [modalityFilter !== 'Todas' ? modalityFilter : null, cohortFilter !== 'Todos' ? `${cohortFilter}s` : null]
          .filter(Boolean)
          .join(' · ');

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6"
    >
      <PageHeader
        eyebrow={
          <>
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-ok text-ok" />
            Operação ao vivo · {scopeLabel}
          </>
        }
        title="Quem precisa de mim agora"
        description="Os radares encontram o sinal, o sistema prioriza e o especialista decide. Este painel mostra a fila real, a saúde da base e o que está puxando os indicadores para baixo."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<RadarIcon className="h-3.5 w-3.5" />}
              onClick={() => actions.goto('radares')}
            >
              Radares
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

      {/* ---- The contrast band: the five numbers that define the shift ---- */}
      <Card tone="band" padded={false}>
        <div className="relative p-5">
          <CardHeader
            tone="band"
            eyebrow="Painel operacional do ciclo"
            title="Estado da operação"
            subtitle="Números calculados sobre o escopo ativo. Alterar modalidade ou coorte no topo recalcula tudo."
            action={
              <div className="hidden text-right sm:block">
                <p className="font-mono text-[10px] font-bold tracking-[0.1em] text-band-ink-2 uppercase">
                  Health Score médio
                </p>
                <p className="font-mono text-[28px] leading-none font-bold text-band-ink">
                  <AnimatedNumber value={avgScore} format={false} />
                  <span className="text-[15px] text-band-ink-3">/100</span>
                </p>
              </div>
            }
          />

          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="relative mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5"
          >
            {[
              {
                label: 'Alunos monitorados',
                value: <AnimatedNumber value={scopedStudents.length} />,
                detail: `de ${int(students.length)}`,
                icon: <Users className="h-4 w-4" />,
                footer: (
                  <>
                    <span>{stats.onboarding} em onboarding</span>
                    <span className="font-mono font-bold">{percent((atRisk / Math.max(1, scopedStudents.length)) * 100)} em risco</span>
                  </>
                ),
                onClick: () => actions.goto('alunos'),
              },
              {
                label: 'Casos abertos',
                value: <AnimatedNumber value={stats.openCount} format={false} />,
                detail: `${stats.critical} críticos`,
                icon: <ListChecks className="h-4 w-4" />,
                footer: (
                  <>
                    <span>{stats.mineCount} na sua fila</span>
                    <span className="font-mono font-bold">{stats.unassigned} sem dono</span>
                  </>
                ),
                onClick: () => actions.goto('fila'),
              },
              {
                label: 'SLA estourado',
                value: <AnimatedNumber value={breached} format={false} />,
                detail: breached > 0 ? 'exige ação' : 'nenhum',
                icon: <Timer className="h-4 w-4" />,
                footer: (
                  <>
                    <span>{warning} próximos do prazo</span>
                    <span className="font-mono font-bold">
                      {percent(((stats.openCount - breached) / Math.max(1, stats.openCount)) * 100)} no prazo
                    </span>
                  </>
                ),
                onClick: () => actions.goto('fila'),
              },
              {
                label: 'Alunos retidos',
                value: <AnimatedNumber value={stats.retained} format={false} />,
                detail: 'no ciclo',
                icon: <HeartHandshake className="h-4 w-4" />,
                footer: (
                  <>
                    <span>{stats.lost} saídas registradas</span>
                    <span className="font-mono font-bold">
                      {percent((stats.retained / Math.max(1, stats.retained + stats.lost)) * 100)} reversão
                    </span>
                  </>
                ),
                onClick: () => actions.goto('indicadores'),
              },
              {
                label: 'Em queda de score',
                value: <AnimatedNumber value={falling} format={false} />,
                detail: 'tendência',
                icon: <TrendingDown className="h-4 w-4" />,
                footer: (
                  <>
                    <span>Monitorar antes de virar caso</span>
                    <ArrowRight className="h-3 w-3" />
                  </>
                ),
                onClick: () => actions.goto('alunos'),
              },
            ].map((tile) => (
              <motion.div key={tile.label} variants={staggerItem}>
                <StatTile
                  tone="band"
                  label={tile.label}
                  value={tile.value}
                  detail={tile.detail}
                  icon={tile.icon}
                  footer={tile.footer}
                  onClick={tile.onClick}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Card>

      {/* ---- Priority queue ---------------------------------------------- */}
      <Card padded={false}>
        <div className="p-5 pb-4">
          <CardHeader
            eyebrow={
              <span className="flex items-center gap-1.5">
                <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-crit text-crit" />
                Fila priorizada · SLA estourado primeiro
              </span>
            }
            title="Casos que exigem ação agora"
            subtitle="Ordenados por SLA em horas úteis, depois por prioridade. Assuma ou abra o dossiê direto daqui."
            action={
              <LinkButton
                onClick={() => actions.goto('fila')}
                iconRight={<ArrowRight className="h-3.5 w-3.5" />}
              >
                Ver todos os {stats.openCount}
              </LinkButton>
            }
          />
        </div>

        {priorityQueue.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-5 w-5 text-ok" />}
            title="Nenhum caso aberto no escopo"
            message="Todos os protocolos deste recorte estão encerrados. Ajuste os filtros no topo para ver outro segmento da base."
          />
        ) : (
          <div className="divide-y divide-hairline border-t border-hairline">
            {priorityQueue.map((kase) => {
              const student = getStudent(kase.studentId);
              if (!student) return null;
              const sla = slaStatus(kase, now);
              const mine = kase.assigneeId === currentUser.id;

              return (
                <Row key={kase.id} tone={sla.state === 'breach' ? 'crit' : 'plain'}>
                  <div className="flex flex-col gap-3 p-4 pl-5 lg:flex-row lg:items-center">
                    {/* Identity */}
                    <button
                      onClick={() => actions.openStudent(student.id)}
                      className="group flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <Avatar initials={student.initials} size="md" tone={student.status} />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-[13.5px] font-bold text-ink group-hover:underline">
                            {student.name}
                          </span>
                          <PriorityBadge priority={kase.priority} solid={kase.priority === 'Crítico'} />
                          <RadarBadge radar={kase.radar} />
                          <ModalityBadge modality={student.modality} />
                          {student.cohort === 'Calouro' && (
                            <CohortBadge cohort="Calouro" days={student.journey.daysSinceEnrollment} />
                          )}
                        </span>
                        <span className="mt-1 block truncate text-[12px] text-ink-3">
                          {kase.title}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[10.5px] text-ink-4">
                          {kase.protocol} · RA {student.ra} · {student.course} · {student.period}º período
                        </span>
                      </span>
                    </button>

                    {/* Metrics */}
                    <div className="flex shrink-0 items-center gap-5 border-t border-hairline pt-3 lg:border-t-0 lg:pt-0">
                      <div className="w-16">
                        <p className="font-mono text-[9.5px] font-bold tracking-[0.08em] text-ink-4 uppercase">
                          Score
                        </p>
                        <p className="mt-0.5 font-mono text-[15px] leading-none font-bold text-ink">
                          {student.healthScore}
                        </p>
                        <div className="mt-1.5">
                          <HealthBadge status={student.status} />
                        </div>
                      </div>

                      <div className="w-24">
                        <p className="font-mono text-[9.5px] font-bold tracking-[0.08em] text-ink-4 uppercase">
                          SLA
                        </p>
                        <div className="mt-0.5">
                          <SlaPill kase={kase} showBar />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
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
                            iconRight={<ArrowRight className="h-3.5 w-3.5" />}
                            onClick={() => actions.openCase(kase.id)}
                          >
                            {mine ? 'Continuar' : 'Abrir caso'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Row>
              );
            })}
          </div>
        )}
      </Card>

      {/* ---- Distribution + drivers -------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            eyebrow="Saúde da base"
            title="Distribuição do Health Score"
            subtitle="Clique em uma faixa para abrir a base filtrada por aquela classificação."
          />

          <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
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

            <div className="w-full min-w-0 flex-1 space-y-2.5">
              {distribution.map((band) => (
                <button
                  key={band.status}
                  onClick={() => actions.goto('alunos')}
                  className="group flex w-full items-center gap-3 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-surface-2"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: band.hex(dark) }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold text-ink">
                      {band.label}
                    </span>
                    <span className="block font-mono text-[10px] text-ink-4">
                      {band.range[0]}–{band.range[1]} pontos
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-[13px] font-bold text-ink">
                      {int(band.count)}
                    </span>
                    <span className="block font-mono text-[10px] text-ink-4">
                      {percent(band.percent, 1)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Causas primárias"
            title="O que está puxando os scores para baixo"
            subtitle="Contagem de alunos por sinal ativo no escopo. É aqui que se decide qual radar merece ajuste."
          />

          <div className="mt-5 space-y-3.5">
            {drivers.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-ink-4">
                Nenhum sinal de risco ativo neste recorte.
              </p>
            ) : (
              drivers.map((driver, i) => (
                <div key={driver.label} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[12px] font-medium text-ink-2">{driver.label}</span>
                    <span className="shrink-0 font-mono text-[12px] font-bold text-ink">
                      {driver.count}
                      <span className="ml-1 font-normal text-ink-4">
                        {percent((driver.count / Math.max(1, scopedStudents.length)) * 100)}
                      </span>
                    </span>
                  </div>
                  <MeterBar
                    value={driver.ratio * 100}
                    color={i === 0 ? 'var(--crit)' : i === 1 ? 'var(--risk)' : i === 2 ? 'var(--warn)' : 'var(--brand-2)'}
                    delay={i * 0.05}
                  />
                </div>
              ))
            )}
          </div>

          <div className="mt-5 border-t border-hairline pt-4">
            <LinkButton
              onClick={() => actions.goto('indicadores')}
              iconRight={<ArrowRight className="h-3.5 w-3.5" />}
            >
              Ver mapa de risco por curso e campus
            </LinkButton>
          </div>
        </Card>
      </div>

      {/* ---- Radar matrix ------------------------------------------------ */}
      <div className="space-y-3">
        <SectionLabel
          action={
            <LinkButton
              onClick={() => actions.goto('radares')}
              iconRight={<ArrowRight className="h-3.5 w-3.5" />}
            >
              Abrir matriz completa
            </LinkButton>
          }
        >
          Os cinco radares · alunos com sinal ativo
        </SectionLabel>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {RADAR_ORDER.map((key) => {
            const radar = RADARS[key];
            const counts = radarCounts.get(key) ?? { students: 0, cases: 0 };
            const excluded = key === 'evasao' && settings.segregateOnboarding;

            return (
              <motion.button
                key={key}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.15 }}
                onClick={() => actions.goto('radares', key)}
                className="group flex flex-col justify-between gap-3 rounded-xl border border-hairline bg-surface p-4 text-left transition-colors hover:border-brand"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-surface-2 text-ink-3 transition-colors group-hover:border-brand-border group-hover:bg-brand-soft group-hover:text-brand-text">
                      <RadarIcon className="h-4 w-4" />
                    </span>
                    <span className="font-mono text-[10px] font-bold text-ink-4">
                      SLA {settings.slaHours[key]}h
                    </span>
                  </div>
                  <p className="mt-3 text-[12.5px] leading-snug font-bold text-ink">{radar.label}</p>
                </div>

                <div className="space-y-2 border-t border-hairline pt-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[9.5px] font-bold tracking-[0.08em] text-ink-4 uppercase">
                      Alunos
                    </span>
                    <span
                      className={[
                        'font-mono text-[17px] leading-none font-bold',
                        counts.students === 0 ? 'text-ink-4' : counts.students > 6 ? 'text-crit-ink' : 'text-ink',
                      ].join(' ')}
                    >
                      {counts.students}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[9.5px] font-bold tracking-[0.08em] text-ink-4 uppercase">
                      Casos
                    </span>
                    <span className="font-mono text-[12px] font-bold text-ink-3">{counts.cases}</span>
                  </div>
                  {excluded && (
                    <p className="text-[10px] leading-snug text-ink-4">Calouros excluídos pela regra de 90 dias</p>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ---- My day ------------------------------------------------------ */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader
            eyebrow={`Sua fila · ${currentUser.name}`}
            title="Meus casos em andamento"
            subtitle={`${stats.mineCount} casos atribuídos, ${stats.minePending} ainda sem primeiro contato.`}
            action={
              <LinkButton onClick={() => actions.goto('fila')} iconRight={<ArrowRight className="h-3.5 w-3.5" />}>
                Abrir minha fila
              </LinkButton>
            }
          />

          {stats.mine.length === 0 ? (
            <EmptyState
              compact
              icon={<CheckCircle2 className="h-5 w-5 text-ok" />}
              title="Sua fila está limpa"
              message="Nenhum caso atribuído a você neste escopo."
              action={
                stats.unassigned > 0 ? (
                  <Button size="sm" variant="secondary" onClick={() => actions.goto('fila')}>
                    Ver {stats.unassigned} casos sem dono
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="mt-4 divide-y divide-hairline">
              {stats.mine.slice(0, 5).map((kase) => {
                const student = getStudent(kase.studentId);
                if (!student) return null;
                return (
                  <li key={kase.id}>
                    <button
                      onClick={() => actions.openCase(kase.id)}
                      className="group flex w-full items-center gap-3 py-3 text-left"
                    >
                      <Avatar initials={student.initials} size="sm" tone={student.status} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold text-ink group-hover:underline">
                          {student.name}
                        </span>
                        <span className="block truncate text-[11.5px] text-ink-3">{kase.title}</span>
                      </span>
                      <SlaPill kase={kase} size="xs" />
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            eyebrow="Agenda"
            title="Acompanhamentos vencendo"
            subtitle="Follow-ups que você agendou e que precisam de verificação hoje."
          />

          {myFollowUpsToday.length === 0 ? (
            <EmptyState
              compact
              icon={<Timer className="h-5 w-5" />}
              title="Nada vencendo hoje"
              message="Seus acompanhamentos estão em dia."
            />
          ) : (
            <ul className="mt-4 space-y-2.5">
              {myFollowUpsToday.slice(0, 5).map((f) => {
                const student = getStudent(f.studentId);
                return (
                  <li key={f.id}>
                    <button
                      onClick={() =>
                        f.caseId ? actions.openCase(f.caseId) : actions.openStudent(f.studentId)
                      }
                      className="group w-full rounded-lg border border-hairline bg-surface-2 p-3 text-left transition-colors hover:border-ink-4"
                    >
                      <span className="flex items-start gap-2">
                        <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0 text-warn" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] leading-snug font-semibold text-ink">
                            {f.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-ink-3">
                            {student?.name ?? 'Aluno'}
                          </span>
                        </span>
                      </span>
                    </button>
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
