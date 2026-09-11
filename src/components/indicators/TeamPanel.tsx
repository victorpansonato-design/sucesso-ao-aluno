import { useMemo, useState } from 'react';
import type { IndicatorsModel, TeamRow } from '../../lib/indicators';
import { Card, CardHeader } from '../ui/Surfaces';
import { Avatar } from '../ui/Badges';
import { MeterBar } from '../ui/Charts';
import { Segmented } from '../ui/Fields';
import { Hint } from '../ui/Hint';
import { ResponsiveTable } from './shared';
import type { TableColumn } from './shared';
import { roleLabel } from '../../lib/routing';
import { initialsOf, int, percent } from '../../lib/format';

/* ==========================================================================
   Equipe
   --------------------------------------------------------------------------
   Eram doze cartões idênticos empilhados, um por especialista. Doze cartões
   respondem "quem existe"; a pergunta da coordenação é "quem está sobrecarregado
   e quem tem folga", e essa é uma comparação de colunas.

   Virou tabela densa e ordenável, com a carga como barra para leitura rápida e
   a capacidade como denominador visível — `11/14` diz o que `79%` sozinho não
   diz, porque três vagas livres num especialista de capacidade 14 é diferente
   de três num de capacidade 4.
   ========================================================================== */

type SortKey = 'carga' | 'sla' | 'retidos' | 'total';

export function TeamPanel({
  model,
}: {
  model: IndicatorsModel;
}) {
  const [sort, setSort] = useState<SortKey>('carga');

  const rows = useMemo(() => {
    const list = [...model.team];
    switch (sort) {
      case 'sla':
        return list.sort((a, b) => a.spec.slaAdherence - b.spec.slaAdherence);
      case 'retidos':
        return list.sort((a, b) => b.retained - a.retained);
      case 'total':
        return list.sort((a, b) => b.total - a.total);
      default:
        return list.sort((a, b) => b.load - a.load);
    }
  }, [model.team, sort]);

  const overloaded = rows.filter((r) => r.load >= 0.85).length;
  const totalCapacity = rows.reduce((s, r) => s + r.spec.capacity, 0);
  const totalOpen = rows.reduce((s, r) => s + r.open, 0);

  const columns: TableColumn<TeamRow>[] = [
    {
      key: 'name',
      header: 'Especialista',
      priority: true,
      render: (r) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar initials={initialsOf(r.spec.name)} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-semibold text-ink">
              {r.spec.name}
            </span>
            <span className="block truncate text-[11px] text-ink-3">{roleLabel(r.spec)}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'load',
      header: 'Carga / capacidade',
      priority: true,
      render: (r) => (
        <span className="flex min-w-32 flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-[12px] font-semibold text-ink tabular">
              {int(r.open)}
              <span className="font-normal text-ink-4">/{int(r.spec.capacity)}</span>
            </span>
            <span className="font-mono text-[11px] text-ink-3 tabular">
              {percent(r.load * 100, 0)}
            </span>
          </span>
          <MeterBar
            value={Math.min(100, r.load * 100)}
            color={r.load >= 0.85 ? 'var(--crit)' : r.load >= 0.6 ? 'var(--warn)' : 'var(--ink-4)'}
            height={4}
          />
        </span>
      ),
    },
    {
      key: 'sla',
      header: 'Aderência ao SLA',
      align: 'right',
      render: (r) => (
        <span
          className={[
            'font-mono text-[12px] font-semibold tabular',
            r.spec.slaAdherence < 85 ? 'text-warn-ink' : 'text-ink',
          ].join(' ')}
        >
          {percent(r.spec.slaAdherence, 1)}
        </span>
      ),
    },
    {
      key: 'retained',
      header: 'Retenções',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-[12px] font-semibold text-ink tabular">
          {int(r.retained)}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Casos totais',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-[12px] text-ink-3 tabular">{int(r.total)}</span>
      ),
    },
    {
      key: 'free',
      header: 'Vagas livres',
      align: 'right',
      render: (r) => {
        const free = r.spec.capacity - r.open;
        return (
          <span
            className={[
              'font-mono text-[12px] tabular',
              free <= 0 ? 'font-semibold text-crit-ink' : 'text-ink-3',
            ].join(' ')}
          >
            {free <= 0 ? 'sem folga' : int(free)}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col rounded-xl bg-surface-2 p-4">
          <span className="text-[12px] font-medium text-ink-3">Ocupação da equipe</span>
          <span className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-[26px] leading-none font-medium text-ink tabular">
              {int(totalOpen)}
            </span>
            <span className="font-mono text-[15px] text-ink-4 tabular">
              /{int(totalCapacity)}
            </span>
          </span>
          <span className="mt-3 border-t border-hairline pt-2.5 text-[11px] text-ink-3">
            casos abertos ÷ capacidade somada de{' '}
            <span className="font-mono tabular">{int(rows.length)}</span> especialistas
          </span>
        </div>

        <div className="flex flex-col rounded-xl bg-surface-2 p-4">
          <span className="text-[12px] font-medium text-ink-3">Acima de 85% de carga</span>
          <span className="mt-2 font-mono text-[26px] leading-none font-medium text-ink tabular">
            {int(overloaded)}
          </span>
          <span className="mt-3 border-t border-hairline pt-2.5 text-[11px] text-ink-3">
            de <span className="font-mono tabular">{int(rows.length)}</span> especialistas — acima
            disso a fila deixa de absorver picos
          </span>
        </div>

        <div className="flex flex-col rounded-xl bg-surface-2 p-4">
          <span className="flex items-start justify-between gap-2">
            <span className="text-[12px] font-medium text-ink-3">Vagas livres na equipe</span>
            <Hint label="a capacidade da equipe" align="right">
              Capacidade é o número de casos simultâneos que cada especialista consegue conduzir com
              qualidade, definido em Governança. Vagas livres = capacidade − casos abertos, somado
              sobre a equipe. É o número que diz se um pico de alertas cabe hoje.
            </Hint>
          </span>
          <span className="mt-2 font-mono text-[26px] leading-none font-medium text-ink tabular">
            {int(Math.max(0, totalCapacity - totalOpen))}
          </span>
          <span className="mt-3 border-t border-hairline pt-2.5 text-[11px] text-ink-3">
            capacidade somada − casos abertos
          </span>
        </div>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="p-5">
          <CardHeader
            eyebrow="Carga e desempenho"
            title="Especialistas"
            subtitle="Ordenável. A capacidade aparece como denominador porque três vagas livres em 14 não é o mesmo que três em 4."
            action={
              <Segmented<SortKey>
                layoutId="team-sort"
                size="xs"
                value={sort}
                onChange={setSort}
                options={[
                  { value: 'carga', label: 'Carga' },
                  { value: 'sla', label: 'SLA' },
                  { value: 'retidos', label: 'Retenções' },
                  { value: 'total', label: 'Total' },
                ]}
              />
            }
          />
        </div>
        <div className="border-t border-hairline">
          <ResponsiveTable
            columns={columns}
            rows={rows}
            keyOf={(r) => r.spec.id}
            minWidth={800}
            emptyMessage="Nenhum especialista cadastrado."
          />
        </div>
      </Card>
    </div>
  );
}
