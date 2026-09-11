import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { motion } from 'motion/react';
import type { SignalMovement } from '../../lib/pulse';
import type { SignalKey } from '../../data/institution';
import { Card, CardHeader } from '../ui/Surfaces';
import { Hint } from '../ui/Hint';
import { emphasis } from '../../lib/motion';
import { decimal, int, signed } from '../../lib/format';

/* ==========================================================================
   Sinais que mais mudaram
   --------------------------------------------------------------------------
   Substitui um donut de sinais, e a troca não é de gosto. Um donut responde
   "qual fatia é maior", que é a pergunta menos útil sobre um gatilho: os cinco
   sinais têm volumes parecidos (39, 36, 32, 29, 27) e cinco arcos parecidos não
   dizem nada. As perguntas úteis são "o que se mexeu?" e "o que virou alto
   risco?", e as duas são colunas, não ângulos.

   Ordenação por MÓDULO da variação: o sinal que mais se mexeu vem primeiro,
   independentemente da direção. Ordenar por volume deixaria o topo da lista
   imóvel semana após semana, e a lista existe para mostrar movimento.

   A coluna que decide a ação é `conversão`: quanto deste sinal termina em alto
   risco. Volume alto com conversão zero é uma régua funcionando; volume médio
   com conversão alta é onde a evasão nasce. Ela é a razão de este cartão não
   ser apenas um ranking de contagem.
   ========================================================================== */

export function SignalRanking({
  rows,
  activeKey,
  onSelect,
  windowLabel,
}: {
  rows: SignalMovement[];
  activeKey: string | null;
  onSelect: (key: SignalKey) => void;
  windowLabel: string;
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0);

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Sinais que mais mudaram"
        subtitle={`Gatilhos ordenados pelo tamanho da variação na janela ${windowLabel.toLowerCase()}. Clique para recortar a página pelo sinal.`}
        action={
          <Hint label="a conversão para alto risco" align="right">
            <strong className="font-semibold text-ink">Conversão</strong> é a fração dos casos deste
            sinal que está classificada como alto risco — o denominador é o próprio volume do sinal,
            na coluna à esquerda. A <strong className="font-semibold text-ink">variação</strong>
            compara com a janela anterior de mesmo tamanho. O censo institucional não guarda
            histórico por sinal em nível de aluno; a série vem do mesmo modelo determinístico que
            alimenta o gráfico de evolução.
          </Hint>
        }
      />

      {rows.length === 0 || max === 0 ? (
        <p className="flex-1 py-14 text-center text-[12px] text-ink-4">
          Nenhum sinal ativo no escopo selecionado.
        </p>
      ) : (
        <ul className="mt-4 flex-1 space-y-0.5">
          {rows.map((row, i) => {
            const active = activeKey === row.key;
            const dimmed = activeKey != null && !active;

            return (
              <li key={row.key}>
                <button
                  type="button"
                  onClick={() => onSelect(row.key as SignalKey)}
                  aria-pressed={active}
                  title={row.description}
                  className={[
                    'w-full rounded-lg px-2 py-2 text-left transition-colors',
                    active ? 'bg-surface-2' : 'hover:bg-surface-2',
                    dimmed ? 'opacity-55' : '',
                  ].join(' ')}
                >
                  <span className="flex items-baseline gap-2">
                    <span
                      className={[
                        'min-w-0 flex-1 truncate text-[12.5px]',
                        active ? 'font-semibold text-ink' : 'font-medium text-ink-2',
                      ].join(' ')}
                    >
                      {row.label}
                    </span>
                    <span className="shrink-0 font-mono text-[14px] leading-none font-medium text-ink tabular">
                      {int(row.count)}
                    </span>
                    <span className="w-16 shrink-0 text-right">
                      <DeltaChip delta={row.delta} />
                    </span>
                  </span>

                  <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-track">
                    <motion.span
                      className="block h-full rounded-full"
                      style={{
                        backgroundColor: active ? 'var(--brand)' : 'var(--ink-3)',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(row.count / max) * 100}%` }}
                      transition={{ duration: 0.6, ease: emphasis, delay: i * 0.04 }}
                    />
                  </span>

                  <span className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-[11px] text-ink-3">
                    <span className="font-mono text-ink-4 tabular">{decimal(row.share, 1)}%</span>
                    <span className="text-ink-4">dos casos humanos</span>
                    <span className="text-ink-4">·</span>
                    <span className="font-mono font-medium text-ink-2 tabular">
                      {int(row.highRisk)}
                    </span>
                    <span>em alto risco</span>
                    <span className="text-ink-4">·</span>
                    <span
                      className={[
                        'font-mono font-medium tabular',
                        row.conversion >= 20 ? 'text-crit-ink' : 'text-ink-2',
                      ].join(' ')}
                    >
                      {decimal(row.conversion, 1)}%
                    </span>
                    <span>de conversão</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/**
 * A variação de um sinal não tem direção boa: "acadêmico subiu" não é pior nem
 * melhor que "financeiro subiu" — os dois são trabalho. Por isso o chip é tinta
 * e seta, sem verde nem vermelho. Vermelho aqui gastaria a cor mais forte do
 * sistema em algo que não é um veredito.
 */
function DeltaChip({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="flex items-center justify-end gap-1 text-[11px] text-ink-4">
        <Minus className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="font-mono tabular">0</span>
      </span>
    );
  }

  const Icon = delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="flex items-center justify-end gap-1 text-[11px] font-medium text-ink-2">
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="font-mono tabular">{signed(delta)}</span>
    </span>
  );
}
