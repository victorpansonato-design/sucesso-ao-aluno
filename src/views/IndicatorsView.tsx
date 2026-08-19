import { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  BarChart3,
  Download,
  FileText,
  HeartHandshake,
  Printer,
  ShieldCheck,
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { RadarKey } from '../types';
import type { ShellActions } from '../App';
import { useApp } from '../state/AppContext';
import { pageVariants } from '../lib/motion';
import {
  Callout,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  SectionLabel,
  StatTile,
} from '../components/ui/Surfaces';
import { Button } from '../components/ui/Button';
import { AnimatedNumber, ColumnChart, MeterBar, StackedBar, heatColor } from '../components/ui/Charts';
import { HealthBadge, Pill, RadarBadge } from '../components/ui/Badges';
import { RADARS, RADAR_ORDER } from '../lib/radars';
import { isOpen, isTerminal } from '../lib/caseFlow';
import { slaStatus, useClock } from '../lib/sla';
import { scoreDistribution } from '../lib/healthScore';
import {
  evasionBreakdown,
  exportCases,
  exportEvasionReport,
  exportInteractions,
  exportStudents,
  printReport,
} from '../lib/exporters';
import { decimal, int, money, percent } from '../lib/format';

/* ==========================================================================
   Indicadores
   --------------------------------------------------------------------------
   The management surface: base health, operational throughput, intervention
   outcomes, retention and radar precision — plus the extraction tools the
   directorate actually asks for. Every number is computed from the same state
   the queue runs on, so the executive report and the attendant's screen can
   never disagree.
   ========================================================================== */

export function IndicatorsView({ actions }: { actions: ShellActions }) {
  const {
    students,
    scopedStudents,
    cases,
    scopedCases,
    interactions,
    specialists,
    settings,
    followUps,
  } = useApp();
  const now = useClock();

  /* -- Base -------------------------------------------------------------- */
  const distribution = useMemo(() => scoreDistribution(scopedStudents), [scopedStudents]);
  const avgScore =
    scopedStudents.length > 0
      ? Math.round(scopedStudents.reduce((s, x) => s + x.healthScore, 0) / scopedStudents.length)
      : 0;

  /* -- Operation --------------------------------------------------------- */
  const open = scopedCases.filter((c) => isOpen(c.status));
  const closed = scopedCases.filter((c) => isTerminal(c.status));
  const retained = cases.filter((c) => c.status === 'Acordo Firmado');
  const lost = cases.filter((c) => c.status === 'Evasão Inevitável');
  const dismissed = cases.filter((c) => c.status === 'Cancelado');
  const breached = open.filter((c) => slaStatus(c, now).state === 'breach');
  const reopened = cases.filter((c) => c.reopenCount > 0);

  const slaAdherence =
    open.length + closed.length > 0
      ? ((open.length + closed.length - breached.length) / (open.length + closed.length)) * 100
      : 100;

  const avgFirstContactHours = useMemo(() => {
    const withContact = cases.filter((c) => c.firstContactAt);
    if (withContact.length === 0) return null;
    const total = withContact.reduce(
      (sum, c) =>
        sum + (new Date(c.firstContactAt as string).getTime() - new Date(c.openedAt).getTime()) / 3_600_000,
      0,
    );
    return total / withContact.length;
  }, [cases]);

  /* -- Intervention ------------------------------------------------------ */
  const contacted = new Set(interactions.map((i) => i.studentId)).size;
  const responded = interactions.filter(
    (i) => i.outcome !== 'Sem contato' && i.outcome !== 'Recusou atendimento',
  ).length;
  const noContact = interactions.filter((i) => i.outcome === 'Sem contato').length;
  const resolvedInteractions = interactions.filter((i) => i.outcome === 'Resolvido').length;

  const reversionRate =
    retained.length + lost.length > 0 ? (retained.length / (retained.length + lost.length)) * 100 : null;

  /* -- Preserved revenue: stated with its formula, never as a bare number -- */
  const preservedRevenue = useMemo(
    () =>
      retained.reduce((sum, c) => {
        const student = students.find((s) => s.id === c.studentId);
        if (!student) return sum;
        // Remaining periods × 6 monthly instalments per period.
        const remainingPeriods = Math.max(1, student.totalPeriods - student.period + 1);
        return sum + student.financial.monthlyFee * 6 * remainingPeriods;
      }, 0),
    [retained, students],
  );

  /* -- Radar precision --------------------------------------------------- */
  const radarStats = useMemo(
    () =>
      RADAR_ORDER.map((key) => {
        const alerts = students.flatMap((s) => s.alerts.filter((a) => a.radar === key));
        const confirmed = alerts.filter((a) => a.review === 'confirmado').length;
        const rejected = alerts.filter((a) => a.review === 'descartado').length;
        const judged = confirmed + rejected;
        return {
          key,
          label: RADARS[key].shortLabel,
          alerts: alerts.length,
          confirmed,
          rejected,
          pending: alerts.length - judged,
          precision: judged > 0 ? (confirmed / judged) * 100 : null,
          openCases: cases.filter((c) => c.radar === key && isOpen(c.status)).length,
          closedCases: cases.filter((c) => c.radar === key && isTerminal(c.status)).length,
        };
      }),
    [students, cases],
  );

  /* -- Risk heatmap by course -------------------------------------------- */
  const heatmap = useMemo(() => {
    const byCourse = new Map<string, { total: number; risky: number }>();
    for (const s of scopedStudents) {
      const entry = byCourse.get(s.course) ?? { total: 0, risky: 0 };
      entry.total += 1;
      if (s.status === 'Risco' || s.status === 'Crítico') entry.risky += 1;
      byCourse.set(s.course, entry);
    }
    return [...byCourse.entries()]
      .map(([course, v]) => ({ course, ...v, ratio: v.risky / v.total }))
      .filter((r) => r.total >= 1)
      .sort((a, b) => b.ratio - a.ratio || b.total - a.total);
  }, [scopedStudents]);

  /* -- Evasion reasons --------------------------------------------------- */
  const evasion = useMemo(() => evasionBreakdown(cases, students), [cases, students]);

  /* -- Team throughput --------------------------------------------------- */
  const teamRows = useMemo(
    () =>
      specialists
        .map((spec) => {
          const specCases = cases.filter((c) => c.assigneeId === spec.id);
          const specOpen = specCases.filter((c) => isOpen(c.status)).length;
          const specRetained = specCases.filter((c) => c.status === 'Acordo Firmado').length;
          return {
            spec,
            open: specOpen,
            retained: specRetained,
            total: specCases.length,
            load: spec.capacity > 0 ? specOpen / spec.capacity : 0,
          };
        })
        .sort((a, b) => b.load - a.load),
    [specialists, cases],
  );

  const pendingFollowUps = followUps.filter((f) => f.status === 'Agendado').length;

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="print-report space-y-6"
    >
      <PageHeader
        eyebrow="Painel de gestão"
        title="Indicadores"
        description="Base, operação, intervenção, retenção e precisão dos radares. Os números vêm do mesmo estado que a fila usa, então relatório e operação nunca divergem."
        actions={
          <>
            <Button
              variant="ghost"
              icon={<Printer className="h-3.5 w-3.5" />}
              onClick={printReport}
              className="print:hidden"
            >
              Imprimir / PDF
            </Button>
            <Button
              variant="secondary"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={() => exportEvasionReport(cases, students)}
              className="print:hidden"
            >
              Motivos de evasão
            </Button>
          </>
        }
      />

      {/* ---- Executive band ---------------------------------------------- */}
      <Card tone="band" padded={false}>
        <div className="relative p-5 sm:p-6">
          <CardHeader
            eyebrow="Resultado consolidado do ciclo"
            title="Impacto do Centro de Sucesso ao Aluno"
            subtitle="Cálculos explícitos, para que o número possa ser defendido em reunião."
          />

          <div className="relative mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              tone="band"
              label="Taxa de reversão"
              value={reversionRate === null ? '—' : `${Math.round(reversionRate)}%`}
              icon={<HeartHandshake className="h-4 w-4" />}
              footer={
                <>
                  <span>
                    {retained.length} retidos de {retained.length + lost.length} desfechos
                  </span>
                </>
              }
            />
            <StatTile
              tone="band"
              label="Aderência ao SLA"
              value={`${Math.round(slaAdherence)}%`}
              icon={<Timer className="h-4 w-4" />}
              footer={
                <>
                  <span>{breached.length} casos estourados</span>
                  {avgFirstContactHours !== null && (
                    <span className="font-mono font-semibold">
                      {decimal(avgFirstContactHours, 1)} h até o 1º contato
                    </span>
                  )}
                </>
              }
            />
            <StatTile
              tone="band"
              label="Health Score médio"
              value={<AnimatedNumber value={avgScore} format={false} />}
              detail="/100"
              icon={<TrendingUp className="h-4 w-4" />}
              footer={<span>{scopedStudents.length} alunos no escopo</span>}
            />
            <StatTile
              tone="band"
              label="Receita preservada"
              value={money(preservedRevenue).replace(/\s/g, '')}
              icon={<ShieldCheck className="h-4 w-4" />}
              footer={<span>mensalidade × 6 × períodos restantes dos retidos</span>}
            />
          </div>

          <p className="relative mt-4 border-t border-band-line pt-3.5 text-[11px] leading-relaxed text-band-ink-2">
            Receita preservada é uma estimativa de exposição evitada, não caixa realizado. O cálculo é
            declarado acima de propósito: um número institucional só é útil quando a fórmula é auditável.
          </p>
        </div>
      </Card>

      {/* ---- Base -------------------------------------------------------- */}
      <div className="space-y-3">
        <SectionLabel>Saúde da base</SectionLabel>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader
              eyebrow="Classificação"
              title="Distribuição do Health Score"
              action={
                <Button
                  size="xs"
                  variant="ghost"
                  icon={<Download className="h-3 w-3" />}
                  onClick={() => exportStudents(scopedStudents)}
                  className="print:hidden"
                >
                  CSV
                </Button>
              }
            />
            <div className="mt-4">
              <StackedBar
                height={12}
                segments={distribution.map((b) => ({
                  key: b.status,
                  label: b.label,
                  value: b.count,
                  color: b.hex(false),
                }))}
              />
            </div>
            <div className="mt-4 space-y-2.5">
              {distribution.map((b) => (
                <div key={b.status} className="flex items-center gap-3">
                  <HealthBadge status={b.status} />
                  <span className="font-mono text-[10.5px] text-ink-4">
                    {b.range[0]}–{b.range[1]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <MeterBar value={b.percent} color={b.hex(false)} height={4} />
                  </div>
                  <span className="w-20 shrink-0 text-right font-mono text-[12px] font-semibold text-ink">
                    {int(b.count)}
                    <span className="ml-1 font-normal text-ink-4">{percent(b.percent, 1)}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Mapa de risco"
              title="Concentração de risco por curso"
              subtitle="Percentual de alunos em Risco ou Crítico. O topo da lista é onde a coordenação precisa entrar."
            />
            {heatmap.length === 0 ? (
              <EmptyState compact title="Sem dados no escopo" />
            ) : (
              <div className="mt-4 space-y-1.5">
                {heatmap.slice(0, 10).map((row) => (
                  <div
                    key={row.course}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5"
                    style={{ backgroundColor: heatColor(row.ratio) }}
                  >
                    <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-ink">
                      {row.course}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] font-semibold text-ink">
                      {row.risky}
                      <span className="font-normal opacity-60">/{row.total}</span>
                    </span>
                    <span className="w-12 shrink-0 text-right font-mono text-[11.5px] font-semibold text-ink">
                      {percent(row.ratio * 100)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ---- Operation --------------------------------------------------- */}
      <div className="space-y-3">
        <SectionLabel>Operação</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {[
            { label: 'Casos abertos', value: open.length, icon: <FileText className="h-3.5 w-3.5" /> },
            { label: 'Encerrados', value: closed.length, icon: <ShieldCheck className="h-3.5 w-3.5" /> },
            {
              label: 'SLA estourado',
              value: breached.length,
              accent: breached.length > 0 ? 'var(--crit)' : undefined,
              icon: <Timer className="h-3.5 w-3.5" />,
            },
            {
              label: 'Reaberturas',
              value: reopened.length,
              accent: reopened.length > 0 ? 'var(--warn)' : undefined,
            },
            { label: 'Follow-ups ativos', value: pendingFollowUps },
            { label: 'Interações no ciclo', value: interactions.length, icon: <Activity className="h-3.5 w-3.5" /> },
          ].map((tile) => (
            <StatTile
              key={tile.label}
              label={tile.label}
              value={int(tile.value)}
              accent={tile.accent}
              icon={tile.icon}
            />
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader
              eyebrow="Volume por radar"
              title="Origem dos casos"
              subtitle="Onde a operação está gastando esforço."
            />
            <div className="mt-5">
              <ColumnChart
                data={radarStats.map((r) => ({
                  label: r.label,
                  value: r.openCases + r.closedCases,
                  color: r.key === 'evasao' ? 'var(--crit)' : 'var(--brand-2)',
                }))}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Resultado das intervenções"
              title="Desfecho dos contatos registrados"
              action={
                <Button
                  size="xs"
                  variant="ghost"
                  icon={<Download className="h-3 w-3" />}
                  onClick={() => exportInteractions(interactions, students)}
                  className="print:hidden"
                >
                  CSV
                </Button>
              }
            />
            <div className="mt-5 space-y-3">
              {[
                { label: 'Alunos contatados', value: contacted, color: 'var(--brand-2)', total: scopedStudents.length },
                { label: 'Interações com resposta', value: responded, color: 'var(--ok)', total: interactions.length },
                { label: 'Resolvidas no contato', value: resolvedInteractions, color: 'var(--ok)', total: interactions.length },
                { label: 'Sem contato estabelecido', value: noContact, color: 'var(--crit)', total: interactions.length },
              ].map((row) => (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[12px] font-medium text-ink-2">{row.label}</span>
                    <span className="shrink-0 font-mono text-[12px] font-semibold text-ink">
                      {int(row.value)}
                      <span className="ml-1.5 font-normal text-ink-4">
                        {percent((row.value / Math.max(1, row.total)) * 100)}
                      </span>
                    </span>
                  </div>
                  <MeterBar value={row.value} max={Math.max(1, row.total)} color={row.color} height={5} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ---- Retention & evasion reasons --------------------------------- */}
      <div className="space-y-3">
        <SectionLabel>Retenção e aprendizado</SectionLabel>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <Card>
            <CardHeader eyebrow="Desfechos" title="Como os casos terminam" />
            <div className="mt-5 space-y-3">
              {[
                { label: 'Acordo firmado · retido', value: retained.length, color: 'var(--ok)' },
                { label: 'Saída inevitável', value: lost.length, color: 'var(--crit)' },
                { label: 'Alerta descartado', value: dismissed.length, color: 'var(--ink-4)' },
                { label: 'Ainda em aberto', value: open.length, color: 'var(--warn)' },
              ].map((row) => (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[12px] font-medium text-ink-2">{row.label}</span>
                    <span className="shrink-0 font-mono text-[12px] font-semibold text-ink">{row.value}</span>
                  </div>
                  <MeterBar value={row.value} max={Math.max(1, cases.length)} color={row.color} height={5} />
                </div>
              ))}
            </div>

            {reversionRate !== null && (
              <div className="mt-5 border-t border-hairline pt-4">
                <Callout tone={reversionRate >= 60 ? 'ok' : 'warn'}>
                  {Math.round(reversionRate)}% dos casos com desfecho terminaram em permanência.
                  {reopened.length > 0 &&
                    ` ${reopened.length} caso(s) foram reabertos — vale revisar o playbook usado neles.`}
                </Callout>
              </div>
            )}
          </Card>

          <Card padded={false}>
            <div className="p-5">
              <CardHeader
                eyebrow="Relatório executivo"
                title="Motivos de evasão registrados"
                subtitle="Taxonomia fixa preenchida no encerramento de cada caso, agregada por curso e campus."
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Download className="h-3.5 w-3.5" />}
                    onClick={() => exportEvasionReport(cases, students)}
                    className="print:hidden"
                  >
                    Exportar CSV
                  </Button>
                }
              />
            </div>

            {evasion.length === 0 ? (
              <EmptyState
                compact
                icon={<ShieldCheck className="h-5 w-5 text-ok" />}
                title="Nenhuma saída registrada"
                message="Nenhum caso foi encerrado como evasão inevitável no ciclo."
              />
            ) : (
              <div className="overflow-x-auto border-t border-hairline">
                <table className="w-full min-w-[600px] text-left">
                  <thead>
                    <tr className="border-b border-hairline bg-surface-2">
                      {['Curso', 'Campus', 'Modalidade', 'Motivo registrado', 'Casos'].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-[11px] font-medium text-ink-4"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {evasion.map((row, i) => (
                      <tr key={`${row.course}-${row.reason}-${i}`}>
                        <td className="px-4 py-2.5 text-[12px] font-semibold text-ink">{row.course}</td>
                        <td className="px-4 py-2.5 text-[11.5px] text-ink-3">{row.campus}</td>
                        <td className="px-4 py-2.5">
                          <Pill dot={false} mono>
                            {row.modality}
                          </Pill>
                        </td>
                        <td className="px-4 py-2.5 text-[11.5px] text-ink-2">{row.reason}</td>
                        <td className="px-4 py-2.5 font-mono text-[12px] font-semibold text-crit-ink">
                          {row.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ---- Radar precision -------------------------------------------- */}
      <div className="space-y-3">
        <SectionLabel>Precisão dos radares</SectionLabel>
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-hairline bg-surface-2">
                  {['Radar', 'SLA', 'Alertas', 'Confirmados', 'Descartados', 'Pendentes', 'Precisão', 'Casos'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-[11px] font-medium text-ink-4"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {radarStats.map((r) => (
                  <tr key={r.key} className="transition-colors hover:bg-surface-hover">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => actions.goto('radares', r.key)}
                        className="flex items-center gap-2 text-left"
                      >
                        <RadarBadge radar={r.key as RadarKey} full />
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11.5px] text-ink-3">
                      {settings.slaHours[r.key]}h
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] font-semibold text-ink">{r.alerts}</td>
                    <td className="px-4 py-3 font-mono text-[12px] font-semibold text-ok-ink">{r.confirmed}</td>
                    <td className="px-4 py-3 font-mono text-[12px] font-semibold text-crit-ink">{r.rejected}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-warn-ink">{r.pending}</td>
                    <td className="px-4 py-3">
                      {r.precision === null ? (
                        <span className="font-mono text-[11.5px] text-ink-4">sem verdicto</span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span className="w-16">
                            <MeterBar
                              value={r.precision}
                              color={r.precision >= 70 ? 'var(--ok)' : 'var(--warn)'}
                              height={4}
                            />
                          </span>
                          <span className="font-mono text-[11.5px] font-semibold text-ink">
                            {Math.round(r.precision)}%
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11.5px] text-ink-3">
                      {r.openCases} abertos · {r.closedCases} fechados
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="px-1 text-[11.5px] leading-relaxed text-ink-4">
          Precisão é a razão entre alertas confirmados e alertas julgados pela equipe. Um radar com
          precisão baixa não está errado — está mal calibrado, e o número acima é o que justifica ajustar
          seu gatilho em Governança.
        </p>
      </div>

      {/* ---- Team -------------------------------------------------------- */}
      <div className="space-y-3">
        <SectionLabel>Carga e desempenho da equipe</SectionLabel>
        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-hairline bg-surface-2 px-4 py-2.5">
            <span className="text-[11px] font-medium text-ink-3">
              {specialists.length} especialistas
            </span>
            <Button
              size="xs"
              variant="ghost"
              icon={<Download className="h-3 w-3" />}
              onClick={() => exportCases(cases, students, specialists)}
              className="print:hidden"
            >
              Exportar casos
            </Button>
          </div>

          <div className="divide-y divide-hairline">
            {teamRows.map(({ spec, open: specOpen, retained: specRetained, total, load }) => (
              <button
                key={spec.id}
                onClick={() => actions.goto('equipe')}
                className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-surface-hover"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-ink">{spec.name}</span>
                  <span className="block truncate text-[11px] text-ink-3">{spec.role}</span>
                </span>

                <span className="w-32 shrink-0">
                  <span className="flex items-baseline justify-between">
                    <span className="text-[11px] font-medium text-ink-4">Carga</span>
                    <span className="font-mono text-[11.5px] font-semibold text-ink">
                      {specOpen}/{spec.capacity}
                    </span>
                  </span>
                  <span className="mt-1 block">
                    <MeterBar
                      value={load * 100}
                      color={load >= 0.85 ? 'var(--crit)' : load >= 0.6 ? 'var(--warn)' : 'var(--ok)'}
                      height={4}
                    />
                  </span>
                </span>

                <span className="hidden w-20 shrink-0 text-right sm:block">
                  <span className="block text-[11px] font-medium text-ink-4">SLA</span>
                  <span className="font-mono text-[12px] font-semibold text-ink">
                    {percent(spec.slaAdherence, 1)}
                  </span>
                </span>

                <span className="hidden w-16 shrink-0 text-right sm:block">
                  <span className="block text-[11px] font-medium text-ink-4">
                    Retidos
                  </span>
                  <span className="font-mono text-[12px] font-semibold text-ok-ink">{specRetained}</span>
                </span>

                <span className="w-14 shrink-0 text-right">
                  <span className="block text-[11px] font-medium text-ink-4">Total</span>
                  <span className="font-mono text-[12px] font-semibold text-ink">{total}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* ---- Extraction -------------------------------------------------- */}
      <Card className="print:hidden">
        <CardHeader
          eyebrow="Extração de dados"
          title="Relatórios para diretoria e reitoria"
          subtitle="CSV com separador ponto-e-vírgula e BOM UTF-8 — abre direto no Excel em português sem quebrar acentuação."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'Base de alunos',
              detail: `${scopedStudents.length} registros com score, frequência, financeiro e AVA`,
              icon: <Users className="h-4 w-4" />,
              run: () => exportStudents(scopedStudents),
            },
            {
              label: 'Casos e SLA',
              detail: `${cases.length} protocolos com responsável, prazos e desfecho`,
              icon: <FileText className="h-4 w-4" />,
              run: () => exportCases(cases, students, specialists),
            },
            {
              label: 'Intervenções',
              detail: `${interactions.length} registros de causa, intervenção e resultado`,
              icon: <Activity className="h-4 w-4" />,
              run: () => exportInteractions(interactions, students),
            },
            {
              label: 'Motivos de evasão',
              detail: 'Agregado por curso, campus e modalidade',
              icon: <BarChart3 className="h-4 w-4" />,
              run: () => exportEvasionReport(cases, students),
            },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.run}
              className="group flex flex-col gap-2 rounded-lg bg-surface-2 p-4 text-left transition-colors"
            >
              <span className="flex items-center justify-between">
                <span className="text-ink-3 transition-colors group-hover:text-brand-text">
                  {item.icon}
                </span>
                <Download className="h-3.5 w-3.5 text-ink-4" />
              </span>
              <span className="text-[12.5px] font-semibold text-ink">{item.label}</span>
              <span className="text-[11px] leading-relaxed text-ink-3">{item.detail}</span>
            </button>
          ))}
        </div>
      </Card>

      <Callout tone="warn" title="Dados de demonstração">
        Toda a base é fictícia e existe para validar o modelo operacional. Nenhum número desta tela deve
        ser apresentado como resultado de produção.
      </Callout>
    </motion.div>
  );
}
