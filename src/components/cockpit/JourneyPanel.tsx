import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import type { JourneyStage } from '../../lib/cockpit';
import { Card, CardHeader } from '../ui/Surfaces';
import { emphasis } from '../../lib/motion';
import { decimal, int } from '../../lib/format';

/* ==========================================================================
   Quarta linha — a jornada do aluno
   --------------------------------------------------------------------------
   O pedido era uma linha temporal sofisticada, não um fluxograma. A diferença,
   na prática, é onde a informação mora.

   Um fluxograma gasta a tela desenhando caixas e setas — a estrutura ocupa o
   espaço e os números sobram nas beiradas. Aqui a estrutura é UMA barra de 6px
   atravessando o cartão, dividida em etapas. A parte preenchida de cada trecho
   é a taxa de conclusão da porta daquela etapa; o vão que sobra é a evasão dela.
   A forma já é o dado, e o espaço restante fica todo para os três números que
   importam: quantos estão ali, quantos passaram, quantos estão em atenção.

   As duas trilhas ficam separadas de propósito. As cinco primeiras etapas são o
   funil do ingressante — cada uma recebe quem passou pela porta anterior, e é
   por isso que a contagem cai. "Veterano" é outra população: quem já atravessou
   a janela de 90 dias. Somar as duas produziria um funil que cresce no fim, que
   é exatamente o gráfico que ninguém consegue explicar numa reunião.
   ========================================================================== */

export function JourneyPanel({
  stages,
  onOpenTrack,
  focusLabel,
}: {
  stages: JourneyStage[];
  onOpenTrack: (track: 'entrada' | 'base') => void;
  /** Recorte ativo, para dizer a que se refere a coluna "em atenção". */
  focusLabel: string | null;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const entry = stages.filter((s) => s.track === 'entrada');
  const base = stages.filter((s) => s.track === 'base');
  const empty = stages.every((s) => s.count === 0);

  const renderStage = (stage: JourneyStage, index: number, groupSize: number) => {
    const active = hover === stage.key;
    const dropped = stage.count - stage.cleared;

    return (
      <button
        key={stage.key}
        onPointerEnter={() => setHover(stage.key)}
        onPointerLeave={() => setHover((h) => (h === stage.key ? null : h))}
        onFocus={() => setHover(stage.key)}
        onBlur={() => setHover((h) => (h === stage.key ? null : h))}
        onClick={() => onOpenTrack(stage.track)}
        title={stage.gate}
        className={[
          // `min-w-38` + wrap em vez de `flex-nowrap`: em 900px as cinco colunas
          // caíam para ~96px de texto e "Primeiro acesso" virava "Primeiro a…".
          // Com largura mínima elas quebram em duas fileiras e ninguém trunca.
          'group flex min-w-38 flex-1 flex-col rounded-lg px-2 py-2.5 text-left transition-colors outline-none',
          active ? 'bg-surface-2' : 'hover:bg-surface-2',
        ].join(' ')}
      >
        <span className="flex items-baseline gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">
            {stage.label}
          </span>
          {index < groupSize - 1 && (
            <ArrowRight className="h-3 w-3 shrink-0 text-ink-4" aria-hidden="true" />
          )}
        </span>

        <span className="mt-2 font-mono text-[21px] leading-none font-medium tracking-tight text-ink">
          {int(stage.count)}
        </span>

        {/* A barra: preenchida = passou a porta, vão = ficou atrás. */}
        <span className="mt-2.5 block h-1.5 w-full overflow-hidden rounded-full bg-track">
          <motion.span
            className="block h-full rounded-full bg-ink-3"
            initial={{ width: 0 }}
            animate={{ width: decimal(stage.completion, 2) + '%' }}
            transition={{ duration: 0.7, ease: emphasis, delay: index * 0.06 }}
          />
        </span>

        <span className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-mono text-[11.5px] font-medium text-ink-2">
            {decimal(stage.completion, 1)}%
          </span>
          <span className="text-[11px] text-ink-4">concluiu</span>
          {dropped > 0 && (
            <span className="text-[11px] text-ink-4">
              · <span className="font-mono">{int(dropped)}</span> não
            </span>
          )}
        </span>

        <span className="mt-1 text-[11px] text-ink-4">
          {stage.attention > 0 ? (
            <>
              <span className="font-mono font-medium text-warn-ink">{int(stage.attention)}</span> em
              atenção
            </>
          ) : (
            <span>sem casos abertos</span>
          )}
        </span>

        {/* A porta da etapa fica sempre visível.
            Ela começou escondida atrás do hover, com `opacity-0` para não
            deslocar o layout — mas texto invisível continua ocupando três linhas
            em cada uma das seis colunas, e o cartão ganhava uma faixa vazia de
            quase cinquenta pixels no pé. Mostrar a frase custa o mesmo espaço e
            responde de graça a pergunta "concluir esta etapa significa o quê?". */}
        <span
          className={[
            'mt-2 text-[10.5px] leading-snug transition-colors',
            active ? 'text-ink-3' : 'text-ink-4',
          ].join(' ')}
        >
          {stage.gate}
        </span>
      </button>
    );
  };

  return (
    <Card>
      <CardHeader
        title="Jornada do aluno"
        subtitle={
          focusLabel
            ? `Etapas da entrada e a base já estabilizada. A coluna "em atenção" está recortada por ${focusLabel}.`
            : 'Cada etapa recebe quem passou pela porta anterior. A barra é a taxa de conclusão da etapa.'
        }
      />

      {empty ? (
        <p className="py-14 text-center text-[12px] text-ink-4">
          Nenhum aluno no escopo selecionado.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-stretch">
          <div className="min-w-0 flex-1">
            <p className="mb-1 px-2 text-[11px] font-medium text-ink-4">
              Funil de entrada · ingressantes do ciclo
            </p>
            <div className="flex min-w-0 flex-wrap gap-1">
              {entry.map((stage, i) => renderStage(stage, i, entry.length))}
            </div>
          </div>

          <span className="hidden w-px shrink-0 bg-hairline xl:block" />

          <div className="min-w-0 xl:w-43">
            <p className="mb-1 px-2 text-[11px] font-medium text-ink-4">Fora da janela de 90 dias</p>
            <div className="flex min-w-0">{base.map((stage) => renderStage(stage, 0, 1))}</div>
          </div>
        </div>
      )}
    </Card>
  );
}
