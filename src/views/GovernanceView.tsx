import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Clock,
  Lock,
  RotateCcw,
  Scale,
  ShieldCheck,
  Sprout,
  Undo2,
} from 'lucide-react';
import type { Modality, RadarKey, ScoreDimension } from '../types';
import { useApp } from '../state/AppContext';
import { pageVariants } from '../lib/motion';
import { Callout, Card, CardHeader, PageHeader, SectionLabel, StatTile } from '../components/ui/Surfaces';
import { Button } from '../components/ui/Button';
import { Field, Segmented, Switch, TextInput } from '../components/ui/Fields';
import { MeterBar } from '../components/ui/Charts';
import { HealthBadge, Pill, RadarBadge } from '../components/ui/Badges';
import { DEFAULT_WEIGHTS, DIMENSION_LABEL, PROFILE_LABEL } from '../lib/healthScore';
import { RADARS, RADAR_ORDER } from '../lib/radars';
import { MODALITIES } from '../data/catalog';
import { int, percent } from '../lib/format';

/* ==========================================================================
   Governança
   --------------------------------------------------------------------------
   The parameters that shape the whole operation, editable and immediately
   consequential: changing a weight profile here re-scores and re-ranks every
   student in the base on the spot. That is deliberate — a knob whose effect you
   cannot see is a knob nobody trusts enough to turn.
   ========================================================================== */

const DIMENSIONS: ScoreDimension[] = [
  'academico',
  'presenca',
  'engajamento',
  'financeiro',
  'relacionamento',
];

export function GovernanceView() {
  const { settings, updateSettings, updateWeights, restoreDemoBase, students, toast } = useApp();
  const [profile, setProfile] = useState<Modality>('Presencial');
  const [confirmReset, setConfirmReset] = useState(false);

  const weights = settings.weights[profile];
  const total = DIMENSIONS.reduce((sum, d) => sum + weights[d], 0);
  const isDefault = DIMENSIONS.every((d) => weights[d] === DEFAULT_WEIGHTS[profile][d]);

  const setWeight = (dimension: ScoreDimension, raw: number) => {
    const value = Math.max(0, Math.min(60, Math.round(raw)));
    updateWeights(profile, { ...weights, [dimension]: value });
  };

  const impact = useMemo(() => {
    const cohort = students.filter((s) => s.modality === profile);
    return {
      count: cohort.length,
      avg:
        cohort.length > 0
          ? Math.round(cohort.reduce((sum, s) => sum + s.healthScore, 0) / cohort.length)
          : 0,
      critical: cohort.filter((s) => s.status === 'Crítico').length,
      risk: cohort.filter((s) => s.status === 'Risco').length,
      attention: cohort.filter((s) => s.status === 'Atenção').length,
      stable: cohort.filter((s) => s.status === 'Estável').length,
    };
  }, [students, profile]);

  const freshmen = students.filter(
    (s) => s.journey.daysSinceEnrollment <= settings.onboardingWindowDays,
  ).length;

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Parâmetros e conformidade"
        title="Governança"
        description="As regras que governam a detecção, a priorização e a proteção do aluno. Toda alteração aqui recalcula a base imediatamente — um parâmetro cujo efeito não se vê é um parâmetro que ninguém confia."
      />

      {/* ---- Health Score weights ---------------------------------------- */}
      <div className="space-y-3">
        <SectionLabel>Composição do Health Score por modalidade</SectionLabel>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <CardHeader
              eyebrow="Perfil de peso"
              title={PROFILE_LABEL[profile]}
              subtitle="Contar a presença física de um aluno híbrido do mesmo jeito que a de um presencial está simplesmente errado. Aqui é onde essa diferença é declarada."
            />
            <Segmented<Modality>
              layoutId="governance-profile"
              value={profile}
              onChange={setProfile}
              options={MODALITIES.map((m) => ({ value: m, label: m }))}
            />
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-4">
              {DIMENSIONS.map((dimension) => (
                <div key={dimension} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <label
                      htmlFor={`weight-${dimension}`}
                      className="text-[12.5px] font-semibold text-ink"
                    >
                      {DIMENSION_LABEL[dimension]}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id={`weight-${dimension}`}
                        type="range"
                        min={0}
                        max={50}
                        step={1}
                        value={weights[dimension]}
                        onChange={(e) => setWeight(dimension, Number(e.target.value))}
                        className="h-1.5 w-40 cursor-pointer accent-[var(--brand)]"
                      />
                      <span className="w-12 shrink-0 text-right font-mono text-[13px] font-semibold text-ink">
                        {weights[dimension]}%
                      </span>
                    </div>
                  </div>
                  <MeterBar
                    value={weights[dimension]}
                    max={50}
                    color={
                      weights[dimension] !== DEFAULT_WEIGHTS[profile][dimension]
                        ? 'var(--warn)'
                        : 'var(--brand-2)'
                    }
                    height={4}
                  />
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-ink-4">
                    Total
                  </span>
                  <span
                    className={[
                      'font-mono text-[16px] font-semibold',
                      total === 100 ? 'text-ok-ink' : 'text-warn-ink',
                    ].join(' ')}
                  >
                    {total}%
                  </span>
                  {total !== 100 && (
                    <span className="text-[11.5px] text-warn-ink">
                      O score máximo passa a ser {total} pontos.
                    </span>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Undo2 className="h-3.5 w-3.5" />}
                  disabled={isDefault}
                  onClick={() => {
                    updateWeights(profile, DEFAULT_WEIGHTS[profile]);
                    toast('info', 'Perfil restaurado', `Pesos padrão do modelo ${profile} reaplicados.`);
                  }}
                >
                  Restaurar padrão
                </Button>
              </div>
            </div>

            {/* Live impact */}
            <aside className="rounded-lg bg-surface-2 p-4">
              <p className="text-[11px] font-medium text-ink-4">
                Impacto imediato · {profile}
              </p>

              <div className="mt-3.5 text-center">
                <p className="font-mono text-[34px] leading-none font-semibold text-ink">{impact.avg}</p>
                <p className="mt-1 text-[11px] text-ink-3">
                  Health Score médio de {impact.count} alunos
                </p>
              </div>

              <div className="mt-4 space-y-2 border-t border-hairline pt-3.5">
                {[
                  { status: 'Estável' as const, value: impact.stable },
                  { status: 'Atenção' as const, value: impact.attention },
                  { status: 'Risco' as const, value: impact.risk },
                  { status: 'Crítico' as const, value: impact.critical },
                ].map((row) => (
                  <div key={row.status} className="flex items-center justify-between gap-2">
                    <HealthBadge status={row.status} />
                    {/* Contagem e percentual em células separadas por um fio.
                        Encostados com uma margem de 6px, `14` e `26%` liam como
                        `1426%` — o mesmo defeito que a distribuição do Health
                        Score tinha em Indicadores. */}
                    <span className="flex shrink-0 items-center font-mono text-[12px]">
                      <span className="w-10 text-right font-semibold text-ink tabular">
                        {int(row.value)}
                      </span>
                      <span className="mx-2 h-3.5 w-px bg-hairline" aria-hidden="true" />
                      <span className="w-12 text-right font-normal text-ink-4 tabular">
                        {percent((row.value / Math.max(1, impact.count)) * 100)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-3.5 border-t border-hairline pt-3 text-[11px] leading-relaxed text-ink-4">
                Estes números mudam enquanto você move os controles — a reclassificação é aplicada em
                toda a base no mesmo instante.
              </p>
            </aside>
          </div>
        </Card>
      </div>

      {/* ---- SLA per radar ----------------------------------------------- */}
      <div className="space-y-3">
        <SectionLabel>SLA por radar · em horas úteis</SectionLabel>

        <Card>
          <CardHeader
            eyebrow="Prazos de resposta"
            title="Quanto tempo cada tipo de sinal pode esperar"
            subtitle="Contado em horas úteis: um caso aberto às 21h40 de uma sexta vence na manhã de segunda, não à 01h40 do sábado."
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {RADAR_ORDER.map((key) => (
              <Field
                key={key}
                label={RADARS[key].label}
                help={RADARS[key].purpose.split('.')[0] + '.'}
              >
                {(id) => (
                  <div className="flex items-center gap-2">
                    <TextInput
                      id={id}
                      type="number"
                      min={1}
                      max={168}
                      value={settings.slaHours[key]}
                      onChange={(e) => {
                        const value = Math.max(1, Math.min(168, Number(e.target.value) || 1));
                        updateSettings({ slaHours: { ...settings.slaHours, [key]: value } });
                      }}
                      className="w-24 font-mono font-semibold"
                    />
                    <span className="font-mono text-[11.5px] text-ink-4">horas úteis</span>
                    {settings.slaHours[key] !== RADARS[key].defaultSlaHours && (
                      <Pill tone="warn" solid dot={false}>
                        padrão {RADARS[key].defaultSlaHours}h
                      </Pill>
                    )}
                  </div>
                )}
              </Field>
            ))}
          </div>

          <div className="mt-5 grid gap-4 border-t border-hairline pt-5 sm:grid-cols-3">
            <Field label="Início do expediente" help="Hora em que o SLA começa a contar.">
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  min={0}
                  max={23}
                  value={settings.businessHours.start}
                  onChange={(e) =>
                    updateSettings({
                      businessHours: {
                        ...settings.businessHours,
                        start: Math.max(0, Math.min(23, Number(e.target.value) || 0)),
                      },
                    })
                  }
                  className="w-24 font-mono font-semibold"
                />
              )}
            </Field>
            <Field label="Fim do expediente (seg–sex)" help="Campus noturno costuma encerrar às 22h.">
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  min={1}
                  max={24}
                  value={settings.businessHours.end}
                  onChange={(e) =>
                    updateSettings({
                      businessHours: {
                        ...settings.businessHours,
                        end: Math.max(1, Math.min(24, Number(e.target.value) || 1)),
                      },
                    })
                  }
                  className="w-24 font-mono font-semibold"
                />
              )}
            </Field>
            <Field label="Fim do expediente (sábado)" help="Domingo é considerado fechado.">
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  min={0}
                  max={24}
                  value={settings.businessHours.saturdayEnd}
                  onChange={(e) =>
                    updateSettings({
                      businessHours: {
                        ...settings.businessHours,
                        saturdayEnd: Math.max(0, Math.min(24, Number(e.target.value) || 0)),
                      },
                    })
                  }
                  className="w-24 font-mono font-semibold"
                />
              )}
            </Field>
          </div>

          <Callout tone="info" icon={<Clock className="h-3.5 w-3.5" />}>
            Janela atual: segunda a sexta de {settings.businessHours.start}h às {settings.businessHours.end}h,
            sábado de {settings.businessHours.start}h às {settings.businessHours.saturdayEnd}h. Todos os
            contadores de SLA da fila usam exatamente esta janela.
          </Callout>
        </Card>
      </div>

      {/* ---- Rules ------------------------------------------------------- */}
      <div className="space-y-3">
        <SectionLabel>Regras de operação e proteção</SectionLabel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              eyebrow="Regra dos 90 dias"
              title="Segregação de calouros"
              subtitle="Aluno em adaptação e aluno em evasão não são o mesmo problema, e tratá-los na mesma fila distorce a taxa de retenção."
            />

            <div className="mt-5 space-y-4">
              <Field
                label="Janela de onboarding"
                help="Dias de matrícula em que o aluno é acompanhado pela régua de acolhimento."
              >
                {(id) => (
                  <div className="flex items-center gap-2">
                    <TextInput
                      id={id}
                      type="number"
                      min={15}
                      max={180}
                      value={settings.onboardingWindowDays}
                      onChange={(e) =>
                        updateSettings({
                          onboardingWindowDays: Math.max(
                            15,
                            Math.min(180, Number(e.target.value) || 90),
                          ),
                        })
                      }
                      className="w-24 font-mono font-semibold"
                    />
                    <span className="font-mono text-[11.5px] text-ink-4">dias</span>
                    <Pill tone="info" solid dot={false}>
                      {int(freshmen)} calouros na janela
                    </Pill>
                  </div>
                )}
              </Field>

              <Switch
                label="Excluir calouros do Radar de Evasão"
                description="Recomendado. Mantém a régua de acolhimento separada da fila de retenção e preserva a integridade dos indicadores de veteranos."
                checked={settings.segregateOnboarding}
                onChange={(v) => updateSettings({ segregateOnboarding: v })}
              />

              {!settings.segregateOnboarding && (
                <Callout tone="warn" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
                  Com a segregação desligada, os {freshmen} calouros passam a gerar alerta de evasão. Isso
                  aumenta falsos positivos e dilui a taxa de retenção da base de veteranos.
                </Callout>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Freio Concorrente e LGPD"
              title="Proteção do aluno"
              subtitle="A tecnologia deve ajudar a equipe, não substituir o julgamento humano nos casos sensíveis."
            />

            <div className="mt-5 space-y-3">
              <Switch
                label="Humano-Primeiro: ativar freio ao assumir caso"
                description="Quando um especialista assume um caso, réguas de cobrança, marketing e push automáticos são suspensas para aquele aluno."
                checked={settings.humanFirst}
                onChange={(v) => updateSettings({ humanFirst: v })}
              />

              <Switch
                label="Conformidade estrita com a LGPD"
                description="Mascaramento de CPF nas telas gerais e registro auditável de cada leitura de dado sensível."
                checked={settings.lgpdStrict}
                onChange={(v) => updateSettings({ lgpdStrict: v })}
              />

              <div className="rounded-lg bg-surface-2 p-3.5">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                  <Lock className="h-3.5 w-3.5 text-ink-4" />
                  Réguas suspensas quando o freio está ativo
                </p>
                <ul className="mt-2 space-y-1">
                  {[
                    'Régua de cobrança automática',
                    'SMS promocional de rematrícula',
                    'E-mail marketing institucional',
                    'Push de atividade pendente',
                  ].map((rule) => (
                    <li key={rule} className="flex gap-2 text-[11.5px] text-ink-3">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-4" />
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ---- LGPD statement ---------------------------------------------- */}
      <Card>
        <CardHeader
          eyebrow="Finalidade dos dados"
          title="Declaração de tratamento"
          subtitle="Definida desde o primeiro desenho, conforme exige a governança do projeto."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'Finalidade',
              value:
                'Identificar alunos que precisam de apoio e acompanhar o resultado das intervenções humanas.',
            },
            {
              label: 'Dados utilizados',
              value:
                'Cadastro, matrícula, notas, frequência, uso do AVA, situação financeira e histórico de atendimento.',
            },
            {
              label: 'Quem acessa',
              value:
                'Especialistas de Sucesso ao Aluno e coordenação de curso, restrito aos alunos sob sua responsabilidade.',
            },
            {
              label: 'Revisão humana',
              value:
                'O Health Score é um indicador orientativo. Toda decisão sensível passa por análise e registro humanos.',
            },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-surface-2 p-3.5">
              <p className="text-[11px] font-medium text-ink-4">
                {item.label}
              </p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-2">{item.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ---- Reset ------------------------------------------------------- */}
      <Card className="">
        <CardHeader
          eyebrow="Ambiente de demonstração"
          title="Restaurar base de demonstração"
          subtitle="Descarta todos os casos assumidos, interações registradas, acompanhamentos e alterações de parâmetro, voltando ao estado inicial."
          action={
            confirmReset ? (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  icon={<RotateCcw className="h-3.5 w-3.5" />}
                  onClick={() => {
                    restoreDemoBase();
                    setConfirmReset(false);
                  }}
                >
                  Confirmar restauração
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                icon={<RotateCcw className="h-3.5 w-3.5" />}
                onClick={() => setConfirmReset(true)}
              >
                Restaurar
              </Button>
            )
          }
        />

        {confirmReset && (
          <div className="mt-4">
            <Callout tone="crit" icon={<AlertTriangle className="h-3.5 w-3.5" />} title="Ação irreversível">
              Todo o trabalho registrado nesta sessão será perdido. Isso inclui casos assumidos, contatos
              registrados, acordos firmados e ajustes de peso e SLA.
            </Callout>
          </div>
        )}
      </Card>

      {/* ---- Summary tiles ----------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Perfis de peso"
          value={MODALITIES.length}
          icon={<Scale className="h-3.5 w-3.5" />}
          footer={<span>{MODALITIES.join(' · ')}</span>}
        />
        <StatTile
          label="Radares configurados"
          value={RADAR_ORDER.length}
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          footer={
            <span className="flex flex-wrap gap-1">
              {RADAR_ORDER.map((k) => (
                <RadarBadge key={k} radar={k as RadarKey} />
              ))}
            </span>
          }
        />
        <StatTile
          label="Janela de onboarding"
          value={settings.onboardingWindowDays}
          detail="dias"
          icon={<Sprout className="h-3.5 w-3.5" />}
          footer={<span>{settings.segregateOnboarding ? 'segregação ativa' : 'segregação desligada'}</span>}
        />
        <StatTile
          label="Alunos na base"
          value={int(students.length)}
          footer={<span>{freshmen} calouros · {students.length - freshmen} veteranos</span>}
        />
      </div>
    </motion.div>
  );
}
