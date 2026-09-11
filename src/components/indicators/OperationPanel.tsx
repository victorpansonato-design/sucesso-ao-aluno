import { Activity, FileText, ShieldCheck, Timer } from 'lucide-react';
import type { IndicatorsModel } from '../../lib/indicators';
import type { Case, Student } from '../../types';
import { Card, CardHeader, StatTile } from '../ui/Surfaces';
import { CaseStatusBadge, RadarBadge } from '../ui/Badges';
import { ColumnChart, MeterBar } from '../ui/Charts';
import { Hint } from '../ui/Hint';
import { ResponsiveTable } from './shared';
import type { TableColumn } from './shared';
import { decimal, int, percent, stamp } from '../../lib/format';

/* ==========================================================================
   Operação
   --------------------------------------------------------------------------
   Throughput: quanto entra, quanto sai, quanto estoura e em quanto tempo.

   A mudança em relação à versão anterior é o denominador em cada linha de
   desfecho. "Interações com resposta: 5" não informa nada; "5 de 7 interações"
   informa que a taxa de resposta é alta e que a amostra é pequena — as duas
   coisas ao mesmo tempo, que é exatamente o que um painel honesto precisa dizer
   quando a base é pequena.

   A tabela detalhada dos casos entra sob demanda, no fim do painel, com coluna
   prioritária e expansão no mobile em vez de oito colunas comprimidas.
   ========================================================================== */

/* Este painel é uma superfície de RELATÓRIO, e por isso não tem mais nenhuma
   saída para a Fila de Atendimento.

   Os três primeiros contadores abriam a fila já filtrada, e a tabela de casos
   abria o caso na fila. Eram atalhos bons — para o atendente. Quem lê
   Indicadores é a gestão, e cada um desses cliques a tirava de um relatório e a
   depositava numa ferramenta de turno, com filtros que ela não escolheu e um
   caminho de volta que passava por três telas. Os números continuam todos aqui;
   o que saiu foi o teletransporte. */
export function OperationPanel({
  model,
  getStudent,
}: {
  model: IndicatorsModel;
  getStudent: (id: string) => Student | undefined;
}) {
  const tiles = [
    {
      key: 'abertos',
      label: 'Casos abertos',
      value: model.openCases.length,
      icon: <FileText className="h-3.5 w-3.5" />,
    },
    {
      key: 'encerrados',
      label: 'Encerrados',
      value: model.closedCases.length,
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
    },
    {
      key: 'sla',
      label: 'SLA estourado',
      value: model.breached.length,
      accent: model.breached.length > 0 ? 'var(--crit)' : undefined,
      icon: <Timer className="h-3.5 w-3.5" />,
    },
    {
      key: 'reaberturas',
      label: 'Reaberturas',
      value: model.reopened.length,
      accent: model.reopened.length > 0 ? 'var(--warn)' : undefined,
    },
    { key: 'followups', label: 'Follow-ups ativos', value: model.pendingFollowUps },
    {
      key: 'interacoes',
      label: 'Interações no ciclo',
      value: model.interactionCount,
      icon: <Activity className="h-3.5 w-3.5" />,
    },
  ];

  const caseColumns: TableColumn<Case>[] = [
    {
      key: 'student',
      header: 'Aluno',
      priority: true,
      render: (c) => (
        <span className="block min-w-0">
          <span className="block truncate text-[12.5px] font-semibold text-ink">
            {getStudent(c.studentId)?.name ?? c.studentId}
          </span>
          <span className="block truncate text-[11px] text-ink-3">{c.title}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Situação',
      priority: true,
      render: (c) => <CaseStatusBadge status={c.status} />,
    },
    { key: 'radar', header: 'Radar', render: (c) => <RadarBadge radar={c.radar} /> },
    {
      key: 'opened',
      header: 'Aberto em',
      render: (c) => (
        <span className="font-mono text-[11.5px] whitespace-nowrap text-ink-3 tabular">
          {stamp(c.openedAt)}
        </span>
      ),
    },
    {
      key: 'contact',
      header: '1º contato',
      render: (c) => (
        <span className="font-mono text-[11.5px] whitespace-nowrap text-ink-3 tabular">
          {c.firstContactAt ? stamp(c.firstContactAt) : '—'}
        </span>
      ),
    },
    {
      key: 'reopen',
      header: 'Reaberturas',
      align: 'right',
      render: (c) => (
        <span
          className={[
            'font-mono text-[12px] tabular',
            c.reopenCount > 0 ? 'font-semibold text-warn-ink' : 'text-ink-4',
          ].join(' ')}
        >
          {c.reopenCount}
        </span>
      ),
    },
  ];

  const allCases = [...model.openCases, ...model.closedCases];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {tiles.map((tile) => (
          <StatTile
            key={tile.key}
            label={tile.label}
            value={int(tile.value)}
            accent={tile.accent}
            icon={tile.icon}
          />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            eyebrow="Volume por radar"
            title="Origem dos casos"
            subtitle="Onde a operação está gastando esforço, somando casos abertos e encerrados."
          />
          <div className="mt-5">
            <ColumnChart
              data={model.radars.map((r) => ({
                label: r.label,
                value: r.totalCases,
                color: r.key === 'evasao' ? 'var(--crit)' : 'var(--ink-3)',
              }))}
            />
          </div>
          <p className="mt-3 border-t border-hairline pt-3 text-[11px] leading-relaxed text-ink-4">
            Total de{' '}
            <span className="font-mono tabular">
              {int(model.radars.reduce((s, r) => s + r.totalCases, 0))}
            </span>{' '}
            casos atribuídos a um radar. Vermelho marca o radar de evasão, que é o único cuja
            presença já é um alerta.
          </p>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Tempo e desfecho"
            title="Resultado dos contatos registrados"
            action={
              <Hint label="o tempo até o primeiro contato" align="right">
                O tempo médio até o 1º contato é calculado sobre os{' '}
                <span className="font-mono tabular">{int(model.firstContactSample)}</span> casos que
                já tiveram contato registrado — casos sem contato ficam fora, senão a média
                melhoraria justamente quando ninguém atende.
              </Hint>
            }
          />

          {model.avgFirstContactHours !== null && (
            <div className="mt-4 flex items-baseline gap-2 rounded-lg bg-surface-2 px-3.5 py-3">
              <span className="font-mono text-[22px] leading-none font-medium text-ink tabular">
                {decimal(model.avgFirstContactHours, 1)}
              </span>
              <span className="text-[12px] text-ink-3">
                horas até o 1º contato, em média de{' '}
                <span className="font-mono tabular">{int(model.firstContactSample)}</span> casos
              </span>
            </div>
          )}

          <ul className="mt-4 space-y-3">
            {model.contactOutcomes.map((row) => (
              <li key={row.key} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[12px] font-medium text-ink-2">
                    {row.label}
                  </span>
                  {/* Contagem, fio, percentual. Nunca colados. */}
                  <span className="flex shrink-0 items-center">
                    <span className="w-14 text-right font-mono text-[12.5px] font-semibold text-ink tabular">
                      {int(row.value)}
                      <span className="font-normal text-ink-4">/{int(row.total)}</span>
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
        </Card>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="p-5">
          <CardHeader
            eyebrow="Detalhe sob demanda"
            title="Casos do recorte"
            subtitle="Abertos e encerrados, com prazo de primeiro contato e reaberturas. Clique numa linha para abrir o caso."
          />
        </div>
        <div className="border-t border-hairline">
          <ResponsiveTable
            columns={caseColumns}
            rows={allCases}
            keyOf={(c) => c.id}
            minWidth={780}
            emptyMessage="Nenhum caso no recorte atual."
          />
        </div>
      </Card>
    </div>
  );
}
