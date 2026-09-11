import { useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { Hint } from '../ui/Hint';
import { MeterBar } from '../ui/Charts';
import { collapseVariants } from '../../lib/motion';
import { decimal, int, money } from '../../lib/format';

/* ==========================================================================
   Primitivas dos Indicadores
   --------------------------------------------------------------------------
   Três componentes, e cada um existe para impedir um erro concreto que a tela
   anterior cometia.
   ========================================================================== */

/* -- 1. A taxa com denominador -------------------------------------------- */

/**
 * Um número institucional, com o seu denominador ao lado e a sua definição a um
 * clique.
 *
 * A regra que este componente torna impossível de esquecer: `value` aceita
 * `null`, e `null` NÃO imprime zero. `Health Score médio 0/100` numa base
 * carregada foi exatamente isso — um fallback vazando como leitura. Aqui a
 * ausência de medida tem forma própria: um travessão, em tinta apagada, com o
 * motivo escrito embaixo.
 */
export function RateStat({
  label,
  value,
  suffix,
  decimals = 0,
  format = 'int',
  denominator,
  emptyReason = 'sem amostra no recorte',
  definition,
  tone = 'plain',
  detail,
}: {
  label: string;
  /** `null` = não há medida. Nunca renderiza 0 no lugar. */
  value: number | null;
  suffix?: string;
  decimals?: number;
  /**
   * Como o número é escrito. `money` passa por `Intl.NumberFormat` com BRL —
   * sem isso, `127440` saía como `127.440` num cartão chamado "Receita
   * preservada", que é um valor monetário impresso sem moeda.
   */
  format?: 'int' | 'money';
  /** O denominador, por extenso. Obrigatório: taxa sem denominador não sai. */
  denominator: ReactNode;
  emptyReason?: string;
  definition: ReactNode;
  tone?: 'plain' | 'vital' | 'warn' | 'crit';
  /** Sufixo semântico ao lado do valor, como "/100". */
  detail?: string;
}) {
  const ink =
    tone === 'vital'
      ? 'text-vital-ink'
      : tone === 'crit'
        ? 'text-crit-ink'
        : tone === 'warn'
          ? 'text-warn-ink'
          : 'text-ink';

  return (
    <div className="flex min-w-0 flex-col rounded-xl bg-surface-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-[12px] font-medium text-ink-3">{label}</span>
        <Hint label={label.toLowerCase()} align="right">
          {definition}
        </Hint>
      </div>

      <p className="mt-2 flex items-baseline gap-1.5">
        {value === null ? (
          <span
            className="font-mono text-[26px] leading-none font-medium text-ink-4"
            aria-label="sem medida"
          >
            —
          </span>
        ) : (
          <>
            <span
              className={[
                'font-mono leading-none font-medium tracking-tight tabular',
                // Um valor em reais tem quatro dígitos a mais que uma taxa; no
                // mesmo corpo ele estoura a largura do cartão em 1280px.
                format === 'money' ? 'text-[21px]' : 'text-[26px]',
                ink,
              ].join(' ')}
            >
              {format === 'money'
                ? money(value)
                : decimals > 0
                  ? decimal(value, decimals)
                  : int(value)}
            </span>
            {suffix && <span className={`text-[15px] font-medium ${ink}`}>{suffix}</span>}
            {detail && <span className="text-[12px] text-ink-4">{detail}</span>}
          </>
        )}
      </p>

      <p className="mt-3 border-t border-hairline pt-2.5 text-[11px] leading-relaxed text-ink-3">
        {value === null ? emptyReason : denominator}
      </p>
    </div>
  );
}

/* -- 2. Contagem e percentual, separados --------------------------------- */

/**
 * A linha que consertou `2648,1%`.
 *
 * O bug original era tipográfico, não aritmético: `{count}` e `{percent}` em
 * dois `<span>` adjacentes com 4px de margem, e `26` + `48,1%` colavam numa
 * leitura só. Aqui as duas grandezas ocupam COLUNAS de largura fixa, alinhadas
 * à direita, separadas por um fio vertical. Não é possível concatená-las por
 * acidente porque elas não são mais vizinhas de texto — são células.
 */
export function CountPercentRow({
  label,
  badge,
  range,
  count,
  percent,
  color,
  onClick,
  title,
}: {
  label: ReactNode;
  badge?: ReactNode;
  /** Faixa numérica da classificação, quando houver. */
  range?: string;
  count: number;
  percent: number;
  color: string;
  onClick?: () => void;
  title?: string;
}) {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      {...(onClick ? { onClick, type: 'button' as const } : {})}
      title={title}
      className={[
        'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
        onClick ? 'hover:bg-surface-2' : '',
      ].join(' ')}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        {badge ?? (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        )}
        <span className="min-w-0 truncate text-[12.5px] font-medium text-ink-2">{label}</span>
        {range && (
          <span className="shrink-0 font-mono text-[10.5px] text-ink-4 tabular">{range}</span>
        )}
      </span>

      <span className="hidden w-24 shrink-0 sm:block">
        <MeterBar value={percent} color={color} height={4} />
      </span>

      {/* Contagem e percentual: duas células, um fio entre elas. */}
      <span className="flex shrink-0 items-center">
        <span className="w-14 text-right font-mono text-[12.5px] font-semibold text-ink tabular">
          {int(count)}
        </span>
        <span className="mx-2.5 h-4 w-px bg-hairline" aria-hidden="true" />
        <span className="w-14 text-right font-mono text-[12px] font-normal text-ink-3 tabular">
          {decimal(percent, 1)}%
        </span>
      </span>
    </Tag>
  );
}

/* -- 3. Tabela responsiva com coluna prioritária -------------------------- */

export interface TableColumn<T> {
  key: string;
  header: string;
  /** `true` = sempre visível, inclusive em 390px. Uma ou duas por tabela. */
  priority?: boolean;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
}

/**
 * Uma tabela que não vira ilegível ao encolher.
 *
 * Comprimir oito colunas em 390px produz oito colunas de 40px, e o requisito
 * era o contrário: coluna prioritária mais expansão. Abaixo de `sm` só as
 * colunas marcadas como prioritárias ficam na linha; as outras viram uma lista
 * de definição que abre no clique. Acima de `sm` é uma tabela normal, com
 * `overflow-x` própria — a página nunca rola na horizontal por causa dela.
 */
export function ResponsiveTable<T>({
  columns,
  rows,
  keyOf,
  onRowClick,
  emptyMessage = 'Sem dados no recorte.',
  minWidth = 720,
}: {
  columns: TableColumn<T>[];
  rows: T[];
  keyOf: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  minWidth?: number;
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-10 text-center text-[12px] text-ink-4">{emptyMessage}</p>;
  }

  const primary = columns.filter((c) => c.priority);
  const secondary = columns.filter((c) => !c.priority);

  return (
    <>
      {/* Desktop e tablet */}
      <div className="scroll-slim hidden overflow-x-auto sm:block">
        <table className="w-full text-left" style={{ minWidth }}>
          <thead>
            <tr className="border-b border-hairline bg-surface-2">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={[
                    'px-4 py-2.5 text-[11px] font-medium text-ink-4',
                    col.align === 'right' ? 'text-right' : 'text-left',
                  ].join(' ')}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((row) => (
              <tr
                key={keyOf(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer transition-colors hover:bg-surface-hover' : ''}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={[
                      'px-4 py-3 align-middle',
                      col.align === 'right' ? 'text-right' : 'text-left',
                    ].join(' ')}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: prioritária + expansão */}
      <ul className="divide-y divide-hairline sm:hidden">
        {rows.map((row) => (
          <MobileRow
            key={keyOf(row)}
            row={row}
            primary={primary.length > 0 ? primary : columns.slice(0, 1)}
            secondary={primary.length > 0 ? secondary : columns.slice(1)}
          />
        ))}
      </ul>
    </>
  );
}

function MobileRow<T>({
  row,
  primary,
  secondary,
}: {
  row: T;
  primary: TableColumn<T>[];
  secondary: TableColumn<T>[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
          {primary.map((col) => (
            <span key={col.key} className="min-w-0">
              {col.render(row)}
            </span>
          ))}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-4 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            variants={collapseVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="overflow-hidden"
          >
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-4 pb-4">
              {secondary.map((col) => (
                <div key={col.key} className="min-w-0">
                  <dt className="text-[10.5px] font-medium text-ink-4">{col.header}</dt>
                  <dd className="mt-0.5 min-w-0">{col.render(row)}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
