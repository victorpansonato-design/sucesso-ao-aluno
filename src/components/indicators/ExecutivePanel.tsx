import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { IndicatorsModel } from '../../lib/indicators';
import { bandOfScore } from '../../lib/indicators';
import { Card, CardHeader } from '../ui/Surfaces';
import { Button } from '../ui/Button';
import { MeterBar } from '../ui/Charts';
import { MetricSheet } from '../ui/MetricSheet';
import type { MetricSheetContent } from '../ui/MetricSheet';
import { CrystalGlassCard, GlassLabel, GlassPill, GlassValue } from '../ui/CrystalGlass';
import type { CrystalColumn } from '../ui/CrystalGlass';
import { Hint } from '../ui/Hint';
import { PieCard } from '../cockpit/PieCard';
import { RateStat } from './shared';
import { Reveal, RevealGroup, RevealItem } from '../ui/Reveal';
import { decimal, int, money, percent } from '../../lib/format';

/* ==========================================================================
   Visão executiva
   --------------------------------------------------------------------------
   Os quatro números que a diretoria pede, e três regras que este painel impõe:

     1. NENHUM APARECE SOZINHO. Cada um traz o seu denominador na linha de baixo
        e a sua fórmula a um clique. Não é excesso de zelo: "taxa de reversão
        60%" com três casos de desfecho é verdade aritmética e mentira
        estatística, e a diferença entre as duas só aparece quando o denominador
        está impresso ao lado.
     2. UM DELES É O PROTAGONISTA, E ELE MOSTRA A DISTRIBUIÇÃO. A taxa de
        reversão ganhou um objeto de vidro cristalino com a MESMA taxa desenhada
        por especialista em colunas atrás do material. Não é enfeite: uma
        reversão global de 60% pode ser uma equipe homogênea ou duas pessoas
        carregando o número de seis, e essas duas situações pedem decisões
        opostas — a média sozinha esconde qual das duas é.

        Os outros três permanecem em superfície LIMPA. Quatro objetos de
        material numa linha não é hierarquia, é um arco-íris, e a regra 4 do
        sistema (cor é conquistada) existe justamente para impedir isso.
     3. NADA SAI DA ABA. "Abrir a base no ponto de maior atenção" mandava a
        diretoria para a Base de Alunos, que é tela de trabalho. Agora o mesmo
        clique abre a concentração de risco aqui, com os cursos ordenados e o
        denominador de cada um.

   O aviso de amostra saiu do corpo do painel e subiu para a abertura da tela
   (`IndicatorsHeader`), onde é lido antes do primeiro número em vez de depois.
   ========================================================================== */

type Sheet = 'reversao' | 'sla' | 'health' | 'receita' | 'risco';

export function ExecutivePanel({ model, dark }: { model: IndicatorsModel; dark: boolean }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const band = bandOfScore(model.avgHealthScore);
  const topRisk = model.courseRisk[0];

  /* -- A pizza que fecha a linha -----------------------------------------
     A terceira coluna existia como vazio: os três indicadores de apoio
     ocupavam metade da largura que sobrava do objeto de vidro e a outra
     metade ficava em branco até o fim do painel. Vazio ao lado de número não
     é respiro, é uma coluna que ninguém terminou.

     O que entra ali é a distribuição da amostra por faixa de Health Score, e a
     escolha é do VIZINHO, não do espaço: logo à esquerda está "Health Score
     médio 73/100", e uma média sozinha não distingue uma base homogênea de
     uma base partida entre muito bem e muito mal. É o mesmo argumento que já
     justifica as colunas por especialista atrás do vidro — a média é o
     resumo, a distribuição é o fato.

     A aba "Saúde da base" mostra a mesma repartição, e em barra empilhada. Não
     é repetição ociosa: lá ela é o assunto e se abre por curso; aqui ela é o
     denominador de um número que a diretoria lê antes de trocar de aba. */
  const distributionSlices = model.distribution.map((b) => ({
    key: b.status,
    label: b.label,
    value: b.count,
    color: b.hex(dark),
    detail: `score ${b.range[0]}–${b.range[1]}`,
  }));

  /* -- As colunas atrás do vidro -----------------------------------------
     A MESMA taxa de reversão, por especialista. Só entram na série os que têm
     carteira no recorte: uma coluna de altura zero para quem não teve nenhum
     caso não é "reversão de 0%", é ausência de medida — e desenhá-la faria a
     equipe parecer pior do que é.

     Ordenadas por taxa, decrescente. Por nome, o gráfico seria um serrilhado
     aleatório; ordenado, ele responde de imediato "a reversão global se sustenta
     em quantas pessoas?". */
  const teamColumns: CrystalColumn[] = model.team
    .filter((row) => row.total > 0)
    .map((row) => ({
      label: row.spec.name,
      value: (row.retained / row.total) * 100,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-5">
      {/* A largura do objeto de vidro é LIMITADA de propósito. A série aqui é
          categórica e curta — uma taxa por especialista, cinco ou seis
          colunas —, e num cartão de 700px cinco barras com `space-between`
          ficam perdidas com vãos maiores que elas mesmas. Com teto de 440px o
          gráfico volta a ter densidade, e os três indicadores de apoio ganham
          a largura que sobra. */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)_minmax(0,320px)]">
        {/* -- O protagonista, em vidro cristalino ------------------------ */}
        <CrystalGlassCard
          columns={teamColumns}
          meterLabel="Taxa de reversão"
          meterText={
            model.reversionRate === null
              ? 'sem desfecho definitivo no recorte'
              : `${decimal(model.reversionRate, 1)}% — ${int(model.retained.length)} de ${int(model.reversionDenominator)} desfechos definitivos`
          }
          seriesLabel="Taxa de reversão por especialista, em ordem decrescente"
          minHeight={324}
          footer={
            <>
              <GlassPill onClick={() => setSheet('reversao')}>
                Como cada caso terminou
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </GlassPill>
              {/* Rótulo curto de propósito: as duas pastilhas dividem 440px, e
                  uma contagem aqui ainda seria pior que curta — dois
                  especialistas estão em 0% de reversão, então "5" ao lado de
                  três barras visíveis leria como bug em vez de como dado.
                  Dizer o que as colunas SÃO resolve as duas coisas. */}
              <GlassPill className="font-mono text-[11px] font-medium text-ink-2">
                {teamColumns.length > 0 ? 'por especialista' : 'sem carteira no recorte'}
              </GlassPill>
            </>
          }
        >
          <div className="flex items-start justify-between gap-2">
            <GlassLabel>Taxa de reversão</GlassLabel>
            <Hint label="a taxa de reversão" align="right">
              Casos encerrados como{' '}
              <strong className="font-semibold text-ink">Acordo firmado</strong> sobre a soma de
              acordos firmados e saídas inevitáveis. Casos cancelados e ainda abertos ficam fora do
              denominador: os primeiros não eram risco real, os segundos ainda não terminaram. As
              colunas atrás do vidro são a MESMA taxa, calculada por especialista.
            </Hint>
          </div>

          <p className="mt-3 flex items-baseline gap-1.5">
            {model.reversionRate === null ? (
              <span
                className="font-mono text-[40px] leading-none font-medium text-ink-4"
                aria-label="sem medida"
              >
                —
              </span>
            ) : (
              <>
                <GlassValue>{decimal(model.reversionRate, 1)}</GlassValue>
                <span className="font-mono text-[22px] leading-none font-medium text-ink-2">%</span>
              </>
            )}
          </p>

          <p className="mt-2.5 max-w-[40ch] text-[11.5px] leading-relaxed text-ink-2">
            {model.reversionRate === null ? (
              'Nenhum caso com desfecho definitivo ainda — nada a medir.'
            ) : (
              <>
                <span className="font-mono font-semibold text-ink tabular">
                  {int(model.retained.length)}
                </span>{' '}
                retidos ÷{' '}
                <span className="font-mono font-semibold text-ink tabular">
                  {int(model.reversionDenominator)}
                </span>{' '}
                desfechos definitivos
              </>
            )}
          </p>
        </CrystalGlassCard>

        {/* -- Os três de apoio, em superfície limpa ---------------------- */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <RateStat
            label="Aderência ao SLA"
            value={model.slaAdherence}
            suffix="%"
            decimals={1}
            tone={model.breached.length > 0 ? 'warn' : 'plain'}
            emptyReason="nenhum caso no recorte"
            denominator={
              <>
                <span className="font-mono font-medium text-ink tabular">
                  {int(model.slaDenominator - model.breached.length)}
                </span>{' '}
                no prazo ÷{' '}
                <span className="font-mono font-medium text-ink tabular">
                  {int(model.slaDenominator)}
                </span>{' '}
                casos
                {model.avgFirstContactHours !== null && (
                  <>
                    {' · '}
                    <span className="font-mono font-medium text-ink tabular">
                      {decimal(model.avgFirstContactHours, 1)} h
                    </span>{' '}
                    até o 1º contato
                  </>
                )}
              </>
            }
            definition={
              <>
                Casos abertos e encerrados que <em>não</em> estouraram o prazo de primeiro contato,
                sobre o total de casos do recorte. O prazo é contado em{' '}
                <strong className="font-semibold text-ink">horas úteis</strong> e varia por radar,
                conforme Governança. Hoje há{' '}
                <span className="font-mono tabular">{int(model.breached.length)}</span> caso(s)
                estourado(s).
              </>
            }
          />

          <RateStat
            label="Health Score médio"
            value={model.avgHealthScore}
            detail="/100"
            emptyReason="sem alunos da amostra neste recorte — nada a medir"
            denominator={
              <>
                média de{' '}
                <span className="font-mono font-medium text-ink tabular">
                  {int(model.sampleSize)}
                </span>{' '}
                alunos da amostra
                {band && (
                  <>
                    {' · faixa '}
                    <strong className="font-semibold text-ink">{band.label}</strong> (
                    {band.range[0]}–{band.range[1]})
                  </>
                )}
              </>
            }
            definition={
              <>
                Média aritmética do Health Score dos alunos da amostra no recorte atual. É a média
                da <strong className="font-semibold text-ink">amostra</strong>, não da instituição:
                o censo guarda faixas, não uma média, e estimá-la pelo ponto médio de cada faixa
                produziria um número que não pode ser auditado. Quando o recorte não tem aluno,
                este indicador mostra um travessão — nunca zero.
              </>
            }
          />

          <RateStat
            label="Receita preservada"
            value={model.preservedRevenue}
            format="money"
            emptyReason="nenhum caso retido no ciclo"
            denominator={
              <>
                exposição evitada de{' '}
                <span className="font-mono font-medium text-ink tabular">
                  {int(model.preservedRevenueBasis)}
                </span>{' '}
                caso(s) retido(s)
              </>
            }
            definition={
              <>
                <strong className="font-semibold text-ink">
                  Estimativa de exposição evitada, não caixa realizado.
                </strong>{' '}
                Fórmula: mensalidade do aluno × 6 parcelas por período × períodos restantes até a
                formatura, somada sobre os casos encerrados como acordo firmado. A conta fica
                declarada porque um número institucional só é útil quando pode ser defendido em
                reunião — e porque ele responde "quanto deixaríamos de faturar se estes alunos
                saíssem", não "quanto entrou".
              </>
            }
          />
        </div>

        {/* -- A distribuição, em pizza -------------------------------------
            Sem cabeçalho de ação e sem clique nas fatias de propósito. O
            aprofundamento por faixa já existe na aba "Saúde da base", com a
            composição por curso; duplicar o caminho aqui daria dois destinos
            para a mesma pergunta e nenhum deles seria o canônico. Aqui a peça
            informa a forma da base e para por aí. */}
        <PieCard
          title="Distribuição da amostra"
          subtitle="Alunos por faixa de Health Score — a forma da base atrás da média ao lado."
          slices={distributionSlices}
          centerValue={model.sampleSize}
          centerLabel="alunos"
          size={132}
          emptyMessage="Sem alunos da amostra neste recorte — nada a repartir."
          footer={
            <>
              Denominador: <span className="font-mono tabular">{int(model.sampleSize)}</span> de{' '}
              <span className="font-mono tabular">{int(model.sampleTotal)}</span> alunos da amostra
              operacional. As faixas são as mesmas de Governança e do dossiê.
            </>
          }
        />
      </div>

      <Reveal>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader
              eyebrow="Resumo do ciclo"
              title="Como o ciclo está terminando"
              subtitle="Composição dos desfechos sobre o total de casos da amostra."
            />
            <RevealGroup as="ul" className="mt-4 space-y-3">
              {model.caseEndings.map((row) => (
                <RevealItem as="li" key={row.key} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[12px] font-medium text-ink-2">
                      {row.label}
                    </span>
                    <span className="flex shrink-0 items-center">
                      <span className="w-10 text-right font-mono text-[12.5px] font-semibold text-ink tabular">
                        {int(row.value)}
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
                </RevealItem>
              ))}
            </RevealGroup>
            <p className="mt-4 border-t border-hairline pt-3 text-[11px] leading-relaxed text-ink-4">
              Denominador:{' '}
              <span className="font-mono tabular">{int(model.caseEndings[0]?.total ?? 0)}</span>{' '}
              casos no total da amostra.
            </p>
          </Card>

          <Card className="flex flex-col">
            <CardHeader
              eyebrow="Concentração de risco"
              title="Onde a coordenação precisa entrar"
              subtitle="Cursos ordenados pela fração de alunos em Risco ou Crítico."
            />

            {model.courseRisk.length === 0 ? (
              <p className="flex-1 py-12 text-center text-[12px] text-ink-4">
                Sem alunos da amostra neste recorte.
              </p>
            ) : (
              <>
                <RevealGroup as="ul" className="mt-4 flex-1 space-y-2.5">
                  {model.courseRisk.slice(0, 6).map((row) => (
                    <RevealItem as="li" key={row.course} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-[12px] font-medium text-ink-2">
                          {row.course}
                        </span>
                        <span className="flex shrink-0 items-center">
                          <span className="w-16 text-right font-mono text-[12px] font-semibold text-ink tabular">
                            {int(row.risky)}
                            <span className="font-normal text-ink-4">/{int(row.total)}</span>
                          </span>
                          <span className="mx-2 h-3.5 w-px bg-hairline" aria-hidden="true" />
                          <span className="w-12 text-right font-mono text-[11.5px] text-ink-3 tabular">
                            {percent(row.ratio * 100, 1)}
                          </span>
                        </span>
                      </div>
                      <MeterBar
                        value={row.ratio * 100}
                        color={
                          row.ratio >= 0.4
                            ? 'var(--crit)'
                            : row.ratio >= 0.2
                              ? 'var(--risk)'
                              : 'var(--ink-4)'
                        }
                        height={5}
                      />
                    </RevealItem>
                  ))}
                </RevealGroup>

                {topRisk && (
                  <div className="mt-4 border-t border-hairline pt-4">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setSheet('risco')}
                      iconRight={<ArrowRight className="h-3.5 w-3.5" />}
                    >
                      Ver a concentração completa
                    </Button>
                    <p className="mt-2 text-[11px] leading-relaxed text-ink-4">
                      {topRisk.course} concentra{' '}
                      <span className="font-mono text-ink-3 tabular">
                        {percent(topRisk.ratio * 100, 1)}
                      </span>{' '}
                      de alunos em Risco ou Crítico —{' '}
                      <span className="font-mono tabular">{int(topRisk.risky)}</span> de{' '}
                      <span className="font-mono tabular">{int(topRisk.total)}</span>.
                    </p>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </Reveal>

      <MetricSheet
        content={sheet ? buildSheet(sheet, model) : null}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}

/* -- Os montadores do aprofundamento -------------------------------------
   Todos leem o MESMO `model` que os ladrilhos leram, então o detalhe não pode
   discordar do cartão que o abriu. */

function buildSheet(sheet: Sheet, model: IndicatorsModel): MetricSheetContent {
  switch (sheet) {
    case 'reversao':
      return {
        eyebrow: 'Taxa de reversão',
        title: 'Como cada caso terminou',
        value: model.reversionRate === null ? '—' : `${decimal(model.reversionRate, 1)}%`,
        denominator: (
          <>
            <span className="font-mono font-semibold text-ink tabular">
              {int(model.retained.length)}
            </span>{' '}
            acordos firmados ÷{' '}
            <span className="font-mono font-semibold text-ink tabular">
              {int(model.reversionDenominator)}
            </span>{' '}
            desfechos definitivos. Casos cancelados e ainda abertos ficam fora do denominador.
          </>
        ),
        rowsLabel: 'Composição dos desfechos da amostra',
        rows: model.caseEndings.map((row) => ({
          key: row.key,
          label: row.label,
          value: row.value,
          percent: row.percent,
          color: row.color,
        })),
        emptyRows: 'Nenhum caso encerrado na amostra.',
        reading: (
          <>
            Com denominador pequeno, esta taxa oscila violentamente: um único caso a mais ou a menos
            move vários pontos. Por isso ela é publicada com{' '}
            <span className="font-mono tabular">{int(model.reversionDenominator)}</span> desfechos
            impressos ao lado — uma reversão de 60% sobre três casos e uma de 60% sobre trezentos
            não são o mesmo fato, e a única defesa contra confundi-los é ler o denominador antes da
            porcentagem.
          </>
        ),
      };

    case 'sla':
      return {
        eyebrow: 'Aderência ao SLA',
        title: 'Onde o prazo está sendo perdido',
        value: model.slaAdherence === null ? '—' : `${decimal(model.slaAdherence, 1)}%`,
        denominator: (
          <>
            <span className="font-mono font-semibold text-ink tabular">
              {int(model.slaDenominator - model.breached.length)}
            </span>{' '}
            no prazo ÷{' '}
            <span className="font-mono font-semibold text-ink tabular">
              {int(model.slaDenominator)}
            </span>{' '}
            casos do recorte. O prazo é contado em horas úteis e varia por radar.
          </>
        ),
        rowsLabel: 'Estouros por radar',
        rows: model.radars
          .filter((r) => r.totalCases > 0)
          .map((r) => ({
            key: r.key,
            label: `${r.label} · SLA ${r.slaHours}h`,
            value: r.totalCases,
            percent: (r.openCases / Math.max(1, r.totalCases)) * 100,
            color: 'var(--warn)',
            meaning: `${int(r.openCases)} em aberto de ${int(r.totalCases)} casos`,
          })),
        emptyRows: 'Nenhum radar com caso na amostra.',
        reading: (
          <>
            Aderência é uma TAXA, e um radar com dois casos e um estouro aparece pior que um radar
            com quarenta e três. A leitura útil é cruzar esta lista com a aba Qualidade dos radares:
            radar com SLA curto e precisão baixa gera estouro por desenho, não por falta de gente —
            e o conserto é o prazo em Governança, não a escala do turno.
          </>
        ),
      };

    case 'health':
      return {
        eyebrow: 'Health Score médio',
        title: 'A distribuição por trás da média',
        value: model.avgHealthScore === null ? '—' : int(model.avgHealthScore),
        denominator: (
          <>
            Média aritmética de{' '}
            <span className="font-mono font-semibold text-ink tabular">
              {int(model.sampleSize)}
            </span>{' '}
            alunos da amostra no recorte atual. É a média da AMOSTRA, não da instituição — o censo
            guarda faixas, não uma média.
          </>
        ),
        rowsLabel: 'Alunos por faixa de Health Score',
        rows: model.distribution.map((d) => ({
          key: d.status,
          label: `${d.label} (${d.range[0]}–${d.range[1]})`,
          value: d.count,
          percent: d.percent,
          color: d.hex(false),
        })),
        emptyRows: 'Sem alunos da amostra neste recorte.',
        reading: (
          <>
            Uma média esconde a forma da distribuição, e é a forma que decide a ação. Duas amostras
            com a mesma média de 68 pedem trabalhos opostos: uma concentrada em torno de 68 é uma
            base homogênea que sobe com programa geral; uma dividida entre 90 e 40 é duas
            populações no mesmo relatório, e tratá-las com a mesma régua desperdiça as duas.
          </>
        ),
      };

    case 'receita':
      return {
        eyebrow: 'Receita preservada',
        title: 'A exposição que deixou de acontecer',
        value: money(model.preservedRevenue),
        denominator: (
          <>
            Somatório sobre{' '}
            <span className="font-mono font-semibold text-ink tabular">
              {int(model.preservedRevenueBasis)}
            </span>{' '}
            caso(s) encerrado(s) como acordo firmado. Fórmula: mensalidade × 6 parcelas por período
            × períodos restantes até a formatura.
          </>
        ),
        rowsLabel: 'Motivos registrados nos casos encerrados',
        /* `EvasionRow` é uma linha de EXPORTAÇÃO: ela vem quebrada por curso,
           campus, modalidade e motivo, sem percentual. Agregar por motivo aqui
           é o que a torna legível como composição — e o percentual é calculado
           sobre o total agregado, não sobre o total de casos, porque um caso
           sem motivo registrado não pertence a este denominador. */
        rows: (() => {
          const byReason = new Map<string, number>();
          for (const row of model.evasion) {
            byReason.set(row.reason, (byReason.get(row.reason) ?? 0) + row.count);
          }
          const total = Math.max(
            1,
            [...byReason.values()].reduce((sum, n) => sum + n, 0),
          );
          return [...byReason.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([reason, count]) => ({
              key: reason,
              label: reason,
              value: count,
              percent: (count / total) * 100,
              color: 'var(--risk)',
            }));
        })(),
        emptyRows: 'Nenhum caso encerrado com motivo registrado.',
        reading: (
          <>
            <strong className="font-semibold text-ink">Este número não é caixa.</strong> Ele é a
            exposição que a instituição deixou de correr, e por isso vale para dimensionar o retorno
            do Centro de Sucesso — nunca para projetar faturamento. Apresentá-lo como receita numa
            reunião de orçamento é o caminho mais curto para o indicador ser desqualificado inteiro
            na reunião seguinte.
          </>
        ),
      };

    case 'risco':
      return {
        eyebrow: 'Concentração de risco',
        title: 'Cursos por fração em risco',
        value: model.courseRisk[0]
          ? `${decimal(model.courseRisk[0].ratio * 100, 1)}%`
          : '—',
        denominator: model.courseRisk[0] ? (
          <>
            Maior concentração: <strong className="font-semibold text-ink">{model.courseRisk[0].course}</strong>,
            com <span className="font-mono font-semibold text-ink tabular">{int(model.courseRisk[0].risky)}</span>{' '}
            de <span className="font-mono font-semibold text-ink tabular">{int(model.courseRisk[0].total)}</span>{' '}
            alunos da amostra em Risco ou Crítico.
          </>
        ) : (
          <>Sem alunos da amostra neste recorte.</>
        ),
        rowsLabel: 'Todos os cursos do recorte',
        rows: model.courseRisk.map((row) => ({
          key: row.course,
          label: `${row.course} · ${int(row.risky)}/${int(row.total)}`,
          value: row.ratio * 100,
          decimals: 1,
          suffix: '%',
          percent: row.ratio * 100,
          color:
            row.ratio >= 0.4 ? 'var(--crit)' : row.ratio >= 0.2 ? 'var(--risk)' : 'var(--ink-4)',
        })),
        emptyRows: 'Sem alunos da amostra neste recorte.',
        reading: (
          <>
            Ordenar por FRAÇÃO e não por contagem é o que torna esta lista acionável: um curso com
            400 alunos e 40 em risco (10%) está saudável, e um com 20 alunos e 8 em risco (40%) está
            em colapso — mas a ordenação por contagem coloca o primeiro no topo e esconde o segundo.
            A contagem fica impressa ao lado justamente para que um curso pequeno não vire prioridade
            por ruído estatístico.
          </>
        ),
      };
  }
}
