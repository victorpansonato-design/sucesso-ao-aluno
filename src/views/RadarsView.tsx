import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Plus,
  Radar as RadarIcon,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';
import type { RadarKey } from '../types';
import type { ShellActions } from '../App';
import { useApp } from '../state/AppContext';
import { pageVariants } from '../lib/motion';
import {
  Callout,
  Card,
  CardHeader,
  DataList,
  EmptyState,
  PageHeader,
  Row,
  SectionLabel,
} from '../components/ui/Surfaces';
import { Button, LinkButton } from '../components/ui/Button';
import { Segmented } from '../components/ui/Fields';
import { MeterBar } from '../components/ui/Charts';
import {
  Avatar,
  CaseStatusBadge,
  CohortBadge,
  HealthBadge,
  ModalityBadge,
  Pill,
  PriorityBadge,
} from '../components/ui/Badges';
import { SlaPill } from '../components/domain/SlaPill';
import { RADARS, RADAR_ORDER, activeRadars, radarEvidence } from '../lib/radars';
import { isOpen } from '../lib/caseFlow';
import { compareBySla, useClock } from '../lib/sla';
import { percent } from '../lib/format';

/* ==========================================================================
   Radares
   --------------------------------------------------------------------------
   Each radar is presented as what it actually is: a rule with a purpose, a set
   of triggers, an SLA, a guidance for the human, and a measured precision.
   Precision comes from real verdicts recorded by the team (confirmado vs.
   descartado) — which is the feedback loop that lets a coordinator justify
   tightening or loosening a trigger in Governança.
   ========================================================================== */

export function RadarsView({
  actions,
  radarParam,
}: {
  actions: ShellActions;
  radarParam: string | null;
}) {
  const { scopedStudents, scopedCases, getStudent, settings, students } = useApp();
  const now = useClock();

  const initial = RADAR_ORDER.includes(radarParam as RadarKey) ? (radarParam as RadarKey) : 'evasao';
  const [active, setActive] = useState<RadarKey>(initial);

  useEffect(() => {
    if (RADAR_ORDER.includes(radarParam as RadarKey)) setActive(radarParam as RadarKey);
  }, [radarParam]);

  const radar = RADARS[active];

  /* Students the radar is currently firing on, with their evidence. */
  const flagged = useMemo(
    () =>
      scopedStudents
        .map((s) => ({ student: s, evidence: radarEvidence(s, active) }))
        .filter((row) => {
          if (row.evidence.length === 0) return false;
          if (!radar.appliesTo.includes(row.student.modality)) return false;
          if (active === 'evasao' && settings.segregateOnboarding && row.student.cohort === 'Calouro')
            return false;
          return true;
        })
        .sort((a, b) => a.student.healthScore - b.student.healthScore),
    [scopedStudents, active, radar.appliesTo, settings.segregateOnboarding],
  );

  const radarCases = useMemo(
    () => scopedCases.filter((c) => c.radar === active).sort((a, b) => compareBySla(a, b, now)),
    [scopedCases, active, now],
  );

  /* Precision measured from human verdicts across the whole base. */
  const precision = useMemo(() => {
    const alerts = students.flatMap((s) => s.alerts.filter((a) => a.radar === active));
    const confirmed = alerts.filter((a) => a.review === 'confirmado').length;
    const dismissed = alerts.filter((a) => a.review === 'descartado').length;
    const pending = alerts.filter((a) => a.review === 'pendente').length;
    const judged = confirmed + dismissed;
    return {
      total: alerts.length,
      confirmed,
      dismissed,
      pending,
      rate: judged > 0 ? (confirmed / judged) * 100 : null,
    };
  }, [students, active]);

  const counts = useMemo(() => {
    const map = new Map<RadarKey, number>();
    for (const key of RADAR_ORDER) map.set(key, 0);
    for (const s of scopedStudents) {
      for (const key of activeRadars(s, { segregateOnboarding: settings.segregateOnboarding })) {
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return map;
  }, [scopedStudents, settings.segregateOnboarding]);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Camada de detecção"
        title="Os cinco radares"
        description="Um radar não existe para gerar alerta; existe para mudar um comportamento ou evitar um problema. Cada matriz abaixo declara qual, com que gatilho, em quanto tempo e com que precisão medida."
      >
        <div className="overflow-x-auto pb-1">
          <Segmented<RadarKey>
            layoutId="radar-tabs"
            value={active}
            onChange={(v) => {
              setActive(v);
              actions.goto('radares', v);
            }}
            options={RADAR_ORDER.map((key) => ({
              value: key,
              label: RADARS[key].shortLabel,
              count: counts.get(key) ?? 0,
            }))}
          />
        </div>
      </PageHeader>

      {/* ---- Radar definition -------------------------------------------- */}
      <Card tone="band" padded={false}>
        <div className="relative p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 max-w-2xl">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-band-line bg-band-inset text-band-ink">
                  <RadarIcon className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="font-mono text-[10px] font-bold tracking-[0.1em] text-band-ink-2 uppercase">
                    SLA {settings.slaHours[active]} horas úteis · especialidade {radar.specialty}
                  </p>
                  <h2 className="text-[19px] leading-tight font-bold text-band-ink">{radar.label}</h2>
                </div>
              </div>

              <p className="mt-3 text-[13px] leading-relaxed text-band-ink-2">{radar.purpose}</p>
            </div>

            <div className="flex shrink-0 gap-6">
              <div className="text-right">
                <p className="font-mono text-[10px] font-bold tracking-[0.1em] text-band-ink-2 uppercase">
                  Alunos com sinal
                </p>
                <p className="font-mono text-[30px] leading-none font-bold text-band-ink">
                  {flagged.length}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] font-bold tracking-[0.1em] text-band-ink-2 uppercase">
                  Casos abertos
                </p>
                <p className="font-mono text-[30px] leading-none font-bold text-band-ink">
                  {radarCases.filter((c) => isOpen(c.status)).length}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] font-bold tracking-[0.1em] text-band-ink-2 uppercase">
                  Precisão
                </p>
                <p className="font-mono text-[30px] leading-none font-bold text-band-ink">
                  {precision.rate === null ? '—' : `${Math.round(precision.rate)}%`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader eyebrow="Regra de detecção" title="Gatilhos que acionam" />
          <ul className="mt-4 space-y-2.5">
            {radar.triggers.map((t) => (
              <li key={t} className="flex gap-2.5">
                <Target className="mt-px h-3.5 w-3.5 shrink-0 text-brand-2" />
                <span className="text-[12px] leading-relaxed text-ink-2">{t}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader eyebrow="Quando o humano entra" title="Diretriz de ação" />
          <p className="mt-4 text-[12.5px] leading-relaxed text-ink-2">{radar.guidance}</p>
          <div className="mt-4 border-t border-hairline pt-4">
            <DataList
              columns={2}
              items={[
                { label: 'SLA inicial', value: `${settings.slaHours[active]} h úteis` },
                { label: 'Prioridade padrão', value: radar.defaultPriority },
                { label: 'Especialidade', value: radar.specialty },
                {
                  label: 'Modalidades',
                  value: radar.appliesTo.map((m) => (m === 'EaD' ? 'EaD' : m)).join(', '),
                },
              ]}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Aprendizado do radar"
            title="Precisão medida"
            subtitle="Vem dos veredictos que a equipe registra em cada alerta."
          />

          <div className="mt-4 space-y-3">
            {precision.total === 0 ? (
              <p className="text-[12px] text-ink-4">
                Nenhum alerta deste radar foi registrado na base de demonstração ainda.
              </p>
            ) : (
              <>
                {[
                  { label: 'Confirmados', value: precision.confirmed, color: 'var(--ok)', Icon: CheckCircle2 },
                  { label: 'Descartados', value: precision.dismissed, color: 'var(--crit)', Icon: XCircle },
                  { label: 'Aguardando verdicto', value: precision.pending, color: 'var(--warn)', Icon: Clock },
                ].map((row) => (
                  <div key={row.label} className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
                        <row.Icon className="h-3.5 w-3.5" style={{ color: row.color }} />
                        {row.label}
                      </span>
                      <span className="font-mono text-[12px] font-bold text-ink">{row.value}</span>
                    </div>
                    <MeterBar value={row.value} max={precision.total} color={row.color} height={4} />
                  </div>
                ))}

                {precision.rate !== null && (
                  <Callout tone={precision.rate >= 70 ? 'ok' : 'warn'}>
                    {precision.rate >= 70
                      ? `${Math.round(precision.rate)}% dos alertas julgados foram confirmados — o gatilho está calibrado.`
                      : `Apenas ${Math.round(precision.rate)}% dos alertas julgados foram confirmados. Vale revisar o gatilho em Governança.`}
                  </Callout>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {active === 'evasao' && settings.segregateOnboarding && (
        <Callout tone="info" title="Regra dos 90 dias aplicada">
          Calouros dentro da janela de {settings.onboardingWindowDays} dias estão excluídos deste radar.
          O risco deles é de adaptação, não de abandono, e misturar os dois distorce a taxa de retenção.
          Eles são acompanhados pela régua de{' '}
          <button
            onClick={() => actions.goto('onboarding')}
            className="font-bold text-brand-text underline hover:text-brand-2"
          >
            Onboarding 90 dias
          </button>
          .
        </Callout>
      )}

      {/* ---- Cases ------------------------------------------------------- */}
      <Card padded={false}>
        <div className="p-5">
          <CardHeader
            eyebrow={`${radarCases.filter((c) => isOpen(c.status)).length} abertos · ${radarCases.filter((c) => !isOpen(c.status)).length} encerrados`}
            title="Casos originados neste radar"
            action={
              <LinkButton
                onClick={() => actions.goto('fila')}
                iconRight={<ArrowRight className="h-3.5 w-3.5" />}
              >
                Abrir na fila
              </LinkButton>
            }
          />
        </div>

        {radarCases.length === 0 ? (
          <EmptyState
            compact
            icon={<CheckCircle2 className="h-5 w-5 text-ok" />}
            title="Nenhum caso deste radar no escopo"
            message="Nenhum protocolo foi aberto a partir desta matriz no recorte atual."
          />
        ) : (
          <div className="divide-y divide-hairline border-t border-hairline">
            {radarCases.map((kase) => {
              const student = getStudent(kase.studentId);
              if (!student) return null;
              return (
                <Row key={kase.id} onClick={() => actions.openCase(kase.id)}>
                  <div className="flex flex-wrap items-center gap-3 p-4">
                    <Avatar initials={student.initials} size="sm" tone={student.status} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-[12.5px] font-bold text-ink">{student.name}</span>
                        <PriorityBadge priority={kase.priority} solid={kase.priority === 'Crítico'} />
                        <CaseStatusBadge status={kase.status} />
                        <ModalityBadge modality={student.modality} />
                      </div>
                      <p className="mt-0.5 truncate text-[11.5px] text-ink-3">{kase.title}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <span className="font-mono text-[11.5px] font-bold text-ink-3">
                        score {student.healthScore}
                      </span>
                      <SlaPill kase={kase} />
                      <ArrowRight className="h-3.5 w-3.5 text-ink-4" />
                    </div>
                  </div>
                </Row>
              );
            })}
          </div>
        )}
      </Card>

      {/* ---- Flagged students -------------------------------------------- */}
      <div className="space-y-3">
        <SectionLabel>
          Alunos com sinal ativo e ainda sem caso aberto
        </SectionLabel>

        <Card padded={false}>
          {(() => {
            const withCase = new Set(radarCases.filter((c) => isOpen(c.status)).map((c) => c.studentId));
            const uncovered = flagged.filter((row) => !withCase.has(row.student.id));

            if (uncovered.length === 0) {
              return (
                <EmptyState
                  compact
                  icon={<CheckCircle2 className="h-5 w-5 text-ok" />}
                  title="Cobertura completa"
                  message="Todos os alunos com sinal ativo neste radar já têm um caso em andamento."
                />
              );
            }

            return (
              <div className="divide-y divide-hairline">
                {uncovered.slice(0, 12).map(({ student, evidence }) => (
                  <div key={student.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        onClick={() => actions.openStudent(student.id)}
                        className="group flex min-w-0 flex-1 items-start gap-3 text-left"
                      >
                        <Avatar initials={student.initials} size="sm" tone={student.status} />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-[12.5px] font-bold text-ink group-hover:underline">
                              {student.name}
                            </span>
                            <HealthBadge status={student.status} />
                            <ModalityBadge modality={student.modality} />
                            {student.cohort === 'Calouro' && (
                              <CohortBadge cohort="Calouro" days={student.journey.daysSinceEnrollment} />
                            )}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[10.5px] text-ink-4">
                            RA {student.ra} · {student.course} · {student.period}º período
                          </span>
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            {evidence.slice(0, 3).map((e) => (
                              <Pill key={e} tone="crit" solid dot={false} className="max-w-full">
                                <span className="truncate">{e}</span>
                              </Pill>
                            ))}
                            {evidence.length > 3 && (
                              <Pill dot={false}>+{evidence.length - 3}</Pill>
                            )}
                          </span>
                        </span>
                      </button>

                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          square
                          title="Copiloto de abordagem"
                          onClick={() => actions.copilot(student.id)}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Plus className="h-3.5 w-3.5" />}
                          onClick={() => actions.createCase(student.id)}
                        >
                          Abrir caso
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {uncovered.length > 12 && (
                  <div className="p-4">
                    <LinkButton
                      onClick={() => actions.goto('alunos')}
                      iconRight={<ArrowRight className="h-3.5 w-3.5" />}
                    >
                      Ver os {uncovered.length - 12} alunos restantes na base
                    </LinkButton>
                  </div>
                )}
              </div>
            );
          })()}
        </Card>

        <p className="px-1 text-[11.5px] text-ink-4">
          {flagged.length} de {scopedStudents.length} alunos do escopo ({percent((flagged.length / Math.max(1, scopedStudents.length)) * 100, 1)})
          têm ao menos um gatilho deste radar acionado.
        </p>
      </div>
    </motion.div>
  );
}
