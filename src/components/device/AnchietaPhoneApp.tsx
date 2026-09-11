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
  Rocket,
  ScrollText,
  Settings,
  ShieldCheck,
  TriangleAlert,
  WalletCards,
} from 'lucide-react';
import type { Discipline, TimelineItem, TrilhaModel, TrilhaStep } from '../../types';
import { IOS, IosStatusBar } from './IPhone';
import { AnchietaLogo } from '../brand/AnchietaLogo';
import { longDay, weekdayOf } from '../../lib/calendarDates';
import {
  PLACE_LABEL,
  bucketsOf,
  countdownPhrase,
  datePhrase,
  nextBadge,
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
} as const;

/** O degradê do cabeçalho. Azul institucional, não o azul do sistema operacional. */
const HEADER_BG =
  'radial-gradient(125% 95% at 14% -10%, #1670c9 0%, #0b5199 42%, #073d76 74%, #052f5c 100%)';

export type PhoneScreen =
  | 'inicio'
  | 'datas'
  | 'trilha'
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
  horarios: 1,
  datas: 2,
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
    .filter((disc) => scheduleDays(disc.schedule).includes(weekday))
    .map((discipline) => ({ discipline, time: scheduleTime(discipline.schedule) }));
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
  chrome,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
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
        Início
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

function ConsequenceDot({ item }: { item: TimelineItem }) {
  const color =
    item.consequence === 'irrecuperavel'
      ? SCREEN.crit
      : item.consequence === 'alta'
        ? SCREEN.warn
        : SCREEN.ink3;
  return (
    <span
      className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

function DatesScreen({
  model,
  onScreen,
  chrome,
}: {
  model: TrilhaModel;
  onScreen: (s: PhoneScreen) => void;
  chrome: boolean;
}) {
  const buckets = bucketsOf(model);
  const [mode, setMode] = useState<'proximas' | 'mes'>('proximas');
  const [filter, setFilter] = useState<'tudo' | 'prova' | 'prazo' | 'aula'>('tudo');
  const [nextOpen, setNextOpen] = useState(false);
  const upcoming = [...buckets.agora, ...buckets.guardado];
  const filtered = upcoming.filter((item) => filter === 'tudo' || item.category === filter);
  const next = upcoming[0];

  const dateParts = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return {
      day: String(day).padStart(2, '0'),
      month: date.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '').toUpperCase(),
      monthLong: date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    };
  };

  const filters = [
    { value: 'tudo' as const, label: 'Tudo' },
    { value: 'prova' as const, label: 'Provas' },
    { value: 'prazo' as const, label: 'Prazos' },
    { value: 'aula' as const, label: 'Aulas' },
  ];
  const months = Array.from(new Set(filtered.map((item) => dateParts(item.start).monthLong)));

  return (
    <ScreenShell chrome={chrome} simulated={model.delta.simulated}>
      <div className="px-5 pb-[62px]" style={{ backgroundImage: HEADER_BG, paddingTop: chrome ? IOS.safeTop : 18 }}>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => onScreen('inicio')} aria-label="Voltar ao início" className="-ml-2 flex h-10 w-10 items-center justify-center" style={{ color: SCREEN.ink }}><ChevronLeft className="h-7 w-7" /></button>
          <div className="min-w-0 flex-1"><h1 className="text-[27px] leading-none font-bold" style={{ color: SCREEN.ink }}>Minhas datas</h1><p className="mt-2 text-[17px] leading-none" style={{ color: 'rgba(255,255,255,0.86)' }}>O que vem pela frente</p></div>
          <button type="button" onClick={() => onScreen('completo')} aria-label="Abrir calendário completo" className="flex h-11 w-11 items-center justify-center rounded-full" style={{ color: SCREEN.ink }}><CalendarRange className="h-7 w-7" /></button>
        </div>
      </div>

      <div className="space-y-4 px-4" style={{ marginTop: -43 }}>
        {next && (
          <div className="rounded-[22px] border p-5" style={{ background: 'linear-gradient(135deg, #202123 0%, #151617 100%)', borderColor: SCREEN.line, boxShadow: '0 16px 34px rgba(0,0,0,0.32)' }}>
            <div className="flex items-start gap-3"><CalendarDays className="mt-0.5 h-5 w-5 shrink-0" style={{ color: SCREEN.ink2 }} /><div className="min-w-0"><p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: SCREEN.ink2 }}>Próxima data</p><p className="mt-1 text-[18px] font-semibold" style={{ color: SCREEN.ink }}>{capitalize(datePhrase(next))}</p></div></div>
            <div className="mt-4 inline-flex rounded-[10px] bg-[#087fea] px-4 py-2 text-[12px] font-semibold uppercase text-white">{nextBadge(next)}</div>
            <p className="mt-3 text-[19px] leading-tight font-semibold" style={{ color: SCREEN.ink }}>{next.title}</p>
            {next.lines.slice(0, 2).map((line) => <p key={line} className="mt-1.5 text-[13px] leading-snug" style={{ color: SCREEN.ink2 }}>{line}</p>)}
            <div className="mt-4 flex items-center justify-between border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>
              <span className="flex items-center gap-2 text-[14px]" style={{ color: SCREEN.ink }}><CalendarDays className="h-[18px] w-[18px]" />{countdownPhrase(next.inDays)}</span>
              <button type="button" onClick={() => setNextOpen((value) => !value)} className="flex items-center gap-1 text-[14px] font-medium" style={{ color: SCREEN.link }}>{nextOpen ? 'Ocultar detalhes' : 'Ver detalhes'}<ChevronRight className={`h-4 w-4 transition-transform ${nextOpen ? 'rotate-90' : ''}`} /></button>
            </div>
            {nextOpen && <div className="mt-3 rounded-xl p-3 text-[11px] leading-relaxed" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: SCREEN.ink2 }}><span style={{ color: SCREEN.ink3 }}>No calendário oficial: </span>«{next.officialTitle}»</div>}
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
              semestre é publicado perto dessa data — mostrar agora as datas de outro semestre
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

        {upcoming.length > 0 && <>
          <div className="flex rounded-[22px] border p-1" style={{ backgroundColor: SCREEN.card, borderColor: 'rgba(255,255,255,0.16)' }}>
            {([{ value: 'proximas' as const, label: 'Próximas' }, { value: 'mes' as const, label: 'Mês' }]).map((option) => <button key={option.value} type="button" onClick={() => setMode(option.value)} className="flex-1 rounded-[18px] py-2.5 text-[14px] font-semibold" style={{ color: SCREEN.ink, background: mode === option.value ? 'linear-gradient(90deg,#087fea,#0670d5)' : 'transparent' }}>{option.label}</button>)}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {filters.map((option) => <button key={option.value} type="button" onClick={() => setFilter(option.value)} className="rounded-full border py-2 text-[12px]" style={{ color: SCREEN.ink, borderColor: filter === option.value ? '#087fea' : 'rgba(255,255,255,0.14)', backgroundColor: filter === option.value ? 'rgba(8,127,234,0.32)' : SCREEN.card }}>{option.label}</button>)}
          </div>

          <section className="min-w-0 overflow-hidden pt-2">
            <h2 className="text-[20px] font-bold" style={{ color: SCREEN.ink }}>{mode === 'proximas' ? 'Sua linha do tempo' : 'Datas por mês'}</h2>
            {filtered.length === 0 ? <p className="mt-4 text-[13px]" style={{ color: SCREEN.ink2 }}>Nenhuma data nesta categoria.</p> : mode === 'proximas' ? (
              <div className="relative mt-4 space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[42px] before:w-px before:bg-white/20">
                {filtered.map((item) => {
                  const part = dateParts(item.start);
                  return (
                    <div key={item.id} className="relative grid w-full min-w-0 grid-cols-[52px_minmax(0,1fr)] gap-2.5">
                      <div className="min-w-0 pt-2">
                        <p className="text-[21px] leading-none font-bold" style={{ color: SCREEN.ink }}>{part.day}</p>
                        <p className="mt-1 text-[10px]" style={{ color: SCREEN.ink2 }}>{part.month}</p>
                        <span className="absolute top-3 left-[35px] h-4 w-4 rounded-full border-[4px] border-[#064d91] bg-[#1689f4]" />
                      </div>
                      <button
                        type="button"
                        onClick={() => onScreen('completo')}
                        className="flex w-full min-w-0 max-w-full items-center gap-2.5 overflow-hidden rounded-[17px] border p-3 text-left"
                        style={{ background: 'linear-gradient(135deg,#202123,#171819)', borderColor: SCREEN.line }}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center" style={{ color: SCREEN.ink }}>
                          {item.category === 'prova' ? <BookOpen className="h-5 w-5" /> : item.category === 'aula' ? <GraduationCap className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                        </span>
                        <span className="min-w-0 flex-1 overflow-hidden">
                          <span className="line-clamp-2 block text-[13px] leading-snug font-semibold" style={{ color: SCREEN.ink }}>{item.title}</span>
                          <span className="mt-0.5 block truncate text-[11px]" style={{ color: SCREEN.ink2 }}>{item.lines[0] ?? CATEGORY_LABEL[item.category]}</span>
                          <span className="mt-1 flex items-center gap-1 text-[10.5px]" style={{ color: SCREEN.ink2 }}><Clock3 className="h-3 w-3 shrink-0" />{countdownPhrase(item.inDays)}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0" style={{ color: SCREEN.ink3 }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 space-y-3">{months.map((month) => <div key={month} className="rounded-[17px] p-4" style={{ backgroundColor: SCREEN.card }}><p className="text-[13px] font-semibold capitalize" style={{ color: SCREEN.ink }}>{month}</p><div className="mt-3 space-y-2">{filtered.filter((item) => dateParts(item.start).monthLong === month).map((item) => <button key={item.id} type="button" onClick={() => onScreen('completo')} className="flex w-full items-center gap-3 border-t pt-2 text-left" style={{ borderColor: SCREEN.line }}><span className="w-8 font-mono text-[12px]" style={{ color: SCREEN.link }}>{dateParts(item.start).day}</span><span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: SCREEN.ink }}>{item.title}</span><ChevronRight className="h-4 w-4" style={{ color: SCREEN.ink3 }} /></button>)}</div></div>)}</div>
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
              Você está vendo <strong>{model.shownCount}</strong> das{' '}
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
   Comece por aqui
   ========================================================================== */

function StepIcon({ step, className = 'h-6 w-6' }: { step: TrilhaStep; className?: string }) {
  if (step.place === 'ava' || step.place === 'portal') return <BookOpen className={className} />;
  if (step.place === 'app') return <ClipboardList className={className} />;
  if (step.place === 'campus') return <GraduationCap className={className} />;
  if (step.place === 'financeiro') return <Banknote className={className} />;
  return <FileText className={className} />;
}

function StepRow({ step, index }: { step: TrilhaStep; index: number }) {
  const status = step.done ? 'Concluído' : index === 0 ? 'Em andamento' : 'Próximo';
  return (
    <div className="relative grid grid-cols-[42px_1fr] items-center gap-3">
      <span
        className="relative z-10 flex h-[25px] w-[25px] items-center justify-center justify-self-center rounded-full border-[4px] text-[12px] font-semibold"
        style={{
          backgroundColor: step.done ? SCREEN.vital : index === 0 ? '#1689f4' : '#161718',
          borderColor: step.done ? SCREEN.vital : index === 0 ? '#07569f' : '#8d9299',
          color: step.done ? '#ffffff' : SCREEN.ink,
        }}
      >
        {step.done ? <Check className="h-[14px] w-[14px]" strokeWidth={3} /> : index === 0 ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
      </span>
      <div className="relative flex min-w-0 items-center gap-3 rounded-[16px] border px-4 py-3 before:absolute before:top-1/2 before:-left-2 before:h-4 before:w-4 before:-translate-y-1/2 before:rotate-45 before:border-b before:border-l" style={{ background: 'linear-gradient(135deg,#202123,#171819)', borderColor: SCREEN.line, ['--tw-border-opacity' as string]: 1 }}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center" style={{ color: SCREEN.ink }}><StepIcon step={step} /></span>
        <span className="min-w-0 flex-1"><span className="block text-[14px] leading-snug font-semibold" style={{ color: SCREEN.ink }}>{step.title}</span><span className="mt-0.5 block text-[12px]" style={{ color: step.done ? SCREEN.ink2 : index === 0 ? SCREEN.ink2 : SCREEN.ink3 }}>{status}</span></span>
      </div>
    </div>
  );
}

function TrailScreen({
  model,
  onScreen,
  chrome,
}: {
  model: TrilhaModel;
  onScreen: (s: PhoneScreen) => void;
  chrome: boolean;
}) {
  const progress = stepProgress(model.steps);
  const pct = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100);
  const complete = progress.done === progress.total && progress.total > 0;
  const nextStepIndex = model.steps.findIndex((step) => !step.done);
  const nextStep = nextStepIndex >= 0 ? model.steps[nextStepIndex] : undefined;
  const [actionOpen, setActionOpen] = useState(false);

  return (
    <ScreenShell chrome={chrome} simulated={model.delta.simulated}>
      <div className="px-5 pb-[62px]" style={{ backgroundImage: HEADER_BG, paddingTop: chrome ? IOS.safeTop : 18 }}>
        <div className="flex items-center gap-4"><button type="button" onClick={() => onScreen('inicio')} aria-label="Voltar ao início" className="-ml-2 flex h-10 w-10 items-center justify-center" style={{ color: SCREEN.ink }}><ChevronLeft className="h-7 w-7" /></button><div className="min-w-0 flex-1"><h1 className="text-[26px] leading-none font-bold" style={{ color: SCREEN.ink }}>Comece por aqui</h1><p className="mt-2 text-[16px] leading-none" style={{ color: 'rgba(255,255,255,0.86)' }}>Sua jornada na UniAnchieta</p></div><span className="flex h-12 w-12 items-center justify-center rounded-full border-2" style={{ color: SCREEN.vital, borderColor: 'rgba(255,255,255,0.8)' }}><Rocket className="h-6 w-6" /></span></div>
      </div>

      <div className="px-4" style={{ marginTop: -43 }}>
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

        {/* A tela de conclusão. Uma trilha que some sem dizer nada parece
            defeito; esta se despede e explica onde continua achável. */}
        {complete && (
          <div
            className="mt-4 rounded-[15px] p-4"
            style={{ backgroundColor: 'rgba(50,213,131,0.12)' }}
          >
            <p className="text-[15px] font-semibold" style={{ color: SCREEN.vital }}>
              Você concluiu a trilha de entrada
            </p>
            <p className="mt-1.5 text-[12px] leading-snug" style={{ color: SCREEN.ink2 }}>
              O atalho «Comece por aqui» sai da tela inicial a partir de agora. Ele continua no
              menu, se você quiser revisar algum passo.
            </p>
          </div>
        )}

        {nextStep && <section className="mt-5"><h2 className="text-[20px] font-bold" style={{ color: SCREEN.ink }}>Próximo passo</h2><div className="mt-3 rounded-[20px] border p-4" style={{ background: 'linear-gradient(135deg,#202123,#171819)', borderColor: 'rgba(255,255,255,0.14)' }}><span className="inline-flex rounded-[10px] bg-[#087fea] px-4 py-2 text-[11px] font-semibold uppercase text-white">Próximo passo</span><div className="mt-4 flex items-start gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center" style={{ color: SCREEN.ink }}><StepIcon step={nextStep} className="h-10 w-10" /></span><div className="min-w-0"><p className="text-[18px] leading-snug font-semibold" style={{ color: SCREEN.ink }}>{nextStep.title}</p><p className="mt-1 text-[13px] leading-snug" style={{ color: SCREEN.ink2 }}>{nextStep.action}</p><p className="mt-2 flex items-center gap-1.5 text-[12px]" style={{ color: SCREEN.ink2 }}><Clock3 className="h-4 w-4" />{PLACE_LABEL[nextStep.place]}</p></div></div><button type="button" onClick={() => nextStep.title.toLowerCase().includes('data') ? onScreen('datas') : setActionOpen((value) => !value)} className="mt-4 w-full rounded-[13px] bg-[#087fea] py-3 text-[16px] font-semibold text-white">{nextStep.place === 'ava' ? 'Abrir AVA' : nextStep.place === 'app' ? 'Abrir no aplicativo' : nextStep.title.toLowerCase().includes('data') ? 'Ver minhas datas' : 'Ver como fazer'}</button>{actionOpen && <p className="mt-3 rounded-xl p-3 text-[12px] leading-relaxed" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: SCREEN.ink2 }}>{nextStep.action}</p>}</div></section>}

        <section className="mt-5"><h2 className="text-[20px] font-bold" style={{ color: SCREEN.ink }}>Sua jornada</h2><div className="relative mt-4 space-y-2.5 before:absolute before:top-4 before:bottom-4 before:left-[21px] before:w-[3px] before:bg-white/20">{model.steps.map((step, index) => <StepRow key={step.id} step={step} index={index - Math.max(nextStepIndex, 0)} />)}</div></section>

        <p className="mt-5 text-center text-[12px]" style={{ color: SCREEN.ink2 }}>Seu progresso é salvo automaticamente.</p>
      </div>
    </ScreenShell>
  );
}

/* ==========================================================================
   Calendário completo — a tela que o contador abre
   ========================================================================== */

const BUCKET_TITLE: Record<string, string> = {
  agora: 'No seu radar agora',
  guardado: 'Prazos guardados',
  passado: 'Já aconteceu',
  recolhido: 'Não se aplica a você agora',
};

function FullCalendarScreen({
  model,
  onScreen,
  chrome,
}: {
  model: TrilhaModel;
  onScreen: (s: PhoneScreen) => void;
  chrome: boolean;
}) {
  const buckets = bucketsOf(model);
  const order: Array<keyof typeof buckets> = ['agora', 'guardado', 'recolhido', 'passado'];

  return (
    <ScreenShell chrome={chrome} simulated={model.delta.simulated}>
      <InnerHeader
        chrome={chrome}
        onBack={() => onScreen('datas')}
        title="Calendário completo"
        subtitle={`Todas as ${model.totalCount} datas de ${
          model.resolution.calendar?.shortName ?? 'seu curso'
        }, inclusive as que não entram no seu resumo.`}
      />

      <div className="space-y-5 px-5 pt-5">
        {order.map((key) => {
          const list = buckets[key];
          if (list.length === 0) return null;
          return (
            <section key={key}>
              <h2
                className="mb-2 flex items-baseline justify-between text-[13px] font-semibold tracking-wide uppercase"
                style={{ color: SCREEN.ink3 }}
              >
                {BUCKET_TITLE[key]}
                <span className="text-[11px] normal-case">{list.length}</span>
              </h2>
              <div className="space-y-1.5">
                {list.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[13px] px-3.5 py-2.5"
                    style={{ backgroundColor: SCREEN.card }}
                  >
                    <div className="flex items-start gap-2.5">
                      <ConsequenceDot item={item} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-snug font-medium" style={{ color: SCREEN.ink }}>
                          {item.title}
                        </p>
                        <p className="text-[11px]" style={{ color: SCREEN.ink2 }}>
                          {datePhrase(item)}
                        </p>
                        {item.hiddenReason && (
                          <p className="mt-1 text-[11px] italic" style={{ color: SCREEN.ink3 }}>
                            {item.hiddenReason}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {model.resolution.calendar && (
          <a
            href={model.resolution.calendar.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-[15px] p-4"
            style={{ backgroundColor: SCREEN.cardHi }}
          >
            <p className="text-[13px] leading-snug" style={{ color: SCREEN.ink }}>
              O documento oficial é o calendário publicado pela instituição.
            </p>
            <p className="mt-1 text-[12px]" style={{ color: SCREEN.ink2 }}>
              {model.resolution.calendar.name}
            </p>
            <span className="mt-2 inline-block text-[13px]" style={{ color: SCREEN.link }}>
              Abrir o PDF oficial
            </span>
          </a>
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
    screen === 'datas' || screen === 'completo'
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
        return <DatesScreen model={model} onScreen={onScreen} chrome={chrome} />;
      case 'trilha':
        return <TrailScreen model={model} onScreen={onScreen} chrome={chrome} />;
      case 'completo':
        return <FullCalendarScreen model={model} onScreen={onScreen} chrome={chrome} />;
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
