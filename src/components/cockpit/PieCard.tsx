import type { ReactNode } from 'react';
import { Card, CardHeader } from '../ui/Surfaces';
import { Donut } from '../ui/Charts';
import { decimal, int } from '../../lib/format';

/* ==========================================================================
   Cartão de pizza
   --------------------------------------------------------------------------
   Quatro blocos do Dashboard mostram a mesma coisa em forma diferente: um
   total repartido em fatias. Um componente só para os quatro evita que a
   distribuição de risco tenha uma legenda e o desfecho das intervenções tenha
   outra — quando o leitor aprende a ler um, já sabe ler os três.

   A pizza dá a proporção num relance; a legenda ao lado dá o número exato e a
   ordem. As duas coisas são necessárias: ninguém tira "1.275" de um arco, e
   ninguém vê "6,9% contra 2,5%" numa coluna de dígitos.
   ========================================================================== */

export interface PieSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  /** Segunda linha da legenda, quando o número sozinho não basta. */
  detail?: ReactNode;
}

export function PieCard({
  title,
  subtitle,
  action,
  slices,
  centerValue,
  centerLabel,
  activeKey,
  onSliceClick,
  emptyMessage = 'Nada no escopo selecionado.',
  footer,
  size = 148,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  slices: PieSlice[];
  centerValue: number;
  centerLabel: string;
  activeKey?: string | null;
  onSliceClick?: (key: string) => void;
  emptyMessage?: string;
  footer?: ReactNode;
  size?: number;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  return (
    <Card className="flex flex-col">
      <CardHeader title={title} subtitle={subtitle} action={action} />

      {total === 0 ? (
        <p className="flex-1 py-14 text-center text-[12px] text-ink-4">{emptyMessage}</p>
      ) : (
        <div className="mt-4 flex flex-1 flex-col items-center gap-4">
          <Donut
            segments={slices.map((s) => ({
              key: s.key,
              label: s.label,
              value: s.value,
              color: s.color,
            }))}
            size={size}
            thickness={18}
            centerValue={centerValue}
            centerLabel={centerLabel}
            centerScale="sm"
            activeKey={activeKey ?? null}
            {...(onSliceClick ? { onSegmentClick: onSliceClick } : {})}
          />

          <ul className="w-full min-w-0 space-y-0.5">
            {slices.map((slice) => {
              const active = activeKey === slice.key;
              const percent = total > 0 ? (slice.value / total) * 100 : 0;
              const Tag = onSliceClick ? 'button' : 'div';

              return (
                <li key={slice.key}>
                  <Tag
                    {...(onSliceClick
                      ? {
                          onClick: () => onSliceClick(slice.key),
                          'aria-pressed': active,
                          title: active
                            ? 'Remover o recorte de ' + slice.label
                            : 'Recortar por ' + slice.label,
                        }
                      : {})}
                    className={[
                      'block w-full rounded-md px-1.5 py-1.5 text-left transition-colors',
                      onSliceClick ? 'cursor-pointer hover:bg-surface-2' : '',
                      active ? 'bg-surface-2' : '',
                      activeKey != null && !active ? 'opacity-55' : '',
                    ].join(' ')}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: slice.color }}
                      />
                      <span
                        className={[
                          'min-w-0 flex-1 truncate text-[12.5px]',
                          active ? 'font-semibold text-ink' : 'text-ink-2',
                        ].join(' ')}
                      >
                        {slice.label}
                      </span>
                      <span className="shrink-0 font-mono text-[12.5px] font-medium text-ink">
                        {int(slice.value)}
                      </span>
                      <span className="w-10 shrink-0 text-right font-mono text-[11px] text-ink-4">
                        {decimal(percent, 1)}%
                      </span>
                    </span>
                    {slice.detail && (
                      <span className="mt-0.5 block pl-4 text-[11px] leading-relaxed text-ink-4">
                        {slice.detail}
                      </span>
                    )}
                  </Tag>
                </li>
              );
            })}
          </ul>

          {footer && (
            <div className="w-full border-t border-hairline pt-3 text-[11.5px] leading-relaxed text-ink-3">
              {footer}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
