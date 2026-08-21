import { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Hand,
  ListChecks,
  Plus,
  Sparkles,
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
import type { QueuePreset } from '../lib/router';
import { aggregate, bandSlices } from '../data/institution';
import { decimal, int } from '../lib/format';

/* ==========================================================================
   Cockpit — a tela do atendente
   --------------------------------------------------------------------------
   Uma pergunta, respondida sem rolar a página: **o que eu faço agora?**

   Foi por não respeitar isso que esta tela cresceu demais uma vez. Índices
   executivos, evolução por faixa, funil de jornada e taxa de estabilização são
   informações boas — e nenhuma delas muda o que o atendente vai fazer nos
   próximos dez minutos. Todas moraram aqui por um tempo e empurraram a fila
   para baixo da dobra, o que é o oposto do trabalho desta tela. Agora vivem no
   **Dashboard**, em Gestão, onde alguém entra justamente para analisar.

   O que sobrou tem uma regra: só entra o que é *meu* ou o que eu posso *pegar*.

     · Quatro números do meu turno. Nenhum deles é da instituição.
     · Duas pizzas: como está a base (contexto) e onde os meus casos estão
       parados (acionável).
     · A lista dos que precisam de mim, ordenada por SLA — o topo é sempre o
       caso que estoura primeiro.

   Sem barra de filtros: modalidade e coorte estão no header global, e período,
   curso e período acadêmico são perguntas de análise, não de turno.

   Sem azul preenchido em lugar nenhum aqui. Esta é a tela mais aberta do
   sistema, e o único azul que ela precisa é o do botão que leva para a fila.
   ========================================================================== */

export function CockpitView({ actions }: { actions: ShellActions }) {
  const {
    theme,
    currentUser,
    getStudent,
    modalityFilter,
    cohortFilter,
    settings,
    scopedCases,
  } = useApp();
  const stats = useQueueStats();
  const now = useClock();
  const dark = theme === 'dark';

  /* -- Pizza 1: a base, como contexto -------------------------------------
     A regra dos 90 dias decide a população: enquanto o onboarding é segregado,
     o calouro está numa trilha de boas-vindas e não é julgado pelo Health
     Score, então contá-lo aqui infla o denominador de toda porcentagem da tela.
     Um filtro de coorte explícito no header sempre vence. */
  const baseScope = useMemo(
    () => ({
      modality: modalityFilter,
      course: 'Todos' as const,
      period: 0,
      cohort:
        cohortFilter !== 'Todos'
          ? cohortFilter
          : settings.segregateOnboarding
            ? ('Veterano' as const)
            : ('Todos' as const),
    }),
    [modalityFilter, cohortFilter, settings.segregateOnboarding],
  );

  const base = useMemo(() => aggregate(baseScope), [baseScope]);
  const bands = useMemo(() => bandSlices(base), [base]);

  const needAttention = useMemo(
    () =>
      bands
        .filter((b) => b.status === 'Risco' || b.status === 'Crítico')
        .reduce((sum, b) => sum + b.count, 0),
    [bands],
  );

  /* -- Pizza 2: onde os meus casos estão parados --------------------------
     Conta os meus mais os sem dono da minha especialidade — as duas pilhas em
     que eu posso agir agora.

     A primeira versão repartia por RADAR, e era degenerada: os casos chegam
     roteados por especialidade, então uma pessoa de Retenção só recebe evasão e
     a pizza saía como um anel de uma fatia só. Repartir por SITUAÇÃO sempre tem
     dispersão e responde uma pergunta melhor — "quantos dos meus ainda não
     foram contatados, e quantos estão esperando o aluno responder?". */
  const actionable = useMemo(
    () => [...stats.mine, ...stats.unownedMine].sort((a, b) => compareBySla(a, b, now)),
    [stats.mine, stats.unownedMine, now],
  );

  const situationSlices = useMemo(() => {
    const buckets: {
      key: string;
      label: string;
      value: number;
      color: string;
      /** Para onde a fatia leva. */
      preset: QueuePreset;
    }[] = [
      {
        key: 'sem-dono',
        label: 'Sem dono, a pegar',
        value: actionable.filter((c) => c.assigneeId === null).length,
        // Âmbar: é a única fatia que pede uma decisão antes de qualquer contato.
        color: 'var(--warn)',
        preset: 'sem-dono',
      },
      {
        key: 'primeiro-contato',
        label: 'Aguardando 1º contato',
        value: actionable.filter((c) => c.assigneeId === currentUser.id && c.status === 'Pendente')
          .length,
        color: dark ? '#c3c9d1' : '#4b5563',
        preset: 'minha-fila',
      },
      {
        key: 'em-contato',
        label: 'Em contato',
        value: actionable.filter((c) => c.assigneeId === currentUser.id && c.status === 'Em Contato')
          .length,
        color: dark ? '#8b929c' : '#7b828e',
        preset: 'minha-fila',
      },
      {
        key: 'aguardando-aluno',
        label: 'Aguardando o aluno',
        value: actionable.filter(
          (c) => c.assigneeId === currentUser.id && c.status === 'Aguardando Retorno',
        ).length,
        color: dark ? '#626973' : '#a8aeb8',
        preset: 'minha-fila',
      },
      {
        key: 'encaminhado',
        label: 'Encaminhado',
        value: actionable.filter(
          (c) => c.assigneeId === currentUser.id && c.status === 'Encaminhado',
        ).length,
        color: dark ? '#4a505a' : '#c9ced6',
        preset: 'minha-fila',
      },
    ];
    return buckets.filter((b) => b.value > 0);
  }, [actionable, currentUser.id, dark]);

  /* -- Números do turno --------------------------------------------------- */

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

  /* Cinco linhas: o suficiente para saber o que vem, curto o bastante para a
     tela terminar acima da dobra num monitor comum. */
  const priorityQueue = useMemo(() => actionable.slice(0, 5), [actionable]);

  const firstName = currentUser.name.split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

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
      className="space-y-6"
    >
      <PageHeader
        eyebrow={
          <>
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-ink-4 text-ink-4" />
            {currentUser.specialty} · {scopeLabel}
          </>
        }
        title={`${greeting}, ${firstName}`}
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

      {/* ---- O meu turno. Sem caixas: o espaço separa. ------------------- */}
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

      {/* ---- Duas pizzas + a fila ---------------------------------------- */}
      <div className="grid gap-5 xl:grid-cols-[210px_210px_minmax(0,1fr)]">
        {/* Contexto: a instituição */}
        <Card className="flex flex-col">
          <CardHeader title="Como está a base" />
          <div className="mt-4 flex flex-1 flex-col items-center gap-3.5">
            <Donut
              segments={bands.map((band) => ({
                key: band.status,
                label: band.label,
                value: band.count,
                color: band.hex(dark),
              }))}
              size={124}
              thickness={15}
              centerValue={base.monitored}
              centerLabel="avaliados"
              centerScale="sm"
              onSegmentClick={(key) => {
                const band = bands.find((b) => b.status === key);
                if (band) actions.goto('alunos', STATUS_SLUG[band.status]);
              }}
            />
            <ul className="w-full min-w-0 space-y-px">
              {bands.map((band) => (
                <li key={band.status}>
                  <button
                    onClick={() => actions.goto('alunos', STATUS_SLUG[band.status])}
                    title={`Abrir a base filtrada em ${band.label}`}
                    className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-surface-2"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: band.hex(dark) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-ink-2">
                      {band.label}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-ink-4">
                      {decimal(band.percent, 1)}%
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="w-full border-t border-hairline px-1 pt-3 text-[11.5px] leading-relaxed text-ink-4">
              <span className="font-mono font-medium text-ink-2">{int(needAttention)}</span> em risco
              ou crítico na instituição.
            </p>
          </div>
        </Card>

        {/* Acionável: onde os meus estão */}
        <Card className="flex flex-col">
          <CardHeader title="Onde meus casos estão" />
          {situationSlices.length === 0 ? (
            <p className="flex flex-1 items-center justify-center px-2 py-8 text-center text-[12px] text-ink-4">
              Nada aberto no seu nome nem sem dono em {currentUser.specialty}.
            </p>
          ) : (
            <div className="mt-4 flex flex-1 flex-col items-center gap-3.5">
              <Donut
                segments={situationSlices}
                size={124}
                thickness={15}
                centerValue={actionable.length}
                centerLabel="casos"
                centerScale="sm"
                onSegmentClick={(key) => {
                  const slice = situationSlices.find((s) => s.key === key);
                  actions.goto('fila', slice?.preset ?? 'minha-fila');
                }}
              />
              <ul className="w-full min-w-0 space-y-px">
                {situationSlices.map((slice) => (
                  <li key={slice.key}>
                    <button
                      onClick={() => actions.goto('fila', slice.preset)}
                      title={`Abrir a fila em ${slice.label.toLowerCase()}`}
                      className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-surface-2"
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink-2">
                        {slice.label}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] font-medium text-ink">
                        {slice.value}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="w-full border-t border-hairline px-1 pt-3 text-[11.5px] leading-relaxed text-ink-4">
                <span className="font-mono font-medium text-ink-2">{int(stats.mineCount)}</span> meus
                e{' '}
                <span className="font-mono font-medium text-ink-2">
                  {int(stats.unownedMineCount)}
                </span>{' '}
                sem dono em {currentUser.specialty}.
              </p>
            </div>
          )}
        </Card>

        {/* A fila */}
        <Card padded={false} className="flex flex-col">
          <div className="p-5 pb-4">
            <CardHeader
              title="Precisam de mim agora"
              subtitle={`Seus casos e os sem dono em ${currentUser.specialty}. SLA estourado primeiro, depois prioridade.`}
              action={
                <LinkButton
                  onClick={() => actions.goto('fila', 'minha-fila')}
                  iconRight={<ArrowRight className="h-3.5 w-3.5" />}
                >
                  Ver a fila ({stats.mineCount})
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
              compact
            />
          ) : (
            <ul className="flex-1 divide-y divide-hairline border-t border-hairline">
              {priorityQueue.map((kase) => {
                const student = getStudent(kase.studentId);
                if (!student) return null;
                const sla = slaStatus(kase, now);
                const mine = kase.assigneeId === currentUser.id;

                return (
                  <li key={kase.id}>
                    <Row tone={sla.state === 'breach' ? 'crit' : 'plain'}>
                      <div className="flex items-center gap-4 px-5 py-3">
                        <button
                          onClick={() => actions.openCase(kase.id)}
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

                        {/* Quem decide o verbo é a posse, não o estágio: um caso
                            pendente que já tem dono não é meu para assumir. */}
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
          )}

          <div className="flex items-center justify-between gap-3 border-t border-hairline px-5 py-2.5">
            {actionable.length > priorityQueue.length ? (
              <LinkButton
                onClick={() => actions.goto('fila', 'minha-fila')}
                iconRight={<ArrowRight className="h-3.5 w-3.5" />}
              >
                Mais {int(actionable.length - priorityQueue.length)} na fila
              </LinkButton>
            ) : (
              <span className="text-[12px] text-ink-4">
                {int(scopedCases.length)} protocolos no escopo
              </span>
            )}
            <LinkButton
              onClick={() => actions.goto('dashboard')}
              icon={<BarChart3 className="h-3.5 w-3.5" />}
              iconRight={<ArrowRight className="h-3.5 w-3.5" />}
              title="Índices, evolução e resultado da operação"
            >
              Dashboard da operação
            </LinkButton>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
