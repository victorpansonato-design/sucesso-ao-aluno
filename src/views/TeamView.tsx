import { useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Mail, ShieldCheck, Star, Timer, Users2 } from 'lucide-react';
import type { ShellActions } from '../App';
import { useApp } from '../state/AppContext';
import { pageVariants } from '../lib/motion';
import { Callout, Card, CardHeader, PageHeader, SectionLabel, StatTile } from '../components/ui/Surfaces';
import { Button } from '../components/ui/Button';
import { MeterBar } from '../components/ui/Charts';
import { Avatar, ModalityBadge, Pill, PriorityBadge } from '../components/ui/Badges';
import { SlaPill } from '../components/domain/SlaPill';
import { isOpen, isTerminal } from '../lib/caseFlow';
import { compareBySla, slaStatus, useClock } from '../lib/sla';
import { decimal, percent } from '../lib/format';

/* ==========================================================================
   Equipe
   --------------------------------------------------------------------------
   The matrix structure from the plan: depth by modality, specialisation by
   intervention type. Load is computed from live case assignments rather than a
   stored counter, so it can never drift from reality — and a saturated
   specialist is visible before their SLA starts slipping.
   ========================================================================== */

export function TeamView({ actions }: { actions: ShellActions }) {
  const { specialists, cases, getStudent, currentUser } = useApp();
  const now = useClock();

  const rows = useMemo(
    () =>
      specialists
        .map((spec) => {
          const assigned = cases.filter((c) => c.assigneeId === spec.id);
          const openCases = assigned.filter((c) => isOpen(c.status));
          const breached = openCases.filter((c) => slaStatus(c, now).state === 'breach').length;
          const critical = openCases.filter((c) => c.priority === 'Crítico').length;
          const retained = assigned.filter((c) => c.status === 'Acordo Firmado').length;
          const lost = assigned.filter((c) => c.status === 'Evasão Inevitável').length;
          const load = spec.capacity > 0 ? openCases.length / spec.capacity : 0;
          return { spec, assigned, openCases, breached, critical, retained, lost, load };
        })
        .sort((a, b) => b.load - a.load),
    [specialists, cases, now],
  );

  const unassigned = cases.filter((c) => c.assigneeId === null && isOpen(c.status));
  const totalOpen = cases.filter((c) => isOpen(c.status)).length;
  const totalCapacity = specialists.reduce((sum, s) => sum + s.capacity, 0);
  const teamLoad = totalCapacity > 0 ? (totalOpen / totalCapacity) * 100 : 0;
  const avgSla =
    specialists.length > 0
      ? specialists.reduce((sum, s) => sum + s.slaAdherence, 0) / specialists.length
      : 0;
  const avgCsat =
    specialists.length > 0 ? specialists.reduce((sum, s) => sum + s.csat, 0) / specialists.length : 0;

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Estrutura matricial"
        title="Equipe de especialistas"
        description="Conhecimento profundo por modalidade e especialização por tipo de intervenção. O sistema decide a fila e o responsável — o atendente não precisa descobrir manualmente para onde cada caso vai."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Especialistas ativos"
          value={specialists.length}
          icon={<Users2 className="h-3.5 w-3.5" />}
          footer={<span>capacidade total de {totalCapacity} casos</span>}
        />
        <StatTile
          label="Ocupação da equipe"
          value={percent(teamLoad)}
          accent={teamLoad >= 85 ? 'var(--crit)' : teamLoad >= 65 ? 'var(--warn)' : 'var(--ok)'}
          footer={
            <span>
              {totalOpen} casos abertos de {totalCapacity} vagas
            </span>
          }
        />
        <StatTile
          label="Aderência média ao SLA"
          value={percent(avgSla, 1)}
          icon={<Timer className="h-3.5 w-3.5" />}
          footer={<span>meta institucional: 95%</span>}
        />
        <StatTile
          label="CSAT no acolhimento"
          value={decimal(avgCsat, 1)}
          detail="/ 5,0"
          icon={<Star className="h-3.5 w-3.5" />}
          footer={<span>média das avaliações do ciclo</span>}
        />
      </div>

      {unassigned.length > 0 && (
        <Callout tone="crit" title={`${unassigned.length} caso(s) aberto(s) sem responsável`}>
          Enquanto um caso não tem dono, o SLA corre e nenhum aluno é contatado. Distribua antes de
          qualquer outra coisa no turno.
          <div className="mt-2.5 flex flex-wrap gap-2">
            {unassigned
              .sort((a, b) => compareBySla(a, b, now))
              .slice(0, 4)
              .map((kase) => {
                const student = getStudent(kase.studentId);
                return (
                  <button
                    key={kase.id}
                    onClick={() => actions.openCase(kase.id)}
                    className="inline-flex items-center gap-2 rounded-md bg-surface px-2.5 py-1.5 transition-colors"
                  >
                    <PriorityBadge priority={kase.priority} />
                    <span className="text-[11.5px] font-semibold text-ink">
                      {student?.name ?? 'Aluno'}
                    </span>
                    <SlaPill kase={kase} size="xs" />
                  </button>
                );
              })}
            {unassigned.length > 4 && (
              <button
                onClick={() => actions.goto('fila')}
                className="inline-flex items-center gap-1 px-2 text-[11.5px] font-semibold text-brand-text hover:text-brand-2"
              >
                +{unassigned.length - 4} na fila
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </Callout>
      )}

      {/* ---- Specialist cards -------------------------------------------- */}
      <div className="space-y-3">
        <SectionLabel>Distribuição por especialista</SectionLabel>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ spec, assigned, openCases, breached, critical, retained, lost, load }) => {
            const isMe = spec.id === currentUser.id;
            const saturated = load >= 0.85;

            return (
              <Card key={spec.id} tone={isMe ? 'band' : 'plain'} padded={false}>
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <Avatar initials={spec.initials} size="md" tone={isMe ? 'brand' : 'neutral'} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-[13px] font-semibold text-ink">{spec.name}</span>
                        {isMe && (
                          <Pill tone="info" solid dot={false}>
                            você
                          </Pill>
                        )}
                        <span
                          className={[
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            spec.presence === 'Disponível'
                              ? 'bg-ok'
                              : spec.presence === 'Em atendimento'
                                ? 'bg-warn'
                                : 'bg-ink-4',
                          ].join(' ')}
                          title={spec.presence}
                        />
                      </div>
                      <p className="mt-0.5 text-[11.5px] leading-snug text-ink-3">{spec.role}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Pill dot={false}>{spec.specialty}</Pill>
                        {spec.modality === 'Todas' ? (
                          <Pill dot={false} mono>
                            Todas as modalidades
                          </Pill>
                        ) : (
                          <ModalityBadge modality={spec.modality} />
                        )}
                      </div>
                      <a
                        href={`mailto:${spec.email}`}
                        className="mt-2 inline-flex items-center gap-1.5 truncate font-mono text-[10.5px] text-brand-text hover:text-brand-2"
                      >
                        <Mail className="h-3 w-3" />
                        {spec.email}
                      </a>
                    </div>
                  </div>

                  {/* Load */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] font-medium text-ink-4">
                        Carga operacional
                      </span>
                      <span
                        className={[
                          'font-mono text-[12px] font-semibold',
                          saturated ? 'text-crit-ink' : 'text-ink',
                        ].join(' ')}
                      >
                        {openCases.length}
                        <span className="font-normal text-ink-4">/{spec.capacity}</span>
                        <span className="ml-1.5 text-ink-3">{percent(load * 100)}</span>
                      </span>
                    </div>
                    <MeterBar
                      value={load * 100}
                      color={saturated ? 'var(--crit)' : load >= 0.6 ? 'var(--warn)' : 'var(--ok)'}
                      height={6}
                    />
                    {saturated && (
                      <p className="text-[10.5px] font-semibold text-crit-ink">
                        Acima de 85% da capacidade — evitar novos encaminhamentos.
                      </p>
                    )}
                  </div>

                  {/* Metrics */}
                  <div className="mt-4 grid grid-cols-4 gap-3 border-t border-hairline pt-3.5">
                    {[
                      { label: 'Críticos', value: critical, tone: critical > 0 ? 'text-crit-ink' : 'text-ink' },
                      { label: 'SLA fora', value: breached, tone: breached > 0 ? 'text-crit-ink' : 'text-ink' },
                      { label: 'Retidos', value: retained, tone: 'text-ok-ink' },
                      { label: 'Saídas', value: lost, tone: lost > 0 ? 'text-risk-ink' : 'text-ink-3' },
                    ].map((m) => (
                      <div key={m.label}>
                        <p className="text-[11px] font-medium text-ink-4">
                          {m.label}
                        </p>
                        <p className={`mt-0.5 font-mono text-[15px] font-semibold ${m.tone}`}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3.5 grid grid-cols-3 gap-3 border-t border-hairline pt-3.5">
                    {[
                      { label: 'Aderência SLA', value: percent(spec.slaAdherence, 1) },
                      { label: '1º contato', value: `${decimal(spec.avgResponseHours, 1)} h` },
                      { label: 'CSAT', value: decimal(spec.csat, 1) },
                    ].map((m) => (
                      <div key={m.label}>
                        <p className="text-[11px] font-medium text-ink-4">
                          {m.label}
                        </p>
                        <p className="mt-0.5 font-mono text-[12px] font-semibold text-ink">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-hairline bg-surface-2 p-3.5">
                  <Button
                    full
                    size="sm"
                    variant="secondary"
                    iconRight={<ArrowRight className="h-3.5 w-3.5" />}
                    onClick={() => {
                      const next =
                        [...openCases].sort((a, b) => compareBySla(a, b, now))[0] ?? assigned[0];
                      if (next) actions.openCase(next.id);
                      else actions.goto('fila');
                    }}
                  >
                    {openCases.length > 0
                      ? `Abrir caso mais crítico (${openCases.length} ativos)`
                      : `Ver histórico (${assigned.filter((c) => isTerminal(c.status)).length} encerrados)`}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ---- Queues ------------------------------------------------------ */}
      <Card>
        <CardHeader
          eyebrow="Filas operacionais"
          title="Como o roteamento funciona"
          subtitle="O radar que detecta o sinal determina a especialidade e, por consequência, o especialista de referência."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              queue: 'Retenção / Críticos',
              radar: 'Radar de Evasão',
              detail: 'Intenção de saída, trancamento, cancelamento e casos com múltiplos sinais.',
            },
            {
              queue: 'Sucesso Acadêmico',
              radar: 'Radar Acadêmico',
              detail: 'Notas, faltas, dependências e risco de reprovação por frequência.',
            },
            {
              queue: 'Engajamento',
              radar: 'Radar de Engajamento AVA',
              detail: 'Ritmo de estudo digital entre encontros presenciais.',
            },
            {
              queue: 'Financeiro',
              radar: 'Radar Financeiro Preventivo',
              detail: 'Primeiro atraso, recorrência e negociações autorizadas.',
            },
            {
              queue: 'Experiência',
              radar: 'Radar de Experiência',
              detail: 'Reclamação, reincidência e protocolo sem resposta.',
            },
            {
              queue: 'Onboarding',
              radar: 'Régua de 90 dias',
              detail: 'Entrada, primeiros acessos e adaptação nos primeiros 30/60/90 dias.',
            },
          ].map((q) => (
            <div key={q.queue} className="rounded-lg bg-surface-2 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[12.5px] font-semibold text-ink">{q.queue}</p>
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-ink-4" />
              </div>
              <p className="mt-1 text-[11px] font-medium text-brand-text">
                {q.radar}
              </p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3">{q.detail}</p>
            </div>
          ))}
        </div>

        <Callout tone="info" title="Especialização não exige departamento">
          No início, essas especializações podem ser papéis acumulados dentro da mesma equipe. Conforme o
          volume e os resultados crescerem, a estrutura se torna mais dedicada — a arquitetura do sistema
          já suporta ambos os arranjos.
        </Callout>
      </Card>
    </motion.div>
  );
}
