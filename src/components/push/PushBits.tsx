import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  BellRing,
  BookOpen,
  CalendarClock,
  CheckCheck,
  ChevronRight,
  Clock3,
  FileClock,
  GraduationCap,
  HandHeart,
  PartyPopper,
  Pencil,
  Send,
  Sparkles,
  Wallet,
  WifiOff,
} from 'lucide-react';
import type { EventRelevance, PushCategory, PushStatus } from '../../types';
import { Pill } from '../ui/Badges';
import { press } from '../../lib/motion';
import { CATEGORY_LABEL } from '../../lib/push';

/* ==========================================================================
   Vocabulário visual da Gestão de PUSH
   --------------------------------------------------------------------------
   Uma régua de semestre tem quarenta linhas e nenhuma delas é urgente sozinha.
   Ler quarenta linhas iguais é o que faz alguém desistir de conferir a régua —
   então a categoria ganha um ícone (que se lê de relance e não gasta cor) e o
   status de entrega ganha um ponto (que é verdade sobre o mundo, e por isso
   pode gastar).

   O preview de notificação existe pelo mesmo motivo que uma prova de gráfica
   existe: o texto que parece bom no formulário fica cortado no celular. Ver o
   push do jeito que o aluno vê é a única forma de escrever para o aluno.
   ========================================================================== */

const CATEGORY_ICON: Record<PushCategory, typeof BellRing> = {
  aula: BookOpen,
  prova: FileClock,
  prazo: CalendarClock,
  evento: PartyPopper,
  feriado: Sparkles,
  programa: GraduationCap,
  financeiro: Wallet,
  engajamento: BellRing,
  acolhimento: HandHeart,
};

export function CategoryIcon({
  category,
  className = 'h-4 w-4',
}: {
  category: PushCategory;
  className?: string;
}) {
  const Icon = CATEGORY_ICON[category] ?? BellRing;
  return <Icon className={className} />;
}

export function CategoryTag({ category }: { category: PushCategory }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-ink-3">
      <CategoryIcon category={category} className="h-3 w-3" />
      {CATEGORY_LABEL[category] ?? category}
    </span>
  );
}

/**
 * Relevância é decisão nossa, não do PDF — e é a chave que liga ou desliga o
 * push. Por isso ela aparece como verdicto (ponto + palavra) e não como tag.
 */
export function RelevanceTag({ relevance }: { relevance: EventRelevance }) {
  if (relevance === 'alta') return <Pill tone="crit" solid>Alta</Pill>;
  if (relevance === 'media') return <Pill tone="warn">Média</Pill>;
  return <Pill tone="muted">Baixa</Pill>;
}

const STATUS_TONE: Record<PushStatus, 'ok' | 'info' | 'muted' | 'crit'> = {
  Aberto: 'ok',
  Enviado: 'info',
  Agendado: 'muted',
  'Não entregue': 'crit',
};

export function DeliveryTag({ status }: { status: PushStatus }) {
  if (status === 'Não entregue') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold whitespace-nowrap text-crit-ink">
        <WifiOff className="h-3 w-3" />
        Não entregue
      </span>
    );
  }
  if (status === 'Aberto') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium whitespace-nowrap text-ink-2">
        <CheckCheck className="h-3.5 w-3.5 text-ink-3" />
        Aberto
      </span>
    );
  }
  if (status === 'Agendado') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium whitespace-nowrap text-ink-3">
        <Clock3 className="h-3 w-3" />
        Agendado
      </span>
    );
  }
  return <Pill tone={STATUS_TONE[status]}>{status}</Pill>;
}

/* -- Botão-lápis ----------------------------------------------------------
   Aparece em toda linha editável e some visualmente até o hover, porque numa
   lista de quarenta itens quarenta lápis visíveis são ruído puro. Em telas de
   toque, onde hover não existe, ele fica sempre visível. */

export function PencilButton({
  onClick,
  label,
  edited = false,
}: {
  onClick: () => void;
  label: string;
  edited?: boolean;
}) {
  return (
    <motion.button
      whileTap={press}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={[
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all',
        'hover:bg-surface-3 hover:text-ink',
        edited
          ? 'text-brand-text opacity-100'
          : 'text-ink-4 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
      ].join(' ')}
    >
      <Pencil className="h-3.5 w-3.5" />
    </motion.button>
  );
}

export function EditedMark() {
  return (
    <span
      title="Texto editado manualmente"
      className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-brand-text"
    >
      <Pencil className="h-2.5 w-2.5" />
      editado
    </span>
  );
}

/* -- Prova de gráfica: o push como o aluno vê ---------------------------- */

export function NotificationPreview({
  title,
  body,
  stamp,
  muted = false,
}: {
  title: string;
  body: string;
  stamp?: string;
  /** Desligado: mostra como está, mas deixa claro que não vai sair. */
  muted?: boolean;
}) {
  return (
    <div
      className={[
        'rounded-2xl bg-surface-2 p-3.5 transition-opacity',
        muted ? 'opacity-45' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 text-[11px] font-medium text-ink-3">
        <span className="flex h-4 w-4 items-center justify-center rounded-[5px] bg-[var(--brand-mark)] font-mono text-[9px] font-semibold text-white">
          A
        </span>
        Grupo Anchieta
        {stamp && <span className="ml-auto font-mono text-ink-4">{stamp}</span>}
      </div>
      <p className="mt-2 text-[13px] leading-snug font-semibold text-ink">{title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{body}</p>
    </div>
  );
}

/* -- Cabeçalho de mês na régua e no calendário --------------------------- */

const MONTH_NAME = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return `${MONTH_NAME[month - 1]} de ${year}`;
}

/** Agrupa em meses preservando a ordem cronológica de entrada. */
export function groupByMonth<T>(items: T[], dateOf: (item: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  items.forEach((item) => {
    const key = monthKey(dateOf(item));
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  });
  return [...map.entries()];
}

export function MonthHeading({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <div className="sticky top-0 z-10 flex items-baseline gap-2 bg-surface/95 py-2 backdrop-blur">
      <h3 className="text-[12px] font-semibold text-ink-3">{children}</h3>
      {count !== undefined && (
        <span className="font-mono text-[11px] text-ink-4">{count}</span>
      )}
    </div>
  );
}

/* -- O próximo disparo ----------------------------------------------------
   Numa régua de setenta linhas existe exatamente uma que muda o que alguém faz
   hoje: a próxima a sair. Ela é a única coisa desta aba que ganha o azul
   institucional — se duas coisas na mesma tela forem azuis, nenhuma é. */

export function NextUpBanner({
  stamp,
  title,
  detail,
  onOpen,
}: {
  stamp: string;
  title: string;
  detail?: string;
  onOpen?: () => void;
}) {
  const Tag = onOpen ? motion.button : motion.div;
  return (
    <Tag
      {...(onOpen ? { whileTap: press, onClick: onOpen } : {})}
      className={[
        'relative flex w-full items-center gap-3 overflow-hidden rounded-lg bg-brand-soft p-3 pl-4 text-left',
        onOpen ? 'transition-colors hover:bg-brand-soft-2' : '',
      ].join(' ')}
    >
      <span className="absolute inset-y-0 left-0 w-0.5 bg-brand" />
      <Send className="h-4 w-4 shrink-0 text-brand-text" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-brand-text">
          Próximo disparo · {stamp}
        </p>
        <p className="mt-0.5 truncate text-[13px] font-semibold text-ink">{title}</p>
        {detail && <p className="mt-0.5 truncate text-[11.5px] text-ink-3">{detail}</p>}
      </div>
      {onOpen && <ChevronRight className="h-4 w-4 shrink-0 text-brand-text" />}
    </Tag>
  );
}

/** Etiqueta azul da linha que vai sair a seguir. */
export function NextUpTag() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-brand-soft px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-brand-text">
      <Send className="h-2.5 w-2.5" />
      próximo
    </span>
  );
}

/* -- A linha do hoje ------------------------------------------------------
   O calendário do semestre inteiro rola por três telas e o olho não tem onde
   se ancorar. Uma régua fina marcando "hoje" resolve isso com um pixel de
   tinta, e é o mesmo azul que marca o próximo disparo — as duas dizem "é aqui
   que você está". */

export function TodayMarker({ label }: { label: string }) {
  return (
    <div className="relative flex items-center gap-2 py-2">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
      <span className="text-[11px] font-semibold whitespace-nowrap text-brand-text">
        hoje · {label}
      </span>
      <span className="h-px flex-1 bg-brand/25" />
    </div>
  );
}
