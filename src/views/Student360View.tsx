import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Radar as RadarIcon,
  Sparkles,
  Wallet,
  XCircle,
} from 'lucide-react';
import type { ShellActions } from '../App';
import { useApp } from '../state/AppContext';
import { pageVariants } from '../lib/motion';
import {
  Callout,
  Card,
  CardHeader,
  DataList,
  EmptyState,
  Row,
  SectionLabel,
  StatTile,
  Tabs,
} from '../components/ui/Surfaces';
import { Button, LinkButton } from '../components/ui/Button';
import { MeterBar, ScoreRing, Sparkline } from '../components/ui/Charts';
import {
  Avatar,
  CaseStatusBadge,
  CohortBadge,
  HealthBadge,
  ModalityBadge,
  Pill,
  PriorityBadge,
  RadarBadge,
  TrendIndicator,
} from '../components/ui/Badges';
import { ScoreBreakdown, statusColor } from '../components/domain/ScoreBreakdown';
import { Timeline } from '../components/domain/Timeline';
import { SlaPill } from '../components/domain/SlaPill';
import { RADARS, accessDropPercent } from '../lib/radars';
import { isOpen } from '../lib/caseFlow';
import { decimal, fullDate, money, percent, relative, stamp } from '../lib/format';

/* ==========================================================================
   Dossiê 360°
   --------------------------------------------------------------------------
   Everything about one student on one screen, in the order an attendant reads
   it before making contact: who they are, how the score got where it is, what
   the radar flagged, then the full history across academic, financial, AVA and
   support sources.
   ========================================================================== */

type Tab = 'linha' | 'academico' | 'financeiro' | 'engajamento' | 'contatos' | 'casos';

export function Student360View({
  studentId,
  actions,
}: {
  studentId: string;
  actions: ShellActions;
}) {
  const { getStudent, scoreOf, interactionsOf, followUpsOf, casesOf, radarsOf, reviewAlert, theme, completeFollowUp, cancelFollowUp } =
    useApp();
  const [tab, setTab] = useState<Tab>('linha');

  const student = getStudent(studentId);
  const score = scoreOf(studentId);
  const interactions = useMemo(() => interactionsOf(studentId), [interactionsOf, studentId]);
  const followUps = useMemo(() => followUpsOf(studentId), [followUpsOf, studentId]);
  const studentCases = useMemo(() => casesOf(studentId), [casesOf, studentId]);
  const radars = useMemo(() => radarsOf(studentId), [radarsOf, studentId]);

  if (!student || !score) {
    return (
      <EmptyState
        title="Aluno não encontrado"
        message="O registro pode ter sido removido da base de demonstração."
        action={
          <Button variant="secondary" onClick={() => actions.goto('alunos')}>
            Voltar para a base
          </Button>
        }
      />
    );
  }

  const dark = theme === 'dark';
  const scoreColor = statusColor(student.status, dark);
  const drop = accessDropPercent(student);
  const openCases = studentCases.filter((c) => isOpen(c.status));
  const pendingAlerts = student.alerts.filter((a) => a.review === 'pendente');

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-5"
    >
      {/* ---- Breadcrumb + primary actions -------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="h-3.5 w-3.5" />}
          onClick={() => actions.goto('alunos')}
        >
          Base de Alunos
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            onClick={() => actions.followUp(student.id)}
          >
            Agendar follow-up
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => actions.createCase(student.id)}
          >
            Abrir caso
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            onClick={() => actions.copilot(student.id, openCases[0]?.id)}
          >
            Copiloto
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            onClick={() => actions.register({ studentId: student.id, caseId: openCases[0]?.id })}
          >
            Registrar contato
          </Button>
        </div>
      </div>

      {/* ---- Identity + score -------------------------------------------- */}
      <Card padded={false}>
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <Avatar initials={student.initials} size="lg" tone={student.status} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[24px] leading-tight font-semibold text-ink">{student.name}</h1>
                  <HealthBadge status={student.status} solid />
                  <CohortBadge cohort={student.cohort} days={student.journey.daysSinceEnrollment} />
                </div>

                <p className="mt-1.5 text-[13px] text-ink-2">
                  <span className="font-semibold text-ink">{student.course}</span> · {student.period}º de{' '}
                  {student.totalPeriods} períodos · {student.shift}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ModalityBadge modality={student.modality} />
                  <Pill dot={false} mono>
                    RA {student.ra}
                  </Pill>
                  <Pill dot={false}>{student.campus}</Pill>
                  <Pill dot={false} mono title="CPF mascarado conforme a política de LGPD">
                    CPF {student.cpfMasked}
                  </Pill>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <a
                    href={`tel:+55${student.phone.replace(/\D/g, '')}`}
                    className="inline-flex items-center gap-1.5 font-mono text-[11.5px] font-semibold text-brand-text hover:text-brand-2"
                  >
                    <Phone className="h-3 w-3" />
                    {student.phone}
                  </a>
                  <a
                    href={`mailto:${student.email}`}
                    className="inline-flex items-center gap-1.5 truncate font-mono text-[11.5px] font-semibold text-brand-text hover:text-brand-2"
                  >
                    <Mail className="h-3 w-3" />
                    {student.email}
                  </a>
                </div>
              </div>
            </div>

            {/* Key metrics */}
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                label="Média geral"
                value={decimal(student.academic.gpa, 1)}
                detail="/ 10"
                icon={<BookOpen className="h-3.5 w-3.5" />}
                accent={student.academic.gpa < 6 ? 'var(--crit)' : undefined}
                footer={<span>Mínimo para aprovação: 6,0</span>}
              />
              <StatTile
                label="Frequência"
                value={percent(student.academic.attendancePercent)}
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                accent={student.academic.attendancePercent < 75 ? 'var(--crit)' : undefined}
                footer={
                  <>
                    <span>Mínimo: 75%</span>
                    {student.academic.attendancePrevPercent !== student.academic.attendancePercent && (
                      <span className="font-mono font-semibold">
                        antes {percent(student.academic.attendancePrevPercent)}
                      </span>
                    )}
                  </>
                }
              />
              <StatTile
                label="Acessos ao AVA"
                value={student.engagement.accessesLast30Days}
                detail="/ 30 dias"
                icon={<Activity className="h-3.5 w-3.5" />}
                accent={drop >= 40 ? 'var(--crit)' : drop >= 25 ? 'var(--warn)' : undefined}
                footer={
                  <>
                    <span>
                      {student.engagement.lastAccessDaysAgo === 0
                        ? 'acesso hoje'
                        : `há ${student.engagement.lastAccessDaysAgo} d`}
                    </span>
                    {drop > 0 && <span className="font-mono font-semibold">−{drop}%</span>}
                  </>
                }
              />
              <StatTile
                label="Financeiro"
                value={student.financial.overdueCount === 0 ? 'Em dia' : `${student.financial.overdueCount}×`}
                detail={student.financial.overdueCount > 0 ? 'em aberto' : undefined}
                icon={<Wallet className="h-3.5 w-3.5" />}
                accent={student.financial.overdueCount > 0 ? 'var(--crit)' : undefined}
                footer={
                  <>
                    <span className="truncate">{student.financial.situation}</span>
                    {student.financial.outstanding > 0 && (
                      <span className="font-mono font-semibold">{money(student.financial.outstanding)}</span>
                    )}
                  </>
                }
              />
            </div>
          </div>

          {/* Score panel */}
          <aside className="border-t border-hairline bg-surface-2 p-5 lg:border-t-0 lg:border-l">
            <div className="flex flex-col items-center">
              <ScoreRing
                score={student.healthScore}
                color={scoreColor}
                label="Health Score"
                sublabel={student.status}
              />
              <div className="mt-3 flex items-center gap-2">
                <TrendIndicator trend={student.trend} delta={student.scoreDelta30d} />
                <span className="text-[11px] text-ink-3">
                  {student.trend === 'up'
                    ? 'em recuperação'
                    : student.trend === 'down'
                      ? 'em queda'
                      : 'estável'}
                </span>
              </div>
            </div>

            <div className="mt-5 border-t border-hairline pt-4">
              <SectionLabel>Composição do score</SectionLabel>
              <div className="mt-3">
                <ScoreBreakdown score={score} compact />
              </div>
            </div>

            <div className="mt-4 border-t border-hairline pt-4">
              <DataList
                columns={2}
                items={[
                  { label: 'Progresso', value: percent(student.journey.progressPercent) },
                  { label: 'Previsão', value: student.journey.completionForecast },
                  { label: 'Ingresso', value: student.journey.admissionSemester },
                  { label: 'Matriculado há', value: `${student.journey.daysSinceEnrollment} d` },
                ]}
              />
              <div className="mt-3">
                <MeterBar value={student.journey.progressPercent} color="var(--brand-2)" height={5} />
              </div>
            </div>
          </aside>
        </div>
      </Card>

      {/* ---- Radar alerts ------------------------------------------------ */}
      {pendingAlerts.length > 0 && (
        <div className="space-y-3">
          <SectionLabel>
            Alertas do radar aguardando verdicto ({pendingAlerts.length})
          </SectionLabel>

          {pendingAlerts.map((alert) => (
            <Card
              key={alert.id}
              className={
                alert.severity === 'Crítico'
                  ? ''
                  : alert.severity === 'Risco'
                    ? ''
                    : ''
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill
                      tone={alert.severity === 'Crítico' ? 'crit' : alert.severity === 'Risco' ? 'risk' : 'warn'}
                      solid
                    >
                      {alert.severity}
                    </Pill>
                    <RadarBadge radar={alert.radar} full />
                    <span className="font-mono text-[10.5px] text-ink-4">
                      detectado {relative(alert.detectedAt)}
                    </span>
                  </div>

                  <h3 className="mt-2 text-[14px] font-semibold text-ink">{alert.title}</h3>
                  <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-ink-2">
                    {alert.detail}
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-surface-2 p-3">
                      <p className="text-[11px] font-medium text-ink-4">
                        Dados que geraram o alerta
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {alert.signals.map((s) => (
                          <li key={s} className="flex gap-2 text-[11.5px] leading-relaxed text-ink-2">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-4" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg bg-brand-soft p-3">
                      <p className="text-[11px] font-medium text-brand-text">
                        Ação sugerida
                      </p>
                      <p className="mt-2 text-[11.5px] leading-relaxed text-ink-2">
                        {alert.suggestedAction}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto">
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<MessageSquare className="h-3.5 w-3.5" />}
                    onClick={() => actions.register({ studentId: student.id, caseId: openCases[0]?.id })}
                  >
                    Acolher aluno
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<CheckCircle2 className="h-3.5 w-3.5 text-ok" />}
                    onClick={() => reviewAlert(student.id, alert.id, 'confirmado')}
                  >
                    Confirmar alerta
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<XCircle className="h-3.5 w-3.5" />}
                    onClick={() => reviewAlert(student.id, alert.id, 'descartado')}
                    title="Falso positivo — alimenta a calibração do radar"
                  >
                    Descartar
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {radars.length > 0 && pendingAlerts.length === 0 && (
        <Callout tone="warn" icon={<RadarIcon className="h-3.5 w-3.5" />} title="Radares ativos sem alerta aberto">
          {radars.map((r) => RADARS[r].label).join('·')} — os gatilhos estão acionados mas nenhum alerta
          aguarda verdicto. Considere abrir um caso de acompanhamento.
        </Callout>
      )}

      {/* ---- Tabs -------------------------------------------------------- */}
      <div>
        <Tabs<Tab>
          layoutId="student-tabs"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'linha', label: 'Linha do tempo', count: student.timeline.length },
            { value: 'academico', label: 'Acadêmico', count: student.academic.disciplines.length },
            { value: 'financeiro', label: 'Financeiro' },
            { value: 'engajamento', label: 'Engajamento' },
            { value: 'contatos', label: 'Contatos', count: interactions.length },
            { value: 'casos', label: 'Casos', count: studentCases.length },
          ]}
        />

        <div className="pt-5">
          {tab === 'linha' && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
              <Card>
                <CardHeader
                  eyebrow="Histórico unificado"
                  title="Linha do tempo 360°"
                  subtitle="Acadêmico, financeiro, AVA, atendimentos, alertas e intervenções em um único fio."
                />
                <div className="mt-5">
                  <Timeline events={student.timeline} />
                </div>
              </Card>

              <Card>
                <CardHeader
                  eyebrow="Agenda"
                  title="Acompanhamentos"
                  action={
                    <LinkButton onClick={() => actions.followUp(student.id)}>Agendar</LinkButton>
                  }
                />
                {followUps.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<CalendarClock className="h-5 w-5" />}
                    title="Nenhum acompanhamento"
                    message="Agende uma verificação para confirmar se a intervenção funcionou."
                  />
                ) : (
                  <ul className="mt-4 space-y-2.5">
                    {followUps.map((f) => (
                      <li
                        key={f.id}
                        className="rounded-lg bg-surface-2 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[12px] leading-snug font-semibold text-ink">{f.title}</p>
                          <Pill
                            dot={false}
                            tone={
                              f.status === 'Concluído' ? 'ok' : f.status === 'Cancelado' ? 'muted' : 'warn'
                            }
                            solid={f.status !== 'Agendado'}
                          >
                            {f.status}
                          </Pill>
                        </div>
                        <p className="mt-1 font-mono text-[10.5px] text-ink-4">
                          {fullDate(f.dueDate)} · {f.ownerName}
                        </p>
                        {f.notes && <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">{f.notes}</p>}
                        {f.status === 'Agendado' && (
                          <div className="mt-2.5 flex gap-2">
                            <Button size="xs" variant="secondary" onClick={() => completeFollowUp(f.id)}>
                              Concluir
                            </Button>
                            <Button size="xs" variant="ghost" onClick={() => cancelFollowUp(f.id)}>
                              Cancelar
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}

          {tab === 'academico' && (
            <div className="space-y-5">
              <Card>
                <CardHeader
                  eyebrow="Semestre corrente"
                  title="Disciplinas matriculadas"
                  subtitle="Notas parciais, frequência e limite regimental de faltas por disciplina."
                />
                {student.academic.disciplines.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<BookOpen className="h-5 w-5" />}
                    title="Grade não detalhada"
                    message="Este registro de demonstração não traz o detalhamento por disciplina."
                  />
                ) : (
                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    {student.academic.disciplines.map((d) => {
                      const absenceRatio = d.absenceLimit > 0 ? d.absences / d.absenceLimit : 0;
                      const atLimit = d.absenceLimit > 0 && d.absences >= d.absenceLimit - 1;
                      return (
                        <div
                          key={d.id}
                          className={[
                            'rounded-lg p-4',
                            d.status === 'Em risco' || d.status === 'Dependência'
                              ? 'bg-crit-soft/40'
                              : 'bg-surface-2',
                          ].join(' ')}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-medium text-ink-4">
                                {d.code} · {d.format}
                              </p>
                              <h4 className="mt-0.5 text-[13px] leading-snug font-semibold text-ink">
                                {d.name}
                              </h4>
                              <p className="mt-0.5 text-[11.5px] text-ink-3">
                                {d.teacher} · {d.schedule}
                              </p>
                            </div>
                            <Pill
                              dot={false}
                              tone={
                                d.status === 'Em risco'
                                  ? 'crit'
                                  : d.status === 'Dependência'
                                    ? 'risk'
                                    : d.status === 'Aprovado'
                                      ? 'ok'
                                      : 'neutral'
                              }
                              solid={d.status !== 'Em curso'}
                            >
                              {d.status}
                            </Pill>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-3 border-t border-hairline pt-3">
                            <div>
                              <p className="text-[11px] font-medium text-ink-4">
                                Nota
                              </p>
                              <p
                                className={[
                                  'mt-0.5 font-mono text-[15px] font-semibold',
                                  d.grade > 0 && d.grade < 6 ? 'text-crit-ink' : 'text-ink',
                                ].join(' ')}
                              >
                                {d.grade > 0 ? decimal(d.grade, 1) : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] font-medium text-ink-4">
                                Frequência
                              </p>
                              <p
                                className={[
                                  'mt-0.5 font-mono text-[15px] font-semibold',
                                  d.attendancePercent < 75 ? 'text-crit-ink' : 'text-ink',
                                ].join(' ')}
                              >
                                {percent(d.attendancePercent)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] font-medium text-ink-4">
                                Faltas
                              </p>
                              <p
                                className={[
                                  'mt-0.5 font-mono text-[15px] font-semibold',
                                  atLimit ? 'text-crit-ink' : 'text-ink',
                                ].join(' ')}
                              >
                                {d.absences}
                                <span className="text-[11px] font-normal text-ink-4">
                                  /{d.absenceLimit || '—'}
                                </span>
                              </p>
                            </div>
                          </div>

                          {d.absenceLimit > 0 && (
                            <div className="mt-2.5">
                              <MeterBar
                                value={absenceRatio * 100}
                                color={atLimit ? 'var(--crit)' : absenceRatio > 0.5 ? 'var(--warn)' : 'var(--ok)'}
                                height={4}
                              />
                              {atLimit && (
                                <p className="mt-1.5 text-[10.5px] font-semibold text-crit-ink">
                                  Uma falta a mais reprova por frequência.
                                </p>
                              )}
                            </div>
                          )}

                          {d.pendingActivities > 0 && (
                            <p className="mt-2.5 text-[11px] font-semibold text-warn-ink">
                              {d.pendingActivities} atividade(s) avaliativa(s) pendente(s)
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card>
                <CardHeader eyebrow="Consolidado" title="Situação acadêmica global" />
                <DataList
                  className="mt-4"
                  columns={4}
                  items={[
                    { label: 'Média geral', value: decimal(student.academic.gpa, 1), tone: student.academic.gpa < 6 ? 'crit' : 'plain' },
                    { label: 'Frequência', value: percent(student.academic.attendancePercent), tone: student.academic.attendancePercent < 75 ? 'crit' : 'plain' },
                    { label: 'Disciplinas', value: student.academic.subjects },
                    { label: 'Dependências', value: student.academic.dependencies, tone: student.academic.dependencies > 0 ? 'crit' : 'plain' },
                    { label: 'Abaixo de 5,0', value: student.academic.failingSubjects, tone: student.academic.failingSubjects > 0 ? 'crit' : 'plain' },
                    { label: 'Atividades em atraso', value: student.academic.lateAssignments, tone: student.academic.lateAssignments > 0 ? 'crit' : 'plain' },
                    { label: 'Frequência anterior', value: percent(student.academic.attendancePrevPercent) },
                    { label: 'Módulo atual', value: student.journey.moduleName },
                  ]}
                />
              </Card>
            </div>
          )}

          {tab === 'financeiro' && (
            <Card>
              <CardHeader
                eyebrow="Situação financeira"
                title={student.financial.situation}
                subtitle="Dado sensível: acesso registrado e CPF mascarado conforme a política de LGPD do projeto."
                action={
                  student.financial.overdueCount > 0 ? (
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<MessageSquare className="h-3.5 w-3.5" />}
                      onClick={() =>
                        actions.register({
                          studentId: student.id,
                          caseId: openCases.find((c) => c.radar === 'financeiro')?.id,
                          prefill: { kind: 'Negociação Financeira' },
                        })
                      }
                    >
                      Registrar mediação
                    </Button>
                  ) : undefined
                }
              />

              <DataList
                className="mt-5"
                columns={4}
                items={[
                  { label: 'Mensalidade', value: money(student.financial.monthlyFee) },
                  { label: 'Vencimento', value: `dia ${student.financial.dueDay}` },
                  {
                    label: 'Saldo devedor',
                    value: money(student.financial.outstanding),
                    tone: student.financial.outstanding > 0 ? 'crit' : 'ok',
                  },
                  {
                    label: 'Parcelas em aberto',
                    value: student.financial.overdueCount,
                    tone: student.financial.overdueCount > 0 ? 'crit' : 'ok',
                  },
                  {
                    label: 'Dias em atraso',
                    value: student.financial.daysOverdue,
                    tone: student.financial.daysOverdue > 20 ? 'crit' : student.financial.daysOverdue > 0 ? 'plain' : 'ok',
                  },
                  { label: 'Último pagamento', value: fullDate(student.financial.lastPayment) },
                  { label: 'Bolsa', value: student.financial.scholarshipPercent > 0 ? percent(student.financial.scholarshipPercent) : '—' },
                  {
                    label: 'Negociação',
                    value: student.financial.hasNegotiation ? 'Ativa' : 'Nenhuma',
                  },
                ]}
              />

              <div className="mt-5">
                {student.financial.overdueCount === 0 ? (
                  <Callout tone="ok" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                    Nenhuma pendência financeira. O Radar Financeiro Preventivo não está acionado para
                    este aluno.
                  </Callout>
                ) : student.financial.insidePreventiveWindow ? (
                  <Callout tone="warn" title="Dentro da janela preventiva (D+5 a D+20)">
                    Este é o momento em que o Radar Financeiro existe para atuar. Resolver agora custa uma
                    conversa; em D+45 custa a matrícula. Condições de repactuação estão pré-autorizadas.
                  </Callout>
                ) : (
                  <Callout tone="crit" title="Fora da janela preventiva">
                    O atraso de {student.financial.daysOverdue} dias já ultrapassou a janela de mediação
                    leve. Risco de cobrança externa e impedimento de rematrícula — priorize o contato e
                    mantenha o Freio Concorrente ativo.
                  </Callout>
                )}
              </div>
            </Card>
          )}

          {tab === 'engajamento' && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card>
                <CardHeader
                  eyebrow="Ambiente Virtual de Aprendizagem"
                  title="Ritmo de estudo digital"
                  subtitle={
                    student.modality === 'Presencial'
                      ? 'No presencial o AVA complementa a sala de aula — peso de 15% no Health Score.'
                      : 'No híbrido o AVA carrega o peso que a presença quinzenal não pode carregar — 27% do Health Score.'
                  }
                />

                <div className="mt-5 space-y-5">
                  <div>
                    <div className="flex items-baseline justify-between">
                      <p className="text-[11px] font-medium text-ink-4">
                        Acessos por semana · últimas 8 semanas
                      </p>
                      {drop > 0 && (
                        <span className="font-mono text-[11.5px] font-semibold text-crit-ink">
                          −{drop}% vs. ciclo anterior
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-end gap-1.5">
                      {student.engagement.accessTrend.map((v, i) => {
                        const max = Math.max(...student.engagement.accessTrend, 1);
                        return (
                          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                            <span className="font-mono text-[10px] font-semibold text-ink-4">{v}</span>
                            <div
                              className="w-full rounded-t-[3px] transition-all"
                              style={{
                                height: `${Math.max(3, (v / max) * 70)}px`,
                                backgroundColor:
                                  i >= student.engagement.accessTrend.length - 2 && v < max * 0.4
                                    ? 'var(--crit)'
                                    : 'var(--brand-2)',
                              }}
                            />
                            <span className="font-mono text-[9px] text-ink-4">S{i + 1}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-hairline pt-4">
                    <DataList
                      columns={3}
                      items={[
                        {
                          label: 'Último acesso',
                          value:
                            student.engagement.lastAccessDaysAgo === 0
                              ? 'Hoje'
                              : `há ${student.engagement.lastAccessDaysAgo} dias`,
                          tone: student.engagement.lastAccessDaysAgo >= 7 ? 'crit' : 'plain',
                        },
                        { label: 'Acessos 30 d', value: student.engagement.accessesLast30Days },
                        { label: 'Ciclo anterior', value: student.engagement.accessesPrev30Days },
                        {
                          label: 'Taxa de entrega',
                          value: percent(student.engagement.deliveryRate),
                          tone: student.engagement.deliveryRate < 70 ? 'crit' : 'plain',
                        },
                        { label: 'Horas semanais', value: decimal(student.engagement.weeklyHours, 1) },
                        { label: 'Interações em fórum', value: student.engagement.forumInteractions },
                      ]}
                    />
                  </div>
                </div>
              </Card>

              <div className="space-y-5">
                <Card>
                  <CardHeader eyebrow="Sinais comportamentais" title="Indicadores de atenção" />
                  <ul className="mt-4 space-y-2.5">
                    {[
                      {
                        label: 'App institucional instalado',
                        ok: student.engagement.appInstalled,
                        detail: student.engagement.appInstalled
                          ? 'Canal de push disponível'
                          : 'Sem canal de push — só WhatsApp e e-mail',
                      },
                      {
                        label: 'Acessou página de trancamento',
                        ok: !student.engagement.visitedCancellationPage,
                        detail: student.engagement.visitedCancellationPage
                          ? 'Sinal terminal — tratar com máxima delicadeza'
                          : 'Nenhuma consulta registrada',
                      },
                      {
                        label: 'Entregas em dia',
                        ok: student.engagement.deliveryRate >= 80,
                        detail: `${percent(student.engagement.deliveryRate)} de atividades entregues`,
                      },
                    ].map((row) => (
                      <li key={row.label} className="flex gap-2.5">
                        {row.ok ? (
                          <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0 text-ok" />
                        ) : (
                          <XCircle className="mt-px h-3.5 w-3.5 shrink-0 text-crit" />
                        )}
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-ink">{row.label}</p>
                          <p className="text-[11px] leading-relaxed text-ink-3">{row.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card>
                  <CardHeader eyebrow="Tendência" title="Curva de acessos" />
                  <div className="mt-4 flex justify-center">
                    <Sparkline
                      data={student.engagement.accessTrend}
                      width={240}
                      height={64}
                      color={drop >= 40 ? 'var(--crit)' : 'var(--brand-2)'}
                    />
                  </div>
                </Card>
              </div>
            </div>
          )}

          {tab === 'contatos' && (
            <Card padded={false}>
              <div className="p-5">
                <CardHeader
                  eyebrow={`${interactions.length} atendimentos registrados`}
                  title="Histórico de contatos humanizados"
                  subtitle="Cada registro traz causa, intervenção, resultado e próximo passo — o registro mínimo do protocolo."
                  action={
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() => actions.register({ studentId: student.id, caseId: openCases[0]?.id })}
                    >
                      Novo registro
                    </Button>
                  }
                />
              </div>

              {interactions.length === 0 ? (
                <EmptyState
                  icon={<MessageSquare className="h-5 w-5" />}
                  title="Nenhum contato registrado"
                  message="Todo contato relevante precisa virar registro — é o que permite saber o que aconteceu depois da intervenção."
                />
              ) : (
                <div className="divide-y divide-hairline border-t border-hairline">
                  {interactions.map((i) => (
                    <div key={i.id} className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[12.5px] font-semibold text-ink">
                            {i.kind} via {i.channel}
                          </span>
                          <Pill
                            dot={false}
                            solid
                            tone={
                              i.outcome === 'Resolvido'
                                ? 'ok'
                                : i.outcome === 'Sem contato' || i.outcome === 'Recusou atendimento'
                                  ? 'crit'
                                  : 'warn'
                            }
                          >
                            {i.outcome}
                          </Pill>
                          {i.scoreDelta !== 0 && (
                            <span className="font-mono text-[11px] font-semibold text-ok-ink">
                              +{i.scoreDelta} pts
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10.5px] text-ink-4">
                          {stamp(i.at)} · {i.specialistName}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-3 rounded-lg bg-surface-2 p-3.5 sm:grid-cols-2">
                        {[
                          ['Causa identificada', i.cause],
                          ['Intervenção realizada', i.intervention],
                          ['Resultado', i.result],
                          ['Próximo passo', i.nextStep],
                        ].map(([label, value]) => (
                          <div key={label} className="min-w-0">
                            <p className="text-[11px] font-medium text-ink-4">
                              {label}
                            </p>
                            <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{value}</p>
                          </div>
                        ))}
                      </div>

                      {i.nextStepDate && (
                        <p className="mt-2.5 inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-brand-text">
                          <CalendarClock className="h-3 w-3" />
                          Acompanhamento previsto para {fullDate(i.nextStepDate)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === 'casos' && (
            <Card padded={false}>
              <div className="p-5">
                <CardHeader
                  eyebrow={`${openCases.length} abertos · ${studentCases.length - openCases.length} encerrados`}
                  title="Casos deste aluno"
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() => actions.createCase(student.id)}
                    >
                      Abrir caso
                    </Button>
                  }
                />
              </div>

              {studentCases.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="h-5 w-5 text-ok" />}
                  title="Nenhum caso registrado"
                  message="Este aluno nunca precisou de intervenção acompanhada."
                />
              ) : (
                <div className="divide-y divide-hairline border-t border-hairline">
                  {studentCases.map((c) => (
                    <Row key={c.id} onClick={() => actions.openCase(c.id)}>
                      <div className="flex flex-wrap items-center gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[10.5px] font-semibold text-ink-4">
                              {c.protocol}
                            </span>
                            <PriorityBadge priority={c.priority} />
                            <CaseStatusBadge status={c.status} />
                            <RadarBadge radar={c.radar} />
                          </div>
                          <p className="mt-1.5 text-[12.5px] font-semibold text-ink">{c.title}</p>
                          <p className="mt-0.5 font-mono text-[10.5px] text-ink-4">
                            Aberto {stamp(c.openedAt)}
                            {c.closedAt && ` · encerrado ${stamp(c.closedAt)}`}
                            {c.closingReason && ` · ${c.closingReason}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <SlaPill kase={c} />
                          <ExternalLink className="h-3.5 w-3.5 text-ink-4" />
                        </div>
                      </div>
                    </Row>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
}
