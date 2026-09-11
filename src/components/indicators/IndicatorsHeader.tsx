import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { emphasis } from '../../lib/motion';
import { useReducedMotion } from '../../lib/reactive';
import { int } from '../../lib/format';

/* ==========================================================================
   Abertura de Indicadores
   --------------------------------------------------------------------------
   O diagnóstico desta tela era "não notei diferenças grandes", e ele estava
   certo: seis abas de conteúdo excelente abaixo de um cabeçalho de 24px que
   dizia "Indicadores" e nada mais. Um workspace analítico com seis painéis
   precisa dizer, antes de qualquer número, EM QUAL painel você está e o que
   ele se propõe a medir — senão a troca de aba é uma troca de conteúdo sem
   troca de contexto, e o leitor recomeça a orientação a cada clique.

   A abertura resolve isso com DUAS informações e nenhuma decoração:

     1. O NOME DO PAINEL, no maior corpo do sistema. Ele TROCA quando a aba
        troca, e a troca é animada — é o movimento que informa que a página
        respondeu, no lugar onde o olho já está.
     2. O TAMANHO DA AMOSTRA, sempre, antes do primeiro número. Esta tela lê a
        amostra operacional — dezenas de alunos com dossiê completo —, não o
        censo de 8.672 que o Dashboard agrega. Confundir os dois é o que faz
        alguém apresentar "Health Score médio da instituição" a partir de 54
        alunos, e a defesa contra isso é imprimir o denominador na abertura em
        vez de escondê-lo num aviso no meio da rolagem. É a única linha da peça
        que sobreviveu à limpeza, e sobreviveu porque é DADO.

   A TESE SAIU. Cada painel trazia um parágrafo de quatro linhas dizendo o que
   ele mede, e seis parágrafos desses eram o volume de texto da peça inteira. O
   diagnóstico foi direto: "poluído de info". A pastilha da aba já nomeia o
   assunto e o título grande já o repete no corpo de display; a terceira
   descrição do mesmo painel era prosa sobre a tela, não leitura da operação.

   O material é o `.editorial-slab`: azul institucional CHAPADO. Ele já foi
   grafite com halo verde e depois azul com halo e degradê — a cor mudou porque
   a maior superfície da tela precisava pertencer à marca, e as camadas saíram
   porque uma peça que carrega uma frase e um denominador não precisa de volume
   para ser vista. Ela aparece UMA vez por tela: repetida, deixa de ser abertura
   e vira papel de parede.
   ========================================================================== */

export function IndicatorsHeader({
  display,
  sampleSize,
  sampleTotal,
  actions,
  children,
}: {
  /** O nome do painel ativo, no corpo de display. Troca com a aba. */
  display: string;
  sampleSize: number;
  sampleTotal: number;
  /** Menu de exportação e impressão. */
  actions?: ReactNode;
  /** O controle de abas, que fica fora do slab, sobre a superfície da página. */
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();

  return (
    <header className="space-y-4">
      <section className="editorial-slab px-6 py-8 sm:px-9 sm:py-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            {/* O nome do painel. `AnimatePresence` com `mode="wait"` para que o
                título antigo saia antes de o novo entrar: cruzados, os dois se
                sobrepõem por 100ms e o resultado é ilegível no corpo de 56px. */}
            <div className="min-h-13 sm:min-h-16 lg:min-h-18">
              {reduced ? (
                <DisplayTitle>{display}</DisplayTitle>
              ) : (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={display}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: emphasis }}
                  >
                    <DisplayTitle>{display}</DisplayTitle>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>

            {/* O denominador, e ele fica DEPOIS do título agora. Antes era uma
                sobrelinha, o que dava três alturas de texto acima do nome do
                painel; embaixo ele lê como a legenda do que o título nomeia,
                que é o que ele é. */}
            <p className="mt-3 text-[12px] font-medium text-white/70">
              amostra operacional de{' '}
              <span className="font-mono tabular text-white/85">{int(sampleSize)}</span> alunos
              {sampleSize !== sampleTotal && (
                <>
                  {' '}
                  <span className="text-white/60">
                    de <span className="font-mono tabular">{int(sampleTotal)}</span> monitorados
                  </span>
                </>
              )}
            </p>
          </div>

          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </section>

      {children}
    </header>
  );
}

function DisplayTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-[36px] leading-[1.02] font-semibold tracking-[-0.038em] text-white sm:text-[48px] lg:text-[56px]">
      {children}
    </h1>
  );
}
