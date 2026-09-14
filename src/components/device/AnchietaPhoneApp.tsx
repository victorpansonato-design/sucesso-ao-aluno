import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Banknote,
  BellRing,
  BookOpen,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  GraduationCap,
  Headphones,
  Home,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  MonitorPlay,
  ChevronDown,
  ExternalLink,
  Rocket,
  Search,
  ScrollText,
  Settings,
  Share2,
  ShieldCheck,
  TriangleAlert,
  WalletCards,
} from 'lucide-react';
import type {
  Discipline,
  StepPlace,
  TimelineItem,
  TrilhaModel,
  TrilhaStep,
} from '../../types';
import { IOS, IosStatusBar } from './IPhone';
import { AnchietaLogo } from '../brand/AnchietaLogo';
import { longDay, shiftDays, shortDay as shortDayOf, weekdayOf } from '../../lib/calendarDates';
import {
  CONSEQUENCE_LABEL,
  PLACE_LABEL,
  assessmentPeriodOf,
  bucketsOf,
  countdownPhrase,
  datePhrase,
  disciplineFor,
  isPeriod,
  nextBadge,
  recognitionOf,
  stepInstructions,
  stepProgress,
} from '../../lib/trilha';
import { CATEGORY_LABEL } from '../../lib/push';
import { emphasis, exitFast, press, spring, springSoft } from '../../lib/motion';
import { useReducedMotion } from '../../lib/reactive';

/* ==========================================================================
   App Grupo Anchieta — a aplicação do aluno, dentro do aparelho
   --------------------------------------------------------------------------
   Esta é a tela que o aluno já tem, reproduzida de perto: o cabeçalho azul com
   a saudação, o card do dia, os quatro atalhos, os Destaques e a barra de
   abas. Ela não existe aqui para ser bonita — existe para que a decisão «onde
   entram as duas entradas novas» seja tomada olhando o lugar real onde elas vão
   morar, em vez de um retângulo vazio.

   TRÊS REGRAS HERDADAS DO `PulsePhoneApp`, PELO MESMO MOTIVO

     1. AS CORES SÃO LITERAIS, não tokens. A tela de um aparelho é fonte de luz
        própria e não inverte junto com o tema da página. O contraste foi
        aferido contra o preto do display, não contra `--surface`.
     2. TODO CONTROLE VISÍVEL TEM DESTINO. As abas, os quatro atalhos, os
        destaques, o calendário do cabeçalho e o atendimento abrem uma tela
        coerente dentro do aparelho. Onde a integração não fornece um dado, a
        tela assume o limite e indica a fonte oficial, sem inventar conteúdo.
     3. NADA SAI DA ABA. Todo caminho a partir do aparelho termina dentro dele
        ou no painel ao lado.

   A QUARTA REGRA É DESTE ARQUIVO: NÃO INVENTAR DADO DE ALUNO.

   O print de referência mostra «Prédio 1 · Sala 12 - Piso Térreo». Prédio e
   sala não existem em `Discipline`, e preencher com um número plausível seria
   ensinar o operador a confiar num campo que o sistema não tem. O terceiro slot
   do card do dia mostra o que sabemos de verdade — o formato da disciplina e o
   horário impresso na grade — e fica calado sobre o resto.

   ONDE ENTRAM OS DOIS ÍCONES, E POR QUE ALI

   Na área azul, numa prateleira logo abaixo da saudação, como dois chips de
   vidro. Três razões:

     · É a primeira dobra sem empurrar o card do dia para fora dela.
     · Chip carrega informação; ícone carrega rótulo. «Minhas datas» com «Prova
       2 · sáb 19» embaixo é olhado toda vez; um ícone que só diz «Datas» é
       aprendido numa semana e ignorado para sempre.
     · O segundo chip SE APOSENTA. «Comece por aqui» ocupa metade da prateleira
       enquanto há passo em aberto e desaparece quando não há — e aí «Minhas
       datas» toma a largura inteira. Dois ícones permanentes significariam um
       permanentemente morto na mesma região onde mora o que o aluno usa por
       cinco anos.
   ========================================================================== */

/** Paleta da tela. Aferida sobre o preto do display, não sobre `--surface`. */
const SCREEN = {
  page: '#000000',
  card: '#1e2023',
  cardHi: '#26292e',
  ink: '#ffffff',
  ink2: 'rgba(255,255,255,0.62)',
  ink3: 'rgba(255,255,255,0.40)',
  line: 'rgba(255,255,255,0.09)',
  link: '#4a9eff',
  green: '#22c55e',
  warn: '#f5b459',
  crit: '#f4776b',
  vital: '#32d583',
  exemption: '#c4b5fd',
} as const;

/** O degradê do cabeçalho. Azul institucional, não o azul do sistema operacional. */
const HEADER_BG =
  'radial-gradient(125% 95% at 14% -10%, #1670c9 0%, #0b5199 42%, #073d76 74%, #052f5c 100%)';

export type PhoneScreen =
  | 'inicio'
  | 'datas'
  /** Detalhe de uma data. Precisa de um item escolhido para existir. */
  | 'detalhe'
  | 'trilha'
  | 'modalidade'
  /** A trilha inteira, em grupos recolhíveis. */
  | 'passos'
  /** Detalhe de uma etapa. Precisa de uma etapa escolhida para existir. */
  | 'passo'
  | 'completo'
  | 'horarios'
  | 'avisos'
  | 'cobrancas'
  | 'notas'
  | 'contratos'
  | 'mais'
  | 'extensao'
  | 'atendimento';

/**
 * Posição conceitual de cada tela. A direção não tenta reproduzir uma pilha de
 * rotas inteira: ela só garante que avançar empurre o conteúdo para a esquerda
 * e voltar o devolva pela direção oposta. As quatro abas seguem sua posição
 * física na barra inferior, então alternar entre elas também parece natural.
 */
const SCREEN_POSITION: Record<PhoneScreen, number> = {
  inicio: 0,
  cobrancas: 1,
  notas: 1,
  contratos: 1,
  mais: 1,
  trilha: 1,
  modalidade: 2,
  horarios: 1,
  datas: 2,
  passos: 2,
  detalhe: 3,
  passo: 3,
  completo: 3,
  avisos: 3,
  extensao: 2,
  atendimento: 2,
};

const PHONE_SCREEN_VARIANTS = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction * 26,
    scale: 0.992,
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: springSoft,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -16,
    scale: 0.996,
    transition: exitFast,
  }),
};

export interface AnchietaPhoneAppProps {
  model: TrilhaModel;
  screen: PhoneScreen;
  onScreen: (screen: PhoneScreen) => void;
  /** Barra de status e safe areas. Desligado quando o aparelho vira card. */
  chrome?: boolean;
}

/* ==========================================================================
   Aula de hoje — derivada da grade, não inventada
   ========================================================================== */

/**
 * Os dias da semana como a grade os escreve.
 *
 * O sufixo opcional existe para aceitar «Qui» e «Quinta» com a mesma regra, e
 * o `\b` no fim é o que impede o desastre que esta função já cometeu: sem ele,
 * `\bqui` casava com «QUInzenal» e «Encontro quinzenal · Sáb» virava
 * quinta-feira. Um dia de aula errado no card do dia é exatamente o tipo de
 * invenção que o resto deste arquivo existe para não cometer.
 */
const DAY_PATTERN: { re: RegExp; index: number }[] = [
  { re: /\bdom(?:ingo)?\b/, index: 0 },
  { re: /\bseg(?:unda)?\b/, index: 1 },
  { re: /\bter(?:ca)?\b/, index: 2 },
  { re: /\bqua(?:rta)?\b/, index: 3 },
  { re: /\bqui(?:nta)?\b/, index: 4 },
  { re: /\bsex(?:ta)?\b/, index: 5 },
  { re: /\bsab(?:ado)?\b/, index: 6 },
];

const DAY_ALT = 'dom(?:ingo)?|seg(?:unda)?|ter(?:ca)?|qua(?:rta)?|qui(?:nta)?|sex(?:ta)?|sab(?:ado)?';

function deaccent(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function dayIndexOf(token: string): number {
  return DAY_PATTERN.findIndex((d) => d.re.test(token));
}

/**
 * Que dias da semana esta grade ocupa.
 *
 * Os textos de `schedule` vêm em cinco formas na base — «Seg e Qua · 19h00»,
 * «Ter, Qui e Sex · 08h00», «Seg a Qui · 08h00», «Encontro quinzenal · Sáb
 * 08h00» e «AVA · entregas semanais». As quatro primeiras têm dia; a última não
 * tem, e devolver lista vazia para ela é a resposta certa: disciplina digital
 * não acontece num dia da semana.
 *
 * A busca corre a linha INTEIRA, e não só o trecho antes do «·», porque a
 * quarta forma imprime o dia depois do separador.
 */
function scheduleDays(schedule: string): number[] {
  const text = deaccent(schedule);
  const out = new Set<number>();

  // «seg a qui» é um intervalo, e é a única forma em que os dias do meio não
  // estão escritos. Sem expandir, quarta-feira desapareceria da semana.
  const range = text.match(new RegExp(`(${DAY_ALT})\\s+a\\s+(${DAY_ALT})`));
  if (range) {
    const from = dayIndexOf(range[1]);
    const to = dayIndexOf(range[2]);
    if (from >= 0 && to >= from) {
      for (let d = from; d <= to; d += 1) out.add(d);
    }
  }

  DAY_PATTERN.forEach(({ re, index }) => {
    if (re.test(text)) out.add(index);
  });

  return [...out].sort((a, b) => a - b);
}

/** «Das 19:00 até 22:30», quando a grade imprime as duas pontas. */
function scheduleTime(schedule: string): string | null {
  const clock = (raw: string) => {
    const [h, m] = raw.split('h');
    return `${h.padStart(2, '0')}:${(m || '00').padEnd(2, '0')}`;
  };
  const span = schedule.match(/(\d{1,2}h\d{0,2})\s*(?:–|—|-|as|até)\s*(\d{1,2}h\d{0,2})/i);
  if (span) return `Das ${clock(span[1])} até ${clock(span[2])}`;
  const single = schedule.match(/(\d{1,2}h\d{0,2})/);
  return single ? `A partir das ${clock(single[1])}` : null;
}

const FORMAT_PLACE: Record<Discipline['format'], string> = {
  Presencial: 'Presencial, no campus',
  Híbrida: 'Encontro presencial no campus, teoria no AVA',
  Digital: 'On-line, no AVA',
};

interface TodayClass {
  discipline: Discipline;
  time: string | null;
}

function classesOn(disciplines: Discipline[], isoDate: string): TodayClass[] {
  const [y, m, d] = isoDate.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return disciplines
    .filter((disc) => !disc.exempted && scheduleDays(disc.schedule).includes(weekday))
    .map((discipline) => ({ discipline, time: scheduleTime(discipline.schedule) }));
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Inclui períodos em andamento e todas as ocorrências até o fim do próximo mês. */
function inTwoMonths(item: TimelineItem, today: string): boolean {
  const [year, month] = today.split('-').map(Number);
  const start = `${today.slice(0, 7)}-01`;
  const end = new Date(Date.UTC(year, month + 1, 1)).toISOString().slice(0, 10);
  return isPeriod(item.dateLabel)
    ? item.start < end && item.end >= start
    : item.dates.some((date) => date >= start && date < end);
}

function MoreDates({ expanded, onToggle, count }: { expanded: boolean; onToggle: () => void; count: number }) {
  return <button type="button" onClick={onToggle} aria-expanded={expanded}
    className="mt-4 min-h-11 w-full rounded-[14px] px-4 py-3 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
    style={{ backgroundColor: SCREEN.card, color: SCREEN.link }}>
    {expanded ? 'Mostrar só este mês e o próximo' : `Ver mais: todas as datas (${count})`}
  </button>;
}

/* ==========================================================================
   Peças de tela
   ========================================================================== */

function ScreenShell({
  chrome,
  simulated,
  children,
}: {
  chrome: boolean;
  /** A faixa foi forçada no simulador da aba. */
  simulated?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: SCREEN.page }}>
      {/* A tarja da simulação vive DENTRO do aparelho, e é por isso que ela
          existe. O aparelho é o que vai ser fotografado e mandado num grupo, e
          uma prévia de faixa forçada convive com datas reais: sem a tarja,
          «Suas aulas começam em 4 de agosto» numa simulação de matrícula
          antecipada circularia como se fosse o que o aluno vê. O aviso que está
          na aba, atrás do vidro, não sai no print.

          Ela OCUPA a faixa da barra de status em vez de empurrá-la: numa prévia
          rotulada, a hora não é a informação que importa, e empilhar as duas
          ou sobrepô-las custaria legibilidade nas duas. */}
      {chrome && !simulated && <IosStatusBar />}
      {simulated && (
        <div
          className="absolute inset-x-0 top-0 z-20 flex items-center justify-center text-center text-[10px] font-semibold tracking-wide uppercase"
          style={{
            height: chrome ? IOS.safeTop - 12 : 22,
            paddingTop: chrome ? 12 : 0,
            backgroundColor: SCREEN.warn,
            color: '#3a2405',
          }}
        >
          Prévia simulada · não é o que este aluno vê
        </div>
      )}
      <div
        className="ios-scroll flex-1 overflow-y-auto"
        style={{ paddingBottom: chrome ? IOS.safeBottom + 78 : 78 }}
      >
        {children}
      </div>
    </div>
  );
}

/** Cabeçalho azul curto das telas internas. */
function InnerHeader({
  title,
  subtitle,
  onBack,
  backLabel = 'Início',
  chrome,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  /** Para onde o voltar leva. Um rótulo fixo mentiria nas telas encadeadas. */
  backLabel?: string;
  chrome: boolean;
}) {
  return (
    <div
      className="px-5 pb-5"
      style={{ backgroundImage: HEADER_BG, paddingTop: chrome ? IOS.safeTop : 16 }}
    >
      <button
        type="button"
        onClick={onBack}
        className="-ml-1.5 mb-3 flex items-center gap-1 text-[15px]"
        style={{ color: SCREEN.ink }}
      >
        <ChevronLeft className="h-[18px] w-[18px]" />
        {backLabel}
      </button>
      <h1 className="text-[26px] leading-[1.15] font-semibold" style={{ color: SCREEN.ink }}>
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1.5 text-[13px] leading-snug" style={{ color: 'rgba(255,255,255,0.72)' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ==========================================================================
   Os dois chips de vidro — as entradas novas
   ========================================================================== */

function GlassChip({
  icon,
  label,
  value,
  tone,
  onClick,
  full,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: string;
  onClick: () => void;
  full?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      transition={spring}
      className={`ios-glass flex items-center gap-2.5 rounded-[17px] px-3 py-3 text-left ${
        full ? 'w-full' : 'flex-1 min-w-0'
      }`}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: 'rgba(255,255,255,0.16)', color: tone ?? SCREEN.ink }}
      >
        {icon}
      </span>
      {/* Sem chevron, e o rótulo não quebra. Dois chips dividem 402 pontos: o
          chevron custava os vinte pontos que faziam «Comece por aqui» virar
          duas linhas, e uma seta é redundante num alvo que é todo tocável. */}
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-[13px] leading-tight font-semibold whitespace-nowrap"
          style={{ color: SCREEN.ink }}
        >
          {label}
        </span>
        <span
          className="block truncate text-[11px] leading-tight"
          style={{ color: 'rgba(255,255,255,0.70)' }}
        >
          {value}
        </span>
      </span>
    </motion.button>
  );
}

/* ==========================================================================
   Tela inicial — o clone
   ========================================================================== */

function HomeScreen({
  model,
  onScreen,
  chrome,
}: {
  model: TrilhaModel;
  onScreen: (s: PhoneScreen) => void;
  chrome: boolean;
}) {
  const { student, today } = model;
  const progress = stepProgress(model.steps);
  const stepsOpen = progress.done < progress.total;

  const todayClasses = useMemo(
    () => classesOn(student.academic.disciplines, today),
    [student.academic.disciplines, today],
  );

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  const firstName = student.name.split(' ')[0];

  const datesValue =
    model.resolution.match === 'nenhuma'
      ? 'Sem calendário publicado'
      : model.delta.band === 'antecipada'
        ? 'Disponível mais perto do início'
        : nextBadge(model.next);

  return (
    <ScreenShell chrome={chrome} simulated={model.delta.simulated}>
      {/* ---- Cabeçalho azul -------------------------------------------- */}
      <div
        className="px-5 pb-6"
        style={{ backgroundImage: HEADER_BG, paddingTop: chrome ? IOS.safeTop - 8 : 14 }}
      >
        <div className="flex items-start justify-between">
          {/* A placa do logotipo recebe um azul mais fundo que o cabeçalho: o
              arquivo pinta a placa com --brand-mark e as letras de branco, e
              sobre o degradê claro do topo a placa no tom padrão sumiria. */}
          <span style={{ ['--brand-mark' as string]: '#04264a' }}>
            <AnchietaLogo className="h-[26px] w-auto" />
          </span>
          <button
            type="button"
            onClick={() => onScreen('completo')}
            aria-label="Abrir calendário completo"
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: SCREEN.ink }}
          >
            <CalendarRange className="h-[22px] w-[22px]" />
          </button>
        </div>

        <div className="mt-5 flex items-start justify-between gap-4">
          <div className="min-w-0 pt-1">
            <p className="text-[16px] leading-tight" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {greeting}, <strong className="font-bold">{firstName}</strong>!
            </p>
            <h1
              className="mt-2 text-[25px] leading-[1.18] font-medium"
              style={{ color: SCREEN.ink }}
            >
              Dê uma olhada no
              <br />
              que tem pra hoje!
            </h1>
          </div>

          {/* Sem fotografia: o retrato do print é de uma pessoa real, e uma
              base de demonstração não carrega rosto de ninguém. As iniciais
              ocupam o mesmo lugar com o mesmo peso visual. */}
          <div className="shrink-0 text-center">
            <div
              className="relative flex h-[86px] w-[86px] items-center justify-center rounded-full"
              style={{
                backgroundColor: 'rgba(255,255,255,0.14)',
                boxShadow: 'inset 0 0 0 2.5px rgba(255,255,255,0.9)',
              }}
            >
              <span className="text-[27px] font-semibold" style={{ color: SCREEN.ink }}>
                {student.initials}
              </span>
              <span
                className="absolute -bottom-0.5 -left-1 flex h-[27px] w-[27px] items-center justify-center rounded-full"
                style={{ backgroundColor: '#0b5199', boxShadow: '0 0 0 2.5px #073d76' }}
              >
                <ClipboardList className="h-[14px] w-[14px]" style={{ color: SCREEN.ink }} />
              </span>
            </div>
            <p className="mt-2 text-[13px] font-bold" style={{ color: SCREEN.ink }}>
              RA: {student.ra}
            </p>
          </div>
        </div>

        {/* ---- A prateleira das duas entradas novas -------------------- */}
        <div className="mt-5 flex items-stretch gap-2.5">
          <GlassChip
            icon={<CalendarDays className="h-[17px] w-[17px]" />}
            label="Minhas datas"
            value={datesValue}
            onClick={() => onScreen('datas')}
            full={!stepsOpen}
          />
          {stepsOpen && (
            <GlassChip
              icon={<Rocket className="h-[17px] w-[17px]" />}
              label="Comece por aqui"
              value={`${progress.done} de ${progress.total} passos`}
              tone={SCREEN.vital}
              onClick={() => onScreen('trilha')}
            />
          )}
        </div>
      </div>

      {/* ---- Card do dia ----------------------------------------------- */}
      <div className="px-5" style={{ marginTop: -14 }}>
        <div className="rounded-[18px] p-4" style={{ backgroundColor: SCREEN.card }}>
          <div className="flex items-center gap-3">
            <CalendarDays className="h-[21px] w-[21px] shrink-0" style={{ color: SCREEN.ink }} />
            <span className="text-[18px] leading-tight" style={{ color: SCREEN.ink }}>
              {capitalize(weekdayOf(today))}, {longDay(today)}
            </span>
          </div>

          {todayClasses.length > 0 ? (
            todayClasses.map(({ discipline, time }) => (
              <div key={discipline.id} className="mt-4 space-y-3.5">
                <div className="flex items-start gap-3">
                  <ScrollText className="mt-0.5 h-[19px] w-[19px] shrink-0" style={{ color: SCREEN.ink }} />
                  <span className="min-w-0">
                    <span className="block text-[16px] leading-snug font-semibold" style={{ color: SCREEN.ink }}>
                      {discipline.name}
                    </span>
                    {time && (
                      <span className="block text-[13px] leading-snug" style={{ color: SCREEN.ink2 }}>
                        {time}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-[19px] w-[19px] shrink-0" style={{ color: SCREEN.ink }} />
                  <span className="min-w-0">
                    <span className="block text-[15px] leading-snug" style={{ color: SCREEN.ink }}>
                      {FORMAT_PLACE[discipline.format]}
                    </span>
                    <span className="block text-[13px] leading-snug" style={{ color: SCREEN.ink2 }}>
                      {discipline.teacher} · {discipline.code}
                    </span>
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="mt-4 flex items-start gap-3">
              <Clock3 className="mt-0.5 h-[19px] w-[19px] shrink-0" style={{ color: SCREEN.ink2 }} />
              <span className="min-w-0">
                <span className="block text-[15px] leading-snug" style={{ color: SCREEN.ink }}>
                  {student.academic.disciplines.length === 0
                    ? 'Sua grade não está no sistema'
                    : 'Nenhum encontro presencial hoje'}
                </span>
                <span className="block text-[13px] leading-snug" style={{ color: SCREEN.ink2 }}>
                  {student.academic.disciplines.length === 0
                    ? 'Confira suas disciplinas no Portal do Aluno.'
                    : 'Confira as entregas da semana no AVA.'}
                </span>
              </span>
            </div>
          )}

          <div className="mt-4 border-t pt-3.5" style={{ borderColor: SCREEN.line }}>
            <button
              type="button"
              onClick={() => onScreen('horarios')}
              className="flex w-full items-center justify-between text-[15px]"
              style={{ color: SCREEN.link }}
            >
              Ver todas as aulas
              <ChevronRight className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </div>

      {/* ---- Quatro atalhos -------------------------------------------- */}
      <div className="mt-5 grid grid-cols-4 gap-3 px-5">
        {[
          { Icon: Banknote, label: 'Cobranças a Pagar', screen: 'cobrancas' as const },
          { Icon: FileText, label: 'Notas e Faltas', screen: 'notas' as const },
          { Icon: ClipboardList, label: 'Contratos', screen: 'contratos' as const },
          { Icon: MoreHorizontal, label: 'Mais...', screen: 'mais' as const },
        ].map(({ Icon, label, screen }) => (
          <button key={label} type="button" onClick={() => onScreen(screen)} className="group text-left">
            <span
              className="flex aspect-square items-center justify-center rounded-[18px]"
              style={{ backgroundColor: SCREEN.card }}
            >
              <Icon className="h-[26px] w-[26px] transition-transform group-active:scale-90" style={{ color: SCREEN.ink }} />
            </span>
            <p className="mt-1.5 text-center text-[11px] leading-tight" style={{ color: SCREEN.ink2 }}>
              {label}
            </p>
          </button>
        ))}
      </div>

      {/* ---- Destaques -------------------------------------------------- */}
      <h2 className="mt-6 px-5 text-[19px] font-semibold" style={{ color: SCREEN.ink }}>
        Destaques
      </h2>
      <div className="ios-scroll mt-3 flex gap-3 overflow-x-auto px-5 pb-1">
        {[
          {
            title: 'Calendário acadêmico',
            body: 'Fique por dentro das datas importantes do semestre.',
            Icon: CalendarDays,
            wash: 'linear-gradient(140deg, #2b3a4d 0%, #1b2530 100%)',
            action: () => onScreen('completo'),
          },
          {
            title: 'Cursos de Extensão',
            body: 'Vagas limitadas! Inscreva-se nos cursos de extensão e amplie sua formação.',
            Icon: Rocket,
            wash: 'linear-gradient(140deg, #4d422b 0%, #302819 100%)',
            action: () => onScreen('extensao'),
          },
        ].map(({ title, body, Icon, wash, action }) => (
          <button
            key={title}
            type="button"
            onClick={action}
            className="w-[252px] shrink-0 overflow-hidden rounded-[16px] text-left"
            style={{ backgroundColor: SCREEN.card }}
          >
            <div className="flex h-[112px] items-center justify-center" style={{ backgroundImage: wash }}>
              <Icon className="h-9 w-9" style={{ color: 'rgba(255,255,255,0.34)' }} />
            </div>
            <div className="p-3.5">
              <p className="text-[15px] leading-snug font-semibold" style={{ color: SCREEN.ink }}>
                {title}
              </p>
              <p className="mt-1 text-[12px] leading-snug" style={{ color: SCREEN.ink2 }}>
                {body}
              </p>
            </div>
          </button>
        ))}
      </div>
    </ScreenShell>
  );
}

/* ==========================================================================
   Minhas datas
   ========================================================================== */

/* ==========================================================================
   O calendário compacto da visão «Mês»
   --------------------------------------------------------------------------
   Ele é um SELETOR, não a leitura principal. A lista embaixo continua sendo
   onde o aluno lê; a grade existe para responder «e no dia 23, tem o quê?» sem
   rolar o semestre inteiro.

   A REGRA DOS PONTOS É A MESMA REGRA DO RESTO DO PRODUTO

   Um ponto só nasce de uma data que existe no documento oficial. Para um
   evento datado, todos os dias impressos recebem ponto. Para um PERÍODO —
   «28/09 a 03/10, período de aplicação da P1» — só o início e o fim recebem,
   porque os dias do meio não são datas: são o intervalo entre elas. Pintar os
   seis dias sugeriria seis compromissos, e pintar um deles seria escolher o dia
   da prova, que é exatamente o que o sistema não sabe e não deve fingir saber.
   ========================================================================== */

/** Domingo a sábado, como o aplicativo os imprime. */
const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** O primeiro dia do mês de uma data ISO, como {ano, mês} sem fuso. */
function monthOf(iso: string): { year: number; month: number } {
  const [year, month] = iso.split('-').map(Number);
  return { year, month };
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function monthLabel({ year, month }: { year: number; month: number }): string {
  return `${MONTH_NAMES[month - 1]} de ${year}`;
}

function addMonths(year: number, month: number, step: number): { year: number; month: number } {
  const zero = year * 12 + (month - 1) + step;
  return { year: Math.floor(zero / 12), month: (zero % 12) + 1 };
}

/**
 * Os dias que este item marca no calendário.
 *
 * Período devolve as duas pontas; qualquer outra coisa devolve os dias
 * impressos. Ver o comentário do bloco.
 */
function markedDays(item: TimelineItem): string[] {
  if (isPeriod(item.dateLabel)) {
    return item.start === item.end ? [item.start] : [item.start, item.end];
  }
  return item.dates.length > 0 ? item.dates : [item.start];
}

function MonthGrid({
  year,
  month,
  items,
  today,
  selected,
  onSelect,
  onMonth,
  canGoBack,
  canGoForward,
}: {
  year: number;
  month: number;
  items: TimelineItem[];
  today: string;
  selected: string | null;
  onSelect: (iso: string | null) => void;
  onMonth: (step: -1 | 1) => void;
  canGoBack: boolean;
  canGoForward: boolean;
}) {
  /* Um dia pode ter mais de um evento. O ponto é um só, e a cor é a do que
     pede mais atenção: laranja é a cor de prazo em todo o sistema, e um prazo
     que fecha vale mais que um encontro no mesmo dia. */
  const dots = useMemo(() => {
    const map = new Map<string, 'prazo' | 'outro'>();
    items.forEach((item) => {
      markedDays(item).forEach((iso) => {
        if (item.category === 'prazo') map.set(iso, 'prazo');
        else if (!map.has(iso)) map.set(iso, 'outro');
      });
    });
    return map;
  }, [items]);

  /* Seis semanas fixas. Uma grade que muda de altura conforme o mês empurra a
     lista para cima e para baixo a cada toque na seta, e a lista é o que o
     aluno está lendo. */
  const first = new Date(Date.UTC(year, month - 1, 1));
  const leading = first.getUTCDay();
  const cells: { iso: string; day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(Date.UTC(year, month - 1, 1 - leading + i));
    cells.push({
      iso: date.toISOString().slice(0, 10),
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month - 1,
    });
  }

  return (
    <div className="rounded-[20px] p-4" style={{ backgroundColor: SCREEN.card }}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonth(-1)}
          disabled={!canGoBack}
          aria-label={`Ir para ${monthLabel(addMonths(year, month, -1))}`}
          className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-25"
          style={{ color: SCREEN.ink }}
        >
          <ChevronLeft className="h-[22px] w-[22px]" />
        </button>
        <p
          className="text-[17px] font-semibold capitalize"
          style={{ color: SCREEN.ink }}
          aria-live="polite"
        >
          {MONTH_NAMES[month - 1]} {year}
        </p>
        <button
          type="button"
          onClick={() => onMonth(1)}
          disabled={!canGoForward}
          aria-label={`Ir para ${monthLabel(addMonths(year, month, 1))}`}
          className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-25"
          style={{ color: SCREEN.ink }}
        >
          <ChevronRight className="h-[22px] w-[22px]" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7">
        {WEEKDAY_INITIALS.map((initial, index) => (
          <span
            key={`${initial}-${index}`}
            className="text-center text-[12px]"
            style={{ color: SCREEN.ink2 }}
            aria-hidden="true"
          >
            {initial}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {cells.map(({ iso, day, inMonth }) => {
          const dot = inMonth ? dots.get(iso) : undefined;
          const isSelected = selected === iso;
          const isToday = iso === today;
          return (
            <button
              key={iso}
              type="button"
              disabled={!inMonth}
              onClick={() => onSelect(isSelected ? null : iso)}
              aria-pressed={isSelected}
              aria-label={
                inMonth
                  ? `${day} de ${MONTH_NAMES[month - 1]}${dot ? ', com data marcada' : ', sem datas'}`
                  : undefined
              }
              className="relative flex h-[42px] flex-col items-center justify-center"
            >
              <span
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-[16px]"
                style={{
                  color: !inMonth ? SCREEN.ink3 : isSelected ? '#ffffff' : SCREEN.ink,
                  backgroundColor: isSelected ? '#1689f4' : 'transparent',
                  boxShadow: !isSelected && isToday ? `inset 0 0 0 1.5px ${SCREEN.ink3}` : undefined,
                }}
              >
                {day}
              </span>
              {dot && (
                <span
                  className="absolute bottom-[1px] h-[5px] w-[5px] rounded-full"
                  style={{ backgroundColor: dot === 'prazo' ? SCREEN.warn : '#1689f4' }}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** «19 SET» e «setembro de 2026» a partir de um ISO, sem fuso pelo caminho. */
function dateParts(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return {
    day: String(day).padStart(2, '0'),
    month: date
      .toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })
      .replace('.', '')
      .toUpperCase(),
    monthLong: monthLabel({ year, month }),
  };
}

function CategoryIcon({ item, className = 'h-5 w-5' }: { item: TimelineItem; className?: string }) {
  if (item.category === 'prova') return <BookOpen className={className} />;
  if (item.category === 'aula') return <GraduationCap className={className} />;
  return <FileText className={className} />;
}

/**
 * A linha do tempo.
 *
 * Os dois modos — «Próximas» e «Mês» — renderizam a MESMA lista. A grade do mês
 * troca quais itens entram; ela não troca como um item se lê, e duas listas
 * escritas em paralelo divergiriam na primeira correção feita só numa delas.
 */
function TimelineList({
  items,
  onOpen,
}: {
  items: TimelineItem[];
  onOpen: (item: TimelineItem) => void;
}) {
  return (
    <div className="relative mt-4 space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[42px] before:w-px before:bg-white/20">
      {items.map((item) => {
        const part = dateParts(item.start);
        return (
          <div key={item.id} className="relative grid w-full min-w-0 grid-cols-[52px_minmax(0,1fr)] gap-2.5">
            <div className="min-w-0 pt-2">
              <p className="text-[21px] leading-none font-bold" style={{ color: SCREEN.ink }}>
                {part.day}
              </p>
              <p className="mt-1 text-[10px]" style={{ color: SCREEN.ink2 }}>
                {part.month}
              </p>
              <span
                className="absolute top-3 left-[35px] h-4 w-4 rounded-full border-[4px] border-[#064d91]"
                style={{ backgroundColor: item.category === 'prazo' ? SCREEN.warn : '#1689f4' }}
              />
            </div>
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="flex w-full min-w-0 max-w-full items-center gap-2.5 overflow-hidden rounded-[17px] border p-3 text-left"
              style={{ background: 'linear-gradient(135deg,#202123,#171819)', borderColor: SCREEN.line }}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center" style={{ color: SCREEN.ink }}>
                <CategoryIcon item={item} />
              </span>
              <span className="min-w-0 flex-1 overflow-hidden">
                <span className="line-clamp-2 block text-[13px] leading-snug font-semibold" style={{ color: SCREEN.ink }}>
                  {item.title}
                </span>
                <span className="mt-0.5 block truncate text-[11px]" style={{ color: SCREEN.ink2 }}>
                  {item.lines[0] ?? CATEGORY_LABEL[item.category]}
                </span>
                <span className="mt-1 flex items-center gap-1 text-[10.5px]" style={{ color: SCREEN.ink2 }}>
                  <Clock3 className="h-3 w-3 shrink-0" />
                  {countdownPhrase(item.inDays)}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" style={{ color: SCREEN.ink3 }} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function DatesScreen({
  model,
  onScreen,
  onOpenItem,
  chrome,
}: {
  model: TrilhaModel;
  onScreen: (s: PhoneScreen) => void;
  onOpenItem: (item: TimelineItem) => void;
  chrome: boolean;
}) {
  const buckets = bucketsOf(model);
  const [mode, setMode] = useState<'proximas' | 'mes'>('proximas');
  const [filter, setFilter] = useState<'tudo' | 'prova' | 'prazo' | 'aula'>('tudo');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const upcoming = [...buckets.agora, ...buckets.guardado].sort((a, b) => a.inDays - b.inDays);
  const personal = model.items.filter((item) => item.bucket !== 'recolhido').sort((a, b) => a.start.localeCompare(b.start));
  const filtered = personal.filter((item) => (expanded || inTwoMonths(item, model.today)) && (filter === 'tudo' || item.category === filter));
  const next = upcoming.find((item) => !item.exempted);

  /* O mês inclui o que já passou DENTRO dele, e isso é deliberado. `recolhido`
     é curadoria — fica no calendário completo, contado no «N de M». `passado`
     não é curadoria, é tempo: uma grade de setembro que escondesse o dia 3
     estaria mentindo sobre setembro, e é a própria grade que o aluno está
     olhando para conferir. */
  const monthPool = useMemo(
    () => model.items.filter((item) => item.bucket !== 'recolhido'),
    [model.items],
  );

  const span = useMemo(() => {
    const days = monthPool.flatMap((item) => markedDays(item)).sort();
    return { first: days[0], last: days[days.length - 1] };
  }, [monthPool]);

  const [cursor, setCursor] = useState(() => monthOf(model.today));

  /* O mês aberto segue o ALUNO, e não a montagem do componente.
     A aba troca o RA e a faixa simulada sem desmontar o aparelho, e um cursor
     preso na montagem deixava a grade parada em setembro de um aluno enquanto
     a lista já era de outro — uma tela vazia que parece defeito e não é. */
  const anchorMonth = model.today;
  useEffect(() => {
    setCursor(monthOf(anchorMonth));
    setSelectedDay(null);
  }, [model.student.id, anchorMonth]);

  const inCursorMonth = (iso: string) => {
    const m = monthOf(iso);
    return m.year === cursor.year && m.month === cursor.month;
  };

  const monthItems = monthPool.filter((item) => markedDays(item).some(inCursorMonth));
  const dayItems = selectedDay
    ? monthItems.filter((item) => markedDays(item).includes(selectedDay))
    : monthItems;

  const cursorKey = monthKey(cursor.year, cursor.month);
  const canGoBack = span.first ? cursorKey > span.first.slice(0, 7) : false;
  const canGoForward = span.last ? cursorKey < span.last.slice(0, 7) : false;

  const goMonth = (step: -1 | 1) => {
    setCursor((current) => addMonths(current.year, current.month, step));
    setSelectedDay(null);
  };

  const filters = [
    { value: 'tudo' as const, label: 'Tudo' },
    { value: 'prova' as const, label: 'Provas' },
    { value: 'prazo' as const, label: 'Prazos' },
    { value: 'aula' as const, label: 'Aulas' },
  ];

  const listed = mode === 'proximas' ? filtered : dayItems;

  return (
    <ScreenShell chrome={chrome} simulated={model.delta.simulated}>
      <div className="px-5 pb-[62px]" style={{ backgroundImage: HEADER_BG, paddingTop: chrome ? IOS.safeTop : 18 }}>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => onScreen('inicio')} aria-label="Voltar ao início" className="-ml-2 flex h-10 w-10 items-center justify-center" style={{ color: SCREEN.ink }}><ChevronLeft className="h-7 w-7" /></button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[27px] leading-none font-bold" style={{ color: SCREEN.ink }}>Minhas datas</h1>
            <p className="mt-2 truncate text-[17px] leading-none capitalize" style={{ color: 'rgba(255,255,255,0.86)' }}>
              {mode === 'mes' ? monthLabel(cursor) : 'O que vem pela frente'}
            </p>
          </div>
          <button type="button" onClick={() => onScreen('completo')} aria-label="Abrir calendário completo" className="flex h-11 w-11 items-center justify-center rounded-full" style={{ color: SCREEN.ink }}><CalendarRange className="h-7 w-7" /></button>
        </div>
      </div>

      <div className="space-y-4 px-4" style={{ marginTop: -43 }}>
        {/* A próxima data é a pergunta do modo «Próximas». No modo «Mês» a
            pergunta é outra — «e no dia 23?» — e repetir o card aqui roubaria a
            primeira dobra da grade, que é o instrumento daquela tela. */}
        {mode === 'proximas' && next && (
          <div className="rounded-[22px] border p-5" style={{ background: 'linear-gradient(135deg, #202123 0%, #151617 100%)', borderColor: SCREEN.line, boxShadow: '0 16px 34px rgba(0,0,0,0.32)' }}>
            <div className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-5 w-5 shrink-0" style={{ color: SCREEN.ink2 }} /><div className="min-w-0"><p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: SCREEN.ink2 }}>Próxima data</p><p className="mt-1 text-[18px] font-semibold" style={{ color: SCREEN.ink }}>{capitalize(datePhrase(next))}</p></div></div>
            <div className="mt-4 inline-flex rounded-[10px] bg-[#087fea] px-4 py-2 text-[12px] font-semibold uppercase text-white">{nextBadge(next)}</div>
            <p className="mt-3 text-[19px] leading-tight font-semibold" style={{ color: SCREEN.ink }}>{next.title}</p>
            {next.lines.slice(0, 2).map((line) => <p key={line} className="mt-1.5 text-[13px] leading-snug" style={{ color: SCREEN.ink2 }}>{line}</p>)}
            <div className="mt-4 flex items-center justify-between border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>
              <span className="flex items-center gap-2 text-[14px]" style={{ color: SCREEN.ink }}><CalendarDays className="h-[18px] w-[18px]" />{countdownPhrase(next.inDays)}</span>
              <button type="button" onClick={() => onOpenItem(next)} className="flex items-center gap-1 text-[14px] font-medium" style={{ color: SCREEN.link }}>Ver detalhes<ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        {model.resolution.match === 'nenhuma' && (
          <div className="rounded-[15px] p-4" style={{ backgroundColor: SCREEN.card }}>
            <p className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: SCREEN.warn }}>
              <TriangleAlert className="h-[17px] w-[17px]" />
              Ainda não há calendário do seu curso
            </p>
            <p className="mt-2 text-[12px] leading-snug" style={{ color: SCREEN.ink2 }}>
              {model.resolution.note}
            </p>
            <p className="mt-2 text-[12px] leading-snug" style={{ color: SCREEN.ink2 }}>
              Fale com a coordenação do curso para receber as datas do seu semestre.
            </p>
          </div>
        )}

        {model.resolution.match === 'outra-coorte' && (
          <div
            className="rounded-[15px] p-3.5"
            style={{ backgroundColor: 'rgba(245,180,89,0.12)' }}
          >
            <p className="text-[13px] font-semibold" style={{ color: SCREEN.warn }}>
              Este é o calendário publicado para a outra coorte do seu curso
            </p>
            <p className="mt-1.5 text-[12px] leading-snug" style={{ color: SCREEN.ink2 }}>
              {model.resolution.note}
            </p>
          </div>
        )}

        {model.delta.band === 'antecipada' && model.resolution.calendar && !next && (
          <div className="rounded-[15px] p-4" style={{ backgroundColor: SCREEN.card }}>
            <p className="text-[15px] font-semibold" style={{ color: SCREEN.ink }}>
              Suas datas ficam disponíveis mais perto do início
            </p>
            <p className="mt-2 text-[12px] leading-snug" style={{ color: SCREEN.ink2 }}>
              Suas aulas começam em {longDay(model.delta.classesStart)}. O calendário do seu
              semestre é publicado perto dessa data. Mostrar agora as datas de outro semestre
              seria pior que não mostrar nada. Enquanto isso, a trilha de entrada já tem o que
              você pode resolver hoje.
            </p>
            <button
              type="button"
              onClick={() => onScreen('trilha')}
              className="mt-3 flex items-center gap-1 text-[13px]"
              style={{ color: SCREEN.link }}
            >
              Ir para «Comece por aqui»
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {personal.length > 0 && <>
          <div className="flex rounded-[22px] border p-1" style={{ backgroundColor: SCREEN.card, borderColor: 'rgba(255,255,255,0.16)' }}>
            {([{ value: 'proximas' as const, label: 'Próximas' }, { value: 'mes' as const, label: 'Mês' }]).map((option) => <button key={option.value} type="button" onClick={() => setMode(option.value)} aria-pressed={mode === option.value} className="flex-1 rounded-[18px] py-2.5 text-[14px] font-semibold" style={{ color: SCREEN.ink, background: mode === option.value ? 'linear-gradient(90deg,#087fea,#0670d5)' : 'transparent' }}>{option.label}</button>)}
          </div>

          {mode === 'proximas' ? (
            <div className="grid grid-cols-4 gap-2">
              {filters.map((option) => <button key={option.value} type="button" onClick={() => setFilter(option.value)} aria-pressed={filter === option.value} className="rounded-full border py-2 text-[12px]" style={{ color: SCREEN.ink, borderColor: filter === option.value ? '#087fea' : 'rgba(255,255,255,0.14)', backgroundColor: filter === option.value ? 'rgba(8,127,234,0.32)' : SCREEN.card }}>{option.label}</button>)}
            </div>
          ) : (
            <MonthGrid
              year={cursor.year}
              month={cursor.month}
              items={monthItems}
              today={model.today}
              selected={selectedDay}
              onSelect={setSelectedDay}
              onMonth={goMonth}
              canGoBack={canGoBack}
              canGoForward={canGoForward}
            />
          )}

          <section className="min-w-0 overflow-hidden pt-2">
            <h2 className="text-[20px] font-bold" style={{ color: SCREEN.ink }}>
              {mode === 'proximas'
                ? expanded ? 'Suas datas do semestre' : 'Este mês e o próximo'
                : selectedDay
                  ? capitalize(`${weekdayOf(selectedDay)}, ${longDay(selectedDay)}`)
                  : 'Datas do mês'}
            </h2>

            {listed.length === 0 ? (
              <p className="mt-4 text-[13px]" style={{ color: SCREEN.ink2 }}>
                {mode === 'proximas'
                  ? 'Nenhuma data nesta categoria.'
                  : selectedDay
                    ? 'Nada marcado neste dia.'
                    : 'Nenhuma data neste mês.'}
              </p>
            ) : (
              <TimelineList items={listed} onOpen={onOpenItem} />
            )}
            {mode === 'proximas' && personal.some((item) => !inTwoMonths(item, model.today)) && <MoreDates expanded={expanded} onToggle={() => setExpanded(!expanded)} count={personal.length} />}

            {mode === 'mes' && (
              <p className="mt-4 text-[12px]" style={{ color: SCREEN.ink2 }}>
                <span className="capitalize">
                  {monthItems.length === 1 ? '1 data em' : `${monthItems.length} datas em`}{' '}
                  {MONTH_NAMES[cursor.month - 1]}
                </span>
                {selectedDay && (
                  <button
                    type="button"
                    onClick={() => setSelectedDay(null)}
                    className="ml-2"
                    style={{ color: SCREEN.link }}
                  >
                    Ver o mês inteiro
                  </button>
                )}
              </p>
            )}
          </section>
        </>}

        {/* ---- O CONTADOR. O mecanismo de honestidade. ------------------
            Dois números, sempre visíveis, na mesma tela. Um aluno que leu «20
            de 50» e não abriu o resto fez uma escolha informada; um aluno que
            viu 20 sem saber que havia 50 foi induzido. É essa diferença que
            separa priorizar de omitir, e é por isso que esta caixa não é um
            item de menu nem um rodapé apagado. */}
        {model.totalCount > 0 && (
          <button
            type="button"
            onClick={() => onScreen('completo')}
            className="w-full border-t px-1 py-4 text-left"
            style={{ borderColor: SCREEN.line }}
          >
            <p className="text-[14px] leading-snug" style={{ color: SCREEN.ink }}>
              Nesta lista: <strong>{listed.length}</strong> das{' '}
              <strong>{model.totalCount}</strong> datas do calendário do seu curso.
            </p>
            <span className="mt-2.5 flex items-center gap-1 text-[13px]" style={{ color: SCREEN.link }}>
              Ver o calendário completo
              <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        )}
      </div>
    </ScreenShell>
  );
}

/* ==========================================================================
   Detalhe de uma data
   --------------------------------------------------------------------------
   A tela que o «Ver detalhes» abre, e o lugar onde a regra de P1 e P2 fica
   visível em vez de implícita.

   O QUE MUDA QUANDO A LINHA É UM PERÍODO

   Um evento datado — «Prova Substitutiva da P1, 17/10» — tem dia, e tudo o que
   a tela oferece é legítimo: lembrete, adicionar ao calendário, compartilhar.

   Um PERÍODO de avaliações não tem. «28/09 a 03/10» é a janela em que o curso
   inteiro aplica a P1; o dia da prova de cada disciplina é marcado pelo
   professor em aula e não existe como dado aqui. Então esta tela:

     · nomeia o tipo como «Período de avaliações», não como uma prova;
     · devolve a pergunta ao professor, em voz alta, no corpo do card;
     · oferece lembrete só para o INÍCIO e o ENCERRAMENTO do período, e diz
       explicitamente que não dá para lembrar de uma prova individual;
     · não oferece adicionar ao calendário um dia que ninguém escolheu.

   A mesma trava vale para a linha que imprime dois dias sem dizer a turma: o
   aparelho não escolhe um deles. Escolher errado a data de uma prova é o pior
   erro que este produto pode cometer, e é um erro que só se comete por
   conveniência de interface.
   ========================================================================== */

/** O tipo que o cabeçalho do detalhe anuncia. */
function typeLabelOf(item: TimelineItem): string {
  if (/^Período de avaliações/.test(item.title)) return 'Período de avaliações';
  return CATEGORY_LABEL[item.category] ?? 'Data do calendário';
}

/** Uma ação do detalhe. Linha inteira, alvo grande, um ícone à esquerda. */
function DetailAction({
  icon,
  label,
  detail,
  onClick,
  open,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  detail?: string;
  onClick: () => void;
  open?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={open}
      className="flex w-full items-center gap-3 rounded-[15px] px-4 py-3.5 text-left disabled:opacity-45"
      style={{ backgroundColor: SCREEN.card }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: SCREEN.ink }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold" style={{ color: SCREEN.ink }}>{label}</span>
        {detail && <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: SCREEN.ink2 }}>{detail}</span>}
      </span>
      {!disabled && (
        <ChevronRight
          className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          style={{ color: SCREEN.ink3 }}
        />
      )}
    </button>
  );
}

/** O painel que uma ação abre, dentro da própria tela. Nada sai da aba. */
function DetailPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[14px] p-3.5 text-[12px] leading-relaxed" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: SCREEN.ink2 }}>
      {children}
    </div>
  );
}

function EventDetailScreen({
  model,
  item,
  onScreen,
  chrome,
  origin = 'datas',
}: {
  model: TrilhaModel;
  item: TimelineItem;
  onScreen: (s: PhoneScreen) => void;
  chrome: boolean;
  origin?: 'datas' | 'completo' | 'modalidade';
}) {
  type Panel = 'lembrete' | 'agenda' | 'oficial' | 'compartilhar';
  const [panel, setPanel] = useState<Panel | null>(null);
  const toggle = (key: Panel) => setPanel((current) => (current === key ? null : key));

  const period = /^Período de avaliações/.test(item.title);
  const typeLabel = typeLabelOf(item);

  /* «Adicionar ao calendário» precisa de um compromisso com dia. Um período de
     seis dias e uma linha de dois dias sem turma não são isso — e a ação some
     com o motivo escrito, em vez de ficar cinza sem explicação. */
  const singleDate = !period && !item.ambiguousDay;

  return (
    <ScreenShell chrome={chrome} simulated={model.delta.simulated}>
      <div className="px-5 pb-6" style={{ backgroundImage: HEADER_BG, paddingTop: chrome ? IOS.safeTop : 18 }}>
        <button
          type="button"
          onClick={() => onScreen(origin)}
          className="-ml-1.5 mb-3 flex items-center gap-1 text-[15px]"
          style={{ color: SCREEN.ink }}
        >
          <ChevronLeft className="h-[18px] w-[18px]" />
          {origin === 'completo' ? 'Calendário completo' : origin === 'modalidade' ? 'Sua modalidade' : 'Minhas datas'}
        </button>
        <p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: 'rgba(255,255,255,0.72)' }}>
          {typeLabel}
        </p>
        <h1 className="mt-1.5 text-[25px] leading-[1.15] font-semibold" style={{ color: SCREEN.ink }}>
          {item.title}
        </h1>
        <p className="mt-2 text-[15px] capitalize" style={{ color: 'rgba(255,255,255,0.86)' }}>
          {datePhrase(item)}
        </p>
      </div>

      <div className="space-y-3 px-4 pt-4">
        <div className="rounded-[18px] p-4" style={{ backgroundColor: SCREEN.card }}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]" style={{ backgroundColor: 'rgba(22,137,244,0.16)', color: SCREEN.link }}>
              <CategoryIcon item={item} className="h-[19px] w-[19px]" />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold capitalize" style={{ color: SCREEN.ink }}>
                {datePhrase(item)}
              </p>
              <p className="text-[12px]" style={{ color: SCREEN.ink2 }}>
                {countdownPhrase(item.inDays)} · {CONSEQUENCE_LABEL[item.consequence]}
              </p>
            </div>
          </div>

          {item.lines.length > 0 && (
            <div className="mt-3.5 space-y-2 border-t pt-3.5" style={{ borderColor: SCREEN.line }}>
              {item.lines.map((line) => (
                <p key={line} className="text-[13px] leading-snug" style={{ color: SCREEN.ink2 }}>
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* A regra escrita onde ela é lida, e não só onde ela é aplicada. */}
        {period && (
          <div className="rounded-[15px] p-4" style={{ backgroundColor: 'rgba(245,180,89,0.12)' }}>
            <p className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: SCREEN.warn }}>
              <TriangleAlert className="h-[16px] w-[16px] shrink-0" />
              A data da sua prova não está aqui
            </p>
            <p className="mt-2 text-[12px] leading-snug" style={{ color: SCREEN.ink2 }}>
              O calendário publica o período em que as avaliações acontecem, para o curso
              inteiro. O dia da prova de cada disciplina é marcado pelo professor durante a aula
              e não está no sistema. Por isso esta tela não mostra um dia, uma sala nem um
              horário para uma disciplina.
            </p>
          </div>
        )}

        {item.ambiguousDay && (
          <div className="rounded-[15px] p-4" style={{ backgroundColor: 'rgba(245,180,89,0.12)' }}>
            <p className="text-[13px] font-semibold" style={{ color: SCREEN.warn }}>
              São dois dias, um por turma
            </p>
            <p className="mt-1.5 text-[12px] leading-snug" style={{ color: SCREEN.ink2 }}>
              O sistema não tem a sua turma, então não escolhe por você. Confirme com a
              coordenação qual dos dois é o seu dia.
            </p>
          </div>
        )}

        {item.officialNote && (
          <div className="rounded-[15px] p-4" style={{ backgroundColor: SCREEN.card }}>
            <p className="text-[13px] font-semibold" style={{ color: SCREEN.warn }}>
              Divergência no documento oficial
            </p>
            <p className="mt-1.5 text-[12px] leading-snug" style={{ color: SCREEN.ink2 }}>
              {item.officialNote}
            </p>
          </div>
        )}

        <div className="space-y-2 pt-1">
          <DetailAction
            icon={<BellRing className="h-[17px] w-[17px]" />}
            label="Criar lembrete"
            detail={period ? 'Para a abertura e o encerramento do período' : undefined}
            onClick={() => toggle('lembrete')}
            open={panel === 'lembrete'}
          />
          {panel === 'lembrete' && (
            <DetailPanel>
              {period ? (
                <>
                  <p style={{ color: SCREEN.ink }}>O lembrete pode marcar:</p>
                  <ul className="mt-2 space-y-1">
                    <li>· Abertura do período: {shortDayOf(item.start)}</li>
                    <li>· Encerramento do período: {shortDayOf(item.end)}</li>
                  </ul>
                  <p className="mt-2.5">
                    Não é possível criar um lembrete para a prova de uma disciplina: essa data
                    não existe no sistema. Quando o professor informar o dia, anote por aqui
                    mesmo.
                  </p>
                </>
              ) : (
                <>
                  <p style={{ color: SCREEN.ink }}>O lembrete pode marcar:</p>
                  <ul className="mt-2 space-y-1">
                    <li>· Um dia antes: {shortDayOf(shiftDays(item.start, -1))}</li>
                    <li>· No dia: {shortDayOf(item.start)}</li>
                  </ul>
                </>
              )}
            </DetailPanel>
          )}

          {singleDate ? (
            <>
              <DetailAction
                icon={<CalendarDays className="h-[17px] w-[17px]" />}
                label="Adicionar ao calendário"
                detail={capitalize(datePhrase(item))}
                onClick={() => toggle('agenda')}
                open={panel === 'agenda'}
              />
              {panel === 'agenda' && (
                <DetailPanel>
                  <p style={{ color: SCREEN.ink }}>{item.title}</p>
                  <p className="mt-1 capitalize">{datePhrase(item)}</p>
                  <p className="mt-2">
                    O evento entra na agenda do seu celular com a citação do calendário oficial
                    na descrição, para que ele continue rastreável fora do aplicativo.
                  </p>
                </DetailPanel>
              )}
            </>
          ) : (
            <div className="rounded-[15px] px-4 py-3.5" style={{ backgroundColor: SCREEN.card }}>
              <p className="text-[14px] font-semibold" style={{ color: SCREEN.ink3 }}>
                Adicionar ao calendário
              </p>
              <p className="mt-1 text-[11px] leading-snug" style={{ color: SCREEN.ink3 }}>
                {period
                  ? 'Disponível quando houver uma data, e não um período de seis dias.'
                  : 'Disponível quando o seu dia estiver confirmado.'}
              </p>
            </div>
          )}

          <DetailAction
            icon={<ScrollText className="h-[17px] w-[17px]" />}
            label="Ver texto e fonte oficial"
            detail={item.sourceName}
            onClick={() => toggle('oficial')}
            open={panel === 'oficial'}
          />
          {panel === 'oficial' && (
            <DetailPanel>
              <p>
                <span style={{ color: SCREEN.ink3 }}>No calendário oficial: </span>
                <span style={{ color: SCREEN.ink }}>«{item.officialTitle}»</span>
              </p>
              <p className="mt-1.5" style={{ color: SCREEN.ink3 }}>
                Impresso como «{item.dateLabel}».
              </p>
              {item.officialDetail && <p className="mt-2">{item.officialDetail}</p>}
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-[12px]"
                style={{ color: SCREEN.link }}
              >
                Abrir o PDF oficial
              </a>
            </DetailPanel>
          )}

          <DetailAction
            icon={<Share2 className="h-[17px] w-[17px]" />}
            label="Compartilhar"
            onClick={() => toggle('compartilhar')}
            open={panel === 'compartilhar'}
          />
          {panel === 'compartilhar' && (
            <DetailPanel>
              {/* O compartilhado leva a citação junto. Um print de card solto
                  num grupo de turma vira boato; com a linha oficial embaixo,
                  vira consulta. */}
              <p style={{ color: SCREEN.ink }}>{item.title}</p>
              <p className="mt-1 capitalize">{datePhrase(item)}</p>
              {item.lines[0] && <p className="mt-1">{item.lines[0]}</p>}
              <p className="mt-2" style={{ color: SCREEN.ink3 }}>
                Fonte: {item.sourceName} · «{item.officialTitle}»
              </p>
            </DetailPanel>
          )}

          <DetailAction
            icon={<Headphones className="h-[17px] w-[17px]" />}
            label="Preciso de ajuda"
            detail="Abre o atendimento com esta data no assunto"
            onClick={() => onScreen('atendimento')}
          />
        </div>

        <button
          type="button"
          onClick={() => onScreen('completo')}
          className="flex w-full items-center gap-1 px-1 pt-2 text-[13px]"
          style={{ color: SCREEN.link }}
        >
          Ver o calendário completo
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </ScreenShell>
  );
}

/* ==========================================================================
   Comece por aqui
   ========================================================================== */

function StepIcon({ step, className = 'h-6 w-6' }: { step: TrilhaStep; className?: string }) {
  if (step.place === 'ava' || step.place === 'portal') return <BookOpen className={className} />;
  if (step.place === 'app') return <ClipboardList className={className} />;
  if (step.place === 'campus') return <GraduationCap className={className} />;
  if (step.place === 'financeiro') return <Banknote className={className} />;
  return <FileText className={className} />;
}

/**
 * O estado de um passo, nas três cores que a especificação nomeia.
 *
 * Verde é conclusão e só conclusão; azul é o passo em andamento, que é o único
 * com ação; cinza é o que ainda não chegou. Três estados, três cores, e nenhum
 * quarto tom inventado para caber um caso — um passo que não é nenhum dos três
 * seria um passo que a tela não sabe explicar.
 */
type StepState = 'done' | 'current' | 'next';

function stepStateOf(step: TrilhaStep, currentId: string | undefined): StepState {
  if (step.done) return 'done';
  return step.id === currentId ? 'current' : 'next';
}

const STEP_TONE: Record<StepState, { dot: string; ring: string; label: string }> = {
  done: { dot: SCREEN.vital, ring: SCREEN.vital, label: 'Concluído' },
  current: { dot: '#1689f4', ring: '#07569f', label: 'Em andamento' },
  next: { dot: '#161718', ring: '#8d9299', label: 'Próximo' },
};

function StepBullet({ state }: { state: StepState }) {
  const tone = STEP_TONE[state];
  return (
    <span
      className="relative z-10 flex h-[25px] w-[25px] items-center justify-center justify-self-center rounded-full border-[4px] text-[12px] font-semibold"
      style={{ backgroundColor: tone.dot, borderColor: tone.ring, color: state === 'done' ? '#ffffff' : SCREEN.ink }}
    >
      {state === 'done' ? (
        <Check className="h-[14px] w-[14px]" strokeWidth={3} />
      ) : state === 'current' ? (
        <span className="h-2 w-2 rounded-full bg-white" />
      ) : null}
    </span>
  );
}

function StepRow({
  step,
  state,
  onOpen,
}: {
  step: TrilhaStep;
  state: StepState;
  onOpen: (step: TrilhaStep) => void;
}) {
  return (
    <div className="relative grid grid-cols-[42px_1fr] items-center gap-3">
      <StepBullet state={state} />
      <button
        type="button"
        onClick={() => onOpen(step)}
        className="relative flex min-w-0 items-center gap-3 rounded-[16px] border px-4 py-3 text-left before:absolute before:top-1/2 before:-left-2 before:h-4 before:w-4 before:-translate-y-1/2 before:rotate-45 before:border-b before:border-l"
        style={{ background: 'linear-gradient(135deg,#202123,#171819)', borderColor: SCREEN.line }}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center" style={{ color: SCREEN.ink }}>
          <StepIcon step={step} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] leading-snug font-semibold" style={{ color: SCREEN.ink }}>
            {step.title}
          </span>
          <span className="mt-0.5 block text-[12px]" style={{ color: state === 'next' ? SCREEN.ink3 : SCREEN.ink2 }}>
            {STEP_TONE[state].label}
            {step.blocking && !step.done ? ' · trava o primeiro dia' : ''}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0" style={{ color: SCREEN.ink3 }} />
      </button>
    </div>
  );
}

/** O rótulo do botão principal, que muda com o passo. */
function primaryActionLabel(step: TrilhaStep): string {
  if (step.place === 'ava') return 'Abrir AVA';
  if (step.place === 'portal') return 'Abrir Portal';
  if (step.place === 'financeiro') return 'Ver cobranças';
  if (step.id === 'horarios') return 'Ver horários';
  if (step.place === 'app') return 'Abrir no aplicativo';
  return 'Ver como fazer';
}

/** Para onde o botão principal leva, quando há destino dentro do aparelho. */
function primaryActionScreen(step: TrilhaStep): PhoneScreen | null {
  if (step.id === 'horarios') return 'horarios';
  if (step.place === 'financeiro') return 'cobrancas';
  return null;
}

function TrailScreen({
  model,
  onScreen,
  onOpenStep,
  chrome,
}: {
  model: TrilhaModel;
  onScreen: (s: PhoneScreen) => void;
  onOpenStep: (step: TrilhaStep) => void;
  chrome: boolean;
}) {
  const progress = stepProgress(model.steps);
  const pct = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100);
  const complete = progress.done === progress.total && progress.total > 0;
  const nextStep = model.steps.find((step) => !step.done);

  return (
    <ScreenShell chrome={chrome} simulated={model.delta.simulated}>
      <div className="px-5 pb-[62px]" style={{ backgroundImage: HEADER_BG, paddingTop: chrome ? IOS.safeTop : 18 }}>
        <div className="flex items-center gap-4"><button type="button" onClick={() => onScreen('inicio')} aria-label="Voltar ao início" className="-ml-2 flex h-10 w-10 items-center justify-center" style={{ color: SCREEN.ink }}><ChevronLeft className="h-7 w-7" /></button><div className="min-w-0 flex-1"><h1 className="text-[26px] leading-none font-bold" style={{ color: SCREEN.ink }}>Comece por aqui</h1><p className="mt-2 text-[16px] leading-none" style={{ color: 'rgba(255,255,255,0.86)' }}>Sua jornada na UniAnchieta</p></div><span className="flex h-12 w-12 items-center justify-center rounded-full border-2" style={{ color: SCREEN.vital, borderColor: 'rgba(255,255,255,0.8)' }}><Rocket className="h-6 w-6" /></span></div>
      </div>

      <div className="px-4" style={{ marginTop: -43 }}>
        <button type="button" onClick={() => onScreen('modalidade')}
          className="mb-4 flex min-h-11 w-full items-center gap-3 rounded-[20px] p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ backgroundColor: SCREEN.cardHi, color: SCREEN.ink }}>
          <GraduationCap className="h-6 w-6 shrink-0" style={{ color: SCREEN.link }} />
          <span className="flex-1"><span className="block text-[16px] font-semibold leading-snug">Entenda como funciona sua modalidade</span><span className="mt-1 block text-[12px]" style={{ color: SCREEN.ink2 }}>Seu formato, suas disciplinas e seus encontros</span></span>
          <ChevronRight className="h-5 w-5 shrink-0" />
        </button>
        <div className="rounded-[22px] border p-5" style={{ background: 'linear-gradient(135deg,#202123,#161718)', borderColor: SCREEN.line, boxShadow: '0 16px 34px rgba(0,0,0,0.3)' }}>
          <div className="flex items-baseline justify-between">
            <span className="text-[18px] font-semibold" style={{ color: SCREEN.ink }}>
              {progress.done} de {progress.total} passos concluídos
            </span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-[7px] flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}><motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg,#087fea 0%,#087fea 68%,#2ed17d 100%)' }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: emphasis }} /></div><span className="text-[16px]" style={{ color: SCREEN.ink }}>{pct}%</span>
          </div>
          <p className="mt-3 text-[13px]" style={{ color: SCREEN.ink2 }}>{complete ? 'Sua trilha de entrada está concluída' : progress.done > 0 ? 'Você está avançando bem' : 'Vamos preparar seu primeiro acesso'}</p>
        </div>

        {/* ---- A despedida ------------------------------------------------
            Institucional e curta. Sem confete, sem medalha, sem placar: a
            trilha termina do jeito que um processo institucional termina, e a
            tela diz para onde o aluno vai agora e onde a trilha continua
            achável — some sem aviso é o que parece defeito. */}
        {complete ? (
          <section className="mt-4">
            <div className="rounded-[20px] border p-5" style={{ background: 'linear-gradient(135deg,#202123,#171819)', borderColor: 'rgba(50,213,131,0.35)' }}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(50,213,131,0.14)', color: SCREEN.vital }}>
                <Check className="h-6 w-6" strokeWidth={3} />
              </span>
              <p className="mt-4 text-[20px] leading-tight font-semibold" style={{ color: SCREEN.ink }}>
                Você concluiu a trilha de entrada
              </p>
              <p className="mt-2 text-[13px] leading-snug" style={{ color: SCREEN.ink2 }}>
                Os {progress.total} passos estão cumpridos. A partir de agora você já consegue:
              </p>
              <ul className="mt-3 space-y-2">
                {[
                  'Entrar no portal e no AVA com o seu RA',
                  'Ver horários, notas e faltas pelo aplicativo',
                  'Acompanhar as datas do seu curso em «Minhas datas»',
                  'Conferir cobranças e o dia do vencimento',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-[13px] leading-snug" style={{ color: SCREEN.ink }}>
                    <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: SCREEN.vital }} strokeWidth={3} />
                    {line}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => onScreen('datas')}
                className="mt-5 w-full rounded-[13px] bg-[#087fea] py-3 text-[16px] font-semibold text-white"
              >
                Ver minhas datas
              </button>
              <button
                type="button"
                onClick={() => onScreen('inicio')}
                className="mt-2 w-full rounded-[13px] border py-3 text-[15px] font-semibold"
                style={{ borderColor: 'rgba(255,255,255,0.18)', color: SCREEN.ink }}
              >
                Ir para o início
              </button>
              <button
                type="button"
                onClick={() => onScreen('passos')}
                className="mt-3 flex w-full items-center justify-center gap-1 text-[13px]"
                style={{ color: SCREEN.link }}
              >
                Rever minha trilha
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-4 text-center text-[12px] leading-snug" style={{ color: SCREEN.ink2 }}>
              O atalho «Comece por aqui» sai da tela inicial a partir de agora. A trilha continua
              no menu «Mais», sempre que você quiser revisar um passo.
            </p>
          </section>
        ) : (
          <>
            {nextStep && (
              <section className="mt-5">
                <h2 className="text-[20px] font-bold" style={{ color: SCREEN.ink }}>Próximo passo</h2>
                <div className="mt-3 rounded-[20px] border p-4" style={{ background: 'linear-gradient(135deg,#202123,#171819)', borderColor: 'rgba(255,255,255,0.14)' }}>
                  <span className="inline-flex rounded-[10px] bg-[#087fea] px-4 py-2 text-[11px] font-semibold uppercase text-white">
                    Passo {model.steps.indexOf(nextStep) + 1} de {progress.total}
                  </span>
                  <div className="mt-4 flex items-start gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center" style={{ color: SCREEN.ink }}>
                      <StepIcon step={nextStep} className="h-10 w-10" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[18px] leading-snug font-semibold" style={{ color: SCREEN.ink }}>{nextStep.title}</p>
                      <p className="mt-1 text-[13px] leading-snug" style={{ color: SCREEN.ink2 }}>{nextStep.action}</p>
                      <p className="mt-2 flex items-center gap-1.5 text-[12px]" style={{ color: SCREEN.ink2 }}>
                        <Clock3 className="h-4 w-4" />
                        {PLACE_LABEL[nextStep.place]}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const destination = primaryActionScreen(nextStep);
                      if (destination) onScreen(destination);
                      else onOpenStep(nextStep);
                    }}
                    className="mt-4 w-full rounded-[13px] bg-[#087fea] py-3 text-[16px] font-semibold text-white"
                  >
                    {primaryActionLabel(nextStep)}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenStep(nextStep)}
                    className="mt-2 flex w-full items-center justify-center gap-1 text-[13px]"
                    style={{ color: SCREEN.link }}
                  >
                    Como fazer
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </section>
            )}

            {/* ---- A prévia da jornada ---------------------------------
                Três passos, não doze. A pergunta desta tela é «qual é o meu
                próximo passo», e uma lista inteira de cards grandes empurra a
                resposta para fora da primeira dobra — que é o único lugar onde
                ela serve. A trilha completa fica a um toque, com nome. */}
            <section className="mt-5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[20px] font-bold" style={{ color: SCREEN.ink }}>Sua jornada</h2>
                <span className="text-[12px]" style={{ color: SCREEN.ink2 }}>
                  {progress.done}/{progress.total}
                </span>
              </div>
              <div className="relative mt-4 space-y-2.5 before:absolute before:top-4 before:bottom-4 before:left-[21px] before:w-[3px] before:bg-white/20">
                {model.steps
                  .slice(
                    Math.max(0, model.steps.indexOf(nextStep ?? model.steps[0]) - 1),
                    Math.max(0, model.steps.indexOf(nextStep ?? model.steps[0]) - 1) + 3,
                  )
                  .map((step) => (
                    <StepRow
                      key={step.id}
                      step={step}
                      state={stepStateOf(step, nextStep?.id)}
                      onOpen={onOpenStep}
                    />
                  ))}
              </div>
              <button
                type="button"
                onClick={() => onScreen('passos')}
                className="mt-4 flex w-full items-center justify-center gap-1 rounded-[14px] border py-3 text-[14px] font-semibold"
                style={{ borderColor: 'rgba(255,255,255,0.18)', color: SCREEN.ink }}
              >
                Ver todos os {progress.total} passos
                <ChevronRight className="h-4 w-4" />
              </button>
            </section>
          </>
        )}

        <p className="mt-5 text-center text-[12px]" style={{ color: SCREEN.ink2 }}>Seu progresso é salvo automaticamente.</p>
      </div>
    </ScreenShell>
  );
}

/* ==========================================================================
   A trilha inteira — grupos recolhíveis
   --------------------------------------------------------------------------
   Doze cards grandes abertos ao mesmo tempo não são uma trilha, são um muro.
   O agrupamento é por LUGAR, que é a única divisão que o dado já carrega e
   também a que o aluno usa para se organizar: resolver as três coisas do portal
   numa sentada é mais barato que pular de aba a cada passo.

   O grupo do passo atual abre sozinho. Os outros ficam fechados, com a contagem
   à direita, para que a tela responda «quanto falta» sem precisar rolar.
   ========================================================================== */

/* ==========================================================================
   Entenda sua modalidade
   --------------------------------------------------------------------------
   Duas telas, porque são duas perguntas. O híbrido pergunta «quando eu vou ao
   campus», e a resposta é uma lista curta de encontros datados que cabe dentro
   de dois ou três cards abertos. O presencial pergunta «como o meu semestre é
   avaliado», porque ir ao campus é a rotina dele e o calendário não imprime uma
   linha por disciplina: imprime a JANELA em que o curso inteiro faz P1 e P2.

   Mandar as duas pela mesma tela era o que estava acontecendo, e custava caro
   no presencial: seis acordeões de 96 pontos de altura, cada um abrindo para
   «confira as datas no calendário acadêmico» — um chevron que promete um
   destino que não existe. Aqui a lista do presencial encolhe para uma linha por
   disciplina, sem seta, e as duas janelas de avaliação fecham a tela.
   ========================================================================== */

function ModalityScreen(props: {
  model: TrilhaModel; onScreen: (screen: PhoneScreen) => void;
  onOpenItem: (item: TimelineItem) => void; chrome: boolean;
}) {
  return props.model.student.modality === 'Presencial'
    ? <CampusModalityScreen model={props.model} onScreen={props.onScreen} chrome={props.chrome} />
    : <HybridModalityScreen {...props} />;
}

/* -- Presencial ------------------------------------------------------------
   O PDF do presencial não nomeia disciplina em lugar nenhum. Tudo o que esta
   tela afirma sobre a grade sai do cadastro do aluno, e tudo o que ela afirma
   sobre data sai das duas linhas de período do calendário — nenhuma das duas
   coisas é composta com a outra, que é exatamente a tentação a evitar aqui. */

function CampusModalityScreen({ model, onScreen, chrome }: {
  model: TrilhaModel; onScreen: (screen: PhoneScreen) => void; chrome: boolean;
}) {
  const { student, resolution } = model;
  const disciplines = student.academic.disciplines;
  const exempted = disciplines.filter((discipline) => discipline.exempted);
  const inCourse = disciplines.length - exempted.length;

  /* As duas janelas institucionais, na ordem do semestre. `assessmentPeriodOf`
     é a mesma função que impede o motor de escolher um dia dentro do intervalo,
     e usá-la aqui garante que a tela e o card de detalhe digam a mesma coisa. */
  const periods = (['P1', 'P2'] as const)
    .map((key) => ({
      key,
      item: model.items.find((item) => {
        const event = resolution.calendar?.events.find((candidate) => candidate.id === item.eventId);
        return event ? assessmentPeriodOf(event) === key : false;
      }),
    }))
    .filter((row): row is { key: 'P1' | 'P2'; item: TimelineItem } => Boolean(row.item));

  return <ScreenShell chrome={chrome} simulated={model.delta.simulated}>
    <InnerHeader title="Entenda sua modalidade" subtitle={`${student.course} · ${student.cohort === 'Calouro' ? 'Ingressante' : 'Veterano'}`} onBack={() => onScreen('trilha')} backLabel="Comece por aqui" chrome={chrome} />
    <div className="space-y-7 px-5 py-5" style={{ color: SCREEN.ink }}>
      <section aria-label="Como você vai estudar" className="space-y-5">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]" style={{ backgroundColor: 'rgba(50,213,131,0.14)', color: SCREEN.vital }}><GraduationCap className="h-6 w-6" /></span>
          <div><h2 className="text-[19px] font-semibold">Suas aulas são no campus</h2><p className="mt-1 text-[15px] leading-snug" style={{ color: '#bfc5ce' }}>Nos dias e horários da sua grade do turno {student.shift.toLowerCase()}.</p></div>
        </div>
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]" style={{ backgroundColor: 'rgba(74,158,255,0.16)', color: SCREEN.link }}><MonitorPlay className="h-6 w-6" /></span>
          <div><h2 className="text-[19px] font-semibold">O AVA completa a carga</h2><p className="mt-1 text-[15px] leading-snug" style={{ color: '#bfc5ce' }}>Materiais, atividades on-line e a parte a distância das disciplinas presenciais.</p></div>
        </div>
        <a href="https://ava.anchieta.br/" target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-[#087fea] px-4 py-3 text-[16px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2">
          Acessar o AVA <ExternalLink className="h-4 w-4" /><span className="sr-only"> (abre em nova aba)</span>
        </a>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[22px] font-semibold">Suas disciplinas</h2>
          <span className="text-[13px]" style={{ color: '#bfc5ce' }}>{inCourse} em curso{exempted.length > 0 ? ` · ${exempted.length} dispensada${exempted.length > 1 ? 's' : ''}` : ''}</span>
        </div>

        {disciplines.length === 0 ? (
          <p className="mt-4 text-[15px] leading-snug" style={{ color: '#bfc5ce' }}>Consulte suas disciplinas no Portal do Aluno.</p>
        ) : (
          <div className="mt-3.5 overflow-hidden rounded-[16px]" style={{ backgroundColor: SCREEN.card }}>
            {disciplines.map((discipline, index) => {
              const digital = discipline.format === 'Digital';
              const color = discipline.exempted ? SCREEN.exemption : digital ? '#67d4e8' : SCREEN.link;
              return (
                <div key={discipline.id} className="flex items-center gap-3 px-3.5 py-3"
                  style={index > 0 ? { borderTop: `1px solid ${SCREEN.line}` } : undefined}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
                    style={{ backgroundColor: discipline.exempted ? 'rgba(196,181,253,0.12)' : digital ? 'rgba(103,212,232,0.12)' : 'rgba(74,158,255,0.12)', color }}>
                    {digital ? <MonitorPlay className="h-[18px] w-[18px]" /> : <BookOpen className="h-[18px] w-[18px]" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-snug font-semibold">{discipline.name}</span>
                    <span className="mt-0.5 block truncate text-[12px]" style={{ color: '#bfc5ce' }}>
                      {discipline.exempted ? 'Você não precisa cursar esta disciplina' : discipline.schedule}
                    </span>
                  </span>
                  {discipline.exempted && (
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ color: SCREEN.exemption, backgroundColor: 'rgba(196,181,253,0.12)' }}>Dispensada</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* As duas janelas do calendário, no fim da lista: é o que o documento
            diz sobre avaliação, e é tudo o que ele diz. O dia de cada prova
            dentro do intervalo é marcado pelo professor e não existe como dado. */}
        {periods.length > 0 && (
          <div className="mt-4 rounded-[16px] p-4" style={{ backgroundColor: SCREEN.card }}>
            <p className="text-[12px] font-semibold tracking-wide uppercase" style={{ color: '#bfc5ce' }}>
              Avaliações previstas no calendário
            </p>
            <div className="mt-3 space-y-3">
              {periods.map(({ key, item }) => (
                <div key={key} className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 h-[18px] w-[18px] shrink-0" style={{ color: SCREEN.link }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-snug font-semibold">Período de provas {key}</span>
                    <span className="block text-[13px]" style={{ color: '#bfc5ce' }}>
                      {datePhrase(item)}{item.end < model.today ? ' · já aconteceu' : ''}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3.5 border-t pt-3 text-[12px] leading-snug" style={{ borderColor: SCREEN.line, color: '#bfc5ce' }}>
              A data de cada disciplina dentro da janela é informada pelo professor durante a aula.
            </p>
          </div>
        )}
      </section>

      <div className="space-y-2">
        <DetailAction icon={<CalendarDays className="h-5 w-5" />} label="Calendário acadêmico" detail="Todas as datas do semestre" onClick={() => onScreen('completo')} />
      </div>
    </div>
  </ScreenShell>;
}

/* -- Híbrido e EaD --------------------------------------------------------- */

const MEETING_ORDINAL: Record<string, number> = {
  primeiro: 1, segundo: 2, terceiro: 3, quarto: 4, quinto: 5,
};

/**
 * Como chamar um encontro na lista de uma disciplina.
 *
 * O PDF numera os encontros por extenso, e a lista da tela raramente tem todos:
 * o calendário dos sábados imprime primeiro, terceiro e quarto da mesma
 * disciplina, e o quinzenal imprime só dois. Contar pela posição na lista
 * rebatizava o terceiro encontro de «2º», que é inventar um dado que o
 * documento contradiz na linha de baixo. Quando o PDF escreve o ordinal, ele
 * manda; a contagem só entra onde não há ordinal impresso.
 */
function meetingLabel(item: TimelineItem, index: number): string {
  const printed = item.officialTitle.match(/^(primeiro|segundo|terceiro|quarto|quinto)\s+encontro/i);
  if (printed) return `${MEETING_ORDINAL[printed[1].toLowerCase()]}º encontro`;
  /* «Encontros presenciais da disciplina híbrida 1» reúne quatro datas numa
     linha só, e chamá-la de «1º encontro» seria contar quatro como um. */
  if (/^encontros\s/i.test(item.officialTitle)) {
    return item.dates.length > 1 ? `${item.dates.length} encontros` : 'Encontro presencial';
  }
  return `${index + 1}º encontro`;
}

/**
 * O mesmo cuidado na lista da disciplina digital.
 *
 * A janela do AVA e a substitutiva daquela mesma disciplina caem na mesma
 * lista, e a substitutiva do calendário de Direito é presencial, com hora
 * marcada antes da aula. Chamar as duas de «Avaliação no AVA» mandava o aluno
 * para o lugar errado numa delas.
 */
function digitalDateLabel(item: TimelineItem): string {
  if (/substitutiva/i.test(item.officialTitle)) return 'Prova substitutiva';
  if (/recupera[çc][ãa]o/i.test(item.officialTitle)) return 'Prova de recuperação';
  return 'Avaliação no AVA';
}

function HybridModalityScreen({ model, onScreen, onOpenItem, chrome }: {
  model: TrilhaModel; onScreen: (screen: PhoneScreen) => void;
  onOpenItem: (item: TimelineItem) => void; chrome: boolean;
}) {
  const { student, resolution } = model;
  const hybrid = student.modality === 'Híbrido';
  const secondStart = resolution.calendar?.events.find((event) => /Início.*1ª disciplina híbrida do segundo bimestre/i.test(event.title));
  const bimester = secondStart && model.today >= secondStart.start ? 2 : 1;
  const periodText = bimester === 1 ? 'primeiro bimestre' : 'segundo bimestre';
  const periodEvents = model.items.filter((item) => item.officialTitle.toLowerCase().includes(periodText));
  const disciplines = student.academic.disciplines.filter((discipline) => discipline.calendarSlot ? discipline.calendarSlot.bimester === bimester : !hybrid || bimester === 1);
  const cards = disciplines.map((discipline) => ({
    id: discipline.id, title: discipline.name, format: discipline.format, exempted: discipline.exempted,
    events: periodEvents.filter((item) => {
      const event = resolution.calendar?.events.find((event) => event.id === item.eventId);
      return event && disciplineFor(event, student)?.id === discipline.id;
    }),
  }));
  // Sem grade nominal, os rótulos vêm do calendário, nunca de matérias inventadas.
  if (cards.length === 0 && hybrid && resolution.calendar) {
    for (const ordinal of [1, 2]) {
      const events = periodEvents.filter((item) => item.officialTitle.includes(`${ordinal}ª disciplina`));
      if (events.length) cards.push({ id: `hybrid-${ordinal}`, title: `${ordinal}ª disciplina híbrida`, format: 'Híbrida', exempted: undefined, events });
    }
    const digital = periodEvents.filter((item) => /disciplina digital|disciplinas digitais regulares/i.test(item.officialTitle));
    if (digital.length) cards.push({ id: 'digital', title: 'Disciplina digital', format: 'Digital', exempted: undefined, events: digital });
  }
  return <ScreenShell chrome={chrome} simulated={model.delta.simulated}>
    <InnerHeader title={hybrid ? 'Entenda o seu híbrido' : 'Entenda sua modalidade'} subtitle={`${student.course} · ${student.cohort === 'Calouro' ? 'Ingressante' : 'Veterano'}`} onBack={() => onScreen('trilha')} backLabel="Comece por aqui" chrome={chrome} />
    <div className="space-y-7 px-5 py-5" style={{ color: SCREEN.ink }}>
      <section aria-label="Como você vai estudar" className="space-y-5">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]" style={{ backgroundColor: 'rgba(74,158,255,0.16)', color: SCREEN.link }}><MonitorPlay className="h-6 w-6" /></span>
          <div><h2 className="text-[19px] font-semibold">Estude no AVA</h2><p className="mt-1 text-[15px] leading-snug" style={{ color: '#bfc5ce' }}>Sua sala de aula on-line, com conteúdos e atividades.</p></div>
        </div>
        {hybrid && <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]" style={{ backgroundColor: 'rgba(50,213,131,0.14)', color: SCREEN.vital }}><GraduationCap className="h-6 w-6" /></span>
          <div><h2 className="text-[19px] font-semibold">Aprenda no campus</h2><p className="mt-1 text-[15px] leading-snug" style={{ color: '#bfc5ce' }}>Encontros com atividades e avaliações presenciais.</p></div>
        </div>}
        <a href="https://ava.anchieta.br/" target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-[#087fea] px-4 py-3 text-[16px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2">
          Acessar o AVA <ExternalLink className="h-4 w-4" /><span className="sr-only"> (abre em nova aba)</span>
        </a>
      </section>
      <section>
        <div className="flex items-baseline justify-between gap-2"><h2 className="text-[22px] font-semibold">Suas disciplinas</h2><span className="text-[13px]" style={{ color: '#bfc5ce' }}>{bimester}º bimestre</span></div>
        <p className="mt-1.5 text-[14px]" style={{ color: '#bfc5ce' }}>Toque para entender cada uma.</p>
        {cards.length === 0 && <p className="mt-4 text-[15px] leading-snug" style={{ color: '#bfc5ce' }}>Consulte suas disciplinas no AVA.</p>}
        <div className="mt-4 space-y-3">
          {cards.map((card) => {
            const digital = card.format === 'Digital';
            const color = card.exempted ? SCREEN.exemption : digital ? '#67d4e8' : SCREEN.link;
            const meetings = card.events.filter((item) => /encontros? presencia/i.test(item.officialTitle));
            const dates = digital ? card.events.filter((item) => item.category === 'prova') : meetings;
            return <details key={`${bimester}-${card.id}`} className="group overflow-hidden rounded-[16px]" style={{ backgroundColor: SCREEN.card }}>
              <summary className="flex min-h-24 cursor-pointer list-none items-center gap-3 p-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] [&::-webkit-details-marker]:hidden">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]" style={{ backgroundColor: card.exempted ? 'rgba(196,181,253,0.12)' : digital ? 'rgba(103,212,232,0.12)' : 'rgba(74,158,255,0.12)', color }}>{digital ? <MonitorPlay className="h-6 w-6" /> : <BookOpen className="h-6 w-6" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[18px] font-semibold leading-snug">{card.title}</span>
                  {card.exempted ? <>
                    <span className="mt-2 inline-flex rounded-full px-2.5 py-1 text-[13px] font-semibold" style={{ color: SCREEN.exemption, backgroundColor: 'rgba(196,181,253,0.12)' }}>Dispensada</span>
                    <span className="mt-2 block text-[13px] leading-snug" style={{ color: '#bfc5ce' }}>Você não precisa participar dos encontros desta disciplina.</span>
                  </> : <span className="mt-1.5 block text-[13px]" style={{ color: '#bfc5ce' }}>{digital ? 'Estudo on-line' : card.format === 'Presencial' ? 'Aulas no campus' : 'AVA + encontros no campus'}</span>}
                </span>
                <ChevronDown className="h-5 w-5 shrink-0 group-open:rotate-180" style={{ color: '#bfc5ce' }} />
              </summary>
              <div className="space-y-4 border-t px-4 py-4" style={{ borderColor: SCREEN.line }}>
                <p className="text-[15px] leading-relaxed" style={{ color: '#d3d7de' }}>{card.exempted ? 'Você não precisa participar dos encontros nem das avaliações desta disciplina.' : digital ? 'Acesse os materiais, faça as atividades e acompanhe os prazos no AVA.' : card.format === 'Presencial' ? 'Confira seus horários e participe das aulas no campus.' : 'Estude o conteúdo no AVA e participe dos encontros desta disciplina no campus.'}</p>
                {!card.exempted && dates.length > 0 && <div className="space-y-1">
                  {dates.sort((a, b) => a.start.localeCompare(b.start)).map((item, index) => <button key={item.id} type="button" onClick={() => onOpenItem(item)} className="flex min-h-12 w-full items-center gap-2 py-2 text-left">
                    <CalendarDays className="h-4 w-4 shrink-0" style={{ color }} /><span className="flex-1 text-[14px]"><span className="block font-medium">{digital ? digitalDateLabel(item) : meetingLabel(item, index)}</span><span style={{ color: '#bfc5ce' }}>{datePhrase(item)}{item.end < model.today ? ' · Data passada' : ''}</span></span><ChevronRight className="h-4 w-4" style={{ color: '#bfc5ce' }} />
                  </button>)}
                </div>}
                {!card.exempted && !dates.length && !digital && <p className="text-[14px]" style={{ color: '#bfc5ce' }}>Confira as datas e os horários no calendário acadêmico.</p>}
              </div>
            </details>;
          })}
        </div>
        {disciplines.length === 0 && cards.length > 0 && <p className="mt-3 text-[13px] leading-snug" style={{ color: '#bfc5ce' }}>Os nomes das disciplinas estão na sua grade no AVA.</p>}
      </section>
      <div className="space-y-2">
        <DetailAction icon={<CalendarDays className="h-5 w-5" />} label="Calendário acadêmico" detail="Todas as datas do semestre" onClick={() => onScreen('completo')} />
      </div>
    </div>
  </ScreenShell>;
}

function StepsScreen({
  model,
  onScreen,
  onOpenStep,
  chrome,
}: {
  model: TrilhaModel;
  onScreen: (s: PhoneScreen) => void;
  onOpenStep: (step: TrilhaStep) => void;
  chrome: boolean;
}) {
  const progress = stepProgress(model.steps);
  const currentStep = model.steps.find((step) => !step.done);

  const groups = useMemo(() => {
    const order: StepPlace[] = [];
    const map = new Map<StepPlace, TrilhaStep[]>();
    model.steps.forEach((step) => {
      if (!map.has(step.place)) {
        map.set(step.place, []);
        order.push(step.place);
      }
      (map.get(step.place) as TrilhaStep[]).push(step);
    });
    return order.map((place) => ({ place, steps: map.get(place) as TrilhaStep[] }));
  }, [model.steps]);

  const [open, setOpen] = useState<StepPlace | null>(currentStep?.place ?? groups[0]?.place ?? null);

  return (
    <ScreenShell chrome={chrome} simulated={model.delta.simulated}>
      <InnerHeader
        chrome={chrome}
        onBack={() => onScreen('trilha')}
        backLabel="Comece por aqui"
        title="Minha trilha"
        subtitle={`${progress.done} de ${progress.total} passos concluídos${
          progress.blocking > 0 ? ` · ${progress.blocking} travam o primeiro dia` : ''
        }`}
      />

      <div className="space-y-3 px-4 pt-4">
        {groups.map(({ place, steps }) => {
          const doneHere = steps.filter((step) => step.done).length;
          const expanded = open === place;
          const hasCurrent = steps.some((step) => step.id === currentStep?.id);
          return (
            <section key={place} className="overflow-hidden rounded-[18px]" style={{ backgroundColor: SCREEN.card }}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : place)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]"
                  style={{
                    backgroundColor:
                      doneHere === steps.length
                        ? 'rgba(50,213,131,0.14)'
                        : hasCurrent
                          ? 'rgba(22,137,244,0.16)'
                          : 'rgba(255,255,255,0.07)',
                    color: doneHere === steps.length ? SCREEN.vital : hasCurrent ? SCREEN.link : SCREEN.ink2,
                  }}
                >
                  <StepIcon step={steps[0]} className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold" style={{ color: SCREEN.ink }}>
                    {PLACE_LABEL[place]}
                  </span>
                  <span className="block text-[11px]" style={{ color: SCREEN.ink2 }}>
                    {doneHere} de {steps.length} concluídos
                  </span>
                </span>
                <ChevronRight
                  className={`h-[18px] w-[18px] shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
                  style={{ color: SCREEN.ink3 }}
                />
              </button>

              {expanded && (
                <div className="relative space-y-2.5 px-3 pt-1 pb-4 before:absolute before:top-3 before:bottom-5 before:left-[24px] before:w-[3px] before:bg-white/15">
                  {steps.map((step) => (
                    <StepRow
                      key={step.id}
                      step={step}
                      state={stepStateOf(step, currentStep?.id)}
                      onOpen={onOpenStep}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}

        {/* O passo atual não pode ficar dobrado dentro de um grupo fechado: é a
            única coisa desta tela que tem ação agora. */}
        {currentStep && (
          <button
            type="button"
            onClick={() => onOpenStep(currentStep)}
            className="flex w-full items-center gap-3 rounded-[18px] border p-4 text-left"
            style={{ background: 'linear-gradient(135deg,#202123,#171819)', borderColor: 'rgba(22,137,244,0.45)' }}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]" style={{ backgroundColor: 'rgba(22,137,244,0.16)', color: SCREEN.link }}>
              <StepIcon step={currentStep} className="h-[19px] w-[19px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold tracking-wide uppercase" style={{ color: SCREEN.link }}>
                Continuar
              </span>
              <span className="mt-0.5 block text-[14px] leading-snug font-semibold" style={{ color: SCREEN.ink }}>
                {currentStep.title}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: SCREEN.ink3 }} />
          </button>
        )}
      </div>
    </ScreenShell>
  );
}

/* ==========================================================================
   Detalhe de uma etapa
   ========================================================================== */

function StepDetailScreen({
  model,
  step,
  onScreen,
  chrome,
}: {
  model: TrilhaModel;
  step: TrilhaStep;
  onScreen: (s: PhoneScreen) => void;
  chrome: boolean;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [deferred, setDeferred] = useState(false);
  const position = model.steps.indexOf(step) + 1;
  const total = model.steps.length;
  const instructions = stepInstructions(step);
  const destination = primaryActionScreen(step);

  return (
    <ScreenShell chrome={chrome} simulated={model.delta.simulated}>
      <div className="px-5 pb-6" style={{ backgroundImage: HEADER_BG, paddingTop: chrome ? IOS.safeTop : 18 }}>
        <button
          type="button"
          onClick={() => onScreen('trilha')}
          className="-ml-1.5 mb-3 flex items-center gap-1 text-[15px]"
          style={{ color: SCREEN.ink }}
        >
          <ChevronLeft className="h-[18px] w-[18px]" />
          Comece por aqui
        </button>
        <p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: 'rgba(255,255,255,0.72)' }}>
          Passo {position} de {total} · {PLACE_LABEL[step.place]}
        </p>
        <h1 className="mt-1.5 text-[25px] leading-[1.15] font-semibold" style={{ color: SCREEN.ink }}>
          {step.title}
        </h1>
        {step.done && (
          <p className="mt-2 flex items-center gap-1.5 text-[14px]" style={{ color: '#b8f0d2' }}>
            <Check className="h-4 w-4" strokeWidth={3} />
            Concluído
          </p>
        )}
      </div>

      <div className="space-y-3 px-4 pt-4">
        <div className="rounded-[18px] p-5" style={{ backgroundColor: SCREEN.card }}>
          <p className="text-[15px] font-semibold" style={{ color: SCREEN.ink }}>Como fazer</p>
          <ol className="mt-3 space-y-3">
            {instructions.map((line, index) => (
              <li key={line} className="flex items-start gap-3">
                <span
                  className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                  style={{ backgroundColor: 'rgba(255,255,255,0.09)', color: SCREEN.ink }}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 text-[13px] leading-snug" style={{ color: SCREEN.ink2 }}>
                  {line}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* ---- O dado útil ------------------------------------------------
            O RA é o que o aluno precisa ter na mão em quase todo passo, e é
            exatamente o que ele não lembra de cabeça no primeiro mês. */}
        <div className="flex items-center gap-3 rounded-[15px] px-4 py-3.5" style={{ backgroundColor: SCREEN.cardHi }}>
          <ClipboardList className="h-[18px] w-[18px] shrink-0" style={{ color: SCREEN.ink2 }} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase" style={{ color: SCREEN.ink3 }}>Seu RA</p>
            <p className="text-[17px] font-semibold" style={{ color: SCREEN.ink }}>{model.student.ra}</p>
          </div>
        </div>

        <div className="rounded-[15px] p-4" style={{ backgroundColor: SCREEN.card }}>
          <p className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: SCREEN.ink }}>
            <ShieldCheck className="h-[16px] w-[16px] shrink-0" style={{ color: SCREEN.ink2 }} />
            Como sabemos que você concluiu
          </p>
          <p className="mt-2 text-[12px] leading-snug" style={{ color: SCREEN.ink2 }}>
            {recognitionOf(step)}
          </p>
        </div>

        {step.blocking && !step.done && (
          <div className="rounded-[15px] p-4" style={{ backgroundColor: 'rgba(245,180,89,0.12)' }}>
            <p className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: SCREEN.warn }}>
              <TriangleAlert className="h-[16px] w-[16px] shrink-0" />
              Este passo trava o seu primeiro dia
            </p>
            <p className="mt-1.5 text-[12px] leading-snug" style={{ color: SCREEN.ink2 }}>
              Sem ele, você chega ao primeiro encontro sem conseguir entrar. Por isso ele não tem
              a opção de deixar para depois.
            </p>
          </div>
        )}

        <div className="space-y-2 pt-1">
          {/* O rótulo é o da ação da etapa, como a especificação pede — e ele
              continua verdadeiro mesmo quando o destino é fora deste
              aplicativo. AVA, portal e secretaria são outros endereços; o botão
              diz para onde vai em vez de fingir que abre aqui dentro, e um
              controle desabilitado com rótulo de ação seria pior que os dois. */}
          {!step.done && (
            <button
              type="button"
              onClick={() => (destination ? onScreen(destination) : setHelpOpen(true))}
              aria-expanded={destination ? undefined : helpOpen}
              className="w-full rounded-[13px] bg-[#087fea] py-3 text-[16px] font-semibold text-white"
            >
              {primaryActionLabel(step)}
            </button>
          )}
          {!destination && helpOpen && (
            <DetailPanel>
              {PLACE_LABEL[step.place]} abre fora do App Grupo Anchieta, com o seu RA{' '}
              {model.student.ra}. Siga os passos acima e volte aqui. O app reconhece o que
              puder reconhecer sozinho.
            </DetailPanel>
          )}

          <DetailAction
            icon={<Headphones className="h-[17px] w-[17px]" />}
            label="Estou com dificuldade"
            detail="Abre o atendimento com este passo no assunto"
            onClick={() => onScreen('atendimento')}
          />

          {/* «Fazer depois» só onde adiar é possível. Oferecer o botão num passo
              bloqueante seria oferecer uma escolha que não existe. */}
          {!step.blocking && !step.done && (
            <button
              type="button"
              onClick={() => setDeferred(true)}
              disabled={deferred}
              className="w-full rounded-[13px] border py-3 text-[14px] font-semibold disabled:opacity-45"
              style={{ borderColor: 'rgba(255,255,255,0.18)', color: SCREEN.ink }}
            >
              {deferred ? 'Guardado para depois' : 'Fazer depois'}
            </button>
          )}
          {deferred && (
            <DetailPanel>
              O passo continua na sua trilha e volta a aparecer. Nada foi marcado como concluído.
            </DetailPanel>
          )}
        </div>

        <button
          type="button"
          onClick={() => onScreen('passos')}
          className="flex w-full items-center justify-center gap-1 px-1 pt-2 text-[13px]"
          style={{ color: SCREEN.link }}
        >
          Ver todos os passos
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </ScreenShell>
  );
}

/* ==========================================================================
   Calendário completo — a tela que o contador abre
   ========================================================================== */

/** «2026/2» → «2º semestre de 2026». O aluno não lê barra. */
function semesterLabel(semester: string): string {
  const parts = semester.match(/^(\d{4})\/(\d)$/);
  return parts ? `${parts[2]}º semestre de ${parts[1]}` : semester;
}

function FullCalendarScreen({
  model,
  onScreen,
  onOpenItem,
  chrome,
}: {
  model: TrilhaModel;
  onScreen: (s: PhoneScreen) => void;
  onOpenItem: (item: TimelineItem) => void;
  chrome: boolean;
}) {
  const calendar = model.resolution.calendar;
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  /* Os meses que este calendário realmente tem. Um filtro que oferece um mês
     vazio é um filtro que ensina o aluno a desconfiar do filtro. */
  const months = useMemo(() => {
    const seen = new Map<string, string>();
    model.items.forEach((item) => {
      markedDays(item).forEach((date) => {
        const { year, month: m } = monthOf(date);
        seen.set(monthKey(year, m), MONTH_NAMES[m - 1]);
      });
    });
    return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [model.items]);

  /* A busca corre o texto TRADUZIDO e o texto OFICIAL. O aluno procura por
     «extensionista» e a linha do PDF diz «Prática Extensionista»; procurar só
     no nosso texto esconderia a linha que a citação promete estar ali. */
  const normalized = deaccent(query.trim());
  const results = model.items.filter((item) => {
    if (month) {
      if (!markedDays(item).some((date) => date.slice(0, 7) === month)) return false;
    }
    if (!month && !normalized && !expanded && !inTwoMonths(item, model.today)) return false;
    if (normalized === '') return true;
    const haystack = deaccent(
      `${item.title} ${item.lines.join(' ')} ${item.officialTitle} ${item.dateLabel}`,
    );
    return haystack.includes(normalized);
  });

  const grouped = useMemo(() => {
    const keys = [...new Set(results.map((item) => item.start.slice(0, 7)))].sort();
    return keys.map((key) => ({ key, list: results.filter((item) => item.start.startsWith(key)).sort((a, b) => a.start.localeCompare(b.start)) }));
  }, [results]);

  return (
    <ScreenShell chrome={chrome} simulated={model.delta.simulated}>
      <div className="px-5 pb-6" style={{ backgroundImage: HEADER_BG, paddingTop: chrome ? IOS.safeTop : 18 }}>
        <button
          type="button"
          onClick={() => onScreen('datas')}
          className="-ml-1.5 mb-3 flex items-center gap-1 text-[15px]"
          style={{ color: SCREEN.ink }}
        >
          <ChevronLeft className="h-[18px] w-[18px]" />
          Minhas datas
        </button>
        <h1 className="text-[26px] leading-[1.15] font-semibold" style={{ color: SCREEN.ink }}>
          Calendário completo
        </h1>
        <p className="mt-1.5 text-[13px] leading-snug" style={{ color: 'rgba(255,255,255,0.72)' }}>
          Documento oficial do seu curso
        </p>
      </div>

      <div className="space-y-4 px-4 pt-4">
        {/* ---- Qual calendário é este -----------------------------------
            A primeira pergunta de quem abre esta tela é «isto é o meu?». Ela
            vem antes da busca porque uma lista de 61 datas do documento errado
            é pior que nenhuma lista. */}
        {calendar ? (
          <div className="rounded-[18px] p-4" style={{ backgroundColor: SCREEN.card }}>
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-[19px] w-[19px] shrink-0" style={{ color: SCREEN.ink }} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: SCREEN.ink2 }}>
                  Calendário aplicável
                </p>
                <p className="mt-1 text-[17px] leading-snug font-semibold" style={{ color: SCREEN.ink }}>
                  {model.student.modality} · {model.student.course}
                </p>
                <p className="mt-0.5 text-[13px]" style={{ color: SCREEN.ink2 }}>
                  {semesterLabel(calendar.semester)} · {calendar.shortName}
                </p>
                <a
                  href={calendar.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2.5 flex items-center gap-1 text-[14px] font-medium"
                  style={{ color: SCREEN.link }}
                >
                  Abrir PDF oficial
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>
            </div>
            {model.resolution.match === 'outra-coorte' && model.resolution.note && (
              <p className="mt-3 border-t pt-3 text-[12px] leading-snug" style={{ borderColor: SCREEN.line, color: SCREEN.warn }}>
                {model.resolution.note}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-[15px] p-4" style={{ backgroundColor: SCREEN.card }}>
            <p className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: SCREEN.warn }}>
              <TriangleAlert className="h-[17px] w-[17px]" />
              Nenhum calendário publicado para o seu curso
            </p>
            <p className="mt-2 text-[12px] leading-snug" style={{ color: SCREEN.ink2 }}>
              {model.resolution.note ?? 'Fale com a coordenação do curso para receber as datas do seu semestre.'}
            </p>
          </div>
        )}

        {model.totalCount > 0 && (
          <>
            <label className="flex items-center gap-3 rounded-[16px] px-4 py-3" style={{ backgroundColor: SCREEN.card }}>
              <Search className="h-[18px] w-[18px] shrink-0" style={{ color: SCREEN.ink2 }} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar uma data"
                aria-label="Buscar uma data no calendário"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-white/40"
                style={{ color: SCREEN.ink }}
              />
            </label>

            <div className="ios-scroll -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              <button
                type="button"
                onClick={() => setMonth(null)}
                aria-pressed={month === null}
                className="shrink-0 rounded-full border px-4 py-2 text-[13px]"
                style={{
                  color: SCREEN.ink,
                  borderColor: month === null ? '#087fea' : 'rgba(255,255,255,0.14)',
                  backgroundColor: month === null ? 'rgba(8,127,234,0.32)' : SCREEN.card,
                }}
              >
                {expanded ? 'Todos' : 'Este mês e o próximo'}
              </button>
              {months.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMonth(month === key ? null : key)}
                  aria-pressed={month === key}
                  className="shrink-0 rounded-full border px-4 py-2 text-[13px] capitalize"
                  style={{
                    color: SCREEN.ink,
                    borderColor: month === key ? '#087fea' : 'rgba(255,255,255,0.14)',
                    backgroundColor: month === key ? 'rgba(8,127,234,0.32)' : SCREEN.card,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <h2 className="text-[20px] font-bold" style={{ color: SCREEN.ink }}>
              {results.length === 1 ? '1 data encontrada' : `${results.length} datas encontradas`}
            </h2>

            {results.length === 0 ? (
              <p className="text-[13px] leading-snug" style={{ color: SCREEN.ink2 }}>
                {normalized || month ? 'Nenhuma data encontrada. Tente outra palavra ou limpe o filtro de mês.' : 'Nenhuma data neste mês e no próximo. Abra todas as datas para consultar o semestre.'}
              </p>
            ) : (
              grouped.map(({ key, list }) => (
                <section key={key}>
                  <h3
                    className="mb-2 flex items-baseline justify-between text-[13px] font-semibold tracking-wide uppercase"
                    style={{ color: SCREEN.ink3 }}
                  >
                    {!expanded && !month && !normalized && key < model.today.slice(0, 7) ? 'Em andamento' : monthLabel(monthOf(`${key}-01`))}
                    <span className="text-[11px] normal-case">{list.length}</span>
                  </h3>
                  <div className="space-y-1.5">
                    {list.map((item) => {
                      const part = dateParts(item.start);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onOpenItem(item)}
                          className="flex w-full items-center gap-3 rounded-[14px] py-2.5 pr-3 pl-1 text-left"
                          style={{ backgroundColor: SCREEN.card }}
                        >
                          <span className="w-[52px] shrink-0 text-center">
                            <span className="block text-[19px] leading-none font-bold" style={{ color: SCREEN.ink }}>
                              {part.day}
                            </span>
                            <span className="mt-0.5 block text-[10px]" style={{ color: SCREEN.ink2 }}>
                              {part.month}
                            </span>
                          </span>
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center border-l pl-3"
                            style={{ borderColor: SCREEN.line, color: SCREEN.ink }}
                          >
                            <CategoryIcon item={item} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 block text-[13px] leading-snug font-medium" style={{ color: SCREEN.ink }}>
                              {item.title}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px]" style={{ color: SCREEN.ink2 }}>
                              {item.lines[0] ?? datePhrase(item)}
                            </span>
                            {item.bucket === 'passado' && (
                              <span className="mt-0.5 block truncate text-[11px] italic" style={{ color: SCREEN.ink3 }}>
                                Já aconteceu
                              </span>
                            )}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0" style={{ color: SCREEN.ink3 }} />
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </>
        )}

        {!month && !normalized && model.items.some((item) => !inTwoMonths(item, model.today)) && <MoreDates expanded={expanded} onToggle={() => setExpanded(!expanded)} count={model.totalCount} />}

        {/* ---- A fonte -----------------------------------------------------
            Sem carimbo de «atualizado em»: o modelo não guarda a data da última
            revisão da transcrição, e um carimbo inventado nesta tela seria
            justamente a peça que faz o aluno parar de abrir o PDF. O que dá
            para afirmar — qual arquivo, qual documento, e que ele prevalece —
            está escrito, e o PDF fica a um toque. */}
        {calendar && (
          <div className="rounded-[15px] p-4" style={{ backgroundColor: SCREEN.cardHi }}>
            <p className="text-[12px] leading-snug" style={{ color: SCREEN.ink }}>
              Fonte: {calendar.name}
            </p>
            <p className="mt-1 text-[11px] leading-snug" style={{ color: SCREEN.ink2 }}>
              Arquivo {calendar.source}, publicado pela instituição. Esta tela é uma transcrição:
              havendo divergência, o PDF oficial prevalece.
            </p>
            <a
              href={calendar.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-[13px]"
              style={{ color: SCREEN.link }}
            >
              Abrir o PDF oficial
            </a>
          </div>
        )}
      </div>
    </ScreenShell>
  );
}

/* ==========================================================================
   Destinos do aplicativo
   --------------------------------------------------------------------------
   Estes destinos usam somente campos que já existem no cadastro do aluno.
   Quando a integração de origem não fornece um documento ou uma ação, a tela
   indica o lugar correto para consultá-lo em vez de simular um resultado.
   ========================================================================== */

function AppPage({
  title,
  subtitle,
  onBack,
  chrome,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  chrome: boolean;
  children: ReactNode;
}) {
  return (
    <ScreenShell chrome={chrome}>
      <InnerHeader title={title} subtitle={subtitle} onBack={onBack} chrome={chrome} />
      <div className="space-y-3 px-5 pt-5">{children}</div>
    </ScreenShell>
  );
}

function EmptyAppCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-[18px] p-5 text-center" style={{ backgroundColor: SCREEN.card }}>
      <span
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: SCREEN.ink2 }}
      >
        {icon}
      </span>
      <p className="mt-3 text-[16px] font-semibold" style={{ color: SCREEN.ink }}>{title}</p>
      <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: SCREEN.ink2 }}>{body}</p>
    </div>
  );
}

function ScheduleScreen({ model, onScreen, chrome }: { model: TrilhaModel; onScreen: (s: PhoneScreen) => void; chrome: boolean }) {
  const disciplines = model.student.academic.disciplines;
  return (
    <AppPage title="Horários" subtitle={`${model.student.course} · ${model.student.shift}`} onBack={() => onScreen('inicio')} chrome={chrome}>
      {disciplines.length === 0 ? (
        <EmptyAppCard icon={<Clock3 className="h-5 w-5" />} title="Grade ainda não disponível" body="Consulte o Portal do Aluno para confirmar suas disciplinas e horários." />
      ) : disciplines.map((discipline) => (
        <div key={discipline.id} className="rounded-[16px] p-4" style={{ backgroundColor: SCREEN.card }}>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]" style={{ backgroundColor: 'rgba(74,158,255,0.14)', color: SCREEN.link }}>
              <BookOpen className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] leading-snug font-semibold" style={{ color: SCREEN.ink }}>{discipline.name}</p>
              <p className="mt-1 text-[12px]" style={{ color: SCREEN.ink2 }}>{discipline.schedule}</p>
              <p className="mt-1 text-[11px]" style={{ color: SCREEN.ink3 }}>{discipline.format} · {discipline.teacher}</p>
            </div>
          </div>
        </div>
      ))}
    </AppPage>
  );
}

function ChargesScreen({ model, onScreen, chrome }: { model: TrilhaModel; onScreen: (s: PhoneScreen) => void; chrome: boolean }) {
  const finance = model.student.financial;
  const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return (
    <AppPage title="Cobranças" subtitle={finance.situation} onBack={() => onScreen('inicio')} chrome={chrome}>
      <div className="rounded-[18px] p-5" style={{ backgroundColor: SCREEN.card }}>
        <p className="text-[12px]" style={{ color: SCREEN.ink2 }}>Total em aberto</p>
        <p className="mt-1 text-[28px] font-semibold" style={{ color: finance.outstanding > 0 ? SCREEN.warn : SCREEN.ink }}>{money(finance.outstanding)}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4" style={{ borderColor: SCREEN.line }}>
          <div><p className="text-[10px] uppercase" style={{ color: SCREEN.ink3 }}>Mensalidade</p><p className="mt-1 text-[14px]" style={{ color: SCREEN.ink }}>{money(finance.monthlyFee)}</p></div>
          <div><p className="text-[10px] uppercase" style={{ color: SCREEN.ink3 }}>Vencimento</p><p className="mt-1 text-[14px]" style={{ color: SCREEN.ink }}>Todo dia {finance.dueDay}</p></div>
        </div>
      </div>
      <EmptyAppCard icon={<WalletCards className="h-5 w-5" />} title={finance.overdueCount === 0 ? 'Tudo em dia' : `${finance.overdueCount} cobrança em atraso`} body={finance.overdueCount === 0 ? 'Não há parcelas em atraso no seu cadastro.' : 'Abra o Portal do Aluno para consultar boletos e opções de negociação.'} />
    </AppPage>
  );
}

function GradesScreen({ model, onScreen, chrome }: { model: TrilhaModel; onScreen: (s: PhoneScreen) => void; chrome: boolean }) {
  const disciplines = model.student.academic.disciplines;
  return (
    <AppPage title="Notas e faltas" subtitle={`${model.student.period}º período`} onBack={() => onScreen('inicio')} chrome={chrome}>
      {disciplines.length === 0 ? (
        <EmptyAppCard icon={<GraduationCap className="h-5 w-5" />} title="Notas ainda não disponíveis" body="Sua grade acadêmica não está disponível nesta integração. Consulte o Portal do Aluno." />
      ) : disciplines.map((discipline) => (
        <div key={discipline.id} className="rounded-[16px] p-4" style={{ backgroundColor: SCREEN.card }}>
          <p className="text-[14px] leading-snug font-semibold" style={{ color: SCREEN.ink }}>{discipline.name}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div><p className="text-[10px] uppercase" style={{ color: SCREEN.ink3 }}>Nota</p><p className="mt-1 text-[16px] font-semibold" style={{ color: SCREEN.ink }}>{discipline.grade.toLocaleString('pt-BR')}</p></div>
            <div><p className="text-[10px] uppercase" style={{ color: SCREEN.ink3 }}>Presença</p><p className="mt-1 text-[16px] font-semibold" style={{ color: discipline.attendancePercent < 75 ? SCREEN.warn : SCREEN.ink }}>{discipline.attendancePercent}%</p></div>
            <div><p className="text-[10px] uppercase" style={{ color: SCREEN.ink3 }}>Faltas</p><p className="mt-1 text-[16px] font-semibold" style={{ color: SCREEN.ink }}>{discipline.absences}</p></div>
          </div>
        </div>
      ))}
    </AppPage>
  );
}

function ContractsScreen({ model, onScreen, chrome }: { model: TrilhaModel; onScreen: (s: PhoneScreen) => void; chrome: boolean }) {
  return (
    <AppPage title="Contratos" subtitle={`RA ${model.student.ra}`} onBack={() => onScreen('inicio')} chrome={chrome}>
      <div className="rounded-[18px] p-5" style={{ backgroundColor: SCREEN.card }}>
        <span className="flex h-11 w-11 items-center justify-center rounded-[14px]" style={{ backgroundColor: 'rgba(74,158,255,0.14)', color: SCREEN.link }}><ShieldCheck className="h-5 w-5" /></span>
        <p className="mt-4 text-[16px] font-semibold" style={{ color: SCREEN.ink }}>{model.student.course}</p>
        <p className="mt-1 text-[12px]" style={{ color: SCREEN.ink2 }}>{model.student.modality} · {model.student.campus}</p>
        <div className="mt-4 border-t pt-4" style={{ borderColor: SCREEN.line }}>
          <p className="text-[12px] leading-relaxed" style={{ color: SCREEN.ink2 }}>Os documentos contratuais e as assinaturas ficam no Portal do Aluno, sua fonte oficial para esta consulta.</p>
        </div>
      </div>
    </AppPage>
  );
}

function NoticesScreen({ model, onScreen, chrome }: { model: TrilhaModel; onScreen: (s: PhoneScreen) => void; chrome: boolean }) {
  const notices = model.student.alerts.slice(0, 4);
  return (
    <AppPage title="Avisos" subtitle={notices.length ? `${notices.length} avisos importantes` : 'Nenhum aviso pendente'} onBack={() => onScreen('inicio')} chrome={chrome}>
      {notices.length === 0 ? (
        <EmptyAppCard icon={<BellRing className="h-5 w-5" />} title="Você está em dia" body="Quando houver uma pendência importante, ela aparecerá aqui." />
      ) : notices.map((notice) => (
        <div key={notice.id} className="rounded-[16px] p-4" style={{ backgroundColor: SCREEN.card }}>
          <div className="flex items-start gap-3">
            <BellRing className="mt-0.5 h-[18px] w-[18px] shrink-0" style={{ color: notice.severity === 'Crítico' ? SCREEN.crit : SCREEN.warn }} />
            <div><p className="text-[14px] leading-snug font-semibold" style={{ color: SCREEN.ink }}>{notice.title}</p><p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: SCREEN.ink2 }}>{notice.detail}</p></div>
          </div>
        </div>
      ))}
    </AppPage>
  );
}

function ExtensionScreen({ onScreen, chrome }: { onScreen: (s: PhoneScreen) => void; chrome: boolean }) {
  return (
    <AppPage title="Cursos de extensão" subtitle="Amplie sua formação" onBack={() => onScreen('inicio')} chrome={chrome}>
      <div className="overflow-hidden rounded-[18px]" style={{ backgroundColor: SCREEN.card }}>
        <div className="flex h-36 items-center justify-center" style={{ backgroundImage: 'linear-gradient(140deg, #4d422b 0%, #302819 100%)' }}><Rocket className="h-12 w-12" style={{ color: 'rgba(255,255,255,0.42)' }} /></div>
        <div className="p-5"><p className="text-[17px] font-semibold" style={{ color: SCREEN.ink }}>Encontre a próxima oportunidade</p><p className="mt-2 text-[12px] leading-relaxed" style={{ color: SCREEN.ink2 }}>O catálogo e as vagas mudam ao longo do semestre. Consulte a área de Extensão no Portal do Aluno para ver as ofertas disponíveis.</p></div>
      </div>
    </AppPage>
  );
}

function MoreScreen({ model, onScreen, chrome }: { model: TrilhaModel; onScreen: (s: PhoneScreen) => void; chrome: boolean }) {
  const items = [
    { label: 'Comece por aqui', detail: `${stepProgress(model.steps).done} de ${stepProgress(model.steps).total} passos`, Icon: Rocket, screen: 'trilha' as const },
    { label: 'Calendário completo', detail: `${model.totalCount} datas do curso`, Icon: CalendarRange, screen: 'completo' as const },
    { label: 'Cursos de extensão', detail: 'Consulte as oportunidades', Icon: GraduationCap, screen: 'extensao' as const },
    { label: 'Atendimento', detail: 'Fale com a equipe Anchieta', Icon: Headphones, screen: 'atendimento' as const },
  ];
  return (
    <AppPage title="Mais" subtitle={model.student.name} onBack={() => onScreen('inicio')} chrome={chrome}>
      {items.map(({ label, detail, Icon, screen }) => (
        <button key={label} type="button" onClick={() => onScreen(screen)} className="flex w-full items-center gap-3 rounded-[16px] p-4 text-left" style={{ backgroundColor: SCREEN.card }}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: SCREEN.ink }}><Icon className="h-[19px] w-[19px]" /></span>
          <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold" style={{ color: SCREEN.ink }}>{label}</span><span className="block text-[11px]" style={{ color: SCREEN.ink2 }}>{detail}</span></span>
          <ChevronRight className="h-4 w-4" style={{ color: SCREEN.ink3 }} />
        </button>
      ))}
      <div className="mt-4 flex items-center gap-2 px-1 text-[11px]" style={{ color: SCREEN.ink3 }}><Settings className="h-3.5 w-3.5" />Versão demonstrativa do aplicativo</div>
    </AppPage>
  );
}

function SupportScreen({ onScreen, chrome }: { onScreen: (s: PhoneScreen) => void; chrome: boolean }) {
  return (
    <AppPage title="Atendimento" subtitle="Como podemos ajudar?" onBack={() => onScreen('inicio')} chrome={chrome}>
      <EmptyAppCard icon={<MessageCircle className="h-5 w-5" />} title="Central de atendimento" body="Escolha o assunto no aplicativo oficial para iniciar uma conversa com a equipe responsável." />
      {['Acadêmico', 'Financeiro', 'Acesso ao AVA'].map((label) => <div key={label} className="flex items-center justify-between rounded-[15px] px-4 py-3.5" style={{ backgroundColor: SCREEN.card, color: SCREEN.ink }}><span className="text-[14px]">{label}</span><ChevronRight className="h-4 w-4" style={{ color: SCREEN.ink3 }} /></div>)}
    </AppPage>
  );
}

/* ==========================================================================
   Barra de abas e o botão de conversa
   ========================================================================== */

function TabBar({
  screen,
  onScreen,
  chrome,
}: {
  screen: PhoneScreen;
  onScreen: (s: PhoneScreen) => void;
  chrome: boolean;
}) {
  const reduced = useReducedMotion();
  const tabs = [
    { key: 'inicio' as const, label: 'Início', Icon: Home },
    { key: 'horarios' as const, label: 'Horários', Icon: Clock3 },
    { key: 'datas' as const, label: 'Calendário', Icon: CalendarDays },
    { key: 'avisos' as const, label: 'Avisos', Icon: BellRing },
  ];

  /* «Comece por aqui» não é o calendário: ela se abre do chip na tela inicial, e
     acender Calendário ali diria ao aluno que ele está num lugar onde não está. */
  const activeKey =
    screen === 'datas' || screen === 'completo' || screen === 'detalhe'
      ? 'datas'
      : screen === 'horarios'
        ? 'horarios'
        : screen === 'avisos'
          ? 'avisos'
          : 'inicio';

  return (
    <div
      className="absolute inset-x-0 z-20 px-4"
      style={{ bottom: chrome ? IOS.safeBottom - 6 : 10 }}
    >
      <div
        className="flex items-center justify-around rounded-[26px] px-2 py-2"
        style={{ backgroundColor: 'rgba(28,30,33,0.94)', backdropFilter: 'blur(12px)' }}
      >
        {tabs.map(({ key, label, Icon }) => {
          const active = key === activeKey;
          return (
            <motion.button
              key={label}
              type="button"
              onClick={() => onScreen(key)}
              aria-current={active ? 'page' : undefined}
              whileTap={reduced ? undefined : press}
              transition={reduced ? { duration: 0 } : spring}
              className="relative flex min-w-[62px] flex-col items-center gap-1 rounded-[18px] px-2 py-1.5"
            >
              {active && (
                <motion.span
                  layoutId="anchieta-active-tab"
                  className="absolute inset-0 rounded-[18px]"
                  style={{ backgroundColor: 'rgba(255,255,255,0.11)' }}
                  transition={reduced ? { duration: 0 } : spring}
                />
              )}
              <Icon
                className="relative z-10 h-[21px] w-[21px] transition-colors duration-200"
                style={{ color: active ? SCREEN.ink : SCREEN.ink2 }}
              />
              <span
                className="relative z-10 text-[10px] leading-none transition-colors duration-200"
                style={{ color: active ? SCREEN.ink : SCREEN.ink2 }}
              >
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ==========================================================================
   O invólucro da aplicação
   ========================================================================== */

export function AnchietaPhoneApp({ model, screen, onScreen, chrome = true }: AnchietaPhoneAppProps) {
  const reduced = useReducedMotion();
  const previousScreen = useRef(screen);

  /* Qual data e qual etapa estão abertas mora AQUI, e não na aba.
     `screen` é controlado de fora porque o segmentado da aba escolhe a tela; a
     escolha de um item, não — ela nasce de um toque dentro do aparelho, e
     empurrá-la para a aba obrigaria o painel a saber o que é uma linha do
     tempo. O aparelho guarda o alvo e só avisa qual tela abrir.

     A busca por id, e não a guarda do objeto, é o que mantém a tela viva quando
     o modelo é reconstruído — trocar a faixa simulada refaz todos os itens, e
     um objeto guardado congelaria a tela num item que já não existe. */
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [openStepId, setOpenStepId] = useState<string | null>(null);
  const [itemOrigin, setItemOrigin] = useState<'datas' | 'completo' | 'modalidade'>('datas');

  const openItem = (item: TimelineItem) => {
    setItemOrigin(screen === 'completo' || screen === 'modalidade' ? screen : 'datas');
    setOpenItemId(item.id);
    onScreen('detalhe');
  };
  const openStep = (step: TrilhaStep) => {
    setOpenStepId(step.id);
    onScreen('passo');
  };

  const openedItem = model.items.find((item) => item.id === openItemId);
  const openedStep = model.steps.find((step) => step.id === openStepId);
  const direction =
    SCREEN_POSITION[screen] === SCREEN_POSITION[previousScreen.current]
      ? 1
      : SCREEN_POSITION[screen] > SCREEN_POSITION[previousScreen.current]
        ? 1
        : -1;

  useEffect(() => {
    previousScreen.current = screen;
  }, [screen]);

  const content = (() => {
    switch (screen) {
      case 'inicio':
        return <HomeScreen model={model} onScreen={onScreen} chrome={chrome} />;
      case 'datas':
        return <DatesScreen model={model} onScreen={onScreen} onOpenItem={openItem} chrome={chrome} />;
      /* Sem item escolhido não há detalhe a mostrar, e a lista é o lugar certo
         para cair — acontece quando o aluno vem de um link ou quando a faixa
         simulada trocou o modelo debaixo da tela. */
      case 'detalhe':
        return openedItem ? (
          <EventDetailScreen model={model} item={openedItem} onScreen={onScreen} chrome={chrome} origin={itemOrigin} />
        ) : (
          <DatesScreen model={model} onScreen={onScreen} onOpenItem={openItem} chrome={chrome} />
        );
      case 'trilha':
        return <TrailScreen model={model} onScreen={onScreen} onOpenStep={openStep} chrome={chrome} />;
      case 'modalidade':
        return <ModalityScreen model={model} onScreen={onScreen} onOpenItem={openItem} chrome={chrome} />;
      case 'passos':
        return <StepsScreen model={model} onScreen={onScreen} onOpenStep={openStep} chrome={chrome} />;
      case 'passo':
        return openedStep ? (
          <StepDetailScreen model={model} step={openedStep} onScreen={onScreen} chrome={chrome} />
        ) : (
          <TrailScreen model={model} onScreen={onScreen} onOpenStep={openStep} chrome={chrome} />
        );
      case 'completo':
        return <FullCalendarScreen model={model} onScreen={onScreen} onOpenItem={openItem} chrome={chrome} />;
      case 'horarios':
        return <ScheduleScreen model={model} onScreen={onScreen} chrome={chrome} />;
      case 'avisos':
        return <NoticesScreen model={model} onScreen={onScreen} chrome={chrome} />;
      case 'cobrancas':
        return <ChargesScreen model={model} onScreen={onScreen} chrome={chrome} />;
      case 'notas':
        return <GradesScreen model={model} onScreen={onScreen} chrome={chrome} />;
      case 'contratos':
        return <ContractsScreen model={model} onScreen={onScreen} chrome={chrome} />;
      case 'mais':
        return <MoreScreen model={model} onScreen={onScreen} chrome={chrome} />;
      case 'extensao':
        return <ExtensionScreen onScreen={onScreen} chrome={chrome} />;
      case 'atendimento':
        return <SupportScreen onScreen={onScreen} chrome={chrome} />;
    }
  })();

  return (
    <div className="relative h-full overflow-hidden">
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={screen}
          custom={direction}
          variants={reduced ? undefined : PHONE_SCREEN_VARIANTS}
          initial={reduced ? false : 'enter'}
          animate={reduced ? undefined : 'center'}
          exit={reduced ? undefined : 'exit'}
          className="absolute inset-0 will-change-transform"
        >
          {content}
        </motion.div>
      </AnimatePresence>

      {/* O atendimento flutua somente na página inicial para não cobrir conteúdo. */}
      <AnimatePresence initial={false}>
        {screen === 'inicio' && (
        <motion.button
          key="atendimento-flutuante"
          type="button"
          onClick={() => onScreen('atendimento')}
          initial={reduced ? false : { opacity: 0, scale: 0.8, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 6, transition: exitFast }}
          whileTap={reduced ? undefined : press}
          transition={springSoft}
          className="absolute right-4 z-20 flex h-[54px] w-[54px] items-center justify-center rounded-full"
          style={{
            bottom: (chrome ? IOS.safeBottom - 6 : 10) + 76,
            backgroundColor: SCREEN.green,
            boxShadow: '0 8px 20px -6px rgba(0,0,0,0.7)',
          }}
          aria-label="Abrir atendimento"
        >
          <MessageCircle className="h-[26px] w-[26px]" style={{ color: '#04240f' }} />
        </motion.button>
        )}
      </AnimatePresence>

      <TabBar screen={screen} onScreen={onScreen} chrome={chrome} />
    </div>
  );
}
