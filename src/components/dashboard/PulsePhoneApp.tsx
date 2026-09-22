import { useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Check, ChevronRight, Minus } from 'lucide-react';
import type { CockpitSnapshot } from '../../lib/cockpit';
import type { PulseModel, SignalMovement } from '../../lib/pulse';
import type { SignalKey } from '../../data/institution';
import { IOS, IosStatusBar } from '../device/IPhone';
import { emphasis, spring } from '../../lib/motion';
import { useReducedMotion } from '../../lib/reactive';
import { decimal, int } from '../../lib/format';

/* ==========================================================================
   Pulso — a aplicação que roda dentro do aparelho
   --------------------------------------------------------------------------
   A pergunta que justifica um iPhone de 900px numa tela de gestão não é "fica
   bonito?", é "o que ele faz que um card não faz". A resposta aqui é concreta:
   ELE É O CONTROLE DA PÁGINA. Tocar num sinal dentro do aparelho recorta o
   dashboard inteiro atrás dele; tocar num widget abre o detalhe daquele
   indicador na própria aba. O objeto não ilustra o painel, ele o pilota.

   É também por isso que nada aqui abre outra rota. Quem lê esta tela é a
   gestão, e a gestão não quer ser jogada na Fila de Atendimento — que é a
   ferramenta do atendente — para descobrir por que um número subiu. Todo
   caminho a partir do aparelho termina dentro do Dashboard.

   As cores são literais em vez de tokens, e este é o único lugar do sistema
   onde isso é correto: a tela de um aparelho é uma fonte de luz própria e não
   inverte junto com o tema da página. O contraste foi conferido contra o preto
   do display, não contra `--surface`.
   ========================================================================== */

/** Paleta da tela. Aferida sobre o preto do display, não sobre `--surface`. */
const SCREEN = {
  vital: '#32d583',
  warn: '#f5b459',
  /** A faixa laranja do Health Score. Só a pizza de risco a usa. */
  risk: '#f0844a',
  crit: '#f4776b',
  info: '#4cc2f1',
  ink: '#ffffff',
} as const;

type WidgetTone = keyof typeof SCREEN;

/** Token de faixa do Health Score → cor aferida sobre o preto do display. */
const BAND_TONE: Record<string, WidgetTone> = {
  ok: 'vital',
  warn: 'warn',
  risk: 'risk',
  crit: 'crit',
};

/** O que o aparelho pode pedir para o Dashboard abrir, sem sair da aba. */
export type DrillKey = 'alto-risco' | 'atencao' | 'retencao' | 'sla' | 'intervencoes';

type Board = 'risco' | 'operacao';

export interface PulsePhoneAppProps {
  snapshot: CockpitSnapshot;
  pulse: PulseModel;
  signals: SignalMovement[];
  scopeLabel: string;
  /** O sinal que recorta a página, quando há um. */
  focusKey: SignalKey | null;
  onToggleSignal: (key: SignalKey) => void;
  onOpenDrill: (key: DrillKey) => void;
  /**
   * `false` remove a barra de status e a safe area do aparelho.
   *
   * Abaixo de 1280px a mesma aplicação é servida dentro de um card, sem
   * chassi — e uma barra de status com hora, sinal e bateria dentro de um
   * card de dashboard não é fidelidade, é um adesivo de iPhone colado num
   * lugar que não é um iPhone.
   */
  chrome?: boolean;
}

export function PulsePhoneApp({
  snapshot,
  pulse,
  signals,
  scopeLabel,
  focusKey,
  onToggleSignal,
  onOpenDrill,
  chrome = true,
}: PulsePhoneAppProps) {
  const [board, setBoard] = useState<Board>('risco');
  const { cases, base, operations } = snapshot;

  /* -- A aba Risco: uma pizza, não quatro copos --------------------------
     Os quatro widgets de líquido respondiam quatro perguntas soltas — uma
     taxa, dois estoques e outra taxa — empilhadas numa grade porque a grade
     existia, não porque as quatro se comparassem. Comparar a altura do copo
     de "Estabilização 69,7%" com a de "Alto risco 30" não significa nada: são
     unidades diferentes sobre denominadores diferentes.

     A pergunta da aba é "como a base está repartida por risco", e essa é uma
     pergunta de parte-todo: uma população, quatro faixas, soma 100%. É a
     única forma em que a pizza é a resposta certa em vez do gráfico padrão —
     e é o único gráfico desta tela onde os quatro pedaços dividem literalmente
     o mesmo total.

     As três taxas que os copos carregavam não sumiram: descem para a régua
     compacta sob a legenda, onde continuam sendo o mesmo toque para o mesmo
     detalhe. A aba Operação segue em widgets porque lá os quatro números são
     de fato quatro medidas independentes do turno. */
  const bands = useMemo(
    () =>
      snapshot.bands.map((band) => ({
        key: band.token,
        label: band.label,
        value: band.count,
        color: SCREEN[BAND_TONE[band.token] ?? 'info'],
        range: `${band.range[0]}–${band.range[1]}`,
      })),
    [snapshot.bands],
  );

  /* A régua sob a legenda. Três medidas, três destinos — os mesmos que os
     widgets antigos abriam. */
  const rails: RailSpec[] = useMemo(
    () => [
      {
        key: 'sla',
        label: 'Contato no prazo',
        value: decimal(pulse.hero.value, 1),
        suffix: '%',
        tone: 'vital',
      },
      /* "Casos de alto risco" por extenso, e não "Alto risco", porque a
         legenda da pizza logo acima tem uma FAIXA com esse nome. São 605
         alunos com score entre 41 e 60 ali e 30 casos abertos aqui — o mesmo
         rótulo para os dois números é o erro de leitura que o resto do
         Dashboard já corrigiu, e ele não pode voltar dentro do aparelho. */
      {
        key: 'alto-risco',
        label: 'Casos de alto risco',
        value: int(cases.highRisk),
        tone: 'crit',
      },
      /* Era "Retenção projetada", com uma casa decimal e um sinal de porcentagem.
         `snapshot.retention` é uma CONTAGEM — os casos de alto risco roteados
         para a fila especializada —, então o aparelho imprimia "11,0%" para um
         número que significa onze casos, sob um rótulo que prometia projeção. O
         funil da mesma página sempre chamou isso de "Roteados para Retenção", e
         é esse o nome correto. */
      {
        key: 'retencao',
        label: 'Roteados para Retenção',
        value: int(snapshot.retention),
        tone: 'info',
      },
    ],
    [pulse.hero.value, cases.highRisk, snapshot.retention],
  );

  /* -- Os quatro widgets da Operação -------------------------------------
     Numa tela de 402pt a grade 2x2 é o limite: um quinto widget vira rolagem,
     e rolagem esconde metade da comparação que a grade existe para permitir. */
  const boards: Record<'operacao', WidgetSpec[]> = useMemo(() => {
    const received = Math.max(1, operations.received);

    return {
      operacao: [
        {
          key: 'sla',
          label: 'Fora do prazo',
          value: operations.outSla,
          fill: (operations.outSla / received) * 100,
          tone: operations.outSla > 0 ? 'warn' : 'vital',
          foot: `de ${int(operations.received)} recebidos`,
        },
        {
          key: 'intervencoes',
          label: 'Intervenções',
          value: operations.received,
          fill: (operations.concluded / received) * 100,
          tone: 'info',
          foot: `${int(operations.concluded)} com desfecho`,
        },
        {
          key: 'sla',
          label: 'Contato no prazo',
          value: operations.slaAdherence,
          decimals: 1,
          suffix: '%',
          fill: operations.slaAdherence,
          tone: operations.slaAdherence >= 90 ? 'vital' : 'warn',
          foot: `${int(operations.inSla)} no prazo`,
        },
        /* Era "Resolvido sem pessoa", a fatia da régua de ingressantes que
           terminava sem contato humano. Saiu junto com o bloco de automação do
           Dashboard: a régua depende de data de matrícula, turma e presença no
           primeiro dia, e nenhum desses dados existe nos sistemas hoje. No lugar
           entrou um estoque que o próprio sistema conta. */
        {
          key: 'atencao',
          label: 'Em atenção humana',
          value: cases.attention,
          fill: (cases.attention / Math.max(1, base.monitored)) * 100,
          tone: 'info',
          foot: `de ${int(base.monitored)} monitorados`,
        },
      ],
    };
  }, [operations, cases.attention, base.monitored]);

  const widgets = boards.operacao;

  return (
    <>
      {chrome && <IosStatusBar />}

      <div
        className="ios-scroll flex-1 overflow-y-auto"
        style={{
          paddingTop: chrome ? IOS.safeTop : 4,
          paddingBottom: chrome ? IOS.safeBottom + 12 : 16,
        }}
      >
        <div className="px-5">
          {/* -- Cabeçalho da aplicação ------------------------------------
              Título grande no padrão do sistema. O escopo vem logo abaixo
              porque o aparelho mostra o MESMO recorte da página — sem essa
              linha, dois números diferentes na mesma dobra pareceriam
              divergência de fonte em vez de diferença de filtro. */}
          <header className="pt-3">
            <p className="text-[13px] font-medium text-white/45">
              {new Date().toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
              })}
            </p>
            <h3 className="mt-0.5 text-[34px] leading-[1.05] font-bold tracking-[-0.03em] text-white">
              Pulso
            </h3>
            <p className="mt-1.5 truncate text-[12.5px] text-white/55">{scopeLabel}</p>
          </header>

          <div className="mt-4">
            <PhoneSegmented
              value={board}
              onChange={setBoard}
              options={[
                { value: 'risco', label: 'Risco' },
                { value: 'operacao', label: 'Operação' },
              ]}
            />
          </div>

          {board === 'risco' ? (
            /* -- A repartição da base por faixa de risco ------------------
                Uma pizza sobre um total, e a legenda ao lado dando o número
                exato — ninguém tira "1.741" de um arco, e ninguém vê "24%
                contra 8%" numa coluna de dígitos. */
            <PhoneRiskPie
              slices={bands}
              total={base.monitored}
              rails={rails}
              onOpenDrill={onOpenDrill}
            />
          ) : (
            /* -- A grade de widgets --------------------------------------
                O líquido é a leitura primária e o número é a confirmação. Por
                isso os quatro dividem a mesma altura: comparar colunas só
                funciona quando os copos têm o mesmo tamanho. */
            <div className="mt-3.5 grid grid-cols-2 gap-3">
              {widgets.map((w, i) => (
                <PhoneWidget
                  key={`${w.key}-${w.label}`}
                  spec={w}
                  delay={i * 0.07}
                  onClick={() => onOpenDrill(w.key)}
                />
              ))}
            </div>
          )}

          {/* -- Sinais: o controle de verdade ------------------------------ */}
          <section className="mt-6">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-[15px] font-semibold tracking-[-0.01em] text-white">
                Sinais do ciclo
              </h4>
              {focusKey && (
                <button
                  type="button"
                  onClick={() => onToggleSignal(focusKey)}
                  className="text-[12px] font-medium"
                  style={{ color: SCREEN.info }}
                >
                  limpar
                </button>
              )}
            </div>
            <ul className="mt-3 overflow-hidden rounded-[26px] bg-white/[0.06]">
              {signals.map((s, i) => (
                <SignalRow
                  key={s.key}
                  signal={s}
                  active={focusKey === s.key}
                  first={i === 0}
                  onClick={() => onToggleSignal(s.key as SignalKey)}
                />
              ))}
            </ul>
          </section>

        </div>
      </div>
    </>
  );
}

/* -- A pizza de risco -----------------------------------------------------
   Um donut desenhado à mão em vez do `ui/Charts`, e o motivo é o mesmo que
   justifica as cores literais no topo deste arquivo: aquele componente lê
   `var(--track)` e `text-ink`, que invertem com o tema da página. A tela de um
   aparelho não inverte. Um donut com trilho claro sobre um display preto não
   seria consistência de design system, seria um buraco branco no meio do
   celular.

   Escolhas de forma, todas medidas na tela de 402pt:

     · FURO GRANDE (espessura 22 num diâmetro de 176). O furo carrega o total,
       que é o denominador de toda a legenda — sem ele a pizza mostra
       proporção e esconde escala, e "24% em atenção" sobre 400 alunos é uma
       reunião diferente de 24% sobre 9.000.
     · SEM RÓTULO NO ARCO. Quatro rótulos girados dentro de 176px viram ruído.
       O número exato mora na legenda, alinhado em coluna, onde se compara.
     · A LEGENDA É A LISTA DE TOQUE. O arco de 4% é um alvo de toque
       impossível; a linha da legenda tem altura de toque do sistema e é ela
       que abre o detalhe. O arco continua clicável para quem mira nele, mas
       nunca é o único caminho.
*/

interface RailSpec {
  key: DrillKey;
  label: string;
  /** Já formatado — a régua não decide casas decimais, só as imprime. */
  value: string;
  suffix?: string;
  tone: WidgetTone;
}

interface RiskSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  /** A faixa de Health Score que define a fatia. */
  range: string;
}

const PIE_SIZE = 176;
const PIE_THICKNESS = 22;

/** As duas primeiras faixas são leitura da base; as duas últimas, alto risco. */
function bandDrill(index: number): DrillKey {
  return index >= 2 ? 'alto-risco' : 'atencao';
}

function PhoneRiskPie({
  slices,
  total,
  rails,
  onOpenDrill,
}: {
  slices: RiskSlice[];
  total: number;
  rails: RailSpec[];
  onOpenDrill: (key: DrillKey) => void;
}) {
  const reduced = useReducedMotion();
  const radius = (PIE_SIZE - PIE_THICKNESS) / 2;
  const circumference = 2 * Math.PI * radius;
  const sum = slices.reduce((acc, sl) => acc + sl.value, 0);

  /* O denominador é a SOMA DAS FATIAS, não `total`. As duas são a mesma
     população, mas se um dia divergirem por arredondamento é a soma que fecha
     o círculo — e um donut que não fecha é um erro que o olho vê antes de
     qualquer auditoria. */
  const denominator = Math.max(1, sum);

  const arcs = useMemo(() => {
    let walked = 0;
    return slices.map((sl) => {
      const fraction = sl.value / denominator;
      const arc = {
        ...sl,
        percent: fraction * 100,
        dash: fraction * circumference,
        offset: -walked * circumference,
      };
      walked += fraction;
      return arc;
    });
  }, [slices, denominator, circumference]);

  if (sum === 0) {
    return (
      <p className="mt-6 py-10 text-center text-[12px] text-white/45">
        Nenhum aluno monitorado neste recorte.
      </p>
    );
  }

  return (
    <section className="mt-4">
      <div className="flex justify-center">
        <div className="relative" style={{ width: PIE_SIZE, height: PIE_SIZE }}>
          <svg
            width={PIE_SIZE}
            height={PIE_SIZE}
            className="-rotate-90"
            role="img"
            aria-label={"Distribuição de " + int(sum) + " alunos monitorados por faixa de Health Score"}
          >
            <circle
              cx={PIE_SIZE / 2}
              cy={PIE_SIZE / 2}
              r={radius}
              fill="none"
              stroke="rgb(255 255 255 / 0.07)"
              strokeWidth={PIE_THICKNESS}
            />
            {arcs.map((arc, i) => (
              <motion.circle
                key={arc.key}
                cx={PIE_SIZE / 2}
                cy={PIE_SIZE / 2}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={PIE_THICKNESS}
                strokeDashoffset={arc.offset}
                initial={{ strokeDasharray: "0 " + circumference }}
                animate={{ strokeDasharray: arc.dash + " " + circumference }}
                transition={
                  reduced ? { duration: 0 } : { duration: 0.7, ease: emphasis, delay: i * 0.06 }
                }
                onClick={() => onOpenDrill(bandDrill(i))}
                style={{ cursor: 'pointer' }}
              >
                <title>{arc.label + ": " + int(arc.value) + " (" + decimal(arc.percent, 1) + "%)"}</title>
              </motion.circle>
            ))}
          </svg>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-[26px] leading-none font-medium tracking-tight text-white tabular">
              {int(total)}
            </span>
            <span className="mt-1 text-[10.5px] font-medium text-white/45">monitorados</span>
          </div>
        </div>
      </div>

      <ul className="mt-4 overflow-hidden rounded-[22px] bg-white/[0.05]">
        {arcs.map((arc, i) => (
          <li key={arc.key}>
            <button
              type="button"
              onClick={() => onOpenDrill(bandDrill(i))}
              className="flex min-h-[44px] w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-white/[0.05]"
              style={{
                boxShadow: i === 0 ? undefined : 'inset 0 0.5px 0 0 rgb(255 255 255 / 0.07)',
              }}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: arc.color }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-white/90">
                  {arc.label}
                </span>
                <span className="block font-mono text-[10px] text-white/35 tabular">
                  score {arc.range}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[13.5px] font-semibold text-white tabular">
                {int(arc.value)}
              </span>
              <span className="w-[46px] shrink-0 text-right font-mono text-[11px] text-white/45 tabular">
                {decimal(arc.percent, 1)}%
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* A régua das três taxas. Os widgets que saíram viram uma linha de
          altura de toque, e cada uma abre o MESMO detalhe que abria antes. */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {rails.map((rail) => (
          <button
            key={rail.label}
            type="button"
            onClick={() => onOpenDrill(rail.key)}
            className="flex min-h-[74px] flex-col justify-between rounded-[18px] bg-white/[0.05] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.08]"
          >
            {/* Duas linhas em vez de `truncate`: em 107px "Casos de alto
                risco" truncado vira "Casos de alto ri…", que é pior que
                qualquer quebra de linha. */}
            <span className="text-[10.5px] leading-tight font-medium text-white/50">
              {rail.label}
            </span>
            <span className="mt-1 flex items-baseline gap-0.5">
              <span
                className="font-mono text-[17px] leading-none font-medium tabular"
                style={{ color: SCREEN[rail.tone] }}
              >
                {rail.value}
              </span>
              {rail.suffix && (
                <span className="text-[11px] font-medium" style={{ color: SCREEN[rail.tone] }}>
                  {rail.suffix}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* -- Widget de vidro com líquido ------------------------------------------
   A referência de widget de casa inteligente feita como controle: o valor em
   cima, o líquido subindo por trás do vidro, e a superfície do líquido com
   tensão em vez de ser um retângulo de cor.

   O `backdrop-filter` aqui é de 9px e a área é pequena — quatro deles custam
   menos que um único painel de vidro grande, e é essa conta que permite o
   material se repetir numa grade sem derrubar a taxa de quadros.
*/

/* O raio é lido do aparelho, não escolhido: no iOS um widget desta proporção
   tem o canto muito mais aberto que um card de web, e é esse raio generoso que
   faz a peça ler como objeto de sistema em vez de um cartão de dashboard
   colado numa tela de celular. Ele mora numa constante porque a lista de
   sinais logo abaixo tem de acompanhar — dois raios diferentes na mesma tela
   de 402pt aparecem como desalinho, não como hierarquia. */
const WIDGET_SHAPE =
  'relative flex h-[148px] flex-col overflow-hidden rounded-[30px] bg-white/[0.05] p-3.5 text-left';

interface WidgetSpec {
  key: DrillKey;
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  fill: number;
  tone: WidgetTone;
  foot: string;
}

function PhoneWidget({
  spec,
  delay,
  onClick,
}: {
  spec: WidgetSpec;
  delay: number;
  onClick: () => void;
}) {
  const reduced = useReducedMotion();
  const color = SCREEN[spec.tone];
  const height = Math.max(0, Math.min(100, Number.isFinite(spec.fill) ? spec.fill : 0)) * 0.78 + 8;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={WIDGET_SHAPE}
    >
      {/* 1 — o líquido, atrás de tudo */}
      <motion.span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 z-0"
        initial={{ height: '8%' }}
        animate={{ height: `${height}%` }}
        transition={reduced ? { duration: 0 } : { duration: 0.8, ease: emphasis, delay }}
        style={{
          backgroundImage: `linear-gradient(to top, ${color}d9, ${color}66)`,
        }}
      >
        {/* a crista: uma elipse clara dá a tensão superficial que um retângulo
            de cor não dá */}
        <span
          className="absolute inset-x-0 -top-2 h-4 rounded-[50%]"
          style={{ background: 'rgb(255 255 255 / 0.42)', filter: 'blur(4px)' }}
        />
      </motion.span>

      {/* 2 — a lâmina de vidro */}
      <span className="ios-glass absolute inset-0 z-[1]" aria-hidden="true" />

      {/* 3 — o véu: texto jamais sobre líquido cru */}
      <span
        aria-hidden="true"
        className="absolute inset-0 z-[2]"
        style={{
          backgroundImage:
            'linear-gradient(to bottom, rgb(10 12 15 / 0.72) 0%, rgb(10 12 15 / 0.62) 46%, transparent 88%)',
        }}
      />

      <span className="relative z-[3] flex h-full flex-col">
        <span className="text-[11.5px] leading-tight font-medium text-white/60">{spec.label}</span>

        <span className="mt-1.5 flex items-baseline gap-0.5">
          <span
            className="font-mono text-[27px] leading-none font-medium tracking-tight tabular"
            style={{ color: spec.tone === 'ink' ? SCREEN.ink : color }}
          >
            {spec.decimals ? decimal(spec.value, spec.decimals) : int(spec.value)}
          </span>
          {spec.suffix && (
            <span className="text-[14px] font-medium" style={{ color }}>
              {spec.suffix}
            </span>
          )}
        </span>

        <span className="mt-auto flex items-end justify-between gap-1">
          <span className="text-[10.5px] leading-tight text-white/55">{spec.foot}</span>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-white/35" aria-hidden="true" />
        </span>
      </span>
    </motion.button>
  );
}

/* -- Linha de sinal --------------------------------------------------------
   O alvo de toque tem 52px, acima dos 44 do guia — dentro de um aparelho
   desenhado em escala real, respeitar a métrica de toque do próprio aparelho é
   a diferença entre um objeto correto e um objeto convincente. */

function SignalRow({
  signal,
  active,
  first,
  onClick,
}: {
  signal: SignalMovement;
  active: boolean;
  first: boolean;
  onClick: () => void;
}) {
  const rising = signal.delta > 0;
  const flat = signal.delta === 0;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className="flex min-h-[52px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
        style={{
          boxShadow: first ? undefined : 'inset 0 0.5px 0 0 rgb(255 255 255 / 0.08)',
          backgroundColor: active ? 'rgb(255 255 255 / 0.09)' : undefined,
        }}
      >
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors"
          style={{
            backgroundColor: active ? SCREEN.info : 'rgb(255 255 255 / 0.1)',
          }}
          aria-hidden="true"
        >
          {active && <Check className="h-3 w-3 text-black" strokeWidth={3} />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium text-white/90">
            {signal.label}
          </span>
          <span className="block truncate text-[10.5px] text-white/45">
            {int(signal.highRisk)} em alto risco
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-[14px] font-semibold text-white tabular">
            {int(signal.count)}
          </span>
          <span
            className="flex w-[46px] items-center justify-end gap-0.5 font-mono text-[10.5px] tabular"
            style={{ color: flat ? 'rgb(255 255 255 / 0.4)' : rising ? SCREEN.crit : SCREEN.vital }}
          >
            {flat ? (
              <Minus className="h-3 w-3" aria-hidden="true" />
            ) : (
              <>
                {rising ? '+' : '−'}
                {int(Math.abs(signal.delta))}
              </>
            )}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-white/25" aria-hidden="true" />
        </span>
      </button>
    </li>
  );
}

/* -- Segmentado do sistema ------------------------------------------------- */

function PhoneSegmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const reduced = useReducedMotion();

  /* O `layoutId` é gerado por INSTÂNCIA, e isso conserta um bug de verdade.
     `PulseDevice` monta esta aplicação duas vezes — uma dentro do aparelho e
     uma no card de fallback — e as duas ficam no DOM, apenas escondidas por
     breakpoint. Com um `layoutId` literal, dois nós vivos declaravam a mesma
     identidade de layout; a árvore de projeção do Motion passava a ter um nó
     órfão e a `AnimatePresence` de rota do shell nunca recebia o
     `onExitComplete` do Dashboard. Sintoma: sair do Dashboard para qualquer
     outra tela deixava a página em branco, porque a view antiga ficava presa
     em opacidade 0 e a nova nunca montava. */
  const layoutId = useId();

  return (
    <div
      role="tablist"
      className="flex w-full rounded-[14px] bg-white/[0.09] p-0.75"
      style={{ boxShadow: 'inset 0 0.5px 1px rgb(0 0 0 / 0.4)' }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className="relative flex-1 py-[7px] text-[13px] font-medium transition-colors"
            style={{ color: active ? '#fff' : 'rgb(255 255 255 / 0.55)' }}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={reduced ? { duration: 0 } : spring}
                className="absolute inset-0 rounded-[11px]"
                style={{
                  backgroundColor: 'rgb(118 124 134 / 0.62)',
                  boxShadow: '0 1px 2px rgb(0 0 0 / 0.4), inset 0 0.5px 0 rgb(255 255 255 / 0.2)',
                }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* -- Conteúdo da Live Activity, na ilha ------------------------------------
   Compacta, a ilha carrega o número que decide o turno. Expandida, ela explica
   por que ele é esse número e oferece o único caminho — que continua dentro da
   aba. É o padrão do sistema usado pelo que ele tem de bom: estado recente,
   sempre visível, sem ocupar a tela.
*/

export function PulseIslandCompact({ highRisk }: { highRisk: number }) {
  return {
    leading: (
      <span className="flex items-center gap-2">
        <span
          className="pulse-dot h-2 w-2 rounded-full"
          style={{ backgroundColor: SCREEN.vital, color: SCREEN.vital }}
        />
        <span className="text-[12.5px] font-semibold text-white">Pulso</span>
      </span>
    ) as ReactNode,
    trailing: (
      <span className="flex items-baseline gap-1">
        <span className="font-mono text-[13px] font-semibold text-white tabular">
          {int(highRisk)}
        </span>
        <span className="text-[10.5px] text-white/55">risco</span>
      </span>
    ) as ReactNode,
  };
}

export function PulseIslandExpanded({
  pulse,
  snapshot,
  onOpenDrill,
}: {
  pulse: PulseModel;
  snapshot: CockpitSnapshot;
  onOpenDrill: (key: DrillKey) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span
          className="pulse-dot h-2 w-2 rounded-full"
          style={{ backgroundColor: SCREEN.vital, color: SCREEN.vital }}
        />
        <span className="text-[12px] font-semibold text-white">Pulso agora</span>
        <span className="font-mono text-[11px] text-white/45">{pulse.windowLabel}</span>
      </div>

      <p className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-[30px] leading-none font-medium text-white tabular">
          {int(snapshot.cases.highRisk)}
        </span>
        <span className="text-[11.5px] leading-tight text-white/60">
          casos de alto risco
          <br />
          de {int(snapshot.cases.attention)} em atenção humana
        </span>
      </p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[11px] text-white/50">
          {snapshot.operations.outSla > 0
            ? `${int(snapshot.operations.outSla)} fora do prazo de 1º contato`
            : 'Nenhum caso fora do prazo'}
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onOpenDrill('sla');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onOpenDrill('sla');
            }
          }}
          className="shrink-0 rounded-full px-3 py-1 text-[11.5px] font-semibold text-black"
          style={{ backgroundColor: SCREEN.vital }}
        >
          Ver
        </span>
      </div>
    </div>
  );
}
