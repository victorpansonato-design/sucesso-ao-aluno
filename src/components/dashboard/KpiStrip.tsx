import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import type { CockpitPeriod, Kpi } from '../../lib/cockpit';
import { periodMeta } from '../../lib/cockpit';
import { AnimatedNumber, Sparkline } from '../ui/Charts';
import { Hint } from '../ui/Hint';
import { press } from '../../lib/motion';
import { decimal, int } from '../../lib/format';

/* ==========================================================================
   Faixa de indicadores primários
   --------------------------------------------------------------------------
   O diagnóstico da tela antiga foi "muitos blocos com peso visual semelhante",
   e cinco caixas idênticas lado a lado são a forma mais pura desse problema:
   com o mesmo corpo, a mesma moldura e o mesmo tratamento, o olho tem de LER os
   cinco para descobrir qual importa.

   A hierarquia aqui é estrutural, não decorativa:

     · UM indicador LÍDER, que dá a escala de tudo ("8.672 monitorados"), ocupa
       o dobro da largura e recebe o corpo maior. Ele responde "de quantos
       estamos falando?", que é a pergunta que precede todas as outras.
     · TRÊS indicadores de operação em corpo menor, divididos por fio de cabelo,
       cada um com a sua microtendência medida.
     · A TAXA DE ESTABILIZAÇÃO **não aparece aqui**. Ela é o protagonista em
       vidro do hero, e repeti-la nesta faixa seria exatamente o "repete números
       em formas diferentes" que o diagnóstico pediu para corrigir. Somando o
       hero, a primeira dobra tem cinco indicadores primários com cinco pesos
       diferentes — nenhum deles duas vezes.

   -- Por que esta faixa é LIMPA -----------------------------------------

   Uma versão intermediária desta faixa deu material a todas as cinco células:
   vidro, calibre e um líquido colorido por semântica — azul no líder, âmbar na
   atenção, vermelho no alto risco, verde nas intervenções. Estava errado por
   duas razões que valem ficar escritas:

     1. QUATRO MATIZES NUMA LINHA NÃO É HIERARQUIA, É UM ARCO-ÍRISO. A regra 4
        do sistema existe para isso — cor é conquistada. Com quatro células
        pintadas, nenhuma delas significava nada, e o vidro do hero perdia o
        posto de único objeto de material da dobra.
     2. O CALIBRE COMPETIA COM O NÚMERO. Nestes quatro indicadores o que
        interessa é o VALOR e a sua VARIAÇÃO, não a fração dele em relação a um
        denominador — e um preenchimento de fundo é uma leitura de fração. Ele
        respondia uma pergunta que ninguém tinha feito, atrás da resposta da
        pergunta que todos fazem.

   Então a faixa voltou a ser o que precisa ser: superfície clara, número em
   tinta, e AZUL — o azul institucional, o único do sistema — reservado ao
   indicador líder e ao fio da célula recortada. A variação continua colorida,
   porque ali a cor é semântica de uma palavra só: melhorou ou piorou.
   ========================================================================== */

export interface KpiCell {
  kpi: Kpi;
  /** Série curta medida. `undefined` = sem série; não desenha sparkline. */
  spark?: number[];
  /** Definição e denominador, para o tooltip. */
  definition: ReactNode;
  /** O denominador por extenso, impresso no pé da célula. */
  denominator: ReactNode;
  hint: string;
  active?: boolean;
  onClick: () => void;
}

export function KpiStrip({
  lead,
  cells,
  period,
}: {
  lead: KpiCell;
  cells: KpiCell[];
  period: CockpitPeriod;
}) {
  /* Os fios entre células são o GAP da grade pintado de hairline, não bordas
     nas células. Com borda, cada quebra de breakpoint exige contas de
     `nth-child` para não desenhar um fio contra a beira do cartão — e a versão
     anterior errava exatamente isso em 768px. Um gap de 1px sobre fundo
     hairline acerta em qualquer número de colunas, de graça. */
  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-hairline md:grid-cols-2 xl:grid-cols-5">
      <Cell cell={lead} period={period} variant="lead" />
      {cells.map((cell) => (
        <Cell key={cell.kpi.key} cell={cell} period={period} variant="secondary" />
      ))}
    </div>
  );
}

function Cell({
  cell,
  period,
  variant,
}: {
  cell: KpiCell;
  period: CockpitPeriod;
  variant: 'lead' | 'secondary';
}) {
  const { kpi } = cell;
  const isLead = variant === 'lead';

  return (
    <div
      className={[
        'relative flex min-w-0 flex-col',
        isLead ? 'xl:col-span-2' : '',
        cell.active ? 'bg-surface-2' : 'bg-surface',
      ].join(' ')}
    >
      {cell.active && <span className="absolute inset-x-0 top-0 h-0.5 bg-brand" />}

      <motion.button
        type="button"
        whileTap={press}
        onClick={cell.onClick}
        aria-pressed={cell.active === undefined ? undefined : cell.active}
        title={cell.hint}
        className="group flex min-w-0 flex-1 flex-col items-start p-4 text-left transition-colors hover:bg-surface-hover"
      >
        <span className="flex w-full min-w-0 items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink-3">
            {kpi.label}
          </span>
          <ArrowRight
            className="h-3 w-3 shrink-0 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        </span>

        {/* O azul aparece UMA vez nesta faixa, no indicador que dá a escala de
            todos os outros. Nos três seguintes o número é tinta — se os quatro
            fossem azuis, nenhum deles seria o líder. */}
        <span
          className={[
            'mt-2 font-mono leading-none font-medium tracking-tight tabular',
            isLead ? 'text-[40px] text-brand-text' : 'text-[27px] text-ink',
          ].join(' ')}
        >
          <AnimatedNumber
            value={kpi.value}
            decimals={kpi.decimals ?? 0}
            format={!kpi.suffix}
            resetOnChange
          />
          {kpi.suffix && <span className="text-[19px] text-ink-3">{kpi.suffix}</span>}
        </span>

        <span className="mt-2.5 flex w-full min-w-0 items-end justify-between gap-3">
          <Delta kpi={kpi} period={period} />
          {cell.spark && cell.spark.length > 1 && (
            <span className="shrink-0" aria-hidden="true">
              <Sparkline
                data={cell.spark}
                width={isLead ? 84 : 56}
                height={22}
                color="var(--ink-4)"
              />
            </span>
          )}
        </span>
      </motion.button>

      {/* O denominador e a definição ficam FORA do botão: um tooltip dentro de
          um alvo clicável dispara a ação quando o usuário só queria ler a
          conta. */}
      <div className="flex items-start gap-1.5 px-4 pb-3.5">
        <span className="mt-px shrink-0">
          <Hint label={kpi.label.toLowerCase()}>{cell.definition}</Hint>
        </span>
        <p className="min-w-0 flex-1 text-[10.5px] leading-relaxed text-ink-4">
          {cell.denominator}
        </p>
      </div>
    </div>
  );
}

/**
 * O delta tem DIREÇÃO SEMÂNTICA, não aritmética.
 *
 * Uma queda de 14% em "casos de alto risco" é notícia boa e uma queda de 14% em
 * "alunos monitorados" é notícia ruim. Seguir o sinal do número em vez de
 * `goodDirection` é como um painel mente sem escrever nada falso — e é o erro
 * que a versão anterior desta faixa já evitava, então ele não volta aqui.
 */
function Delta({ kpi, period }: { kpi: Kpi; period: CockpitPeriod }) {
  const meta = periodMeta(period);

  if (kpi.deltaPercent === null) {
    return (
      <span
        className="flex min-w-0 items-center gap-1 text-[11px] text-ink-4"
        title="Sem base de comparação no período anterior."
      >
        <Minus className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">sem comparação</span>
      </span>
    );
  }

  const delta = kpi.deltaPercent;
  const flat = Math.abs(delta) < 0.05;
  const rising = delta > 0;
  const good = flat ? null : rising === (kpi.goodDirection === 'up');
  const Icon = flat ? Minus : rising ? ArrowUpRight : ArrowDownRight;
  const tone = flat ? 'text-ink-4' : good ? 'text-ink-2' : 'text-crit-ink';

  const isRate = kpi.suffix === '%';
  const text = flat
    ? 'estável'
    : `${rising ? '+' : '−'}${decimal(Math.abs(delta), 1)}${isRate ? ' p.p.' : '%'}`;

  return (
    <span
      className={`flex min-w-0 items-center gap-1 text-[11px] font-medium ${tone}`}
      title={`${meta.compare}${kpi.previous === null ? '' : ` · anterior: ${int(kpi.previous)}`}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="shrink-0 font-mono whitespace-nowrap tabular">{text}</span>
      <span className="min-w-0 truncate text-ink-4">{meta.compare}</span>
    </span>
  );
}
