import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  CalendarX2,
  ExternalLink,
  EyeOff,
  FileText,
  FlaskConical,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import type { Consequence, TimelineItem, TrilhaBucket, TrilhaModel } from '../../types';
import {
  BAND_LABEL,
  CONSEQUENCE_LABEL,
  bucketsOf,
  countdownPhrase,
  datePhrase,
} from '../../lib/trilha';
import { CATEGORY_LABEL } from '../../lib/push';
import { int } from '../../lib/format';
import { staggerContainer, staggerItem } from '../../lib/motion';
import { Card, EmptyState, SectionLabel } from '../ui/Surfaces';
import { Segmented } from '../ui/Fields';
import type { SegmentedOption } from '../ui/Fields';
import { Pill } from '../ui/Badges';

/* ==========================================================================
   Auditoria do recorte
   --------------------------------------------------------------------------
   O aparelho ao lado mostra o que o aluno vê. Este painel responde a outra
   pergunta, e é a que o estudo de decisão trata como o maior risco do produto:
   O QUE EXATAMENTE ESTE ALUNO NÃO ESTÁ VENDO, E POR QUÊ.

   As duas telas existem porque a mesma informação serve a dois leitores. O
   aluno precisa de oito datas legíveis. A operação precisa das sessenta e uma
   linhas com o motivo de cada ausência ao lado — senão «por que ninguém me
   avisou?» não tem resposta, e a única resposta que a instituição pode dar é
   uma que ela consegue mostrar linha por linha.

   TRÊS DECISÕES QUE ESTE ARQUIVO CARREGA

   1. O CONTADOR É A PEÇA PRINCIPAL, NÃO UM RODAPÉ.
      «Mostrando 8 de 61» abre o painel em corpo grande porque é o mecanismo de
      honestidade inteiro: um aluno que sabe que existem 61 e leu 8 fez uma
      escolha informada; um aluno que viu 8 sem saber dos 61 foi induzido. A
      barra de quatro segmentos põe a proporção no olho antes da leitura — e é
      feita de quatro divs com largura percentual, não de uma biblioteca de
      gráfico: quatro números não precisam de eixo, de tooltip nem de 40 KB.

   2. A LISTA É COMPLETA, SEMPRE. Nenhum filtro por padrão, nenhuma reticência.
      Cada linha traz o nosso título E o título oficial do PDF, porque o nosso
      texto fica EM CIMA do oficial e nunca EM VEZ dele — e porque é aqui, com
      as duas versões encostadas, que uma tradução que se afastou do documento
      aparece na leitura. Onde o item saiu do recorte, o `hiddenReason` fica em
      destaque: ele é a informação que justifica a ausência, e a ausência é o
      objeto desta tela.

   3. OS ALERTAS SÃO VERIFICAÇÕES NOMEADAS, COM CONTAGEM AO VIVO.
      Mesma disciplina de `IRRECUPERAVEL` no motor: uma lista de regras com
      `run`, e não `if`s espalhados pelo JSX. O painel diz quantas verificações
      rodaram e quantas acusaram, então ninguém as apaga sem perceber, e uma
      verificação nova entra no denominador no mesmo commit em que nasce.

   O que este painel NÃO faz é oferecer conserto. Preencher a turma, resolver o
   calendário do curso e corrigir o PDF acontecem em outros lugares e com outras
   autorizações; aqui a operação descobre o que está errado e para onde ir. Uma
   tela de auditoria que também edita deixa de ser prova de nada.
   ========================================================================== */

/* -- Os quatro destinos do recorte ---------------------------------------
   A ordem é a da barra e a dos grupos da lista, e não é arbitrária: vai do que
   o aluno vê agora até o que ele não vê, para que a barra seja lida da esquerda
   para a direita como «visível → invisível».

   As cores são duas, não quatro. Azul institucional no que está na fila, âmbar
   no que está guardado — as duas faixas que o aluno alcança —, e dois cinzas de
   superfície no que ficou fora. Quatro matizes aqui produziriam um arco-íris que
   sugere quatro categorias de igual peso, e elas não são. */

const BUCKET_ORDER: TrilhaBucket[] = ['agora', 'guardado', 'passado', 'recolhido'];

const BUCKET_META: Record<TrilhaBucket, { label: string; swatch: string; note: string }> = {
  agora: {
    label: 'Agora',
    swatch: 'bg-brand',
    note: 'Na fila das próximas datas, dentro do horizonte da faixa.',
  },
  guardado: {
    label: 'Guardado',
    swatch: 'bg-warn',
    note: 'Irrecuperável fora do horizonte: faixa própria, sempre visível.',
  },
  passado: {
    label: 'Passado',
    swatch: 'bg-surface-3',
    note: 'Já aconteceu — salvo na janela de 48 horas, que volta para «agora».',
  },
  recolhido: {
    label: 'Recolhido',
    swatch: 'bg-hairline-strong',
    note: 'Fora do recorte por consequência baixa, por configuração ou por distância.',
  },
};

/** Só `irrecuperavel` ganha vermelho. O resto ranqueia sem gritar. */
const CONSEQUENCE_TONE: Record<Consequence, 'crit' | 'warn' | 'neutral' | 'muted'> = {
  irrecuperavel: 'crit',
  alta: 'warn',
  media: 'neutral',
  baixa: 'muted',
};

type BucketFilter = 'todos' | TrilhaBucket;

function plural(n: number, one: string, many: string): string {
  return `${int(n)} ${n === 1 ? one : many}`;
}

/* ==========================================================================
   As verificações
   --------------------------------------------------------------------------
   Uma lista, como `IRRECUPERAVEL` no motor. Cada regra devolve `null` quando
   passa e o texto do alerta quando acusa — e o texto SEMPRE termina dizendo o
   que fazer, porque um alerta sem próximo passo é ruído com tom de urgência.
   ========================================================================== */

interface AuditCheck {
  id: string;
  tone: 'crit' | 'warn' | 'info';
  icon: ReactNode;
  run: (model: TrilhaModel) => { title: string; body: ReactNode } | null;
}

/**
 * Provas em que a tradução não aconteceu.
 *
 * Detectadas pela linha honesta que o motor escreveu no lugar do nome da
 * disciplina — «a sua grade não está no sistema» ou «a grade do segundo
 * bimestre ainda não está definida». Ler o sintoma que o motor já produziu é
 * melhor que reimplementar `disciplineFor` aqui: duas implementações da mesma
 * regra divergem no dia em que alguém corrigir só uma.
 */
function unresolvedExams(items: TimelineItem[]): TimelineItem[] {
  return items.filter(
    (i) => i.category === 'prova' && i.lines.some((l) => /grade|Confirme a disciplina/.test(l)),
  );
}

const AUDIT_CHECKS: AuditCheck[] = [
  {
    id: 'nada-visivel',
    tone: 'crit',
    icon: <CalendarX2 className="h-3.5 w-3.5" />,
    run: (model) => {
      if (model.shownCount > 0) return null;
      return {
        title: 'Este aluno não vê nenhuma data',
        body:
          model.totalCount === 0
            ? 'O recorte está vazio porque não há calendário de origem — nada foi recolhido, não havia o que recolher. Resolva o calendário do curso antes de entregar a trilha: a lista de passos continua válida, as datas não existem.'
            : `As ${int(model.totalCount)} linhas do calendário caíram todas fora do recorte. Confira o horizonte da faixa e as categorias recolhidas na configuração — um recorte que não mostra nada é um recorte quebrado, não um aluno sem compromissos.`,
      };
    },
  },
  {
    id: 'sem-calendario',
    tone: 'crit',
    icon: <ShieldAlert className="h-3.5 w-3.5" />,
    run: (model) => {
      if (model.resolution.match !== 'nenhuma') return null;
      return {
        title: 'Nenhum calendário publicado para este curso',
        body: (
          <>
            {model.resolution.note} Encaminhe o caso a quem publica os calendários: enquanto a
            linha não existir, este aluno fica sem datas em todas as superfícies — aqui, no app e
            na régua de PUSH.
          </>
        ),
      };
    },
  },
  {
    id: 'outra-coorte',
    tone: 'warn',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    run: (model) => {
      if (model.resolution.match !== 'outra-coorte') return null;
      return {
        title: 'As datas vêm do calendário de outra coorte',
        body: (
          <>
            {model.resolution.note} O rodapé de cada linha já cita o PDF de origem — mantenha essa
            citação visível em qualquer cópia desta trilha que sair daqui.
          </>
        ),
      };
    },
  },
  {
    id: 'turma-nao-resolvida',
    tone: 'warn',
    icon: <HelpCircle className="h-3.5 w-3.5" />,
    run: (model) => {
      const rows = model.items.filter((i) => i.ambiguousDay);
      if (rows.length === 0) return null;
      return {
        title: `${plural(rows.length, 'prova', 'provas')} com dois dias e sem turma no sistema`,
        body: 'O calendário imprime um dia por turma e o cadastro deste aluno não tem turma. Os cards dizem que não sabem, que é o comportamento certo — mas o conserto é preencher a turma no cadastro, nunca escolher um dos dois dias por ele.',
      };
    },
  },
  {
    id: 'divergencia-pdf',
    tone: 'warn',
    icon: <FileText className="h-3.5 w-3.5" />,
    run: (model) => {
      const rows = model.items.filter((i) => i.officialNote);
      if (rows.length === 0) return null;
      return {
        title: `${plural(rows.length, 'divergência', 'divergências')} de transcrição no PDF de origem`,
        body: 'A transcrição preservou a divergência em vez de escolher uma versão. Abra o documento pelo link da linha e confira: se o erro é do PDF, o conserto é com quem o publica, e até lá a data não pode ser tratada como definitiva com o aluno.',
      };
    },
  },
  {
    id: 'prova-sem-disciplina',
    tone: 'info',
    icon: <HelpCircle className="h-3.5 w-3.5" />,
    run: (model) => {
      const rows = unresolvedExams(model.items);
      if (rows.length === 0) return null;
      return {
        title: `${plural(rows.length, 'prova', 'provas')} sem disciplina resolvida`,
        body: 'A grade deste aluno não está no sistema, ou a linha é do segundo bimestre e a grade guardada é a do corrente. Sem grade não há tradução: a linha sai com o texto oficial e uma frase honesta. Preencher a grade é o que mais aumenta o valor desta trilha.',
      };
    },
  },
  {
    id: 'faixa-simulada',
    tone: 'info',
    icon: <FlaskConical className="h-3.5 w-3.5" />,
    run: (model) => {
      if (!model.delta.simulated) return null;
      return {
        title: 'Faixa simulada: esta prévia não é o estado real',
        body: (
          <>
            O recorte foi montado na faixa{' '}
            <span className="font-medium text-ink">«{BAND_LABEL[model.delta.band]}»</span>, forçada
            no simulador da tela, e não na que o Δ deste aluno produz. Volte à faixa real antes de
            usar esta auditoria como resposta sobre o que o aluno vê.
          </>
        ),
      };
    },
  },
];

const TONE_WEIGHT: Record<AuditCheck['tone'], number> = { crit: 0, warn: 1, info: 2 };

type AuditAlert = AuditCheck & { title: string; body: ReactNode };

/* ==========================================================================
   O painel
   ========================================================================== */

export function TrilhaAudit({ model }: { model: TrilhaModel }) {
  const [filter, setFilter] = useState<BucketFilter>('todos');

  const buckets = useMemo(() => bucketsOf(model), [model]);

  const alerts = useMemo<AuditAlert[]>(
    () =>
      AUDIT_CHECKS.map((check) => {
        const hit = check.run(model);
        return hit ? { ...check, ...hit } : null;
      })
        .filter((a): a is AuditAlert => a !== null)
        .sort((a, b) => TONE_WEIGHT[a.tone] - TONE_WEIGHT[b.tone]),
    [model],
  );

  const groups = BUCKET_ORDER.map((bucket) => ({ bucket, items: buckets[bucket] })).filter(
    (g) => g.items.length > 0 && (filter === 'todos' || filter === g.bucket),
  );

  const visible = groups.reduce((sum, g) => sum + g.items.length, 0);
  const visibleItems = groups
    .flatMap((group) => group.items)
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const monthGroups = Array.from(new Set(visibleItems.map((item) => item.start.slice(0, 7)))).map(
    (key) => {
      const [year, month] = key.split('-').map(Number);
      return {
        key,
        label: new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('pt-BR', {
          month: 'long',
          timeZone: 'UTC',
        }),
        items: visibleItems.filter((item) => item.start.startsWith(key)),
      };
    },
  );

  const filterOptions: SegmentedOption<BucketFilter>[] = [
    { value: 'todos', label: 'Todos', count: model.totalCount },
    ...BUCKET_ORDER.map((bucket) => ({
      value: bucket as BucketFilter,
      label: BUCKET_META[bucket].label,
      count: buckets[bucket].length,
    })),
  ];

  return (
    <div className="space-y-4 min-w-0">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-ink-4">Resumo do calendário</p>
            <p className="mt-2 text-[13px] text-ink-2"><strong className="font-mono text-[28px] text-ink">{int(model.shownCount)}</strong> de <strong className="font-mono text-ink">{int(model.totalCount)}</strong> datas aparecem para o aluno</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {BUCKET_ORDER.map((bucket) => <span key={bucket} className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 text-[11px] text-ink-3"><span className={`h-2 w-2 rounded-sm ${BUCKET_META[bucket].swatch}`} />{BUCKET_META[bucket].label} <strong className="font-mono text-ink">{int(buckets[bucket].length)}</strong></span>)}
          </div>
        </div>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={BUCKET_ORDER.map((b) => `${BUCKET_META[b].label}: ${buckets[b].length}`).join(', ')}>
          {model.totalCount > 0 && BUCKET_ORDER.filter((b) => buckets[b].length > 0).map((bucket) => <div key={bucket} className={BUCKET_META[bucket].swatch} style={{ width: `${(buckets[bucket].length / model.totalCount) * 100}%` }} />)}
        </div>
      </Card>

      {alerts.length > 0 && (
        <Card>
          <SectionLabel>Precisa de atenção</SectionLabel>
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="mt-3 flex flex-wrap gap-2">
            {alerts.map((alert) => <motion.div key={alert.id} variants={staggerItem} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-medium ${alert.tone === 'crit' ? 'border-crit-border bg-crit-soft text-crit-ink' : alert.tone === 'warn' ? 'border-warn-border bg-warn-soft text-warn-ink' : 'border-info-border bg-info-soft text-info-ink'}`}>{alert.icon}{alert.title}</motion.div>)}
          </motion.div>
        </Card>
      )}

      <Card padded={false}>
        <div className="space-y-3 px-5 pt-4">
          <SectionLabel
            action={
              <span className="text-[11px] whitespace-nowrap text-ink-4">
                Arraste para o lado → · <span className="font-mono tabular">{int(visible)} de {int(model.totalCount)}</span>
              </span>
            }
          >
            Todas as linhas do calendário
          </SectionLabel>

          <Segmented
            layoutId="trilha-audit-bucket"
            size="xs"
            value={filter}
            onChange={setFilter}
            options={filterOptions}
          />

          {monthGroups.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1" aria-label="Atalhos por mês">
              <span className="mr-1 shrink-0 text-[10px] font-semibold tracking-wide uppercase text-ink-4">
                Ir para
              </span>
              {monthGroups.map((month) => (
                <button
                  key={month.key}
                  type="button"
                  onClick={() =>
                    document
                      .getElementById(`trilha-mes-${month.key}`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
                  }
                  className="shrink-0 rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-[10.5px] font-medium capitalize text-ink-2 transition-colors hover:border-brand-border hover:text-brand-text"
                >
                  {month.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {model.totalCount === 0 ? (
          <EmptyState
            compact
            icon={<CalendarX2 className="h-5 w-5" />}
            title="Não há linhas a auditar"
            message={
              model.resolution.note ??
              'Sem calendário de origem não há datas a recortar — e nada foi escondido deste aluno.'
            }
          />
        ) : visible === 0 ? (
          <EmptyState
            compact
            icon={<EyeOff className="h-5 w-5" />}
            title="Nenhuma linha neste destino"
            message="O recorte não pôs nada aqui. Volte a «Todos» para ver o calendário inteiro."
          />
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="scroll-slim flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pt-4 pb-5"
          >
            {monthGroups.map((month) => (
              <section key={month.key} id={`trilha-mes-${month.key}`} className="flex shrink-0 scroll-ml-5 items-start gap-3">
                <div className="w-20 shrink-0 border-r border-hairline pr-3 pt-1">
                  <span className="block h-1.5 w-8 rounded-full bg-brand" />
                  <h3 className="mt-2 text-[12px] font-semibold capitalize text-ink-2">
                    {month.label}
                  </h3>
                  <span className="mt-1 block font-mono text-[10px] text-ink-4 tabular">
                    {int(month.items.length)} datas
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  {month.items.map((item) => (
                    <motion.div key={item.id} variants={staggerItem} className="w-[235px] shrink-0 snap-start rounded-xl border border-hairline bg-surface-2 px-3.5">
                      <AuditRow item={item} />
                    </motion.div>
                  ))}
                </div>
              </section>
            ))}
          </motion.div>
        )}
      </Card>
    </div>
  );
}

/* ==========================================================================
   A linha
   --------------------------------------------------------------------------
   O nosso título em cima, o oficial embaixo, e os dois sempre — inclusive
   quando são idênticos. Omitir a citação nos casos em que a tradução não mudou
   nada pareceria economia de tinta e seria o começo do fim do princípio: no dia
   em que a citação é condicional, a sua ausência passa a significar «aqui não
   há original», e não «aqui o original é igual».
   ========================================================================== */

function AuditRow({ item }: { item: TimelineItem }) {
  const tone = CONSEQUENCE_TONE[item.consequence];

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10.5px] text-ink-3 tabular">{datePhrase(item)}</p>
        <p className="shrink-0 font-mono text-[9.5px] text-ink-4 tabular">
          {countdownPhrase(item.inDays)}
        </p>
      </div>

      <p className="mt-2 line-clamp-2 min-h-[34px] text-[12.5px] leading-snug font-semibold text-ink">
        {item.title}
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="inline-flex rounded-sm bg-surface-3 px-1.5 py-0.5 text-[9.5px] font-medium text-ink-3">
          {CATEGORY_LABEL[item.category] ?? item.category}
        </span>
        <Pill tone={tone} solid={item.consequence === 'irrecuperavel'} className="text-[10px]">
          {CONSEQUENCE_LABEL[item.consequence]}
        </Pill>
        {item.ambiguousDay && (
          <span className="inline-flex items-center gap-1 rounded-sm bg-warn-soft px-1.5 py-px text-[9.5px] font-semibold text-warn-ink">
            <HelpCircle className="h-2.5 w-2.5" />
            sem turma
          </span>
        )}
        {item.officialNote && (
          <span className="inline-flex items-center gap-1 rounded-sm bg-warn-soft px-1.5 py-px text-[9.5px] font-semibold text-warn-ink">
            <AlertTriangle className="h-2.5 w-2.5" />
            divergência
          </span>
        )}
      </div>

      <details className="mt-3 border-t border-hairline pt-2 text-[10.5px] text-ink-3">
        <summary className="cursor-pointer font-medium text-brand-text">Ver detalhes</summary>
        <div className="mt-2 space-y-1.5 leading-relaxed">
          <p><span className="text-ink-4">No PDF: </span>«{item.officialTitle}»</p>
          {item.officialDetail && <p>{item.officialDetail}</p>}
          {item.officialNote && <p className="text-warn-ink">{item.officialNote}</p>}
          {item.hiddenReason && <p className="flex gap-1.5"><EyeOff className="mt-0.5 h-3 w-3 shrink-0" />{item.hiddenReason}</p>}
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-brand-text transition-colors hover:text-brand-2"
          >
            <FileText className="h-2.5 w-2.5" />
            {item.sourceName}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </details>
    </div>
  );
}
