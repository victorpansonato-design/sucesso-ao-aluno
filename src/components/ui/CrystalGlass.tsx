import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'motion/react';
import { useCoarsePointer, useSheen } from '../../lib/reactive';
import { useEnter } from './Reveal';
import { decimal } from '../../lib/format';

/* ==========================================================================
   CrystalGlassCard — uma placa de vidro apoiada sobre um gráfico
   --------------------------------------------------------------------------
   O objeto protagonista do sistema. Ele faz duas coisas que normalmente se
   atropelam: mostrar a SÉRIE de um indicador e mostrar o VALOR dele, sem que
   um vire ruído do outro.

   A composição é a da referência da Apple — um bloco de vidro apoiado sobre
   uma fotografia, com a imagem visível através dele:

     · o CARTÃO é o gráfico: a grade de 0 a 100 e as colunas, na altura toda;
     · a PLACA de vidro flutua sobre ele, com margem dos quatro lados, e é ela
       que carrega o rótulo, o número e a variação;
     · os controles que ficam fora da placa levam a sua própria pastilha de
       vidro.

   Duas tentativas anteriores erraram pelo mesmo motivo: uma lâmina cobrindo o
   cartão inteiro é invisível na metade que tem branco atrás, e a versão que
   resolvia isso com um véu branco sólido sobre o gráfico havia deixado de ser
   vidro — era uma superfície opaca com degradê. Com a placa apoiada sobre a
   grade, existe conteúdo atrás de cada milímetro dela, e o material aparece.

   O MATERIAL NÃO DEFORMA O FUNDO, e isso é uma regra e não uma limitação. Uma
   versão intermediária usou refração de verdade — um filtro SVG deslocando o
   fundo canal por canal — e o efeito era convincente como vidro e errado como
   instrumento: as colunas entortavam dentro da placa (uma barra é uma medida,
   a prumada dela é informação) e o deslocamento por canal pintava franja azul
   e amarelada sobre um gráfico onde a única cor com significado é o verde.
   Aqui o vidro é translucidez, aresta, espessura na borda e reflexo. A série
   atravessa o material reta. Ver a nota de versões em `index.css`.

   UMA ARMADILHA QUE VALE FICAR ESCRITA: nenhum ancestral entre a peça de vidro
   e `.cg-shell` pode ter `isolation: isolate`, `opacity` < 1, `filter`, `mask`
   ou `contain: paint`. Qualquer um deles cria um BACKDROP ROOT e a peça passa a
   desfocar o próprio interior vazio — ela não quebra, ela simplesmente vira um
   retângulo chapado, que é o sintoma mais difícil de diagnosticar do arquivo.

   Quatro regras que o componente impõe:

     1. AS COLUNAS SÃO DADO. Quem chama passa uma série calculada com a MESMA
        conta do número grande — a taxa dia a dia, ou a mesma taxa por
        especialista. Barras com alturas escolhidas por gosto na primeira dobra
        de um painel institucional não são decoração inofensiva: a próxima
        pessoa a olhar a tela acredita nelas.
     2. A ESCALA COMEÇA EM ZERO E VAI A CEM. Uma taxa desenhada entre o mínimo
        e o máximo da própria série exagera a variação: 68% e 72% viram uma
        coluna baixa e uma alta. Aqui a altura significa "quanto de 100", que é
        o que uma taxa é — e as marcas de 0 / 50 / 100 na borda tornam isso
        legível em vez de proporção vaga.
     3. TEXTO SÓ DENTRO DA PLACA. É a placa que garante contraste, com o seu
        próprio tinte. Nenhum caractere é desenhado direto sobre uma coluna.
     4. A SÉRIE É PUBLICADA EM TEXTO. `role="meter"` para o valor e `role="img"`
        com uma lista `sr-only` para a série. Nenhuma informação vive só na
        altura de um retângulo.

   Movimento: as colunas sobem em 1,15s com escalonamento de 55ms, e a lentidão
   é deliberada. Uma série que aparece em 200ms não é lida como série, é lida
   como layout chegando; nesta duração o olho acompanha a subida e registra que
   existe uma forma antes de o número ser lido. Com `prefers-reduced-motion`,
   elas nascem na altura final.
   ========================================================================== */

/**
 * Uma coluna do gráfico de fundo.
 *
 * O tipo mora aqui e não em `lib/pulse` de propósito: este objeto é do sistema,
 * não do Dashboard. A série pode ser temporal (a taxa dia a dia) ou categórica
 * ordenada (a mesma taxa por especialista) — o que ele exige é que `value` seja
 * uma medida de 0 a 100 na MESMA unidade do número grande na placa, para que o
 * gráfico e o valor impresso nunca se contradigam.
 */
export interface CrystalColumn {
  /** Rótulo curto da coluna, para o leitor de tela. */
  label: string;
  /** A medida daquela coluna, 0–100. */
  value: number;
  /** `true` na coluna que o número em corpo grande representa, se houver uma. */
  current?: boolean;
}

export function CrystalGlassCard({
  columns,
  meterLabel,
  meterText,
  seriesLabel,
  minHeight = 392,
  className = '',
  children,
  footer,
}: {
  columns: CrystalColumn[];
  /** Nome da medida, para leitor de tela. */
  meterLabel: string;
  /** O valor por extenso, lido junto do calibre. */
  meterText: string;
  /** O que a série mostra, para o `aria-label` do gráfico. */
  seriesLabel: string;
  minHeight?: number;
  className?: string;
  /** Rótulo, número e variação. Vai DENTRO da placa de vidro. */
  children: ReactNode;
  /** Controles ancorados no pé do cartão, sobre as colunas. Use `GlassPill`. */
  footer?: ReactNode;
}) {
  const { ref: enterRef, entered, reduced } = useEnter<HTMLDivElement>();
  const coarse = useCoarsePointer();
  const { ref: sheenRef, handlers } = useSheen<HTMLDivElement>({ disabled: reduced || coarse });

  const current = columns.find((c) => c.current) ?? columns[columns.length - 1];

  /* A largura máxima da barra depende de QUANTAS barras existem, e isso é uma
     decisão de leitura em vez de um detalhe de layout. Uma série de doze dias
     precisa de barras finas para as doze caberem com ar entre elas; uma série
     de cinco especialistas com as mesmas barras finas fica com cinco riscos
     perdidos num cartão largo, e o gráfico deixa de ter presença. O trilho usa
     `space-between`, então o teto de largura é o que decide se a série lê como
     uma sequência densa ou como um punhado de categorias. */
  const colMax = columns.length >= 10 ? 16 : columns.length >= 6 ? 26 : 46;

  /* Dois refs no mesmo nó: um observa a entrada no viewport, o outro escreve as
     coordenadas do brilho. Um wrapper a mais para separá-los custaria uma
     camada de composição dentro de um objeto que já tem três. */
  const setRefs = (node: HTMLDivElement | null) => {
    enterRef.current = node;
    sheenRef.current = node;
  };

  return (
    <div
      ref={setRefs}
      {...handlers}
      style={{ minHeight, '--cg-col-max': `${colMax}px` } as CSSProperties}
      className={`cg-shell ${className}`}
    >
      {/* -- 1. A grade: a régua, e o que garante refração em toda a altura -- */}
      <span className="cg-grid" aria-hidden="true" />

      {/* A escala, no vão reservado à direita (`--cg-pad-r`). Ela mora fora do
          alcance das colunas de propósito: uma marca numérica desenhada sobre
          uma barra verde precisaria de halo para ser lida, e halo em cima de
          gráfico é o começo de uma tela suja. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-2">
        {[100, 50, 0].map((tick) => (
          <span
            key={tick}
            className="absolute right-2.5 translate-y-1/2 font-mono text-[9.5px] font-medium text-ink-3 opacity-70"
            style={{
              bottom: `calc(var(--cg-pad-y) + (100% - var(--cg-pad-y) * 2) * ${tick / 100})`,
            }}
          >
            {tick}
          </span>
        ))}
      </span>

      {/* -- 2. As colunas -------------------------------------------------- */}
      <div className="cg-plot" aria-hidden="true">
        {columns.map((col, i) => {
          const height = Math.max(0, Math.min(100, col.value));
          return (
            <motion.span
              key={`${col.label}-${i}`}
              className="cg-col"
              data-current={col.current ? 'true' : 'false'}
              initial={{ height: reduced ? `${height}%` : '0%' }}
              animate={{ height: `${entered ? height : 0}%` }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: 1.15, ease: [0.16, 1, 0.3, 1], delay: 0.14 + i * 0.055 }
              }
            />
          );
        })}
      </div>

      {/* -- 3. A placa de vidro, com o texto dentro ------------------------
          Quatro camadas, todas em CSS (`.cg-*` em `index.css`): o corpo com o
          tinte e o desfoque, o anel de espessura, o reflexo especular e a
          aresta. Nenhuma delas deforma o que passa por trás. */}
      <div className="cg-lens">
        <span className="cg-glass" aria-hidden="true" />
        <span className="cg-edge" aria-hidden="true" />
        <span className="cg-spec" aria-hidden="true" />
        <span className="cg-rim" aria-hidden="true" />
        <div className="cg-content p-5">{children}</div>
      </div>

      {/* -- 4. Os controles, no pé, sobre as colunas ----------------------- */}
      {footer && (
        <div
          className="absolute z-4 flex flex-wrap items-end justify-between gap-3"
          style={{
            left: 'var(--cg-lens-inset)',
            right: 'var(--cg-lens-inset)',
            bottom: 'var(--cg-lens-inset)',
          }}
        >
          {footer}
        </div>
      )}

      {/* -- 5. A medida e a série, em texto ------------------------------- */}
      <span
        role="meter"
        aria-label={meterLabel}
        aria-valuenow={current ? Math.round(current.value * 10) / 10 : 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={meterText}
        className="sr-only"
      />
      <div role="img" aria-label={seriesLabel} className="sr-only">
        <ul>
          {columns.map((col, i) => (
            <li key={`${col.label}-sr-${i}`}>
              {col.label}: {decimal(col.value, 1)}%
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* -- Tipografia e controles de dentro do vidro ----------------------------- */

/**
 * Rótulo dentro da placa.
 *
 * Existe para que ninguém escreva `text-ink-3` aqui. A placa é translúcida e o
 * que passa por trás dela muda conforme o indicador se move — com uma coluna
 * verde atrás, a tinta 3 fica no limite do AA. A diferença é invisível no
 * editor e visível na tela.
 */
export function GlassLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`text-[12px] font-medium text-ink-2 ${className}`}>{children}</span>;
}

/** O número protagonista. Mono, tabular, tracking fechado. */
export function GlassValue({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[44px] leading-[0.9] font-medium tracking-tight text-ink tabular sm:text-[52px]">
      {children}
    </span>
  );
}

/** Pastilha de vidro para um controle que fica sobre as colunas. */
export function GlassPill({
  children,
  onClick,
  title,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  className?: string;
}) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick, title } : {})}
      className={[
        'cg-pill inline-flex items-center gap-1.5 rounded-full px-3.5 py-2',
        'text-[12px] font-semibold text-ink',
        className,
      ].join(' ')}
    >
      <span className="cg-pill-glass" aria-hidden="true" />
      {/* O rótulo sobe para cima do material. Antes o `hover` era
          `opacity-80` no botão inteiro — e opacidade < 1 CRIA UM BACKDROP
          ROOT, então passar o mouse apagava o vidro da própria pastilha.
          O realce agora é do vidro, via `--cg-pill-bg`. */}
      <span className="relative z-1 inline-flex items-center gap-1.5">{children}</span>
    </Tag>
  );
}
