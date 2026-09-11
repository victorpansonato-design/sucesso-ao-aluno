import { ArrowDown, ArrowLeftRight, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import type { FunnelStage } from '../../lib/pulse';
import { Card, CardHeader } from '../ui/Surfaces';
import { Hint } from '../ui/Hint';
import { emphasis } from '../../lib/motion';
import { decimal, int } from '../../lib/format';

/* ==========================================================================
   Funil de atenção
   --------------------------------------------------------------------------
   Este cartão existe para resolver a contradição aparente que o diagnóstico
   apontou: 1.741 e 163 na mesma tela, sem nada explicando por que os dois
   descrevem "atenção" e discordam por uma ordem de grandeza.

   A resposta é que eles não discordam — são medidas diferentes:

     1.741  é uma FAIXA DE HEALTH SCORE. Classificação automática. Ninguém foi
            acionado.
       163  são CASOS ABERTOS com uma pessoa responsável.

   Por isso o conector entre os dois degraus é OUTRO conector. Uma seta para
   baixo diz "destes, tantos"; a seta dupla diz "outra medida da mesma base". Um
   funil que usa a mesma seta nas duas transições afirma um subconjunto que não
   existe, e continua errado mesmo com os cinco números certos.

   A barra de cada degrau é proporcional ao SEU PRÓPRIO denominador, que está
   escrito ao lado dela. `30 casos` desenhados contra 8.672 seriam três pixels e
   nenhuma informação; contra os 163 de que saíram, são 18,4% e uma leitura.
   ========================================================================== */

const TONE_BAR: Record<FunnelStage['tone'], string> = {
  ink: 'var(--ink-4)',
  warn: 'var(--warn)',
  risk: 'var(--risk)',
  crit: 'var(--crit)',
};

export function AttentionFunnel({
  stages,
  onSelect,
}: {
  stages: FunnelStage[];
  /**
   * A chave do degrau. Não uma rota: quem lê o Dashboard é a gestão, e cada
   * degrau deste funil abria a Fila de Atendimento ou a Base de Alunos — telas
   * de trabalho de outro público. O aprofundamento agora acontece nesta aba, e
   * traduzir a chave em painel é responsabilidade da view.
   */
  onSelect: (stageKey: string) => void;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Funil de atenção"
        subtitle="Cinco leituras da mesma base. Duas delas não são degraus do mesmo funil — o conector diz qual é qual."
        action={
          <Hint label="o funil de atenção" align="right">
            <strong className="font-semibold text-ink">Faixa de atenção</strong> é uma classificação
            de Health Score: o sistema calculou e ninguém foi acionado.{' '}
            <strong className="font-semibold text-ink">Atenção humana</strong> são casos abertos com
            um responsável. Um aluno pode estar em faixa estável e ter caso aberto, e a maioria dos
            alunos na faixa de atenção não tem caso — por isso os dois números convivem sem se
            contradizer.
          </Hint>
        }
      />

      <ol className="mt-4 flex-1 space-y-0">
        {stages.map((stage, i) => {
          const ratio = stage.ofValue > 0 ? (stage.count / stage.ofValue) * 100 : 0;
          const previous = stages[i - 1];

          return (
            <li key={stage.key}>
              {previous && <Connector relation={stage.relation} />}

              <button
                type="button"
                onClick={() => onSelect(stage.key)}
                title={stage.meaning}
                className="group w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2"
              >
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">
                    {stage.label}
                  </span>
                  <span className="shrink-0 font-mono text-[16px] leading-none font-medium text-ink tabular">
                    {int(stage.count)}
                  </span>
                  <ChevronRight
                    className="h-3.5 w-3.5 shrink-0 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </span>

                <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-track">
                  <motion.span
                    className="block h-full rounded-full"
                    style={{ backgroundColor: TONE_BAR[stage.tone] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, ratio)}%` }}
                    transition={{ duration: 0.6, ease: emphasis, delay: i * 0.05 }}
                  />
                </span>

                {/* O denominador de cada degrau, sempre visível. Nunca uma
                    porcentagem solta. */}
                <span className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-[11px] text-ink-3">
                  <span className="font-mono font-medium text-ink-2 tabular">
                    {decimal(ratio, 1)}%
                  </span>
                  <span>{stage.ofLabel}</span>
                  <span className="text-ink-4">·</span>
                  <span className="font-mono text-ink-4 tabular">{int(stage.ofValue)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/**
 * O conector. É o elemento que carrega toda a honestidade do cartão.
 *
 * Nem a forma nem a cor sozinhas diferenciam os dois casos: há ícone, há
 * rótulo escrito e há um fio pontilhado contra um fio contínuo. Três encodings
 * para uma distinção que, se passar batida, volta a produzir a leitura errada
 * que este cartão existe para consertar.
 */
function Connector({ relation }: { relation: FunnelStage['relation'] }) {
  if (relation === 'subset') {
    return (
      <span className="flex items-center gap-1.5 py-1 pl-2">
        <ArrowDown className="h-3 w-3 shrink-0 text-ink-4" aria-hidden="true" />
        <span className="h-px w-4 bg-hairline-strong" aria-hidden="true" />
        <span className="text-[10.5px] text-ink-4">destes,</span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 py-1 pl-2">
      <ArrowLeftRight className="h-3 w-3 shrink-0 text-warn-ink" aria-hidden="true" />
      <span
        className="h-px w-4"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to right, var(--warn) 0 3px, transparent 3px 6px)',
        }}
        aria-hidden="true"
      />
      <span className="text-[10.5px] font-medium text-warn-ink">
        outra medida da mesma base — não um subconjunto
      </span>
    </span>
  );
}
