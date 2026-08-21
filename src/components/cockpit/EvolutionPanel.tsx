import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { SCORE_BANDS } from '../../lib/healthScore';
import { CHART_RANGES, bandSeries, chartRangeMeta } from '../../lib/cockpit';
import type { ChartRange } from '../../lib/cockpit';
import type { CensusAggregate } from '../../data/institution';
import { Card, CardHeader } from '../ui/Surfaces';
import { Segmented } from '../ui/Fields';
import { LineChart } from '../ui/Plot';
import type { PlotSeries } from '../ui/Plot';
import { bandColors } from './palette';
import { int } from '../../lib/format';

/* ==========================================================================
   Segunda linha — evolução por nível de atenção
   --------------------------------------------------------------------------
   Uma decisão de escala que vale explicar, porque parece um bug e não é:
   "Estável" começa OCULTO.

   As quatro faixas convivem numa razão de 28 para 1 — treze mil estáveis contra
   quatrocentos e poucos críticos. Num eixo linear com as quatro visíveis,
   "Crítico" é uma linha reta no chão do gráfico e o movimento que importa fica
   invisível. Esconder a maior faixa por padrão é o que transforma a exigência de
   "ocultar/mostrar séries" em função de verdade em vez de enfeite: a legenda
   liga "Estável" a qualquer momento, e o eixo y se reescala na hora.
   ========================================================================== */

const shortFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const longFmt = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
});

export function EvolutionPanel({
  agg,
  seriesKey,
  range,
  onRangeChange,
  scopeLabel,
}: {
  agg: CensusAggregate;
  /** Semente estável da série — muda com escopo e recorte. */
  seriesKey: string;
  range: ChartRange;
  onRangeChange: (r: ChartRange) => void;
  scopeLabel: string;
}) {
  const { theme } = useApp();
  const dark = theme === 'dark';

  // "Estável" (índice 0) começa fora da escala. Ver o comentário do topo.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set([SCORE_BANDS[0].status]));

  const series = useMemo(() => bandSeries(agg, seriesKey, range), [agg, seriesKey, range]);
  const colors = useMemo(() => bandColors(dark), [dark]);

  const plot: PlotSeries[] = useMemo(
    () =>
      SCORE_BANDS.map((band, b) => ({
        key: band.status,
        label: band.label,
        color: colors[b],
        values: series.points.map((p) => p.bands[b]),
      })),
    [series, colors],
  );

  const labels = useMemo(() => series.points.map((p) => shortFmt.format(p.date)), [series]);
  const fullLabels = useMemo(() => series.points.map((p) => longFmt.format(p.date)), [series]);

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      // Ocultar tudo deixaria um eixo sem escala e um gráfico em branco.
      if (next.size === SCORE_BANDS.length) next.delete(key);
      return next;
    });

  const stableHidden = hidden.has(SCORE_BANDS[0].status);
  const meta = chartRangeMeta(range);

  return (
    <Card>
      <CardHeader
        title="Evolução dos alunos por nível de atenção"
        subtitle={`${scopeLabel} · ${meta.label} · ${series.sampling}. O último ponto é hoje e vale exatamente o que os indicadores acima mostram.`}
        action={
          <Segmented<ChartRange>
            layoutId="cockpit-evolution-range"
            value={range}
            onChange={onRangeChange}
            options={CHART_RANGES.map((r) => ({ value: r.key, label: r.label }))}
          />
        }
      />

      <div className="mt-5">
        <LineChart
          series={plot}
          labels={labels}
          fullLabels={fullLabels}
          hidden={hidden}
          onToggleSeries={toggle}
          height={276}
          emptyMessage="Nenhum aluno no escopo selecionado."
          footnote={`clique na legenda para ocultar · setas percorrem os pontos`}
        />
      </div>

      {stableHidden && agg.monitored > 0 && (
        <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-4">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            <span className="font-mono text-ink-3">{int(agg.bands[0])}</span> alunos estáveis estão
            fora da escala para que as faixas de risco fiquem legíveis. Clique em{' '}
            <span className="font-medium text-ink-3">Estável</span> na legenda para incluí-los.
          </span>
        </p>
      )}
    </Card>
  );
}
