import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Laptop,
  Layers,
  School,
  Scale,
} from 'lucide-react';
import type { Modality } from '../types';
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
import { Button, LinkButton } from '../components/ui/Button';
import { Segmented } from '../components/ui/Fields';
import { MeterBar, StackedBar } from '../components/ui/Charts';
import { Avatar, HealthBadge, ModalityBadge, Pill } from '../components/ui/Badges';
import { DIMENSION_LABEL } from '../lib/healthScore';
import { decimal, int, percent } from '../lib/format';
import { BASE_POPULATION } from '../data/catalog';

/* ==========================================================================
   Jornada por Modalidade
   --------------------------------------------------------------------------
   Answers the second loose end from the spec: the hybrid and fully-online
   journeys are not the on-campus journey with fewer classes. They have their
   own calendars, their own risks and — critically — their own Health Score
   weight profile, which is shown here alongside the funnel so the attendant
   understands *why* the same behaviour scores differently across modalities.
   ========================================================================== */

interface StageDef {
  id: string;
  title: string;
  description: string;
  risk: string;
  matches: (progress: number, days: number) => boolean;
}

const STAGES: Record<Modality, StageDef[]> = {
  Presencial: [
    {
      id: 'ambientacao',
      title: 'Ambientação no campus',
      description: 'Primeiras semanas: turma, horários, deslocamento e rotina noturna ou matutina.',
      risk: 'Dificuldade de conciliar deslocamento com trabalho.',
      matches: (_, days) => days <= 90,
    },
    {
      id: 'rotina',
      title: 'Rotina acadêmica',
      description: 'Frequência estabilizada, primeiras avaliações e uso do AVA como complemento.',
      risk: 'Faltas acumuladas em disciplina específica.',
      matches: (p) => p > 0 && p <= 35,
    },
    {
      id: 'meio',
      title: 'Meio de curso',
      description: 'Fase de maior desgaste: carga somada, estágio e dependências aparecem.',
      risk: 'Dependência acumulada e desgaste de rotina.',
      matches: (p) => p > 35 && p <= 65,
    },
    {
      id: 'reta',
      title: 'Reta final',
      description: 'Estágio supervisionado, TCC e integralização da matriz.',
      risk: 'Pendência financeira travando a rematrícula final.',
      matches: (p) => p > 65 && p <= 88,
    },
    {
      id: 'conclusao',
      title: 'Conclusão',
      description: 'Colação, documentação e transição para egresso.',
      risk: 'Pendência documental ou financeira impedindo o diploma.',
      matches: (p) => p > 88,
    },
  ],
  Híbrido: [
    {
      id: 'onboarding-h',
      title: 'Primeiro acesso e reconhecimento do modelo',
      description:
        'Duas primeiras semanas: entender o que é digital, o que é presencial e quando são os encontros.',
      risk: 'Não realizar o primeiro login ou não localizar a turma.',
      matches: (_, days) => days <= 90,
    },
    {
      id: 'modulo-1',
      title: 'Primeiro módulo e encontro quinzenal',
      description: 'Início do bloco, primeira aula síncrona e primeiro estudo dirigido.',
      risk: 'Perder o primeiro encontro quinzenal.',
      matches: (p) => p > 0 && p <= 30,
    },
    {
      id: 'rotina-modular',
      title: 'Rotina modular e autonomia guiada',
      description: 'Módulos bimestrais, fóruns de tutoria e autoestudo programado.',
      risk: 'Acúmulo de videoaulas nas 72 h antes do fechamento.',
      matches: (p) => p > 30 && p <= 62,
    },
    {
      id: 'avaliacoes',
      title: 'Avaliações modulares e práticas',
      description: 'Fechamento de notas do bloco e laboratórios presenciais aplicados.',
      risk: 'Confusão de calendário levando à perda de prazo.',
      matches: (p) => p > 62 && p <= 88,
    },
    {
      id: 'renovacao',
      title: 'Renovação e continuidade',
      description: 'Confirmação dos módulos seguintes e alinhamento do plano de estudos.',
      risk: 'Pendência financeira ou pedido de mudança de polo.',
      matches: (p) => p > 88,
    },
  ],
  EaD: [
    {
      id: 'ativacao',
      title: 'Ativação da plataforma',
      description: 'Login, reconhecimento da trilha e primeira interação no fórum.',
      risk: 'Não ativar a plataforma nos primeiros 15 dias.',
      matches: (_, days) => days <= 90,
    },
    {
      id: 'ritmo',
      title: 'Construção de ritmo',
      description: 'Estabelecer cadência semanal de estudo sem a âncora de um horário fixo.',
      risk: 'Sem rotina externa, o estudo simplesmente não acontece.',
      matches: (p) => p > 0 && p <= 35,
    },
    {
      id: 'sprints',
      title: 'Sprints e entregas',
      description: 'Entregas quinzenais avaliadas, tutoria assíncrona e projetos aplicados.',
      risk: 'Duas sprints consecutivas sem entrega.',
      matches: (p) => p > 35 && p <= 70,
    },
    {
      id: 'conclusao-ead',
      title: 'Conclusão e certificação',
      description: 'Últimos módulos, avaliação integradora e emissão do certificado.',
      risk: 'Abandono na última etapa por perda de vínculo institucional.',
      matches: (p) => p > 70,
    },
  ],
};

const MODALITY_PROFILE: Record<
  Modality,
  { headline: string; focus: string[]; risks: string[]; attendanceNote: string }
> = {
  Presencial: {
    headline: 'A presença física é o sinal de engajamento de maior fidelidade.',
    focus: ['Rotina de campus', 'Frequência por disciplina', 'Turmas e horários', 'Encontros presenciais'],
    risks: [
      'Faltas consecutivas na mesma disciplina',
      'Deslocamento incompatível com estágio ou trabalho',
      'Reprovação por frequência antes da reprovação por nota',
    ],
    attendanceNote:
      'Frequência responde por 25% do Health Score: uma sequência de faltas move o número imediatamente.',
  },
  Híbrido: {
    headline: 'A presença é quinzenal, então uma falta não pode ser lida como abandono.',
    focus: ['Módulos e blocos', 'Encontros quinzenais', 'Atividades no AVA', 'Compreensão do calendário'],
    risks: [
      'Confusão sobre o que é digital e o que é presencial',
      'Atividade não entregue por perda de prazo do módulo',
      'Falta em encontro síncrono contando como 25% do total permitido',
    ],
    attendanceNote:
      'Presença cai para 15% e o engajamento no AVA sobe para 27%: no híbrido, o login carrega o peso que a frequência não pode carregar.',
  },
  EaD: {
    headline: 'O AVA é a sala de aula. Sem login, não há aula.',
    focus: ['Trilha assíncrona', 'Sprints de entrega', 'Tutoria por fórum', 'Autonomia de rotina'],
    risks: [
      'Ausência de rotina externa que ancore o estudo',
      'Sprints acumuladas sem entrega',
      'Perda de vínculo institucional por falta de contato humano',
    ],
    attendanceNote:
      'Presença vale apenas 5% e o engajamento no AVA responde por 37% do Health Score — é o eixo central da avaliação.',
  },
};

export function JourneyView({ actions }: { actions: ShellActions }) {
  const { students, settings, scopedStudents } = useApp();
  const [modality, setModality] = useState<Modality>('Híbrido');

  const cohort = useMemo(() => students.filter((s) => s.modality === modality), [students, modality]);
  const stages = STAGES[modality];
  const profile = MODALITY_PROFILE[modality];
  const weights = settings.weights[modality];

  const stageRows = useMemo(
    () =>
      stages.map((stage) => {
        const members = cohort.filter((s) =>
          stage.matches(s.journey.progressPercent, s.journey.daysSinceEnrollment),
        );
        const atRisk = members.filter((s) => s.status === 'Risco' || s.status === 'Crítico').length;
        return {
          ...stage,
          members,
          atRisk,
          avgScore:
            members.length > 0
              ? Math.round(members.reduce((sum, s) => sum + s.healthScore, 0) / members.length)
              : 0,
        };
      }),
    [stages, cohort],
  );

  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const visible = selectedStage
    ? (stageRows.find((s) => s.id === selectedStage)?.members ?? [])
    : cohort;

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Jornadas diferentes, réguas diferentes"
        title="Jornada por Modalidade"
        description="Presencial, híbrido e EaD não são o mesmo curso com menos aulas. Cada modelo tem calendário, riscos e — decisivo para o Health Score — perfil de pesos próprio."
        actions={
          <Button
            variant="secondary"
            icon={<Scale className="h-3.5 w-3.5" />}
            onClick={() => actions.goto('governanca')}
          >
            Editar pesos
          </Button>
        }
      >
        <Segmented<Modality>
          layoutId="journey-modality"
          value={modality}
          onChange={(v) => {
            setModality(v);
            setSelectedStage(null);
          }}
          options={[
            { value: 'Presencial', label: 'Presencial', icon: <School className="h-3 w-3" />, count: students.filter((s) => s.modality === 'Presencial').length },
            { value: 'Híbrido', label: 'Híbrido', icon: <Layers className="h-3 w-3" />, count: students.filter((s) => s.modality === 'Híbrido').length },
            { value: 'EaD', label: 'EaD 100%', icon: <Laptop className="h-3 w-3" />, count: students.filter((s) => s.modality === 'EaD').length },
          ]}
        />
      </PageHeader>

      {/* ---- Weight profile: the answer to "why is my score different?" --- */}
      <Card tone="band" padded={false}>
        <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0">
            <CardHeader
              tone="band"
              eyebrow={`Perfil de peso · ${modality === 'EaD' ? 'EaD 100%' : modality}`}
              title={profile.headline}
              subtitle={profile.attendanceNote}
            />

            <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                tone="band"
                label="Alunos na base"
                value={int(BASE_POPULATION[modality])}
                footer={<span>{cohort.length} na amostra</span>}
              />
              <StatTile
                tone="band"
                label="Health Score médio"
                value={
                  cohort.length > 0
                    ? Math.round(cohort.reduce((s, x) => s + x.healthScore, 0) / cohort.length)
                    : 0
                }
                footer={<span>de 100 pontos</span>}
              />
              <StatTile
                tone="band"
                label="Em risco ou crítico"
                value={cohort.filter((s) => s.status === 'Risco' || s.status === 'Crítico').length}
                footer={
                  <span>
                    {percent(
                      (cohort.filter((s) => s.status === 'Risco' || s.status === 'Crítico').length /
                        Math.max(1, cohort.length)) *
                        100,
                    )}{' '}
                    da amostra
                  </span>
                }
              />
              <StatTile
                tone="band"
                label="Calouros"
                value={cohort.filter((s) => s.cohort === 'Calouro').length}
                footer={<span>janela de {settings.onboardingWindowDays} dias</span>}
              />
            </div>
          </div>

          <aside className="rounded-xl border border-band-line bg-band-inset p-4">
            <p className="font-mono text-[10px] font-bold tracking-[0.1em] text-band-ink-2 uppercase">
              Composição do Health Score nesta modalidade
            </p>

            <div className="mt-3.5 space-y-2.5">
              {(Object.keys(weights) as (keyof typeof weights)[]).map((dim) => (
                <div key={dim} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[11.5px] font-medium text-band-ink-2">
                      {DIMENSION_LABEL[dim]}
                    </span>
                    <span className="shrink-0 font-mono text-[12px] font-bold text-band-ink">
                      {weights[dim]}%
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-white/80"
                      style={{ width: `${(weights[dim] / 40) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-3.5 border-t border-band-line pt-3 font-mono text-[10.5px] text-band-ink-2">
              Total {totalWeight} pontos ·{' '}
              <button
                onClick={() => actions.goto('governanca')}
                className="font-bold text-band-ink underline"
              >
                revisar em Governança
              </button>
            </p>
          </aside>
        </div>
      </Card>

      {/* ---- Focus vs risks ---------------------------------------------- */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="O que acompanhar" title="Foco operacional" />
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.focus.map((f) => (
              <Pill key={f} tone="info" solid dot={false}>
                {f}
              </Pill>
            ))}
          </div>

          {modality === 'Híbrido' && (
            <div className="mt-5 border-t border-hairline pt-4">
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-ink">
                <CalendarDays className="h-3.5 w-3.5 text-brand-2" />
                “Como funciona meu módulo?”
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-3">
                A funcionalidade central do híbrido no portal do aluno: mostrar as disciplinas do módulo,
                o que é digital, o que é presencial, quando são os encontros e o que precisa ser feito
                naquela semana. O objetivo é transformar o calendário na resposta a “o que eu preciso
                fazer agora?”.
              </p>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader eyebrow="Riscos típicos" title="Onde esta modalidade quebra" />
          <ul className="mt-4 space-y-2.5">
            {profile.risks.map((r) => (
              <li key={r} className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-crit" />
                <span className="text-[12px] leading-relaxed text-ink-2">{r}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* ---- Funnel ------------------------------------------------------ */}
      <div className="space-y-3">
        <SectionLabel
          action={
            selectedStage && (
              <LinkButton onClick={() => setSelectedStage(null)}>Limpar seleção de etapa</LinkButton>
            )
          }
        >
          Funil da jornada · clique numa etapa para filtrar os alunos
        </SectionLabel>

        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))` }}
        >
          {stageRows.map((stage, i) => {
            const selected = selectedStage === stage.id;
            return (
              <button
                key={stage.id}
                onClick={() => setSelectedStage(selected ? null : stage.id)}
                className={[
                  'flex flex-col justify-between gap-3 rounded-xl border p-4 text-left transition-colors',
                  selected
                    ? 'border-brand bg-brand-soft'
                    : 'border-hairline bg-surface hover:border-ink-4',
                ].join(' ')}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={[
                        'flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-bold',
                        selected ? 'bg-brand text-on-brand' : 'border border-hairline bg-surface-2 text-ink-4',
                      ].join(' ')}
                    >
                      {i + 1}
                    </span>
                    <span className="font-mono text-[16px] font-bold text-ink">
                      {stage.members.length}
                    </span>
                  </div>
                  <p className="mt-2.5 text-[12.5px] leading-snug font-bold text-ink">{stage.title}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-3">
                    {stage.description}
                  </p>
                </div>

                <div className="space-y-2 border-t border-hairline pt-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[9.5px] font-bold tracking-[0.08em] text-ink-4 uppercase">
                      Score médio
                    </span>
                    <span className="font-mono text-[12px] font-bold text-ink">{stage.avgScore}</span>
                  </div>
                  <MeterBar
                    value={stage.avgScore}
                    color={
                      stage.avgScore >= 81
                        ? 'var(--ok)'
                        : stage.avgScore >= 61
                          ? 'var(--warn)'
                          : 'var(--crit)'
                    }
                    height={4}
                  />
                  <p className="text-[10.5px] leading-snug text-risk-ink">
                    Risco: {stage.risk}
                  </p>
                  {stage.atRisk > 0 && (
                    <p className="font-mono text-[10.5px] font-bold text-crit-ink">
                      {stage.atRisk} em risco ou crítico
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Distribution of the cohort ---------------------------------- */}
      <Card>
        <CardHeader
          eyebrow="Composição"
          title={`Distribuição de classificação · ${modality === 'EaD' ? 'EaD 100%' : modality}`}
        />
        <div className="mt-4">
          <StackedBar
            height={10}
            segments={[
              { key: 'ok', label: 'Estável', value: cohort.filter((s) => s.status === 'Estável').length, color: 'var(--ok)' },
              { key: 'warn', label: 'Atenção', value: cohort.filter((s) => s.status === 'Atenção').length, color: 'var(--warn)' },
              { key: 'risk', label: 'Risco', value: cohort.filter((s) => s.status === 'Risco').length, color: 'var(--risk)' },
              { key: 'crit', label: 'Crítico', value: cohort.filter((s) => s.status === 'Crítico').length, color: 'var(--crit)' },
            ]}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          {(['Estável', 'Atenção', 'Risco', 'Crítico'] as const).map((status) => (
            <span key={status} className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
              <HealthBadge status={status} />
              <span className="font-mono font-bold text-ink">
                {cohort.filter((s) => s.status === status).length}
              </span>
            </span>
          ))}
        </div>
      </Card>

      {/* ---- Students ---------------------------------------------------- */}
      <Card padded={false}>
        <div className="p-5">
          <CardHeader
            eyebrow={`${visible.length} alunos`}
            title={
              selectedStage
                ? `Etapa: ${stageRows.find((s) => s.id === selectedStage)?.title}`
                : `Todos os alunos ${modality === 'EaD' ? 'EaD' : modality.toLowerCase()}`
            }
            action={
              <LinkButton
                onClick={() => actions.goto('alunos')}
                iconRight={<ArrowRight className="h-3.5 w-3.5" />}
              >
                Abrir na base completa
              </LinkButton>
            }
          />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            compact
            title="Nenhum aluno nesta etapa"
            message="A amostra de demonstração não tem alunos neste ponto da jornada."
          />
        ) : (
          <div className="divide-y divide-hairline border-t border-hairline">
            {visible.slice(0, 14).map((s) => (
              <Row key={s.id} onClick={() => actions.openStudent(s.id)}>
                <div className="flex items-center gap-3 p-4">
                  <Avatar initials={s.initials} size="sm" tone={s.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[12.5px] font-bold text-ink">{s.name}</span>
                      <HealthBadge status={s.status} />
                      <ModalityBadge modality={s.modality} />
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[10.5px] text-ink-4">
                      RA {s.ra} · {s.course} · {s.journey.moduleName}
                    </p>
                  </div>
                  <div className="hidden w-32 sm:block">
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-[9.5px] font-bold text-ink-4 uppercase">
                        Progresso
                      </span>
                      <span className="font-mono text-[11px] font-bold text-ink">
                        {percent(s.journey.progressPercent)}
                      </span>
                    </div>
                    <div className="mt-1">
                      <MeterBar value={s.journey.progressPercent} color="var(--brand-2)" height={4} />
                    </div>
                  </div>
                  <div className="w-14 text-right">
                    <span className="font-mono text-[9.5px] font-bold text-ink-4 uppercase">Score</span>
                    <p className="font-mono text-[14px] font-bold text-ink">{s.healthScore}</p>
                  </div>
                  <div className="hidden w-16 text-right sm:block">
                    <span className="font-mono text-[9.5px] font-bold text-ink-4 uppercase">Média</span>
                    <p className="font-mono text-[14px] font-bold text-ink">
                      {s.academic.gpa > 0 ? decimal(s.academic.gpa, 1) : '—'}
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-4" />
                </div>
              </Row>
            ))}
          </div>
        )}
      </Card>

      <Callout tone="info">
        Este recorte ignora os filtros globais de modalidade para permitir a comparação entre modelos.
        Os {scopedStudents.length} alunos do escopo global continuam válidos nas demais telas.
      </Callout>
    </motion.div>
  );
}
