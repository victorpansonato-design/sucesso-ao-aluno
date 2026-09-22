import { motion } from 'motion/react';
import type { OutcomeBreakdown } from '../../lib/cockpit';
import { OUTCOMES } from '../../lib/cockpit';
import { Card, CardHeader } from '../ui/Surfaces';
import { Denominator, Hint } from '../ui/Hint';
import { outcomeColor } from '../cockpit/palette';
import { emphasis } from '../../lib/motion';
import { decimal, int } from '../../lib/format';

/* ==========================================================================
   Resultado das intervenções
   --------------------------------------------------------------------------
   Era o terceiro donut de uma fileira de três donuts, e três donuts iguais lado
   a lado é a assinatura de um dashboard montado por template. Aqui a mesma
   partição virou UMA barra empilhada com legenda numerada.

   A troca ganha três coisas que o donut não dava:

     1. COMPARAÇÃO DE FATIAS PEQUENAS. "Encaminhados" (3) e "sem contato" (3)
        eram dois slivers indistinguíveis num arco; numa barra são dois
        segmentos com rótulo e número.
     2. A LINHA DO APURADO. Os casos em acompanhamento ainda não terminaram.
        Numa barra é possível marcar visualmente onde termina o que já foi
        apurado; num donut de 360° isso não tem onde ser dito.
     3. VÃO DE 2px ENTRE SEGMENTOS. Fatias coladas de matizes próximos leem como
        um bloco; o vão na cor da superfície separa sem acrescentar traço.

   O QUE ESTE CARTÃO DEIXOU DE AFIRMAR. Ele terminava com a taxa de
   estabilização — estabilizados ÷ apurados — em corpo destacado, e era o número
   que a diretoria levava da tela. Ela saiu do produto: sem janela de observação
   declarada e sem grupo de controle, a taxa credita à operação a melhora de
   alunos que melhorariam de todo jeito, e o erro é de direção, não de precisão.
   A composição ficou porque cada linha dela é um registro que o especialista
   fez ao encerrar o caso. Descrição do que foi registrado, não placar.

   A cor segue `outcomeColor`, que é a escala semântica que o resto do app já
   usa: verde só em "estabilizado", âmbar em "sem resposta", vermelho em "não
   resolveu", tinta no resto. Nenhuma categoria vive só da cor — todas têm
   rótulo e número na legenda.
   ========================================================================== */

export function OutcomeComposition({
  outcomes,
  windowInline,
  dark,
}: {
  outcomes: OutcomeBreakdown;
  windowInline: string;
  dark: boolean;
}) {
  const total = outcomes.received;
  const rows = OUTCOMES.map((outcome) => ({
    ...outcome,
    value: outcomes.counts[outcome.key],
    color: outcomeColor(outcome.key, dark),
    percent: total > 0 ? (outcomes.counts[outcome.key] / total) * 100 : 0,
  }));

  const settledShare = total > 0 ? (outcomes.settled / total) * 100 : 0;

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Resultado das intervenções"
        subtitle={`Desfecho dos ${int(total)} contatos abertos ${windowInline}.`}
        action={
          <Hint label="a composição dos desfechos" align="right">
            Cada faixa é o que o especialista <strong className="font-semibold text-ink">registrou
            ao encerrar</strong> o caso, e a soma é o total de contatos abertos na janela. Os casos{' '}
            <strong className="font-semibold text-ink">em acompanhamento</strong> ainda não
            terminaram e por isso ficam fora do que está apurado. Esta é a distribuição do que foi
            registrado — nenhuma das faixas mede quanto do desfecho se deve à intervenção.
          </Hint>
        }
      />

      {total === 0 ? (
        <p className="flex-1 py-14 text-center text-[12px] text-ink-4">
          Nenhuma intervenção na janela selecionada.
        </p>
      ) : (
        <>
          {/* A barra. O vão de 2px é `gap`, não borda. */}
          <div className="mt-5">
            <div
              className="flex h-3.5 w-full gap-0.5 overflow-hidden rounded-full"
              role="img"
              aria-label={rows
                .filter((r) => r.value > 0)
                .map((r) => `${r.label}: ${int(r.value)}`)
                .join('; ')}
            >
              {rows.map((row, i) =>
                row.value === 0 ? null : (
                  <motion.span
                    key={row.key}
                    className="h-full first:rounded-l-full last:rounded-r-full"
                    style={{ backgroundColor: row.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${row.percent}%` }}
                    transition={{ duration: 0.6, ease: emphasis, delay: i * 0.05 }}
                    title={`${row.label}: ${int(row.value)} (${decimal(row.percent, 1)}%)`}
                  />
                ),
              )}
            </div>

            {/* Onde termina o que foi apurado. É o denominador da taxa, dito
                na própria régua em vez de só na nota de pé. */}
            <div className="relative mt-1.5 h-4">
              <span
                className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${Math.min(97, Math.max(3, settledShare))}%` }}
              >
                <span className="h-1.5 w-px bg-hairline-strong" aria-hidden="true" />
              </span>
              <span
                className="absolute top-2 -translate-x-1/2 text-[10px] whitespace-nowrap text-ink-4"
                style={{ left: `${Math.min(88, Math.max(12, settledShare))}%` }}
              >
                fim dos apurados
              </span>
            </div>
          </div>

          <ul className="mt-6 flex-1 space-y-0.5">
            {rows.map((row) => (
              <li
                key={row.key}
                className="flex items-baseline gap-2.5 rounded-md px-1.5 py-1.5"
                title={row.meaning}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">
                  {row.label}
                  {!row.settled && (
                    <span className="ml-1.5 text-[11px] text-ink-4">fora do denominador</span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-[12.5px] font-medium text-ink tabular">
                  {int(row.value)}
                </span>
                <span className="w-11 shrink-0 text-right font-mono text-[11px] text-ink-4 tabular">
                  {decimal(row.percent, 1)}%
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-hairline pt-3.5">
            <Denominator
              numerator={int(outcomes.settled)}
              numeratorLabel="com desfecho apurado"
              denominator={int(total)}
              denominatorLabel="contatos abertos na janela"
            />
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3">
              Os <span className="font-mono tabular">{int(outcomes.counts.acompanhamento)}</span> em
              acompanhamento entram na composição quando fecharem. As duas faixas que pedem decisão
              são{' '}
              <span className="font-mono font-medium text-ink tabular">
                {int(outcomes.counts['sem-contato'])}
              </span>{' '}
              sem contato e{' '}
              <span className="font-mono font-medium text-ink tabular">
                {int(outcomes.counts['risco-mantido'])}
              </span>{' '}
              com risco mantido.
            </p>
          </div>
        </>
      )}
    </Card>
  );
}
