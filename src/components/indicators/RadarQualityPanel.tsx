import { AlertTriangle, Settings2 } from 'lucide-react';
import type { IndicatorsModel, RadarStat } from '../../lib/indicators';
import type { RouteName } from '../../lib/router';
import { Card, CardHeader, Callout } from '../ui/Surfaces';
import { RadarBadge } from '../ui/Badges';
import { MeterBar } from '../ui/Charts';
import { Hint } from '../ui/Hint';
import { ResponsiveTable } from './shared';
import type { TableColumn } from './shared';
import { int, percent } from '../../lib/format';

/* ==========================================================================
   Qualidade dos radares
   --------------------------------------------------------------------------
   Precisão é a razão entre alertas confirmados e alertas JULGADOS. A correção
   deste painel é sobre o que fazer quando ninguém julgou ainda.

   Antes a célula dizia "sem verdicto", em tinta apagada, exatamente onde os
   outros radares mostravam uma barra e um percentual. Numa coluna chamada
   "Precisão", uma célula vazia lê como zero — como se o radar tivesse errado
   tudo. Não é isso: é AMOSTRA INSUFICIENTE, um estado da operação (a equipe
   ainda não revisou), não um resultado do radar.

   Agora esse estado tem forma própria — rótulo explícito, contagem de pendentes
   e nenhuma barra —, e o painel destaca separadamente o caso que realmente
   pede ação: volume suficiente E precisão baixa. Um radar com dois alertas e
   50% de precisão não precisa de calibração; precisa de mais dois alertas.
   ========================================================================== */

/** Julgamentos mínimos para a precisão ser tratada como sinal, não como ruído. */
const MIN_JUDGED = 5;
/** Abaixo disto, com volume suficiente, o radar está mal calibrado. */
const LOW_PRECISION = 70;

export function RadarQualityPanel({
  model,
  onNavigate,
}: {
  model: IndicatorsModel;
  onNavigate: (route: RouteName, param: string | null) => void;
}) {
  const needsCalibration = model.radars.filter(
    (r) => r.judged >= MIN_JUDGED && r.precision !== null && r.precision < LOW_PRECISION,
  );
  const awaitingReview = model.radars.filter((r) => r.precisionState === 'insufficient');
  const totalPending = model.radars.reduce((sum, r) => sum + r.pending, 0);

  const columns: TableColumn<RadarStat>[] = [
    {
      key: 'radar',
      header: 'Radar',
      priority: true,
      render: (r) => <RadarBadge radar={r.key} full />,
    },
    {
      key: 'precision',
      header: 'Precisão',
      priority: true,
      render: (r) => <PrecisionCell radar={r} />,
    },
    {
      key: 'sla',
      header: 'SLA',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-[11.5px] text-ink-3 tabular">{r.slaHours}h</span>
      ),
    },
    {
      key: 'alerts',
      header: 'Alertas',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-[12px] font-semibold text-ink tabular">{int(r.alerts)}</span>
      ),
    },
    {
      key: 'confirmed',
      header: 'Confirmados',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-[12px] font-semibold text-ink tabular">
          {int(r.confirmed)}
        </span>
      ),
    },
    {
      key: 'rejected',
      header: 'Descartados',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-[12px] text-ink-3 tabular">{int(r.rejected)}</span>
      ),
    },
    {
      key: 'pending',
      header: 'Aguardando revisão',
      align: 'right',
      render: (r) => (
        <span
          className={[
            'font-mono text-[12px] tabular',
            r.pending > 0 ? 'font-semibold text-warn-ink' : 'text-ink-4',
          ].join(' ')}
        >
          {int(r.pending)}
        </span>
      ),
    },
    {
      key: 'cases',
      header: 'Casos',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-[11.5px] whitespace-nowrap text-ink-3 tabular">
          {int(r.openCases)} abertos · {int(r.closedCases)} fechados
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {needsCalibration.length > 0 && (
        <Callout
          tone="warn"
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Radares com volume suficiente e precisão baixa"
        >
          {needsCalibration.map((r) => (
            <span key={r.key} className="mr-3 inline-block">
              <strong className="font-semibold text-ink">{r.label}</strong>{' '}
              <span className="font-mono tabular">{percent(r.precision ?? 0, 1)}</span> em{' '}
              <span className="font-mono tabular">{int(r.judged)}</span> julgados
            </span>
          ))}
          <span className="mt-1.5 block">
            Estes são os únicos que justificam ajustar gatilho em Governança — os demais ou estão
            calibrados, ou ainda não têm julgamentos suficientes.
          </span>
        </Callout>
      )}

      <Card padded={false} className="overflow-hidden">
        <div className="p-5">
          <CardHeader
            eyebrow="Calibração"
            title="Precisão por radar"
            subtitle="Confirmados sobre julgados. Clique numa linha para abrir o radar."
            action={
              <Hint label="a precisão de um radar" align="right">
                <strong className="font-semibold text-ink">Precisão</strong> = confirmados ÷
                julgados, onde julgados = confirmados + descartados. Alertas aguardando revisão
                ficam fora das duas pontas — incluí-los como erro puniria o radar por lentidão da
                equipe. Abaixo de{' '}
                <span className="font-mono tabular">{MIN_JUDGED}</span> julgamentos a precisão é
                tratada como <strong className="font-semibold text-ink">amostra insuficiente</strong>{' '}
                e não como resultado.
              </Hint>
            }
          />
        </div>
        <div className="border-t border-hairline">
          <ResponsiveTable
            columns={columns}
            rows={model.radars}
            keyOf={(r) => r.key}
            minWidth={860}
            emptyMessage="Nenhum radar configurado."
          />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            eyebrow="Fila de revisão"
            title="Alertas aguardando julgamento"
            subtitle="Enquanto um alerta não é confirmado ou descartado, ele não entra em nenhuma precisão."
          />
          <p className="mt-4 flex items-baseline gap-2">
            <span className="font-mono text-[30px] leading-none font-medium text-ink tabular">
              {int(totalPending)}
            </span>
            <span className="text-[12px] text-ink-3">
              de <span className="font-mono tabular">{int(model.radars.reduce((s, r) => s + r.alerts, 0))}</span>{' '}
              alertas no ciclo
            </span>
          </p>

          {awaitingReview.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-hairline pt-4">
              {awaitingReview.map((r) => (
                <li key={r.key} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink-2">
                    {r.label}
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-4">amostra insuficiente</span>
                  <span className="w-10 shrink-0 text-right font-mono text-[12px] font-semibold text-warn-ink tabular">
                    {int(r.pending)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col">
          <CardHeader
            eyebrow="Próximo passo"
            title="O que fazer com estes números"
          />
          <p className="mt-3 flex-1 text-[12px] leading-relaxed text-ink-2">
            Um radar com precisão baixa não está errado — está mal calibrado, e o número desta tela
            é o que justifica ajustar o seu gatilho. A recíproca também vale: um radar com precisão
            de 100% sobre poucos julgamentos pode simplesmente estar disparando pouco, e o volume
            de alertas é a coluna que mostra isso.
          </p>
          {/* A única saída que sobrou em Indicadores, e ela sobra por ser de
              natureza diferente: mudar o gatilho de um radar é uma TAREFA de
              configuração, não um aprofundamento de leitura. As linhas da
              tabela acima deixaram de abrir a tela de Radares justamente para
              que esta continue sendo a única — um botão explícito, rotulado com
              o destino, é o oposto de uma linha de tabela que teleporta. */}
          <div className="mt-4 border-t border-hairline pt-4">
            <button
              type="button"
              onClick={() => onNavigate('governanca', null)}
              className="flex items-center gap-2 text-[12.5px] font-semibold text-brand-text transition-colors hover:text-brand-2"
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              Abrir a configuração de radares em Governança
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

/**
 * A célula de precisão, com os dois estados que o painel existe para separar.
 *
 * `insufficient` não desenha barra e não imprime percentual: qualquer um dos
 * dois faria a ausência de julgamento parecer uma medida ruim. A cor sozinha
 * também não diferencia — há rótulo escrito nos dois casos.
 */
function PrecisionCell({ radar }: { radar: RadarStat }) {
  if (radar.precision === null) {
    return (
      <span className="flex flex-col gap-0.5">
        <span className="text-[11.5px] font-medium text-ink-3">amostra insuficiente</span>
        <span className="font-mono text-[10.5px] text-ink-4 tabular">
          0 julgados · {int(radar.pending)} aguardando
        </span>
      </span>
    );
  }

  const weak = radar.judged >= MIN_JUDGED && radar.precision < LOW_PRECISION;

  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-2">
        <span className="w-14 shrink-0">
          <MeterBar
            value={radar.precision}
            color={weak ? 'var(--warn)' : 'var(--ink-3)'}
            height={4}
          />
        </span>
        <span className="font-mono text-[12px] font-semibold text-ink tabular">
          {percent(radar.precision, 1)}
        </span>
      </span>
      <span className="font-mono text-[10.5px] text-ink-4 tabular">
        {int(radar.confirmed)} ÷ {int(radar.judged)} julgados
        {radar.judged < MIN_JUDGED && ' · amostra pequena'}
      </span>
    </span>
  );
}
