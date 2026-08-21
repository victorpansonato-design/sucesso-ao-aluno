import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from 'lucide-react';
import { motion } from 'motion/react';
import type { Kpi } from '../../lib/cockpit';
import { periodMeta } from '../../lib/cockpit';
import type { CockpitPeriod } from '../../lib/cockpit';
import { AnimatedNumber } from '../ui/Charts';
import { decimal } from '../../lib/format';
import { press } from '../../lib/motion';

/* ==========================================================================
   Primeira linha — indicadores executivos
   --------------------------------------------------------------------------
   Cinco números, uma superfície. A alternativa óbvia — cinco cartões lado a
   lado — coloca cinco molduras na primeira coisa que a diretoria vê, e o olho
   passa a ler bordas antes de ler números. Aqui é um cartão só, dividido por
   fios de cabelo: mesma densidade, um quinto da tinta.

   A comparação com o período anterior tem direção. Uma queda de 12% em "alunos
   monitorados" é notícia ruim e uma queda de 12% em "alto risco" é notícia boa,
   então o verde e o vermelho seguem `goodDirection` e não o sinal do número.
   Rotular as duas do mesmo jeito é como um painel de dashboard mente sem
   escrever nada falso.
   ========================================================================== */

function DeltaChip({
  kpi,
  period,
  accent = false,
}: {
  kpi: Kpi;
  period: CockpitPeriod;
  /** Sobre o azul preenchido, a escala de tinta some e o vermelho não contrasta. */
  accent?: boolean;
}) {
  const meta = periodMeta(period);

  if (kpi.deltaPercent === null) {
    return (
      <span
        className={`flex items-center gap-1 text-[11px] ${accent ? 'text-on-brand/70' : 'text-ink-4'}`}
        title="Sem base de comparação no período anterior."
      >
        <Minus className="h-3 w-3" />
        sem comparação
      </span>
    );
  }

  const delta = kpi.deltaPercent;
  const flat = Math.abs(delta) < 0.05;
  const rising = delta > 0;
  const good = flat ? null : rising === (kpi.goodDirection === 'up');

  const Icon = flat ? Minus : rising ? ArrowUpRight : ArrowDownRight;
  const tone = accent
    ? // Branco cheio para a má notícia, translúcido para o resto: é o único
      // par que se lê sobre o azul sem trazer uma segunda cor para dentro dele.
      flat || good
      ? 'text-on-brand/80'
      : 'text-on-brand'
    : flat
      ? 'text-ink-4'
      : good
        ? 'text-ink-2'
        : 'text-crit-ink';

  /* A taxa de estabilização é uma porcentagem, então a variação é em pontos
     percentuais — chamar "de 71% para 73%" de "+2,8%" é errado. */
  const isRate = kpi.suffix === '%';
  const text = flat
    ? 'estável'
    : (rising ? '+' : '−') + decimal(Math.abs(delta), 1) + (isRate ? ' p.p.' : '%');

  /* `min-w-0` no contêiner e `shrink-0` no valor: sem isso, "−2,0 p.p." era o
     primeiro a ceder espaço e quebrava para a linha de baixo, desalinhando o
     rodapé de uma célula em relação às outras quatro. Quem trunca é a frase de
     comparação, que o `title` repete por extenso. */
  return (
    <span
      className={`flex min-w-0 items-center gap-1 text-[11px] font-medium ${tone}`}
      title={meta.compare}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="shrink-0 font-mono tabular whitespace-nowrap">{text}</span>
      <span className={`min-w-0 truncate ${accent ? 'text-on-brand/60' : 'text-ink-4'}`}>
        {meta.compare}
      </span>
    </span>
  );
}

export interface KpiAction {
  /** `focus` marca o indicador como recorte ativo; `link` navega. */
  kind: 'focus' | 'link';
  active?: boolean;
  run: () => void;
  hint: string;
}

export function CockpitKpis({
  kpis,
  period,
  actions,
  accentKey,
}: {
  kpis: Kpi[];
  period: CockpitPeriod;
  actions: Record<Kpi['key'], KpiAction>;
  /**
   * O único indicador que recebe o azul institucional preenchido. Existe para
   * uma tela ter exatamente UM ponto de cor: no Dashboard é a taxa de
   * estabilização, porque é a métrica que todos os outros números servem para
   * explicar. Dois deles em azul e o azul deixa de significar "este".
   */
  accentKey?: Kpi['key'];
}) {
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-xl bg-surface sm:grid-cols-2 xl:grid-cols-5">
      {kpis.map((kpi, i) => {
        const action = actions[kpi.key];
        const active = action.kind === 'focus' && action.active;
        const accent = accentKey === kpi.key;

        return (
          <motion.button
            key={kpi.key}
            whileTap={press}
            onClick={action.run}
            title={kpi.hint + ' · ' + action.hint}
            {...(action.kind === 'focus' ? { 'aria-pressed': Boolean(active) } : {})}
            className={[
              'group relative flex flex-col items-start p-4 text-left transition-colors',
              // Fio de cabelo entre colunas, e entre linhas quando a grade quebra.
              i > 0 && !accent ? 'xl:border-l xl:border-hairline' : '',
              i % 2 === 1 && !accent ? 'sm:border-l sm:border-hairline xl:border-l' : '',
              i >= 2 ? 'sm:border-t sm:border-hairline xl:border-t-0' : '',
              i >= 1 && !accent ? 'border-t border-hairline sm:border-t-0' : '',
              accent
                ? 'bg-brand hover:bg-brand-hover'
                : active
                  ? 'bg-surface-2'
                  : 'hover:bg-surface-hover',
            ].join(' ')}
          >
            {active && !accent && <span className="absolute inset-x-0 top-0 h-0.5 bg-brand" />}

            <span className="flex w-full items-center gap-1.5">
              <span
                className={[
                  'min-w-0 flex-1 truncate text-[12px] font-medium',
                  accent ? 'text-on-brand/80' : 'text-ink-3',
                ].join(' ')}
              >
                {kpi.label}
              </span>
              <ArrowRight
                className={[
                  'h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100',
                  accent ? 'text-on-brand/70' : 'text-ink-4',
                ].join(' ')}
              />
            </span>

            <span
              className={[
                'mt-2 font-mono text-[30px] leading-none font-medium tracking-tight',
                accent ? 'text-on-brand' : 'text-ink',
              ].join(' ')}
            >
              <AnimatedNumber
                value={kpi.value}
                decimals={kpi.decimals ?? 0}
                format={!kpi.suffix}
                resetOnChange
              />
              {kpi.suffix && (
                <span className={accent ? 'text-[20px] text-on-brand/70' : 'text-[20px] text-ink-3'}>
                  {kpi.suffix}
                </span>
              )}
            </span>

            <span className="mt-2.5 flex w-full min-w-0">
              <DeltaChip kpi={kpi} period={period} accent={accent} />
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
