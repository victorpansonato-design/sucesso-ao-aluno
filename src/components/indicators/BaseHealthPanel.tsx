import { useMemo, useState } from 'react';
import type { IndicatorsModel } from '../../lib/indicators';
import type { HealthStatus, Student } from '../../types';
import { Card, CardHeader, EmptyState } from '../ui/Surfaces';
import { HealthBadge } from '../ui/Badges';
import { StackedBar } from '../ui/Charts';
import { Hint } from '../ui/Hint';
import { MetricSheet } from '../ui/MetricSheet';
import type { MetricSheetContent } from '../ui/MetricSheet';
import { CountPercentRow, ResponsiveTable } from './shared';
import type { TableColumn } from './shared';
import { SCORE_BANDS } from '../../lib/healthScore';
import { decimal, int, percent } from '../../lib/format';

/* ==========================================================================
   Saúde da base
   --------------------------------------------------------------------------
   Aqui vivia o erro mais visível do produto: `2648,1%`.

   A causa era tipográfica. Contagem e percentual estavam em dois `<span>`
   vizinhos com quatro pixels entre eles, e `26` seguido de `48,1%` lia como um
   número só. O conserto não é um espaço maior — é `CountPercentRow`, onde as
   duas grandezas são CÉLULAS de largura fixa com um fio vertical entre elas.
   Duas colunas não colam.

   O resto do painel é a decomposição que a faixa de score pede: distribuição,
   coortes por modalidade e perfil, e ranking de risco por curso.

   O drill-down mudou de endereço nesta versão. Clicar numa faixa abria a Base
   de Alunos já filtrada — um atalho útil para quem vai TRABALHAR aquela lista,
   e um desvio para quem está lendo um relatório. Agora o mesmo clique abre,
   aqui mesmo, a composição da faixa por curso: a pergunta que a distribuição
   levanta ("de onde vêm os 605 em risco?") passa a ser respondida no lugar em
   que ela é feita.
   ========================================================================== */

export function BaseHealthPanel({
  model,
  scopedStudents,
  dark,
}: {
  model: IndicatorsModel;
  scopedStudents: Student[];
  dark: boolean;
}) {
  const [bandSheet, setBandSheet] = useState<HealthStatus | null>(null);
  /* -- Coortes ------------------------------------------------------------
     Cruzamento modalidade × perfil sobre a amostra. É a decomposição que
     responde "a queda é do híbrido ou dos calouros?", e ela não existia. */
  const cohorts = useMemo(() => {
    const keys = ['Presencial', 'Híbrido', 'EaD'] as const;
    return keys
      .map((modality) => {
        const rows = scopedStudents.filter((s) => s.modality === modality);
        const freshmen = rows.filter((s) => s.cohort === 'Calouro');
        const veterans = rows.filter((s) => s.cohort === 'Veterano');
        const avg = (list: Student[]) =>
          list.length > 0
            ? list.reduce((sum, s) => sum + s.healthScore, 0) / list.length
            : null;
        const risky = rows.filter((s) => s.status === 'Risco' || s.status === 'Crítico').length;
        return {
          modality,
          total: rows.length,
          freshmen: freshmen.length,
          veterans: veterans.length,
          avgAll: avg(rows),
          avgFreshmen: avg(freshmen),
          avgVeterans: avg(veterans),
          risky,
          riskyRatio: rows.length > 0 ? (risky / rows.length) * 100 : 0,
        };
      })
      .filter((row) => row.total > 0);
  }, [scopedStudents]);

  const cohortColumns: TableColumn<(typeof cohorts)[number]>[] = [
    {
      key: 'modality',
      header: 'Modalidade',
      priority: true,
      render: (r) => (
        <span className="text-[12.5px] font-semibold text-ink">{r.modality}</span>
      ),
    },
    {
      key: 'total',
      header: 'Alunos',
      priority: true,
      align: 'right',
      render: (r) => (
        <span className="font-mono text-[12.5px] font-semibold text-ink tabular">
          {int(r.total)}
        </span>
      ),
    },
    {
      key: 'split',
      header: 'Calouros / veteranos',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-[11.5px] text-ink-3 tabular">
          {int(r.freshmen)} / {int(r.veterans)}
        </span>
      ),
    },
    {
      key: 'avg',
      header: 'Score médio',
      align: 'right',
      render: (r) => <ScoreCell value={r.avgAll} />,
    },
    {
      key: 'avgFresh',
      header: 'Média calouros',
      align: 'right',
      render: (r) => <ScoreCell value={r.avgFreshmen} />,
    },
    {
      key: 'avgVet',
      header: 'Média veteranos',
      align: 'right',
      render: (r) => <ScoreCell value={r.avgVeterans} />,
    },
    {
      key: 'risky',
      header: 'Risco ou crítico',
      align: 'right',
      render: (r) => (
        <span className="flex items-center justify-end">
          <span className="w-10 text-right font-mono text-[12px] font-semibold text-ink tabular">
            {int(r.risky)}
          </span>
          <span className="mx-2 h-3.5 w-px bg-hairline" aria-hidden="true" />
          <span className="w-12 text-right font-mono text-[11.5px] text-ink-3 tabular">
            {percent(r.riskyRatio, 1)}
          </span>
        </span>
      ),
    },
  ];

  const courseColumns: TableColumn<IndicatorsModel['courseRisk'][number]>[] = [
    {
      key: 'course',
      header: 'Curso',
      priority: true,
      render: (r) => <span className="text-[12.5px] font-semibold text-ink">{r.course}</span>,
    },
    {
      key: 'ratio',
      header: '% em risco',
      priority: true,
      align: 'right',
      render: (r) => (
        <span
          className={[
            'font-mono text-[12.5px] font-semibold tabular',
            r.ratio >= 0.4 ? 'text-crit-ink' : r.ratio >= 0.2 ? 'text-risk-ink' : 'text-ink',
          ].join(' ')}
        >
          {percent(r.ratio * 100, 1)}
        </span>
      ),
    },
    {
      key: 'risky',
      header: 'Em risco',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-[12px] font-semibold text-ink tabular">{int(r.risky)}</span>
      ),
    },
    {
      key: 'total',
      header: 'Alunos no curso',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-[12px] text-ink-3 tabular">{int(r.total)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            eyebrow="Classificação"
            title="Distribuição do Health Score"
            subtitle={`Contagem e percentual sobre ${int(model.sampleSize)} alunos da amostra no recorte.`}
            action={
              <Hint label="a distribuição do Health Score" align="right">
                As quatro faixas são intervalos fechados do score de 0 a 100 e cobrem a base
                inteira, então os percentuais somam 100%. A contagem e o percentual aparecem em
                colunas separadas de propósito: quando encostados, <span className="font-mono">26</span>{' '}
                e <span className="font-mono">48,1%</span> liam como{' '}
                <span className="font-mono">2648,1%</span>.
              </Hint>
            }
          />

          {model.sampleSize === 0 ? (
            <EmptyState
              compact
              title="Sem alunos da amostra neste recorte"
              message="Troque modalidade ou perfil do aluno para voltar a ter amostra."
            />
          ) : (
            <>
              <div className="mt-4">
                <StackedBar
                  height={12}
                  segments={model.distribution.map((b) => ({
                    key: b.status,
                    label: b.label,
                    value: b.count,
                    color: b.hex(dark),
                  }))}
                />
              </div>

              {/* Cabeçalho das duas colunas numéricas. Sem ele, o leitor tem de
                  deduzir qual número é contagem e qual é percentual. */}
              <div className="mt-4 flex items-center gap-3 px-2 pb-1">
                <span className="min-w-0 flex-1 text-[10.5px] font-medium text-ink-4">Faixa</span>
                <span className="hidden w-24 shrink-0 sm:block" aria-hidden="true" />
                <span className="flex shrink-0 items-center">
                  <span className="w-14 text-right text-[10.5px] font-medium text-ink-4">
                    alunos
                  </span>
                  <span className="mx-2.5 w-px" aria-hidden="true" />
                  <span className="w-14 text-right text-[10.5px] font-medium text-ink-4">
                    % da base
                  </span>
                </span>
              </div>

              <div className="space-y-0.5">
                {model.distribution.map((b) => (
                  <CountPercentRow
                    key={b.status}
                    badge={<HealthBadge status={b.status} />}
                    label={<span className="sr-only">{b.label}</span>}
                    range={`${b.range[0]}–${b.range[1]}`}
                    count={b.count}
                    percent={b.percent}
                    color={b.hex(dark)}
                    title={`Ver a composição da faixa ${b.label} por curso`}
                    onClick={() => setBandSheet(b.status)}
                  />
                ))}
              </div>

              <p className="mt-3 border-t border-hairline pt-3 text-[11px] leading-relaxed text-ink-4">
                Somam{' '}
                <span className="font-mono tabular">
                  {int(model.distribution.reduce((s, b) => s + b.count, 0))}
                </span>{' '}
                alunos e{' '}
                <span className="font-mono tabular">
                  {decimal(
                    model.distribution.reduce((s, b) => s + b.percent, 0),
                    1,
                  )}
                  %
                </span>
                . Clique numa faixa para ver a composição dela por curso.
              </p>
            </>
          )}
        </Card>

        <Card padded={false} className="overflow-hidden">
          <div className="p-5">
            <CardHeader
              eyebrow="Coortes"
              title="Score por modalidade e perfil"
              subtitle="Onde a média se sustenta e onde ela é puxada para baixo."
            />
          </div>
          <div className="border-t border-hairline">
            <ResponsiveTable
              columns={cohortColumns}
              rows={cohorts}
              keyOf={(r) => r.modality}
              minWidth={680}
              emptyMessage="Sem alunos da amostra neste recorte."
            />
          </div>
        </Card>
      </div>

      <Card padded={false} className="overflow-hidden">
        <div className="p-5">
          <CardHeader
            eyebrow="Mapa de risco"
            title="Ranking de risco por curso"
            subtitle="Percentual de alunos em Risco ou Crítico, com o denominador de cada curso."
          />
        </div>
        <div className="border-t border-hairline">
          <ResponsiveTable
            columns={courseColumns}
            rows={model.courseRisk}
            keyOf={(r) => r.course}
            minWidth={560}
            emptyMessage="Sem alunos da amostra neste recorte."
          />
        </div>
      </Card>

      <MetricSheet
        content={bandSheet ? buildBandSheet(bandSheet, model, scopedStudents, dark) : null}
        onClose={() => setBandSheet(null)}
      />
    </div>
  );
}

/* -- A composição de uma faixa -------------------------------------------
   Lida direto de `scopedStudents`, que este painel já recebe. Agregar por curso
   aqui em vez de no modelo é deliberado: nenhuma outra aba precisa deste corte,
   e uma métrica calculada em `lib/indicators` que só um painel consome é peso
   morto no cálculo de todas as outras. */

function buildBandSheet(
  status: HealthStatus,
  model: IndicatorsModel,
  scopedStudents: Student[],
  dark: boolean,
): MetricSheetContent {
  const band = model.distribution.find((b) => b.status === status);
  const inBand = scopedStudents.filter((s) => s.status === status);

  const byCourse = new Map<string, number>();
  for (const student of inBand) {
    byCourse.set(student.course, (byCourse.get(student.course) ?? 0) + 1);
  }
  const total = Math.max(1, inBand.length);

  const avg =
    inBand.length > 0
      ? inBand.reduce((sum, s) => sum + s.healthScore, 0) / inBand.length
      : null;

  return {
    eyebrow: `Faixa ${band?.label ?? status}`,
    title: 'De onde vêm os alunos desta faixa',
    value: int(inBand.length),
    denominator: (
      <>
        <span className="font-mono font-semibold text-ink tabular">{int(inBand.length)}</span> de{' '}
        <span className="font-mono font-semibold text-ink tabular">{int(model.sampleSize)}</span>{' '}
        alunos da amostra no recorte —{' '}
        <span className="font-mono tabular">{percent(band?.percent ?? 0, 1)}</span> da base.
        {band && (
          <>
            {' '}Score entre{' '}
            <span className="font-mono tabular">
              {band.range[0]}–{band.range[1]}
            </span>
            {avg !== null && (
              <>
                , média da faixa <span className="font-mono tabular">{decimal(avg, 1)}</span>
              </>
            )}
            .
          </>
        )}
      </>
    ),
    rowsLabel: 'Cursos que compõem a faixa',
    rows: [...byCourse.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([course, count]) => ({
        key: course,
        label: course,
        value: count,
        percent: (count / total) * 100,
        color: band?.hex(dark) ?? 'var(--ink-4)',
      })),
    emptyRows: 'Nenhum aluno da amostra nesta faixa dentro do recorte atual.',
    reading: (
      <>
        O percentual desta lista é sobre a PRÓPRIA faixa, não sobre a base — ele responde "quem são
        os alunos desta faixa", e não "qual curso está pior". Para a segunda pergunta, o ranking de
        risco por curso na mesma aba divide cada curso pelo seu próprio total, que é a única forma de
        um curso de vinte alunos não parecer saudável só por ser pequeno.
      </>
    ),
  };
}

/**
 * Uma média de score, com a sua faixa como veredito.
 *
 * `null` imprime travessão. É a mesma regra de `RateStat`, aplicada às células
 * de tabela: um `0` numa coluna de médias seria lido como "base no chão" em vez
 * de "coorte vazia".
 */
function ScoreCell({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="font-mono text-[12px] text-ink-4">—</span>;
  }
  const band = SCORE_BANDS.find((b) => value >= b.range[0] && value <= b.range[1]);
  return (
    <span className="font-mono text-[12.5px] font-semibold text-ink tabular" title={band?.label}>
      {Math.round(value)}
      <span className="font-normal text-ink-4">/100</span>
    </span>
  );
}
