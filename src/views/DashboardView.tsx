import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { FilterX } from 'lucide-react';
import type { ShellActions } from '../App';
import { useApp } from '../state/AppContext';
import { pageVariants } from '../lib/motion';
import { Card, EmptyState, PageHeader } from '../components/ui/Surfaces';
import { Button } from '../components/ui/Button';
import {
  NO_FOCUS,
  OUTCOMES,
  chartRangeForPeriod,
  cockpitSnapshot,
  focusLabel,
  periodMeta,
  snapshotKey,
} from '../lib/cockpit';
import type { ChartRange, CockpitFocus } from '../lib/cockpit';
import type { SignalKey } from '../data/institution';
import { STATUS_SLUG } from '../lib/healthScore';
import { CockpitFilters } from '../components/cockpit/CockpitFilters';
import { CockpitKpis } from '../components/cockpit/CockpitKpis';
import type { KpiAction } from '../components/cockpit/CockpitKpis';
import { EvolutionPanel } from '../components/cockpit/EvolutionPanel';
import { JourneyPanel } from '../components/cockpit/JourneyPanel';
import { InterventionsPanel } from '../components/cockpit/OperationPanels';
import { PieCard } from '../components/cockpit/PieCard';
import { AUTOMATION_COLOR, SIGNAL_COLOR, bandColors, outcomeColor } from '../components/cockpit/palette';
import { decimal, int } from '../lib/format';

/* ==========================================================================
   Dashboard — Gestão
   --------------------------------------------------------------------------
   Tudo o que responde "como a operação está indo" mora aqui, e não no Cockpit.
   A separação não é organizacional, é de público: o atendente abre o Cockpit
   para saber o que fazer nos próximos dez minutos; a coordenação abre o
   Dashboard para saber se o mês está funcionando. São perguntas diferentes, com
   horizontes diferentes, e empilhá-las na mesma tela fez o Cockpit ficar longo
   justamente para quem tem menos tempo.

   Aqui o scroll é bem-vindo — quem entra veio analisar.

   Um único ponto de azul preenchido: a TAXA DE ESTABILIZAÇÃO. Todos os outros
   números da tela existem para explicar aquele. Volume de atendimento não é
   resultado, e a hierarquia de cor diz isso antes de qualquer legenda.
   ========================================================================== */

export function DashboardView({ actions }: { actions: ShellActions }) {
  const { censusScope, period, resetFilters, filtersActive, theme } = useApp();
  const dark = theme === 'dark';

  const [focus, setFocus] = useState<CockpitFocus>(NO_FOCUS);
  const [range, setRange] = useState<ChartRange>(() => chartRangeForPeriod(period));

  /* A janela do gráfico acompanha o período global — trocar para "90 dias" no
     alto da página e o gráfico continuar em 30 seria um filtro que não filtra.
     "Hoje" não tem linha correspondente, então a janela fica onde está e o
     controle local do cartão continua disponível. */
  useEffect(() => {
    if (period !== 'hoje') setRange(chartRangeForPeriod(period));
  }, [period]);

  const snapshot = useMemo(
    () => cockpitSnapshot(censusScope, period, focus),
    [censusScope, period, focus],
  );

  /* Um sinal que deixou de existir no novo escopo não pode continuar recortando
     a página — o usuário veria "0 casos" sem entender de onde veio o zero. */
  useEffect(() => {
    if (focus.kind === 'signal' && snapshot.base.cells > 0) {
      const row = snapshot.signals.find((s) => s.key === focus.key);
      if (row && row.count === 0) setFocus(NO_FOCUS);
    }
  }, [focus, snapshot]);

  const seriesKey = useMemo(
    () => snapshotKey(censusScope, period, focus),
    [censusScope, period, focus],
  );

  const toggleSignal = useCallback((key: SignalKey) => {
    setFocus((current) =>
      current.kind === 'signal' && current.key === key ? NO_FOCUS : { kind: 'signal', key },
    );
  }, []);

  const toggleHighRisk = useCallback(() => {
    setFocus((current) => (current.kind === 'high-risk' ? NO_FOCUS : { kind: 'high-risk' }));
  }, []);

  /* -- Rótulo do escopo, em palavras -------------------------------------
     Nenhum gráfico deve poder ser lido fora de contexto depois de um filtro. */
  const scopeLabel = useMemo(() => {
    const parts = [
      censusScope.modality !== 'Todas' ? censusScope.modality : null,
      censusScope.course !== 'Todos' ? censusScope.course : null,
      censusScope.period !== 0 ? `${censusScope.period}º período` : null,
      censusScope.cohort !== 'Todos' ? `${censusScope.cohort}s` : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'Base completa';
  }, [censusScope]);

  const emptyReason = useMemo(() => {
    if (censusScope.cohort === 'Calouro' && censusScope.period > 1) {
      return 'Um ingressante está, por definição, no 1º período — a janela de 90 dias termina antes do segundo. Deixe o período acadêmico em "Todos", ou troque a coorte para veteranos.';
    }
    if (censusScope.course !== 'Todos' && censusScope.modality !== 'Todas') {
      return `${censusScope.course} não é ofertado na modalidade ${censusScope.modality} neste ciclo. Os tecnológicos existem só no híbrido, e alguns bacharelados só no presencial.`;
    }
    return 'Nenhuma turma ofertada neste ciclo corresponde a esta combinação de filtros.';
  }, [censusScope]);

  const activeFocus = focusLabel(focus);
  const meta = periodMeta(period);

  const kpiActions: Record<string, KpiAction> = {
    monitorados: { kind: 'link', run: () => actions.goto('alunos'), hint: 'Abrir a base de alunos' },
    atencao: {
      kind: 'link',
      run: () => actions.goto('fila', 'equipe'),
      hint: 'Abrir a fila com os casos da equipe',
    },
    'alto-risco': {
      kind: 'focus',
      active: focus.kind === 'high-risk',
      run: toggleHighRisk,
      hint: 'Recortar a página apenas no alto risco',
    },
    intervencoes: {
      kind: 'link',
      run: () => actions.goto('fila', 'equipe'),
      hint: 'Abrir a fila de atendimento',
    },
    estabilizacao: {
      kind: 'link',
      run: () => actions.goto('indicadores'),
      hint: 'Abrir os indicadores e as exportações',
    },
  };

  /* -- Pizzas ------------------------------------------------------------- */

  const bandSlices = useMemo(() => {
    const colors = bandColors(dark);
    return snapshot.bands.map((band, i) => ({
      key: band.status,
      label: band.label,
      value: band.count,
      color: colors[i],
    }));
  }, [snapshot.bands, dark]);

  const signalSlices = useMemo(
    () =>
      [...snapshot.signals]
        .sort((a, b) => b.count - a.count)
        .map((signal) => ({
          key: signal.key,
          label: signal.label,
          value: signal.count,
          color: focus.kind === 'signal' && focus.key === signal.key
            ? SIGNAL_COLOR.active
            : signalTint(signal.key, dark),
          detail:
            signal.highRisk > 0 ? (
              <>
                <span className="font-mono font-medium text-ink-3">{int(signal.highRisk)}</span> em
                alto risco
              </>
            ) : undefined,
        })),
    [snapshot.signals, focus, dark],
  );

  const outcomeSlices = useMemo(
    () =>
      OUTCOMES.map((outcome) => ({
        key: outcome.key,
        label: outcome.label,
        value: snapshot.operations.outcomes.counts[outcome.key],
        color: outcomeColor(outcome.key, dark),
        detail: outcome.settled ? undefined : 'ainda sem desfecho apurado',
      })),
    [snapshot.operations.outcomes.counts, dark],
  );

  const automationSlices = useMemo(() => {
    const a = snapshot.automation;
    return [
      { key: 'auto', label: 'Automático concluído', value: a.auto, color: AUTOMATION_COLOR.auto },
      { key: 'pending', label: 'Pendência na régua', value: a.pending, color: AUTOMATION_COLOR.pending },
      { key: 'human', label: 'Intervenção humana', value: a.human, color: AUTOMATION_COLOR.human },
    ];
  }, [snapshot.automation]);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-5"
    >
      <PageHeader
        eyebrow={
          <>
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-ink-4 text-ink-4" />
            {scopeLabel}
            {activeFocus && (
              <>
                <span className="text-ink-4">·</span>
                <span className="font-semibold text-ink-2">recorte: {activeFocus}</span>
                <button
                  onClick={() => setFocus(NO_FOCUS)}
                  className="text-brand-text transition-colors hover:text-brand-2"
                >
                  limpar
                </button>
              </>
            )}
          </>
        }
        title="Dashboard"
        description="Índices, evolução e resultado da operação. Para o trabalho do turno, o Cockpit."
      >
        <CockpitFilters />
      </PageHeader>

      {snapshot.empty ? (
        <Card>
          <EmptyState
            icon={<FilterX className="h-5 w-5" />}
            title={`Nenhum aluno em ${scopeLabel.toLowerCase()}`}
            message={emptyReason}
            action={
              filtersActive ? (
                <Button size="sm" variant="secondary" onClick={resetFilters}>
                  Limpar os filtros
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          {/* 1 — Indicadores executivos. A estabilização em azul. */}
          <CockpitKpis
            kpis={snapshot.kpis}
            period={period}
            actions={kpiActions}
            accentKey="estabilizacao"
          />

          {/* 2 — Evolução */}
          <EvolutionPanel
            agg={snapshot.base}
            seriesKey={seriesKey}
            range={range}
            onRangeChange={setRange}
            scopeLabel={scopeLabel}
          />

          {/* 3 — As três pizzas que respondem "onde", "o quê" e "deu certo?" */}
          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <PieCard
              title="Distribuição de risco"
              subtitle="Leitura do Health Score sobre toda a base monitorada."
              slices={bandSlices}
              centerValue={snapshot.base.monitored}
              centerLabel="monitorados"
              onSliceClick={(key) => {
                const band = snapshot.bands.find((b) => b.status === key);
                if (band) actions.goto('alunos', STATUS_SLUG[band.status]);
              }}
              emptyMessage="Nenhum aluno no escopo selecionado."
              footer={
                <>
                  <span className="font-mono font-medium text-ink">
                    {int(snapshot.base.monitored)}
                  </span>{' '}
                  monitorados →{' '}
                  <span className="font-mono font-medium text-ink">
                    {int(snapshot.base.attention)}
                  </span>{' '}
                  em atenção humana →{' '}
                  <span className="font-mono font-medium text-ink">
                    {int(snapshot.base.highRisk)}
                  </span>{' '}
                  em alto risco →{' '}
                  <span className="font-mono font-medium text-ink">
                    {int(snapshot.base.retention)}
                  </span>{' '}
                  em retenção.{' '}
                  {snapshot.base.monitored > 0 &&
                    `${decimal((1 - snapshot.base.attention / snapshot.base.monitored) * 100, 1)}% da base seguiu sem qualquer toque humano.`}
                  {activeFocus && (
                    <>
                      {' '}
                      Este funil é da base inteira, sem o recorte de{' '}
                      <span className="text-ink-2">{activeFocus}</span>.
                    </>
                  )}
                </>
              }
            />

            <PieCard
              title="Principais sinais detectados"
              subtitle={
                snapshot.cases.attention === 0
                  ? 'Nenhuma exceção humana no escopo selecionado.'
                  : `O que disparou as ${int(snapshot.cases.attention)} exceções que chegaram a uma pessoa. Clique para recortar.`
              }
              action={
                activeFocus && focus.kind === 'signal' ? (
                  <button
                    onClick={() => setFocus(NO_FOCUS)}
                    className="text-[12px] font-medium text-brand-text transition-colors hover:text-brand-2"
                  >
                    Limpar recorte
                  </button>
                ) : undefined
              }
              slices={signalSlices}
              centerValue={snapshot.cases.attention}
              centerLabel="em atenção"
              activeKey={focus.kind === 'signal' ? focus.key : null}
              onSliceClick={(key) => toggleSignal(key as SignalKey)}
              emptyMessage="Nenhum sinal ativo no escopo."
              footer={
                focus.kind === 'signal'
                  ? 'Indicadores, jornada e operação já estão recortados por este sinal.'
                  : 'A distribuição de risco acima descreve a base; esta descreve os casos.'
              }
            />

            <PieCard
              title="Resultado das intervenções"
              subtitle={`Desfecho dos ${int(snapshot.operations.outcomes.received)} contatos abertos ${meta.inline}.`}
              slices={outcomeSlices}
              centerValue={Math.round(snapshot.operations.outcomes.rate)}
              centerLabel="% estabilizados"
              emptyMessage="Nenhuma intervenção na janela selecionada."
              footer={
                <>
                  <span className="font-mono font-medium text-ink">
                    {int(snapshot.operations.outcomes.counts.estabilizado)}
                  </span>{' '}
                  estabilizados ÷{' '}
                  <span className="font-mono font-medium text-ink">
                    {int(snapshot.operations.outcomes.settled)}
                  </span>{' '}
                  com desfecho apurado. Os{' '}
                  <span className="font-mono">
                    {int(snapshot.operations.outcomes.counts.acompanhamento)}
                  </span>{' '}
                  em acompanhamento ficam fora da conta até fechar. Um caso só conta como
                  estabilizado quando o sinal que o abriu deixa de aparecer nos ciclos seguintes.
                </>
              }
            />
          </div>

          {/* 4 — Jornada */}
          <JourneyPanel
            stages={snapshot.journey}
            focusLabel={activeFocus}
            onOpenTrack={(track) => actions.goto(track === 'entrada' ? 'onboarding' : 'alunos')}
          />

          {/* 5 — Operação e a quarta pizza: quanto a máquina resolveu sozinha */}
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <InterventionsPanel
              operations={snapshot.operations}
              period={period}
              onOpenQueue={() => actions.goto('fila', 'equipe')}
            />

            <PieCard
              title="Automação × intervenção humana"
              subtitle="Automatizar o normal, detectar o desvio, humanizar a exceção — medido."
              slices={automationSlices}
              centerValue={snapshot.automation.freshmen}
              centerLabel="ingressantes"
              emptyMessage="Nenhum ingressante no escopo. A régua só existe dentro da janela de 90 dias."
              footer={
                <>
                  <span className="font-mono font-medium text-ink">
                    {decimal(100 - snapshot.automation.humanPercent, 1)}%
                  </span>{' '}
                  da régua segue sem uma pessoa. Cada ponto que sai desta conta é uma ligação que a
                  equipe não precisou fazer.
                </>
              }
            />
          </div>

          <p className="px-1 pb-2 text-[11px] leading-relaxed text-ink-4">
            {int(snapshot.base.monitored)} alunos monitorados no escopo{' '}
            <span className="text-ink-3">{scopeLabel.toLowerCase()}</span>. Os agregados vêm do censo
            institucional; a fila e os dossiês operam sobre a amostra de alunos carregada nesta
            versão.
          </p>
        </>
      )}
    </motion.div>
  );
}

/**
 * Tinta das fatias de sinal. Não usa a rampa de risco porque sinal não é
 * severidade: "financeiro" não é pior que "acadêmico". É uma escala de cinzas em
 * ordem de volume, e o azul só aparece na fatia recortada.
 */
function signalTint(key: string, dark: boolean): string {
  const ramp = dark
    ? ['#c3c9d1', '#a4abb5', '#8b929c', '#727984', '#5a606a']
    : ['#4b5563', '#6b7280', '#868d99', '#a1a8b3', '#bcc2cc'];
  const order = ['acesso', 'frequencia', 'financeiro', 'academico', 'onboarding'];
  const i = order.indexOf(key);
  return ramp[i < 0 ? 0 : i];
}
