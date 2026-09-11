import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ExternalLink,
  Lock,
  RotateCcw,
} from 'lucide-react';
import type {
  CalendarEntry,
  CalendarGroup,
  Modality,
  PushCategory,
  TrilhaBand,
  TrilhaConfig,
  TrilhaStep,
} from '../../types';
import { CALENDARS, CALENDAR_ENTRIES } from '../../data/academicCalendars';
import { COURSES } from '../../data/catalog';
import type { CourseInfo } from '../../data/catalog';
import { useApp } from '../../state/AppContext';
import {
  BAND_DESCRIPTION,
  BAND_LABEL,
  IRRECUPERAVEL,
  PLACE_LABEL,
  irrecuperavelRulesFor,
} from '../../lib/trilha';
import { CATEGORY_LABEL, siteCourseOf } from '../../lib/push';
import { int, searchKey } from '../../lib/format';
import { collapseVariants } from '../../lib/motion';
import { Callout, Card, CardHeader, EmptyState, SectionLabel } from '../ui/Surfaces';
import { Button } from '../ui/Button';
import { SearchInput, Segmented, Switch } from '../ui/Fields';
import type { SegmentedOption } from '../ui/Fields';
import { Pill } from '../ui/Badges';
import { RevealGroup, RevealItem } from '../ui/Reveal';

/* ==========================================================================
   Trilha do Aluno — Configuração
   --------------------------------------------------------------------------
   Quatro blocos, e o pedido foi explícito: «nada parecido com a Gestão de
   PUSH». A comparação é justa e vale escrever por que as duas telas são
   diferentes. A Gestão de PUSH é uma MESA DE TRABALHO — trinta e três
   combinações de curso e público, filtros, editor por evento e por régua, e
   alguém mexendo nela toda semana. Isto aqui são QUATRO DECISÕES que a
   coordenação toma uma vez por semestre, mais uma lupa para conferir onde cada
   uma vale. Se um dia aparecer um quinto bloco, é porque alguém confundiu as
   duas telas.

   O QUE CADA BLOCO É

     1. O conjunto irrecuperável — NÃO editável aqui. É o artefato de
        governança que responde «por que o aluno não foi avisado», e uma
        resposta dessas não pode depender de quem mexeu num interruptor na
        semana passada. O que a tela faz é CONTAR ao vivo quantas linhas cada
        regra captura, para que ninguém a esvazie sem perceber.
     2. As famílias recolhidas — o único terço genuinamente subjetivo da
        classificação. Aqui se recolhe, nunca se apaga.
     3. A janela de cada faixa — quantos dias à frente o recorte olha, por
        distância até a primeira aula.
     4. Os passos da trilha — ordem, bloqueio, faixa e modalidade. Com a lupa
        de curso ao lado, que é um INSPETOR: confere o que vale onde.

   O PERIGO DESTA TELA TEM NOME: RECOLHER EM SILÊNCIO

   Um interruptor chamado «Programa» que tira do recorte as linhas de monitoria,
   Libras, Bagagem e eletivas sem dizer QUANTAS são é o modo de falha inteiro
   deste produto. Por isso cada controle desta tela carrega O NÚMERO DE LINHAS
   QUE ELE MOVE, contado do documento e nunca digitado à mão, e cada recorte diz
   os dois números — o que mostra e o que existe. Quem recolheu «Programa»
   sabendo quantas linhas eram fez uma escolha; quem recolheu sem saber foi
   induzido, e a diferença entre as duas coisas é o motivo de esta aba existir.

   DE ONDE VEM A CONTAGEM, E O QUE ELA NÃO VÊ

   Direto de `CALENDARS`, em `data/academicCalendars` — os PDFs transcritos. As
   correções manuais feitas na Gestão de PUSH vivem por fora, num mapa de
   edições aplicado por cima pelo `pushStore`, e esta tela não as recebe: a
   configuração da trilha é sobre o documento publicado, não sobre o rascunho
   de quem está editando. Está dito na própria tela, porque um número sem
   origem declarada é um número em que ninguém deveria confiar.
   ========================================================================== */

/* -- O que se conta, contado uma vez --------------------------------------
   `CALENDARS` é constante de módulo: o número não muda entre renderizações, e
   embrulhar isto em `useMemo` seria cerimônia para não ganhar nada. */

const ALL_EVENTS = CALENDARS.flatMap((c) => c.events);

/** Quantas linhas cada regra do conjunto irrecuperável captura, e onde. */
const RULE_HITS = IRRECUPERAVEL.map((rule) => ({
  rule,
  total: ALL_EVENTS.filter(rule.test).length,
  byCalendar: CALENDARS.map((calendar) => ({
    id: calendar.id,
    shortName: calendar.shortName,
    n: calendar.events.filter(rule.test).length,
  })).filter((row) => row.n > 0),
}));

/**
 * Linhas distintas protegidas por pelo menos uma regra.
 *
 * Não é a soma das regras, e a diferença tem de ser dita na tela: uma prova
 * substitutiva com a cláusula das 48 horas dispara duas regras e continua sendo
 * uma linha. Somar as sete daria um número maior que o calendário inteiro.
 */
const IRRECUPERAVEL_TOTAL = ALL_EVENTS.filter((e) => irrecuperavelRulesFor(e).length > 0).length;

/** As nove famílias que o modelo de push conhece, na ordem em que ele as declara. */
const CATEGORIES: PushCategory[] = [
  'aula',
  'prova',
  'prazo',
  'evento',
  'feriado',
  'programa',
  'financeiro',
  'engajamento',
  'acolhimento',
];

/**
 * Quantas linhas cada família move — e quantas continuariam aparecendo.
 *
 * `irrecuperaveis` é a nuance que não pode ficar escondida: em `bucketFor`, o
 * conjunto irrecuperável é avaliado ANTES da lista de recolhidas, então
 * recolher «Avaliação» não tira uma única prova da trilha. E `baixa` é a outra
 * ponta: o motor já recolhe relevância baixa antes de olhar esta configuração,
 * então parte da família está fora do recorte com o interruptor desligado.
 */
const FAMILY_STATS = CATEGORIES.map((category) => {
  const events = ALL_EVENTS.filter((e) => e.category === category);
  return {
    category,
    total: events.length,
    irrecuperaveis: events.filter((e) => irrecuperavelRulesFor(e).length > 0).length,
    baixa: events.filter((e) => e.relevance === 'baixa').length,
  };
});

const BANDS: TrilhaBand[] = ['antecipada', 'confortavel', 'vespera', 'em-curso'];

/** Os horizontes que a operação usa de verdade. Números redondos, não um campo livre. */
const HORIZON_PRESETS = [14, 30, 45, 60, 90];

/**
 * A modalidade do catálogo e o bloco do site.
 *
 * Três linhas, e escritas aqui porque a função equivalente do motor de push é
 * privada e recebe um aluno — e esta lupa trabalha com um CURSO, que não tem
 * matrícula nenhuma. A correspondência é a mesma que o site publica nos três
 * títulos de bloco, então não há segunda verdade a divergir.
 */
const GROUP_OF_MODALITY: Record<Modality, CalendarGroup> = {
  Presencial: 'presencial',
  Híbrido: 'hibrido',
  EaD: 'ead',
};

const COHORT_LABEL: Record<CalendarEntry['audience'], string> = {
  Ingressante: 'Calouro',
  Veterano: 'Veterano',
  Ambos: 'Calouro e veterano',
};

export interface TrilhaConfigPanelProps {
  config: TrilhaConfig;
  onChange: (next: TrilhaConfig) => void;
  onReset: () => void;
  dirty: boolean;
}

export function TrilhaConfigPanel({ config, onChange, onReset, dirty }: TrilhaConfigPanelProps) {
  /* Nada de `useState` para a configuração: ela mora em quem monta a aba, e uma
     cópia local aqui seria a segunda verdade que esta tela existe para evitar.
     O estado local é só de interface — regra aberta, busca, curso escolhido. */

  const collapsedStats = useMemo(() => {
    const active = FAMILY_STATS.filter((f) => config.collapsed.includes(f.category));
    return {
      families: active.length,
      lines: active.reduce((sum, f) => sum + f.total, 0),
      stillShown: active.reduce((sum, f) => sum + f.irrecuperaveis, 0),
    };
  }, [config.collapsed]);

  const setFamily = (category: PushCategory, collapsed: boolean) => {
    /* Reconstruído a partir de `CATEGORIES` em vez de empurrado no fim do
       array: a ordem fica canônica e não há como entrar duplicado. */
    const next = CATEGORIES.filter((c) =>
      c === category ? collapsed : config.collapsed.includes(c),
    );
    onChange({ ...config, collapsed: next });
  };

  const setHorizon = (band: TrilhaBand, days: number) => {
    onChange({
      ...config,
      horizonDays: { ...config.horizonDays, [band]: days },
    });
  };

  const toggleBlocking = (id: string) => {
    onChange({
      ...config,
      steps: config.steps.map((s) => (s.id === id ? { ...s, blocking: !s.blocking } : s)),
    });
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= config.steps.length) return;
    const next = [...config.steps];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChange({ ...config, steps: next });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-3xl text-[12.5px] leading-relaxed text-ink-3">
          Quatro blocos. O primeiro não se edita aqui — é o que a instituição tem de poder mostrar
          quando alguém perguntar por que um aluno não foi avisado. Os outros três mudam o recorte
          pessoal, e cada controle diz quantas linhas dos {CALENDARS.length} calendários ele move.
          Nada aqui apaga uma data: o que sai do recorte continua contado e alcançável no calendário
          completo.
        </p>
        {dirty && (
          <Button variant="ghost" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={onReset}>
            Descartar alterações
          </Button>
        )}
      </div>

      <RevealGroup className="space-y-4">
        <RevealItem>
          <IrrecuperavelBlock />
        </RevealItem>

        <RevealItem>
          <FamiliesBlock collapsed={config.collapsed} stats={collapsedStats} onToggle={setFamily} />
        </RevealItem>

        <RevealItem>
          <HorizonBlock horizonDays={config.horizonDays} onChange={setHorizon} />
        </RevealItem>

        <RevealItem>
          <StepsBlock steps={config.steps} onToggleBlocking={toggleBlocking} onMove={moveStep} />
        </RevealItem>
      </RevealGroup>
    </div>
  );
}

/* ==========================================================================
   Bloco 1 — O que nunca é recolhido
   --------------------------------------------------------------------------
   Sete regras, e nenhum interruptor. A ausência do interruptor é o conteúdo do
   bloco: a lista não mede interesse, mede dano, e por isso não é matéria de
   preferência. O que a tela entrega em troca é auditoria — a contagem ao vivo
   por regra e, quando se abre a regra, por calendário.
   ========================================================================== */

function IrrecuperavelBlock() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader
        eyebrow={
          <>
            <Lock className="h-3.5 w-3.5" />
            Governança
          </>
        }
        title="O que nunca é recolhido"
        subtitle="A classe de evento que aparece com peso cheio para todo aluno a quem o calendário se aplica, independente de perfil, interesse ou configuração. Não mede o que interessa: mede o que o aluno perde e não recupera."
      />

      <div className="mt-4 rounded-lg bg-brand-soft p-3.5">
        <p className="text-[12.5px] leading-relaxed text-brand-text">
          <span className="font-mono font-semibold">{int(IRRECUPERAVEL.length)}</span> regras
          protegem <span className="font-mono font-semibold">{int(IRRECUPERAVEL_TOTAL)}</span> das{' '}
          <span className="font-mono font-semibold">{int(ALL_EVENTS.length)}</span> linhas
          transcritas dos {CALENDARS.length} calendários.
        </p>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-2">
          A soma das regras é maior que {int(IRRECUPERAVEL_TOTAL)} porque uma linha dispara mais de
          uma: uma prova substitutiva com a cláusula das 48 horas cai em duas regras e continua
          sendo uma linha só.
        </p>
      </div>

      <ul className="mt-4 divide-y divide-hairline border-y border-hairline">
        {RULE_HITS.map(({ rule, total, byCalendar }) => {
          const expanded = open === rule.id;
          return (
            <li key={rule.id}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : rule.id)}
                aria-expanded={expanded}
                className="flex w-full items-start gap-3 py-3 text-left transition-colors hover:bg-surface-hover"
              >
                <span
                  className={[
                    'mt-px w-10 shrink-0 text-right font-mono text-[13px] font-semibold tabular',
                    total === 0 ? 'text-ink-4' : 'text-ink',
                  ].join(' ')}
                >
                  {int(total)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-ink">{rule.label}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-3">
                    {rule.why}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={`mt-0.5 h-4 w-4 shrink-0 text-ink-4 transition-transform ${
                    expanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    variants={collapseVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="overflow-hidden"
                  >
                    <div className="pb-4 pl-[3.25rem]">
                      {total === 0 ? (
                        <p className="text-[11.5px] leading-relaxed text-ink-3">
                          Nenhuma linha nos calendários publicados hoje. A regra fica declarada para
                          quando a instituição publicar essas datas — e é por isso que ela aparece
                          com zero em vez de ser apagada da lista.
                        </p>
                      ) : (
                        <>
                          <p className="mb-2 text-[11px] font-medium text-ink-4">
                            Linhas capturadas, por calendário ({byCalendar.length} de{' '}
                            {CALENDARS.length})
                          </p>
                          <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                            {byCalendar.map((row) => (
                              <div key={row.id} className="flex items-baseline gap-2">
                                <dt className="min-w-0 text-[11.5px] text-ink-2">
                                  {row.shortName}
                                </dt>
                                <dd className="order-first w-7 shrink-0 text-right font-mono text-[12px] font-semibold text-ink tabular">
                                  {int(row.n)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>

      <div className="mt-4">
        <Callout
          tone="info"
          icon={<Lock className="h-3.5 w-3.5" />}
          title="Por que não há interruptor neste bloco"
        >
          É o artefato que responde «por que o aluno não foi avisado», e uma resposta dessas não
          pode depender de quem mexeu num interruptor na semana passada. As regras moram em{' '}
          <code className="font-mono text-[11px] text-ink">IRRECUPERAVEL</code>, em{' '}
          <code className="font-mono text-[11px] text-ink">lib/trilha.ts</code>, e mudam por
          alteração de código revisada — com a contagem acima à vista, para que ninguém as esvazie
          sem perceber. Cada regra procura um padrão, não uma lista de identificadores: o calendário
          do semestre que vem traz linhas novas, e a regra captura as novas sem ninguém ter de se
          lembrar delas.
        </Callout>
      </div>
    </Card>
  );
}

/* ==========================================================================
   Bloco 2 — Famílias recolhidas no recorte
   --------------------------------------------------------------------------
   O terço subjetivo da classificação, e o único lugar desta tela onde a palavra
   «preferência» cabe. Recolher não é apagar: o item continua contado no «N de
   M» e alcançável no calendário completo.

   Cada linha mostra quantas linhas do calendário a família move, porque mudar
   classificação em silêncio é o modo de falha desta aba. E mostra a nuance:
   `bucketFor` avalia o conjunto irrecuperável ANTES desta lista, então
   «Avaliação» recolhida não tira nenhuma prova da trilha.
   ========================================================================== */

function familyDescription(stat: (typeof FAMILY_STATS)[number]): string {
  if (stat.total === 0) {
    return `Nenhuma linha desta família nos ${CALENDARS.length} calendários publicados. Recolher não muda nada hoje.`;
  }

  const lines = stat.total === 1 ? '1 linha' : `${int(stat.total)} linhas`;
  const parts = [`${lines} nos ${CALENDARS.length} calendários.`];

  if (stat.irrecuperaveis > 0) {
    parts.push(
      stat.irrecuperaveis === stat.total
        ? 'Todas são irrecuperáveis e continuam na trilha mesmo com a família recolhida — recolher aqui não esconde nenhuma delas.'
        : `${int(stat.irrecuperaveis)} são irrecuperáveis e continuam na trilha mesmo com a família recolhida.`,
    );
  }
  if (stat.baixa > 0) {
    parts.push(
      `${int(stat.baixa)} já ficam fora do recorte por relevância baixa, antes deste interruptor.`,
    );
  }
  return parts.join(' ');
}

function FamiliesBlock({
  collapsed,
  stats,
  onToggle,
}: {
  collapsed: PushCategory[];
  stats: { families: number; lines: number; stillShown: number };
  onToggle: (category: PushCategory, collapsed: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Famílias recolhidas no recorte"
        subtitle="Ligar recolhe a família da linha do tempo pessoal. Ela continua no calendário completo e continua contada no «mostrando N de M» — a diferença inteira entre priorizar e omitir."
      />

      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-2">
        {stats.families === 0 ? (
          <>Nenhuma família recolhida. O recorte pessoal vê as {int(ALL_EVENTS.length)} linhas.</>
        ) : (
          <>
            <span className="font-mono font-semibold text-ink">{int(stats.families)}</span>{' '}
            {stats.families === 1 ? 'família recolhida' : 'famílias recolhidas'}, somando{' '}
            <span className="font-mono font-semibold text-ink">{int(stats.lines)}</span> das{' '}
            <span className="font-mono font-semibold text-ink">{int(ALL_EVENTS.length)}</span>{' '}
            linhas.
            {stats.stillShown > 0 && (
              <>
                {' '}
                Dessas,{' '}
                <span className="font-mono font-semibold text-ink">
                  {int(stats.stillShown)}
                </span>{' '}
                continuam aparecendo por serem irrecuperáveis.
              </>
            )}
          </>
        )}
      </p>

      <div className="mt-4 grid gap-2 xl:grid-cols-2">
        {FAMILY_STATS.map((stat) => (
          <Switch
            key={stat.category}
            checked={collapsed.includes(stat.category)}
            onChange={(v) => onToggle(stat.category, v)}
            label={CATEGORY_LABEL[stat.category] ?? stat.category}
            description={familyDescription(stat)}
          />
        ))}
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">
        A contagem lê os PDFs transcritos em{' '}
        <code className="font-mono text-[11px] text-ink-2">data/academicCalendars</code>. Correções
        feitas na Gestão de PUSH vivem num mapa de edições aplicado por cima e não entram nestes
        números.
      </p>
    </Card>
  );
}

/* ==========================================================================
   Bloco 3 — Janela de cada faixa
   --------------------------------------------------------------------------
   Quantos dias à frente o recorte olha, por distância até a primeira aula.

   A faixa antecipada é o caso especial e não se resolve com um zero no campo.
   Em `bucketFor`, ela devolve `recolhido` para TODA linha antes de olhar o
   horizonte: quem começa em mais de sessenta dias não tem calendário publicado,
   e mostrar as datas do semestre errado é pior que não mostrar nada. Um controle
   numérico ali seria um controle inerte — a tela declara o valor guardado e o
   motivo, em vez de oferecer um botão que não faz nada.
   ========================================================================== */

function horizonOptions(current: number): SegmentedOption<string>[] {
  const values = HORIZON_PRESETS.includes(current)
    ? HORIZON_PRESETS
    : [...HORIZON_PRESETS, current].sort((a, b) => a - b);
  return values.map((v) => ({
    value: String(v),
    label: v === 0 ? 'Sem linha' : `${v} d`,
  }));
}

function HorizonBlock({
  horizonDays,
  onChange,
}: {
  horizonDays: Record<TrilhaBand, number>;
  onChange: (band: TrilhaBand, days: number) => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Janela de cada faixa"
        subtitle="A faixa vem do presente — quantos dias faltam, de hoje, para a primeira aula do aluno. Fora da janela, o irrecuperável não desaparece: vai para a faixa guardada, que está sempre visível."
      />

      <div className="mt-4 space-y-3">
        {BANDS.map((band) => {
          const days = horizonDays[band];
          const frozen = band === 'antecipada';

          return (
            <div key={band} className="rounded-lg bg-surface-2 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="text-[13px] font-medium text-ink">{BAND_LABEL[band]}</p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">
                    {BAND_DESCRIPTION[band]}
                  </p>
                </div>

                <div className="shrink-0">
                  {frozen ? (
                    <Pill tone="muted" dot={false} mono>
                      Sem linha do tempo
                    </Pill>
                  ) : (
                    <Segmented
                      options={horizonOptions(days)}
                      value={String(days)}
                      onChange={(v) => onChange(band, Number(v))}
                      layoutId={`trilha-horizonte-${band}`}
                      size="xs"
                    />
                  )}
                </div>
              </div>

              <p className="mt-2.5 border-t border-hairline pt-2.5 text-[11.5px] leading-relaxed text-ink-2">
                {frozen ? (
                  <>
                    Valor guardado:{' '}
                    <span className="font-mono font-semibold text-ink">{int(days)}</span>{' '}
                    {days === 1 ? 'dia' : 'dias'} — e o motor não o consulta. Esta faixa recolhe
                    toda linha por construção, porque o calendário do semestre dela ainda não
                    existe. Não há controle aqui de propósito: um número editável que não chega ao
                    aluno é pior que número nenhum.
                  </>
                ) : (
                  <>
                    O recorte olha{' '}
                    <span className="font-mono font-semibold text-ink">{int(days)}</span>{' '}
                    {days === 1 ? 'dia' : 'dias'} à frente. O que cai além disso sai da fila
                    cronológica — e se for irrecuperável, vai para a faixa guardada em vez de ser
                    recolhido.
                  </>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ==========================================================================
   Bloco 4 — Passos da trilha, e a lupa de curso
   --------------------------------------------------------------------------
   A ordem é a do caminho real, não a da importância: o boleto vem antes do AVA
   porque é o que trava a matrícula. Por isso a reordenação existe — e é com
   setas, não arrastando: a lista tem doze itens, é lida por teclado com a mesma
   frequência que por mouse, e arrastar num painel que rola é o gesto que mais
   erra em tela cheia de operação.

   O que esta lista NÃO faz é marcar passo como concluído. `done` aqui é
   gabarito; quem preenche é `buildSteps`, a partir dos sinais que o sistema
   realmente tem. Um interruptor de «concluído» nesta tela seria a operação
   opinando sobre o aluno.
   ========================================================================== */

function bandSummary(step: TrilhaStep): string[] {
  if (step.bands.length === 0 || step.bands.length === BANDS.length) return ['Todas as faixas'];
  return step.bands.map((b) => BAND_LABEL[b]);
}

function modalitySummary(step: TrilhaStep): string {
  if (step.modalities.length === 0) return 'Todas as modalidades';
  return step.modalities.join(' e ');
}

function StepsBlock({
  steps,
  onToggleBlocking,
  onMove,
}: {
  steps: TrilhaStep[];
  onToggleBlocking: (id: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  const blocking = steps.filter((s) => s.blocking).length;

  return (
    <Card>
      <CardHeader
        title="Passos da trilha"
        subtitle="A lista que o aluno recebe, na ordem em que ele cumpre. Bloqueante trava o primeiro dia de aula se não estiver resolvido — clique no selo para ligar ou desligar."
      />

      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-2">
        <span className="font-mono font-semibold text-ink">{int(steps.length)}</span> passos, todos
        listados — esta lista não tem recorte.{' '}
        <span className="font-mono font-semibold text-ink">{int(blocking)}</span>{' '}
        {blocking === 1 ? 'é bloqueante' : 'são bloqueantes'}. Faixa e modalidade filtram por aluno
        na hora de montar a trilha; aqui aparecem como fato, não como filtro desta tela.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <ul className="divide-y divide-hairline border-y border-hairline">
          {steps.map((step, index) => (
            <li key={step.id} className="flex items-start gap-3 py-3">
              <span className="mt-0.5 w-6 shrink-0 text-right font-mono text-[12px] font-medium text-ink-4 tabular">
                {String(index + 1).padStart(2, '0')}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink">{step.title}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-3">{step.action}</p>

                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <Pill tone="neutral" dot={false}>
                    {PLACE_LABEL[step.place]}
                  </Pill>

                  <button
                    type="button"
                    onClick={() => onToggleBlocking(step.id)}
                    aria-pressed={step.blocking}
                    className={[
                      'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] transition-colors',
                      step.blocking
                        ? 'bg-brand font-semibold text-on-brand hover:bg-brand-hover'
                        : 'bg-surface-2 font-medium text-ink-3 hover:bg-surface-3 hover:text-ink',
                    ].join(' ')}
                  >
                    {step.blocking ? 'Bloqueante' : 'Não bloqueante'}
                  </button>

                  {bandSummary(step).map((label) => (
                    <Pill key={label} tone="info" dot={false} solid>
                      {label}
                    </Pill>
                  ))}

                  <span className="text-[11px] text-ink-4">{modalitySummary(step)}</span>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                <Button
                  variant="ghost"
                  size="xs"
                  square
                  disabled={index === 0}
                  onClick={() => onMove(index, -1)}
                  aria-label={`Subir «${step.title}»`}
                  icon={<ArrowUp className="h-3.5 w-3.5" />}
                />
                <Button
                  variant="ghost"
                  size="xs"
                  square
                  disabled={index === steps.length - 1}
                  onClick={() => onMove(index, 1)}
                  aria-label={`Descer «${step.title}»`}
                  icon={<ArrowDown className="h-3.5 w-3.5" />}
                />
              </div>
            </li>
          ))}
        </ul>

        <CourseInspector steps={steps} />
      </div>
    </Card>
  );
}

/* ==========================================================================
   A lupa de curso
   --------------------------------------------------------------------------
   Um inspetor, não um editor de exceção. Exceção por curso NÃO EXISTE neste
   sistema, e a copy diz isso na cara: os passos e as janelas desta tela valem
   para todos os cursos. A lupa serve para conferir o que vale onde antes de
   mudar algo acima — e fingir um recurso que não existe custaria mais confiança
   do que a ausência dele custa.

   A PONTE DE NOME, E POR QUE ELA PASSA PELA BASE
   O catálogo escreve «Tecnologia em Gestão de Recursos Humanos»; o site escreve
   «Recursos Humanos». A tabela que liga os dois nomes mora em `lib/push.ts` e
   só é alcançável por `siteCourseOf`, que recebe um ALUNO. Reconstruir a tabela
   aqui criaria uma segunda verdade sobre os mesmos nomes, e a primeira vez que
   alguém corrigisse um deles a outra ficaria para trás em silêncio. Então a
   ponte é lida da base: cada curso matriculado ensina como o site o chama.
   Curso sem aluno na base cai no nome do catálogo — que é exatamente o que
   `siteCourseOf` faria — e a tela DIZ qual das duas coisas aconteceu, porque a
   diferença importa para quem confere.
   ========================================================================== */

function CourseInspector({ steps }: { steps: TrilhaStep[] }) {
  const { students } = useApp();
  const [query, setQuery] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(null);

  /** Como o site chama cada curso matriculado, aprendido de quem está matriculado. */
  const siteNames = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach((s) => {
      if (!map.has(s.course)) map.set(s.course, siteCourseOf(s));
    });
    return map;
  }, [students]);

  const enrolled = useMemo(() => {
    const map = new Map<string, number>();
    students.forEach((s) => map.set(s.course, (map.get(s.course) ?? 0) + 1));
    return map;
  }, [students]);

  const filtered = useMemo(() => {
    const q = searchKey(query);
    if (!q) return COURSES;
    return COURSES.filter((c) => searchKey(c.name).includes(q));
  }, [query]);

  const selected = selectedName ? COURSES.find((c) => c.name === selectedName) : undefined;

  return (
    <aside className="min-w-0 space-y-3 rounded-xl bg-surface-2 p-3.5">
      <div>
        <p className="text-[12px] font-semibold text-ink">Conferir por curso</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">
          Qual calendário o site publica para o curso, por coorte, e quais destes passos valem para
          a modalidade dele.
        </p>
      </div>

      <SearchInput value={query} onValueChange={setQuery} placeholder="Nome do curso…" />

      <p className="text-[11px] text-ink-4">
        Mostrando <span className="font-mono font-semibold text-ink-2">{int(filtered.length)}</span>{' '}
        de <span className="font-mono font-semibold text-ink-2">{int(COURSES.length)}</span> cursos
        do catálogo.
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          compact
          title="Nenhum curso com esse nome"
          message="O catálogo institucional tem os nomes completos — «Bacharelado em», «Tecnologia em», «Licenciatura em». Tente uma palavra do meio."
        />
      ) : (
        <ul className="max-h-56 overflow-y-auto rounded-lg bg-surface">
          {filtered.map((course) => {
            const active = course.name === selectedName;
            return (
              <li key={course.name}>
                <button
                  type="button"
                  onClick={() => setSelectedName(active ? null : course.name)}
                  aria-pressed={active}
                  className={[
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors',
                    active
                      ? 'bg-brand-soft font-semibold text-brand-text'
                      : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                  ].join(' ')}
                >
                  <span className="min-w-0 flex-1 truncate">{course.name}</span>
                  <span className="shrink-0 font-mono text-[10px] text-ink-4">
                    {course.modality.join('·')}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected ? (
        <CourseCard
          course={selected}
          siteName={siteNames.get(selected.name)}
          enrolled={enrolled.get(selected.name) ?? 0}
          steps={steps}
        />
      ) : (
        <p className="rounded-lg bg-surface p-3 text-[11.5px] leading-relaxed text-ink-3">
          Escolha um curso para ver o que vale nele. É um inspetor: exceção por curso não existe
          neste sistema, e os passos e as janelas desta tela valem para todos os{' '}
          {int(COURSES.length)} cursos igualmente.
        </p>
      )}
    </aside>
  );
}

/** A linha do site que vale para este curso nesta modalidade — e o guarda-chuva, se não houver. */
function linesFor(siteName: string, modality: Modality) {
  const group = GROUP_OF_MODALITY[modality];
  const own = CALENDAR_ENTRIES.filter(
    (e) => e.group === group && !e.catchAll && e.course === siteName,
  );
  const umbrella =
    own.length === 0 ? CALENDAR_ENTRIES.find((e) => e.group === group && e.catchAll) : undefined;
  return { own, umbrella };
}

function CourseCard({
  course,
  siteName,
  enrolled,
  steps,
}: {
  course: CourseInfo;
  /** O nome publicado pelo site, quando a base tem aluno deste curso para ensinar a ponte. */
  siteName?: string;
  enrolled: number;
  steps: TrilhaStep[];
}) {
  const lookupName = siteName ?? course.name;

  return (
    <div className="space-y-3 rounded-lg bg-surface p-3.5">
      <div>
        <p className="text-[12.5px] font-semibold text-ink">{course.name}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-3">
          {course.area} · {course.totalPeriods} períodos ·{' '}
          {enrolled === 0
            ? 'nenhum aluno desta base'
            : `${int(enrolled)} ${enrolled === 1 ? 'aluno' : 'alunos'} desta base`}
        </p>
      </div>

      <div className="border-t border-hairline pt-2.5">
        <p className="text-[11px] leading-relaxed text-ink-3">
          Nome usado na busca: <span className="font-medium text-ink-2">«{lookupName}»</span>
          {siteName
            ? siteName === course.name
              ? ' — o catálogo e o site escrevem igual, conferido no registro de um aluno matriculado.'
              : ' — é assim que o site escreve este curso, conferido no registro de um aluno matriculado.'
            : ' — o nome do catálogo, porque a base não tem aluno deste curso para conferir como o site o chama. Se o site usar outro nome, o resultado abaixo fica em branco por isso, e não por ausência de calendário.'}
        </p>
      </div>

      <div>
        <SectionLabel>Calendário por coorte</SectionLabel>
        <div className="mt-2 space-y-2.5">
          {course.modality.map((modality) => {
            const { own, umbrella } = linesFor(lookupName, modality);
            return (
              <div key={modality}>
                <p className="text-[11px] font-medium text-ink-4">{modality}</p>

                {own.length > 0 ? (
                  <ul className="mt-1 space-y-1.5">
                    {own.map((entry) => (
                      <EntryLine key={entry.id} entry={entry} />
                    ))}
                  </ul>
                ) : umbrella ? (
                  <div className="mt-1 space-y-1.5">
                    <p className="text-[11px] leading-relaxed text-ink-3">
                      Sem linha própria. Coberto pela linha guarda-chuva do site,{' '}
                      <span className="font-medium text-ink-2">«{umbrella.course}»</span>:
                    </p>
                    <ul>
                      <EntryLine entry={umbrella} />
                    </ul>
                  </div>
                ) : (
                  <p className="mt-1 flex gap-1.5 text-[11px] leading-relaxed text-warn-ink">
                    <AlertTriangle aria-hidden="true" className="mt-px h-3 w-3 shrink-0" />
                    <span>
                      O site não publica calendário para este curso nesta modalidade, em nenhuma
                      coorte, e o bloco não tem guarda-chuva. Sem documento de origem, a trilha não
                      gera datas — e projetar as de um curso parecido produziria datas erradas com a
                      nossa assinatura.
                    </span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <SectionLabel>Passos que se aplicam</SectionLabel>
        <div className="mt-2 space-y-2">
          {course.modality.map((modality) => {
            const applies = steps.filter(
              (s) => s.modalities.length === 0 || s.modalities.includes(modality),
            );
            const out = steps.filter(
              (s) => s.modalities.length > 0 && !s.modalities.includes(modality),
            );
            return (
              <div key={modality}>
                <p className="text-[11.5px] text-ink-2">
                  <span className="font-mono font-semibold text-ink">{int(applies.length)}</span> de{' '}
                  <span className="font-mono font-semibold text-ink">{int(steps.length)}</span>{' '}
                  passos valem para {modality}.
                </p>
                {out.length > 0 && (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">
                    Fora: {out.map((s) => s.title).join('; ')}.
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-4">
          A conta olha só a modalidade. A faixa de Δ não é propriedade do curso: depende de quantos
          dias faltam para a primeira aula DAQUELE aluno, e por isso ela só se resolve no gerador,
          com um RA na mão.
        </p>
      </div>
    </div>
  );
}

function EntryLine({ entry }: { entry: CalendarEntry }) {
  const calendar = CALENDARS.find((c) => c.id === entry.calendarId);

  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11.5px] leading-relaxed">
      <Pill tone="info" dot={false} solid>
        {COHORT_LABEL[entry.audience]}
      </Pill>
      {calendar ? (
        <>
          <a
            href={calendar.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-baseline gap-1 font-medium text-brand-text hover:underline"
          >
            {calendar.shortName}
            <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0 self-center" />
          </a>
          <span className="text-ink-4">{calendar.rhythm}</span>
        </>
      ) : (
        <span className="text-warn-ink">
          A linha do site aponta para «{entry.calendarId}», e esse calendário não está transcrito.
          Não há o que mostrar sem o documento.
        </span>
      )}
    </li>
  );
}
