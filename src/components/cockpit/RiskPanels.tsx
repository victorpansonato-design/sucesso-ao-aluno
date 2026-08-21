import { useMemo } from 'react';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { STATUS_SLUG } from '../../lib/healthScore';
import type { BandSlice } from '../../data/institution';
import type { CockpitFocus, SignalRow } from '../../lib/cockpit';
import { Card, CardHeader } from '../ui/Surfaces';
import { Donut } from '../ui/Charts';
import { BarList } from '../ui/Plot';
import type { BarRow } from '../ui/Plot';
import { SIGNAL_COLOR } from './palette';
import { decimal, int } from '../../lib/format';

/* ==========================================================================
   Terceira linha — distribuição de risco e sinais detectados
   --------------------------------------------------------------------------
   Os dois blocos respondem perguntas diferentes e por isso não compartilham
   população:

     · A DISTRIBUIÇÃO fala da BASE. É a leitura do Health Score sobre todos os
       monitorados, e não muda quando se recorta um sinal — a base é a base.
     · OS SINAIS falam dos CASOS. É a decomposição das exceções que chegaram a
       uma pessoa, e é aí que o recorte age.

   Confundir os dois é o erro que faz um dashboard somar 18.426 num painel e 347
   no painel vizinho sem explicar a diferença. Aqui a diferença está escrita: o
   funil no pé do donut liga os dois números numa frase.
   ========================================================================== */

export function RiskDistribution({
  bands,
  monitored,
  attention,
  highRisk,
  retention,
  focusLabel,
  onOpenBand,
}: {
  bands: BandSlice[];
  monitored: number;
  attention: number;
  highRisk: number;
  retention: number;
  /** Recorte ativo na página, apenas para dizer que este cartão o ignora. */
  focusLabel: string | null;
  onOpenBand: (slug: string) => void;
}) {
  const { theme } = useApp();
  const dark = theme === 'dark';

  return (
    <Card>
      <CardHeader
        title="Distribuição de risco"
        subtitle="Leitura do Health Score sobre toda a base monitorada."
      />

      {monitored === 0 ? (
        <p className="py-14 text-center text-[12px] text-ink-4">
          Nenhum aluno no escopo selecionado.
        </p>
      ) : (
        <div className="mt-5 flex flex-col items-center gap-5">
          <Donut
            segments={bands.map((band) => ({
              key: band.status,
              label: band.label,
              value: band.count,
              color: band.hex(dark),
            }))}
            centerValue={monitored}
            centerLabel="monitorados"
            onSegmentClick={(key) => {
              const band = bands.find((b) => b.status === key);
              if (band) onOpenBand(STATUS_SLUG[band.status]);
            }}
          />

          <div className="w-full min-w-0 space-y-0.5">
            {bands.map((band) => (
              <button
                key={band.status}
                onClick={() => onOpenBand(STATUS_SLUG[band.status])}
                title={`Abrir a base de alunos filtrada em ${band.label} (${band.range[0]}–${band.range[1]})`}
                className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: band.hex(dark) }}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{band.label}</span>
                <span className="shrink-0 font-mono text-[13px] font-medium text-ink">
                  {int(band.count)}
                </span>
                <span className="w-11 shrink-0 text-right font-mono text-[11px] text-ink-4">
                  {decimal(band.percent, 1)}%
                </span>
              </button>
            ))}
          </div>

          {/* O funil, em uma frase. É o que explica por que 18.426 monitorados
              produzem 347 casos: a automação resolve o resto. */}
          <div className="w-full border-t border-hairline pt-4">
            <p className="px-1.5 text-[12.5px] leading-relaxed text-ink-2">
              <span className="font-mono font-medium text-ink">{int(monitored)}</span> monitorados →{' '}
              <span className="font-mono font-medium text-ink">{int(attention)}</span> em atenção
              humana →{' '}
              <span className="font-mono font-medium text-ink">{int(highRisk)}</span> em alto risco →{' '}
              <span className="font-mono font-medium text-ink">{int(retention)}</span> em retenção.
            </p>
            <p className="mt-1.5 px-1.5 text-[11.5px] leading-relaxed text-ink-4">
              {monitored > 0 ? decimal((1 - attention / monitored) * 100, 1) : '0'}% da base seguiu
              sem qualquer toque humano no ciclo.
              {/* Sem esta ressalva, o funil mostra 347 enquanto o indicador
                  logo acima mostra 84 — e o leitor conclui que um dos dois
                  está errado. Os dois estão certos; o recorte é que não vale
                  para a leitura da base. */}
              {focusLabel && (
                <>
                  {' '}
                  O funil acima é da base inteira, sem o recorte de{' '}
                  <span className="text-ink-3">{focusLabel}</span>.
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

export function SignalBoard({
  signals,
  attention,
  focus,
  onToggleSignal,
}: {
  signals: SignalRow[];
  attention: number;
  focus: CockpitFocus;
  onToggleSignal: (key: SignalRow['key']) => void;
}) {
  const activeKey = focus.kind === 'signal' ? focus.key : null;

  const rows: BarRow[] = useMemo(
    () =>
      [...signals]
        .sort((a, b) => b.count - a.count)
        .map((signal) => ({
          key: signal.key,
          label: signal.label,
          value: signal.count,
          percent: signal.percent,
          color: activeKey === signal.key ? SIGNAL_COLOR.active : SIGNAL_COLOR.idle,
          title:
            activeKey === signal.key
              ? 'Remover o recorte de ' + signal.label
              : 'Recortar o Cockpit por ' + signal.label,
          detail:
            signal.count === 0 ? (
              signal.description
            ) : (
              <>
                {signal.highRisk > 0 ? (
                  <span className="text-ink-3">
                    <span className="font-mono font-medium">{int(signal.highRisk)}</span> em alto
                    risco ·{' '}
                  </span>
                ) : null}
                {signal.description}
              </>
            ),
        })),
    [signals, activeKey],
  );

  const top = rows[0];

  return (
    <Card>
      <CardHeader
        title="Principais sinais detectados"
        subtitle={
          attention === 0
            ? 'Nenhuma exceção humana no escopo selecionado.'
            : `O que disparou as ${int(attention)} exceções que chegaram a uma pessoa. Clique para recortar a página.`
        }
        action={
          activeKey ? (
            <button
              onClick={() => onToggleSignal(activeKey)}
              className="text-[12px] font-medium text-brand-text transition-colors hover:text-brand-2"
            >
              Limpar recorte
            </button>
          ) : undefined
        }
      />

      <div className="mt-4">
        <BarList rows={rows} activeKey={activeKey} onSelect={(k) => onToggleSignal(k as SignalRow['key'])} />
      </div>

      {top && top.value > 0 && !activeKey && (
        <p className="mt-3 flex items-start gap-1.5 border-t border-hairline pt-3 text-[11.5px] leading-relaxed text-ink-3">
          <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0 text-ink-4" />
          <span>
            Maior causa no escopo: <span className="font-medium text-ink-2">{top.label}</span>, com{' '}
            <span className="font-mono">{decimal(top.percent, 0)}%</span> das exceções.
          </span>
        </p>
      )}

      {activeKey && (
        <p className="mt-3 flex items-center gap-1.5 border-t border-hairline pt-3 text-[11.5px] text-ink-3">
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-4" />
          Indicadores, jornada e operação abaixo já estão recortados por este sinal.
        </p>
      )}
    </Card>
  );
}
