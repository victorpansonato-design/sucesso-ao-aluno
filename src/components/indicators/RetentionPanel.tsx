import type { IndicatorsModel } from '../../lib/indicators';
import type { EvasionRow } from '../../lib/exporters';
import { Card, CardHeader, Callout } from '../ui/Surfaces';
import { MeterBar } from '../ui/Charts';
import { Pill } from '../ui/Badges';
import { Denominator, Hint } from '../ui/Hint';
import { RateStat, ResponsiveTable } from './shared';
import type { TableColumn } from './shared';
import { int, percent } from '../../lib/format';

/* ==========================================================================
   Retenção
   --------------------------------------------------------------------------
   Como os casos terminam, quanto disso é permanência e quanto de exposição
   financeira foi evitada.

   O ponto sensível deste painel é a receita preservada, e ele é tratado como
   número institucional de verdade: a fórmula fica visível, o denominador fica
   visível, e a natureza do número — ESTIMATIVA DE EXPOSIÇÃO EVITADA, não caixa
   realizado — está escrita no próprio cartão, não numa nota de pé de página que
   ninguém lê antes de colar o valor num slide.
   ========================================================================== */

export function RetentionPanel({ model }: { model: IndicatorsModel }) {
  const evasionColumns: TableColumn<EvasionRow>[] = [
    {
      key: 'course',
      header: 'Curso',
      priority: true,
      render: (r) => <span className="text-[12.5px] font-semibold text-ink">{r.course}</span>,
    },
    {
      key: 'count',
      header: 'Casos',
      priority: true,
      align: 'right',
      render: (r) => (
        <span className="font-mono text-[12.5px] font-semibold text-crit-ink tabular">
          {int(r.count)}
        </span>
      ),
    },
    { key: 'campus', header: 'Campus', render: (r) => <span className="text-[11.5px] text-ink-3">{r.campus}</span> },
    {
      key: 'modality',
      header: 'Modalidade',
      render: (r) => (
        <Pill dot={false} mono>
          {r.modality}
        </Pill>
      ),
    },
    {
      key: 'reason',
      header: 'Motivo registrado',
      render: (r) => <span className="text-[11.5px] text-ink-2">{r.reason}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Um indicador, não dois. O segundo era "Receita preservada", em reais:
          mensalidade × 6 parcelas × períodos restantes de cada caso retido. Ele
          presumia que todo retido sairia com certeza e concluiria o curso
          inteiro, sobre um punhado de casos — e, em reais numa aba executiva,
          era lido como caixa por quem vê o número fora da tela. Retenção volta a
          ser medida em casos e pessoas, que é a unidade que a operação produz.
          A conversão para dinheiro é trabalho do financeiro, com as premissas
          dele. */}
      <div className="grid gap-3">
        <RateStat
          label="Taxa de reversão"
          value={model.reversionRate}
          suffix="%"
          tone="vital"
          emptyReason="nenhum caso com desfecho definitivo ainda — nada a medir"
          denominator={
            <>
              <span className="font-mono font-medium text-ink tabular">
                {int(model.retained.length)}
              </span>{' '}
              acordos firmados ÷{' '}
              <span className="font-mono font-medium text-ink tabular">
                {int(model.reversionDenominator)}
              </span>{' '}
              desfechos definitivos (acordos + saídas)
            </>
          }
          definition={
            <>
              Fração dos casos que terminaram em permanência. Cancelados e ainda abertos ficam fora
              do denominador: um alerta descartado não era risco, e um caso aberto ainda não
              terminou. Com{' '}
              <span className="font-mono tabular">{int(model.reversionDenominator)}</span>{' '}
              desfechos, cada caso vale{' '}
              <span className="font-mono tabular">
                {model.reversionDenominator > 0
                  ? percent(100 / model.reversionDenominator, 1)
                  : '—'}
              </span>{' '}
              nesta taxa — leia o número junto do tamanho da amostra.
            </>
          }
        />

      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Card className="flex flex-col">
          <CardHeader
            eyebrow="Desfechos"
            title="Como os casos terminam"
            action={
              <Hint label="a composição dos desfechos" align="right">
                Percentuais sobre o total de{' '}
                <span className="font-mono tabular">{int(model.caseEndings[0]?.total ?? 0)}</span>{' '}
                casos da amostra — incluindo os ainda abertos, que é por isso que as quatro linhas
                somam 100% e a taxa de reversão acima usa outro denominador.
              </Hint>
            }
          />

          <ul className="mt-4 flex-1 space-y-3">
            {model.caseEndings.map((row) => (
              <li key={row.key} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[12px] font-medium text-ink-2">
                    {row.label}
                  </span>
                  <span className="flex shrink-0 items-center">
                    <span className="w-10 text-right font-mono text-[12.5px] font-semibold text-ink tabular">
                      {int(row.value)}
                    </span>
                    <span className="mx-2 h-3.5 w-px bg-hairline" aria-hidden="true" />
                    <span className="w-12 text-right font-mono text-[11.5px] text-ink-3 tabular">
                      {percent(row.percent, 1)}
                    </span>
                  </span>
                </div>
                <MeterBar
                  value={row.value}
                  max={Math.max(1, row.total)}
                  color={row.color}
                  height={5}
                />
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-hairline pt-4">
            <Denominator
              numerator={int(model.retained.length)}
              numeratorLabel="retidos"
              denominator={int(model.reversionDenominator)}
              denominatorLabel="desfechos definitivos"
            />
            {model.reopened.length > 0 && (
              <p className="mt-2.5 text-[11px] leading-relaxed text-ink-3">
                <span className="font-mono tabular">{int(model.reopened.length)}</span> caso(s)
                foram reabertos — vale revisar o playbook usado neles.
              </p>
            )}
          </div>
        </Card>

        <Card padded={false} className="overflow-hidden">
          <div className="p-5">
            <CardHeader
              eyebrow="Relatório executivo"
              title="Motivos de evasão registrados"
              subtitle="Taxonomia fixa preenchida no encerramento de cada caso, agregada por curso, campus e modalidade."
            />
          </div>
          <div className="border-t border-hairline">
            <ResponsiveTable
              columns={evasionColumns}
              rows={model.evasion}
              keyOf={(r) => `${r.course}|${r.campus}|${r.modality}|${r.reason}`}
              minWidth={620}
              emptyMessage="Nenhum caso foi encerrado como evasão inevitável no ciclo."
            />
          </div>
        </Card>
      </div>

      {model.reversionRate !== null && (
        <Callout tone={model.reversionRate >= 60 ? 'ok' : 'warn'}>
          <span className="font-mono font-semibold tabular">
            {percent(model.reversionRate, 1)}
          </span>{' '}
          dos <span className="font-mono tabular">{int(model.reversionDenominator)}</span> casos com
          desfecho definitivo terminaram em permanência. Com uma amostra deste tamanho, trate a taxa
          como direção, não como precisão — um caso a mais ou a menos move o número em{' '}
          <span className="font-mono tabular">
            {percent(100 / Math.max(1, model.reversionDenominator), 1)}
          </span>
          .
        </Callout>
      )}
    </div>
  );
}
