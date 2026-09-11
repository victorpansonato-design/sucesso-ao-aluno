import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Compass,
  MessageSquare,
  Plus,
  ShieldAlert,
  Sparkles,
  Sprout,
} from 'lucide-react';
import type { ShellActions } from '../App';
import { useApp } from '../state/AppContext';
import { pageVariants } from '../lib/motion';
import {
  Callout,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Row,
  SectionLabel,
  StatTile,
} from '../components/ui/Surfaces';
import { Button } from '../components/ui/Button';
import { Segmented } from '../components/ui/Fields';
import { MeterBar } from '../components/ui/Charts';
import { Avatar, HealthBadge, ModalityBadge, Pill } from '../components/ui/Badges';
import { decimal, int, percent } from '../lib/format';
import { TOTAL_ONBOARDING } from '../data/population';
import {
  ONBOARDING_AUTO,
  ONBOARDING_HUMAN,
  ONBOARDING_PENDING,
  TOTAL_FRESHMEN,
} from '../data/institution';

/* ==========================================================================
   Onboarding 90 dias
   --------------------------------------------------------------------------
   The 90-day rule, made operational. Two things happen here that do not happen
   anywhere else in the app:

     · Freshmen are read against adaptation milestones, not against evasion
       signals. A student who has not logged in for nine days on day 22 has an
       onboarding problem, not a retention problem, and the playbook differs.
     · They are held out of the evasion queue and its metrics, so the retention
       rate the Reitoria reads is not diluted by students who have not yet
       started.
   ========================================================================== */

type Window = 'todos' | '0-30' | '31-60' | '61-90';

const WINDOW_LABEL: Record<Window, string> = {
  todos: 'Todos os calouros',
  '0-30': 'Primeiros 30 dias',
  '31-60': '31 a 60 dias',
  '61-90': '61 a 90 dias',
};

export function OnboardingView({ actions }: { actions: ShellActions }) {
  const { students, scopedStudents, settings, cases, updateSettings } = useApp();
  const [window, setWindow] = useState<Window>('todos');

  const freshmen = useMemo(
    () => scopedStudents.filter((s) => s.cohort === 'Calouro'),
    [scopedStudents],
  );

  const inWindow = useMemo(() => {
    if (window === 'todos') return freshmen;
    const [min, max] = window.split('-').map(Number);
    return freshmen.filter(
      (s) => s.journey.daysSinceEnrollment >= min && s.journey.daysSinceEnrollment <= max,
    );
  }, [freshmen, window]);

  /* Milestone completion across the cohort — this is the funnel that matters
     in the first 90 days. */
  const milestones = useMemo(() => {
    const labels = freshmen[0]?.journey.onboardingSteps.map((s) => s.label) ?? [];
    return labels.map((label) => {
      const done = freshmen.filter(
        (s) => s.journey.onboardingSteps.find((x) => x.label === label)?.done,
      ).length;
      return {
        label,
        done,
        total: freshmen.length,
        rate: freshmen.length > 0 ? (done / freshmen.length) * 100 : 0,
      };
    });
  }, [freshmen]);

  const stuck = useMemo(
    () =>
      inWindow
        .filter(
          (s) =>
            s.engagement.lastAccessDaysAgo >= 5 ||
            s.journey.onboardingSteps.filter((x) => x.done).length <= 3 ||
            s.engagement.deliveryRate < 50,
        )
        .sort((a, b) => b.engagement.lastAccessDaysAgo - a.engagement.lastAccessDaysAgo),
    [inWindow],
  );

  const onTrack = inWindow.length - stuck.length;

  /** Quanto da régua fechou sem uma pessoa. Vem do censo, não da amostra. */
  const automationShare =
    TOTAL_FRESHMEN > 0 ? ((TOTAL_FRESHMEN - ONBOARDING_HUMAN) / TOTAL_FRESHMEN) * 100 : 0;

  const freshmenCases = cases.filter((c) => {
    const s = students.find((x) => x.id === c.studentId);
    return s?.cohort === 'Calouro';
  });

  const windowCounts: Record<Window, number> = {
    todos: freshmen.length,
    '0-30': freshmen.filter((s) => s.journey.daysSinceEnrollment <= 30).length,
    '31-60': freshmen.filter(
      (s) => s.journey.daysSinceEnrollment > 30 && s.journey.daysSinceEnrollment <= 60,
    ).length,
    '61-90': freshmen.filter(
      (s) => s.journey.daysSinceEnrollment > 60 && s.journey.daysSinceEnrollment <= 90,
    ).length,
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Régua de acolhimento · regra dos 90 dias"
        title="Onboarding 90 dias"
        description="Calouro em adaptação não é aluno em evasão. Esta trilha acompanha ambientação, primeiro acesso e primeiras entregas — separada da fila de retenção para não roubar SLA de quem está em risco real nem distorcer os indicadores."
        actions={
          <Button
            variant="secondary"
            icon={<ArrowRight className="h-3.5 w-3.5" />}
            onClick={() => actions.goto('governanca')}
          >
            Ajustar janela ({settings.onboardingWindowDays}d)
          </Button>
        }
      >
        <Segmented<Window>
          layoutId="onboarding-window"
          value={window}
          onChange={setWindow}
          options={(Object.keys(WINDOW_LABEL) as Window[]).map((k) => ({
            value: k,
            label: WINDOW_LABEL[k],
            count: windowCounts[k],
          }))}
        />
      </PageHeader>

      <Callout
        tone={settings.segregateOnboarding ? 'ok' : 'warn'}
        icon={<ShieldAlert className="h-3.5 w-3.5" />}
        title={
          settings.segregateOnboarding
            ? 'Segregação ativa — calouros fora do Radar de Evasão'
            : 'Segregação desligada — calouros entram no Radar de Evasão'
        }
      >
        {settings.segregateOnboarding ? (
          <>
            Os {freshmen.length} calouros deste escopo não geram alerta de evasão e não entram no cálculo
            de retenção da base de veteranos.{' '}
            <button
              onClick={() => updateSettings({ segregateOnboarding: false })}
              className="font-semibold text-brand-text underline hover:text-brand-2"
            >
              Desligar segregação
            </button>
          </>
        ) : (
          <>
            Calouros estão sendo avaliados pelas mesmas regras dos veteranos, o que produz falsos
            positivos de evasão e polui a taxa de retenção.{' '}
            <button
              onClick={() => updateSettings({ segregateOnboarding: true })}
              className="font-semibold text-brand-text underline hover:text-brand-2"
            >
              Reativar segregação
            </button>
          </>
        )}
      </Callout>

      {/* ---- A razão de existir do projeto, em uma linha -------------------
              O único elemento em azul preenchido desta tela, e ele é o que
              justifica a régua inteira: a régua rodou até o fim, sozinha, para
              a esmagadora maioria dos ingressantes. Cada ponto que sai desta
              conta é uma ligação que a equipe teve de fazer. Quando este número
              cai, é a automação que está falhando — não a equipe. */}
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-xl bg-brand px-5 py-4 sm:px-6">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[38px] leading-none font-medium tracking-tight text-on-brand">
            {decimal(automationShare, 1)}
            <span className="text-[24px] text-on-brand/60">%</span>
          </span>
          <span className="max-w-xs text-[13px] leading-snug text-on-brand/85">
            da régua de onboarding concluiu <strong className="font-semibold">sem</strong> intervenção
            humana
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
          {[
            { label: 'automático', value: ONBOARDING_AUTO },
            { label: 'pendência na régua', value: ONBOARDING_PENDING },
            { label: 'intervenção humana', value: ONBOARDING_HUMAN },
          ].map((item) => (
            <span key={item.label} className="min-w-0">
              <span className="block font-mono text-[17px] leading-none font-medium text-on-brand">
                {int(item.value)}
              </span>
              <span className="mt-1 block text-[11px] text-on-brand/70">{item.label}</span>
            </span>
          ))}
          <button
            onClick={() => actions.goto('dashboard')}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-medium text-on-brand transition-colors hover:bg-white/25"
            title="Ver o recorte de automação por curso, modalidade e período"
          >
            Abrir no Dashboard
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Calouros na instituição"
          value={int(TOTAL_ONBOARDING)}
          icon={<Sprout className="h-3.5 w-3.5" />}
          footer={
            <span>
              {int(inWindow.length)} em acompanhamento · janela de{' '}
              {settings.onboardingWindowDays} dias
            </span>
          }
        />
        <StatTile
          label="Ambientação em curso"
          value={int(onTrack)}
          accent="var(--ok)"
          footer={
            <span>{percent((onTrack / Math.max(1, inWindow.length)) * 100)} da janela em ritmo</span>
          }
        />
        <StatTile
          label="Precisam de contato"
          value={int(stuck.length)}
          accent={stuck.length > 0 ? 'var(--crit)' : undefined}
          icon={<ShieldAlert className="h-3.5 w-3.5" />}
          footer={<span>sem acesso, sem entrega ou sem integração</span>}
        />
        <StatTile
          label="Casos de onboarding"
          value={int(freshmenCases.length)}
          onClick={() => actions.goto('fila')}
          footer={
            <>
              <span>na fila operacional</span>
              <ArrowRight className="h-3 w-3" />
            </>
          }
        />
      </div>

      {/* ---- Milestone funnel -------------------------------------------- */}
      <Card>
        <CardHeader
          eyebrow="Funil de ambientação"
          title="Marcos da régua de acolhimento"
          subtitle="Percentual de calouros que concluíram cada etapa. A primeira queda acentuada é onde a régua precisa de reforço."
        />

        <div className="mt-5 space-y-4">
          {milestones.length === 0 ? (
            <p className="text-[12.5px] text-ink-4">Nenhum calouro no escopo atual.</p>
          ) : (
            milestones.map((m, i) => {
              const previous = milestones[i - 1];
              const drop = previous ? previous.rate - m.rate : 0;
              return (
                <div key={m.label} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-2 text-[12.5px] font-medium text-ink-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 font-mono text-[10px] font-semibold text-ink-4">
                        {i + 1}
                      </span>
                      {m.label}
                    </span>
                    <span className="shrink-0 font-mono text-[12px] font-semibold text-ink">
                      {m.done}
                      <span className="font-normal text-ink-4">/{m.total}</span>
                      <span className="ml-2 text-ink-3">{percent(m.rate)}</span>
                      {drop > 20 && (
                        <span className="ml-2 font-semibold text-crit-ink">−{Math.round(drop)} p.p.</span>
                      )}
                    </span>
                  </div>
                  <MeterBar
                    value={m.rate}
                    color={m.rate >= 80 ? 'var(--ok)' : m.rate >= 50 ? 'var(--warn)' : 'var(--crit)'}
                    delay={i * 0.05}
                  />
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* ---- Needs contact ----------------------------------------------- */}
      <div className="space-y-3">
        <SectionLabel>Calouros que precisam de contato ({stuck.length})</SectionLabel>

        <Card padded={false}>
          {stuck.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5 text-ok" />}
              title="Toda a turma está em ritmo"
              message="Nenhum calouro desta janela está sem acesso, sem entrega ou sem integração."
            />
          ) : (
            <div className="divide-y divide-hairline">
              {stuck.map((s) => {
                const doneSteps = s.journey.onboardingSteps.filter((x) => x.done).length;
                const totalSteps = s.journey.onboardingSteps.length;

                return (
                  <Row key={s.id} tone={s.engagement.lastAccessDaysAgo >= 7 ? 'crit' : 'plain'}>
                    <div className="flex flex-col gap-2.5 px-5 py-3 lg:flex-row lg:items-center lg:gap-5">
                      <button
                        onClick={() => actions.openStudent(s.id)}
                        className="group flex min-w-0 flex-1 items-start gap-3 text-left"
                      >
                        <Avatar initials={s.initials} size="md" tone={s.status} />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-[13px] font-semibold text-ink group-hover:underline">
                              {s.name}
                            </span>
                            <HealthBadge status={s.status} />
                            <ModalityBadge modality={s.modality} />
                            <Pill tone="info" solid dot={false}>
                              dia {s.journey.daysSinceEnrollment}
                            </Pill>
                          </span>
                          <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">
                            {s.course} · {s.period}º período · {s.campus}
                          </span>

                          {/* Milestone dots */}
                          <span className="mt-2 flex flex-wrap items-center gap-1.5">
                            {s.journey.onboardingSteps.map((step) => (
                              <span
                                key={step.label}
                                title={step.label}
                                className={[
                                  'inline-flex items-center gap-1 rounded-sm bg-surface-2 px-1.5 py-0.5 text-[11px]',
                                  step.done ? 'font-medium text-ink-2' : 'text-ink-4',
                                ].join(' ')}
                              >
                                {step.done ? (
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                ) : (
                                  <Circle className="h-2.5 w-2.5" />
                                )}
                                {step.label}
                              </span>
                            ))}
                          </span>
                        </span>
                      </button>

                      <div className="flex shrink-0 items-center gap-5 border-t border-hairline pt-3 lg:border-t-0 lg:pt-0">
                        <div className="w-20">
                          <p className="text-[11px] font-medium text-ink-4">
                            Último AVA
                          </p>
                          <p
                            className={[
                              'font-mono text-[14px] font-semibold',
                              s.engagement.lastAccessDaysAgo >= 7 ? 'text-crit-ink' : 'text-ink',
                            ].join(' ')}
                          >
                            {s.engagement.lastAccessDaysAgo === 0
                              ? 'hoje'
                              : `${s.engagement.lastAccessDaysAgo} d`}
                          </p>
                        </div>

                        <div className="w-24">
                          <p className="text-[11px] font-medium text-ink-4">
                            Marcos
                          </p>
                          <p className="font-mono text-[14px] font-semibold text-ink">
                            {doneSteps}
                            <span className="text-[11px] font-normal text-ink-4">/{totalSteps}</span>
                          </p>
                          <div className="mt-1.5">
                            <MeterBar
                              value={doneSteps}
                              max={totalSteps}
                              color={doneSteps >= totalSteps - 1 ? 'var(--ok)' : 'var(--warn)'}
                              height={4}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Compass className="h-3.5 w-3.5" />}
                            onClick={() => actions.goto('trilha', s.ra)}
                          >
                            Trilha
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            square
                            title="Copiloto de acolhimento"
                            onClick={() => actions.copilot(s.id)}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            square
                            title="Abrir caso de onboarding"
                            onClick={() => actions.createCase(s.id)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            icon={<MessageSquare className="h-3.5 w-3.5" />}
                            onClick={() =>
                              actions.register({
                                studentId: s.id,
                                prefill: { kind: 'Acolhimento', channel: 'WhatsApp' },
                              })
                            }
                          >
                            Acolher
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Row>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ---- Playbook reminder ------------------------------------------- */}
      <Card>
        <CardHeader
          eyebrow="Diretriz da régua"
          title="Como conduzir um contato de onboarding"
          subtitle="A abordagem é diferente da retenção: aqui o objetivo é reduzir atrito, não reverter uma decisão."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: 'Comunicação progressiva',
              body: 'Não entregue o pacote completo de informações de uma vez. Primeiro o essencial, depois o que se torna relevante conforme a data de início.',
            },
            {
              title: 'Demonstração guiada',
              body: 'Abrir o AVA junto com o aluno, pelo celular, resolve a maioria dos casos. Instale o app durante a própria chamada.',
            },
            {
              title: 'Nada de tom de cobrança',
              body: 'O calouro ainda está decidindo se pertence. Uma mensagem que soa como advertência acelera a saída.',
            },
            {
              title: 'Primeira entrega é o marco',
              body: 'A primeira atividade entregue é o preditor mais forte de permanência. Feche o contato com ela combinada.',
            },
          ].map((tip) => (
            <div key={tip.title} className="rounded-lg bg-surface-2 p-3.5">
              <p className="text-[12px] font-semibold text-ink">{tip.title}</p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3">{tip.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-hairline pt-4">
          <Button
            size="sm"
            variant="secondary"
            iconRight={<ArrowRight className="h-3.5 w-3.5" />}
            onClick={() => actions.goto('playbook')}
          >
            Ver playbook completo com roteiros
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
