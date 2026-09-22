import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { motion } from 'motion/react';
import { FilterX } from 'lucide-react';
import type { ShellActions } from '../App';
import { useApp } from '../state/AppContext';
import { pageVariants } from '../lib/motion';
import { Card, EmptyState, PageHeader, SectionLabel } from '../components/ui/Surfaces';
import { Button } from '../components/ui/Button';
import { Reveal } from '../components/ui/Reveal';
import {
  NO_FOCUS,
  chartRangeForPeriod,
  cockpitSnapshot,
  focusLabel,
  periodMeta,
  snapshotKey,
} from '../lib/cockpit';
import type { ChartRange, CockpitFocus, Kpi } from '../lib/cockpit';
import { heroSeries, kpiSparks, pulseModel, signalMovement } from '../lib/pulse';
import { TOTAL_MONITORED } from '../data/institution';
import type { SignalKey } from '../data/institution';
import { ContextBar } from '../components/dashboard/ContextBar';
import { PulseHero } from '../components/dashboard/PulseHero';
import { PulseDevice } from '../components/dashboard/PulseDevice';
import { DrillPanel } from '../components/dashboard/DrillPanel';
import type { DrillKey } from '../components/dashboard/PulsePhoneApp';
import { KpiStrip } from '../components/dashboard/KpiStrip';
import type { KpiCell } from '../components/dashboard/KpiStrip';
import { AttentionFunnel } from '../components/dashboard/AttentionFunnel';
import { SignalRanking } from '../components/dashboard/SignalRanking';
import { OutcomeComposition } from '../components/dashboard/OutcomeComposition';
import { EvolutionPanel } from '../components/cockpit/EvolutionPanel';
import { InterventionsPanel } from '../components/cockpit/OperationPanels';
import { decimal, int } from '../lib/format';

/* ==========================================================================
   Dashboard — Student Pulse
   --------------------------------------------------------------------------
   Superfície de decisão diária. A pergunta que o Cockpit responde é "o que eu
   faço nos próximos dez minutos"; a que esta tela responde é "o mês está
   funcionando, e onde ele não está".

   Estrutura, e o peso de cada dobra é deliberado:

     PRIMEIRA DOBRA   abertura editorial com a leitura do ciclo, o indicador
                      protagonista em vidro cristalino sobre a sua própria
                      série em colunas, três chamadas, uma ação — e, à direita,
                      o aparelho em dimensão real, que não ilustra o painel:
                      ele o PILOTA.
     SEGUNDA FAIXA    quatro indicadores primários, em superfície limpa. O
                      material é do hero; aqui o que interessa é o valor e a
                      variação, e um preenchimento de fundo responderia uma
                      pergunta que ninguém fez (ver `KpiStrip`).
     NÚCLEO           uma visualização dominante (evolução) e três módulos
                      auxiliares que trocaram donut por forma adequada.
     ABAIXO DA DOBRA  a operação, que é leitura de apoio.

   A REGRA QUE GOVERNA ESTA TELA NESTA VERSÃO: NADA SAI DA ABA.

   Antes, quase todo elemento clicável levava para a Fila de Atendimento, para
   os Radares ou para a Base de Alunos. Era um erro de público, não de rota:
   quem lê o Dashboard é a gestão e a diretoria, e a Fila é a ferramenta do
   atendente. Despachar um diretor para a fila operacional para explicar por
   que o alto risco subiu é responder "abra o sistema" a quem perguntou "como
   estamos".

   Agora todo aprofundamento acontece no `DrillPanel`, sobre o MESMO snapshot
   que a página já calculou — então é impossível o detalhe discordar do cartão
   que o abriu. As duas únicas exceções são a Base de Alunos e o botão de
   limpar filtros, que não são aprofundamento e sim outra tarefa.

   Até esta versão, nenhuma reorganização tinha REMOVIDO indicador: mudavam peso,
   forma e nome. Três nomes mudaram porque estavam errados, e continuam assim:

     · "Em atenção" virou "Casos em atenção humana", porque 163 são casos e
       1.741 são alunos numa faixa de score, e a tela mostrava os dois sem
       distinguir.
     · "Alto risco" virou "Casos de alto risco", porque a faixa de Health Score
       chamada "Alto risco" tem 605 alunos e o indicador tinha 30 casos.
     · O donut de sinais virou ranking de variação, porque cinco arcos de
       tamanho parecido não respondem "o que mudou?".

   -- O QUE ESTA VERSÃO TIROU ---------------------------------------------

   O critério foi um só: um indicador fica se o próprio sistema produz os dois
   lados da conta e se ele não atribui mérito por correlação.

     · A TAXA DE ESTABILIZAÇÃO deixou de ser a protagonista e saiu do produto.
       No lugar entrou CONTATO DENTRO DO PRAZO — ver `PulseHero` para o
       argumento inteiro.
     · O FUNIL DE JORNADA e a pizza AUTOMAÇÃO × INTERVENÇÃO HUMANA saíram da
       tela. Os dois medem a régua de ingressantes, que depende de data de
       matrícula, turma e presença no primeiro dia — dados que hoje não existem
       em nenhum sistema da instituição (ver `docs/comportamentos-do-aluno.md`).
       Eles não foram apagados do produto: a régua dos 90 dias continua inteira
       em `#/onboarding`, que é a tela de quem opera o acolhimento. O que saiu
       foi a promessa, na aba da diretoria, de que aquilo já está medido.
   ========================================================================== */

/** Tradução de um degrau do funil para o painel que o explica. */
const FUNNEL_DRILL: Record<string, DrillKey> = {
  monitorada: 'atencao',
  faixa: 'atencao',
  humana: 'atencao',
  'alto-risco': 'alto-risco',
  retencao: 'retencao',
};

/**
 * `actions` continua na assinatura porque o shell entrega o mesmo contrato a
 * todas as views — mas esta tela não consome nenhuma delas, e a ausência é o
 * requisito, não um esquecimento. Um `goto` disponível aqui é um convite a
 * mandar a diretoria para a Fila de Atendimento, e foi assim que a versão
 * anterior acabou com nove saídas para telas de outro público. Se um dia esta
 * tela precisar de uma ação de shell, ela será um `openStudent` explícito com
 * um rótulo que diz que sai daqui.
 */
export function DashboardView(_props: { actions: ShellActions }) {
  const { censusScope, period, resetFilters, filtersActive, theme } = useApp();
  const dark = theme === 'dark';

  const [focus, setFocus] = useState<CockpitFocus>(NO_FOCUS);
  const [range, setRange] = useState<ChartRange>(() => chartRangeForPeriod(period));
  const [drill, setDrill] = useState<DrillKey | null>(null);

  /* A janela do gráfico acompanha a janela operacional — trocar para "90 dias"
     no alto e o gráfico continuar em 30 seria um filtro que não filtra. "Hoje"
     não tem linha correspondente, então o intervalo fica onde está e o controle
     local do cartão continua disponível. */
  useEffect(() => {
    if (period !== 'hoje') setRange(chartRangeForPeriod(period));
  }, [period]);

  const snapshot = useMemo(
    () => cockpitSnapshot(censusScope, period, focus),
    [censusScope, period, focus],
  );

  const pulse = useMemo(() => pulseModel(snapshot), [snapshot]);
  const series = useMemo(() => heroSeries(snapshot), [snapshot]);
  const signals = useMemo(() => signalMovement(snapshot), [snapshot]);
  const sparks = useMemo(() => kpiSparks(snapshot), [snapshot]);

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

  /* -- Aviso de recálculo -------------------------------------------------
     Os agregados são sincronos, então não existe estado de carregamento real a
     mostrar. O que existe é uma troca de escopo, e o requisito é anunciá-la sem
     layout shift. O aviso acende por 420ms na mudança de chave do snapshot e
     apaga — tempo suficiente para o leitor de tela anunciar e para o olho
     registrar que a página respondeu, sem simular latência que não existe. */
  const [recalculating, setRecalculating] = useState(false);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setRecalculating(true);
    const t = window.setTimeout(() => setRecalculating(false), 420);
    return () => window.clearTimeout(t);
  }, [seriesKey]);

  /* -- Por que o recorte é uma transição -----------------------------------
     Trocar o foco recalcula o snapshot inteiro e re-renderiza a dobra de vidro,
     o aparelho, o gráfico de evolução, o funil, o ranking e as duas pizzas —
     tudo num commit só. Sem `startTransition` esse commit acontece DENTRO do
     clique: o navegador não consegue pintar sequer o estado pressionado do
     item antes de o trabalho terminar, e o que se vê é a página travar por um
     quadro e só então responder.

     Marcada como transição, a re-renderização deixa de ser urgente. O toque
     pinta na hora (o `whileTap` do item e o realce da linha), o React trabalha
     depois e pode ser interrompido se outro clique chegar antes — o que
     importa quando alguém alterna dois sinais em sequência rápida.

     `isPending` alimenta o mesmo aviso de "recalculando" que a troca de escopo
     já usa: agora ele acende sobre trabalho real em vez de sobre um timer. */
  const [pending, startFocusTransition] = useTransition();

  const toggleSignal = useCallback(
    (key: SignalKey) => {
      startFocusTransition(() => {
        setFocus((current) =>
          current.kind === 'signal' && current.key === key ? NO_FOCUS : { kind: 'signal', key },
        );
      });
    },
    [startFocusTransition],
  );

  const toggleHighRisk = useCallback(() => {
    startFocusTransition(() => {
      setFocus((current) => (current.kind === 'high-risk' ? NO_FOCUS : { kind: 'high-risk' }));
    });
  }, [startFocusTransition]);

  const openDrill = useCallback((key: DrillKey) => setDrill(key), []);

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
      return 'Um ingressante está, por definição, no 1º período — a janela de 90 dias termina antes do segundo. Deixe o período acadêmico em "Todos", ou troque o perfil para veteranos.';
    }
    if (censusScope.course !== 'Todos' && censusScope.modality !== 'Todas') {
      return `${censusScope.course} não é ofertado na modalidade ${censusScope.modality} neste ciclo. Os tecnológicos existem só no híbrido, e alguns bacharelados só no presencial.`;
    }
    return 'Nenhuma turma ofertada neste ciclo corresponde a esta combinação de filtros.';
  }, [censusScope]);

  const activeFocus = focusLabel(focus);
  const meta = periodMeta(period);

  /* -- Renomear os indicadores da faixa ----------------------------------
     `lib/cockpit` é compartilhado com o Cockpit, então os rótulos são
     reescritos AQUI em vez de na fonte: mudar `Kpi.label` no selector mudaria
     também a tela do atendente, que não tem o funil ao lado para explicar a
     diferença entre faixa de score e caso aberto. */
  const RELABEL: Partial<Record<Kpi['key'], string>> = {
    atencao: 'Casos em atenção humana',
    'alto-risco': 'Casos de alto risco',
    intervencoes: `Intervenções ${meta.inline}`,
  };

  const kpiOf = (key: Kpi['key']): Kpi => {
    const found = snapshot.kpis.find((k) => k.key === key)!;
    const label = RELABEL[key];
    return label ? { ...found, label } : found;
  };

  /* -- As frações que cada denominador produz ----------------------------
     Não desenham nada: são o texto do denominador impresso no pé de cada
     célula. A faixa é limpa de propósito (ver `KpiStrip`), então a proporção é
     publicada em número em vez de virar preenchimento colorido. */
  const monitoredShare = (snapshot.base.monitored / Math.max(1, TOTAL_MONITORED)) * 100;
  const attentionShare = (snapshot.cases.attention / Math.max(1, snapshot.base.monitored)) * 100;
  const highRiskShare = (snapshot.cases.highRisk / Math.max(1, snapshot.cases.attention)) * 100;
  const settledShare =
    (snapshot.operations.concluded / Math.max(1, snapshot.operations.received)) * 100;

  const leadCell: KpiCell = {
    kpi: kpiOf('monitorados'),
    spark: sparks.monitorados,
    hint: 'Ver a composição da base',
    onClick: () => openDrill('atencao'),
    denominator: (
      <>
        <span className="font-mono font-medium text-ink tabular">
          {decimal(monitoredShare, 1)}%
        </span>{' '}
        do censo institucional de{' '}
        <span className="font-mono tabular">{int(TOTAL_MONITORED)}</span> alunos monitorados
      </>
    ),
    definition: (
      <>
        Toda a graduação presencial e híbrida sob leitura automática de sinais. É a{' '}
        <strong className="font-semibold text-ink">população</strong> do escopo, não uma fila: a
        maioria destes alunos nunca é acionada. Denominador de quase todas as taxas desta página. O
        denominador ao lado diz o tamanho deste recorte dentro do censo inteiro.
      </>
    ),
  };

  const cells: KpiCell[] = [
    {
      kpi: kpiOf('atencao'),
      spark: sparks.atencao,
      hint: 'Ver quanto da base exige uma pessoa',
      onClick: () => openDrill('atencao'),
      denominator: (
        <>
          <span className="font-mono font-medium text-ink tabular">
            {decimal(attentionShare, 2)}%
          </span>{' '}
          de <span className="font-mono tabular">{int(snapshot.base.monitored)}</span> alunos
          monitorados
        </>
      ),
      definition: (
        <>
          <strong className="font-semibold text-ink">Casos abertos</strong> com uma pessoa
          responsável — desvios que a automação não resolveu. Não confundir com a{' '}
          <strong className="font-semibold text-ink">faixa de atenção</strong> do Health Score, que
          é uma classificação de {int(snapshot.base.bands[1])} alunos sem caso aberto. O funil de
          atenção abaixo mostra as duas medidas lado a lado.
        </>
      ),
    },
    {
      kpi: kpiOf('alto-risco'),
      spark: sparks['alto-risco'],
      active: focus.kind === 'high-risk',
      hint: 'Recortar a página apenas no alto risco',
      onClick: toggleHighRisk,
      denominator: (
        <>
          <span className="font-mono font-medium text-ink tabular">
            {decimal(highRiskShare, 1)}%
          </span>{' '}
          de <span className="font-mono tabular">{int(snapshot.cases.attention)}</span> casos em
          atenção humana
        </>
      ),
      definition: (
        <>
          Subconjunto dos casos em atenção humana com risco elevado de não permanência.
          Denominador: {int(snapshot.cases.attention)} casos em atenção humana. A{' '}
          <strong className="font-semibold text-ink">faixa</strong> de Health Score de mesmo nome
          tem {int(snapshot.base.bands[2])} alunos — é outra medida. Clicar aqui recorta a página
          inteira no alto risco.
        </>
      ),
    },
    {
      kpi: kpiOf('intervencoes'),
      spark: sparks.intervencoes,
      hint: 'Ver o desfecho de cada intervenção',
      onClick: () => openDrill('intervencoes'),
      denominator: (
        <>
          <span className="font-mono font-medium text-ink tabular">
            {decimal(settledShare, 1)}%
          </span>{' '}
          com desfecho apurado ·{' '}
          <span className="font-mono tabular">{int(snapshot.operations.pending)}</span> em
          acompanhamento
        </>
      ),
      definition: (
        <>
          Contatos humanos abertos na janela{' '}
          <strong className="font-semibold text-ink">{meta.label.toLowerCase()}</strong>. Volume é
          esforço, não resultado: {int(snapshot.operations.concluded)} tiveram desfecho apurado e{' '}
          {int(snapshot.operations.pending)} seguem em acompanhamento. O indicador no alto da
          página diz quantos desses contatos chegaram dentro do prazo.
        </>
      ),
    },
  ];

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
        description="Pulso do ciclo, evolução e resultado da operação. Todo aprofundamento acontece nesta aba — para o trabalho do turno, o Cockpit."
      />

      <ContextBar loading={recalculating || pending} />

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
          {/* 1 — Primeira dobra: a decisão, e o aparelho que a pilota. */}
          <PulseHero
            pulse={pulse}
            series={series}
            onOpenDrill={openDrill}
            device={
              <PulseDevice
                snapshot={snapshot}
                pulse={pulse}
                signals={signals}
                scopeLabel={scopeLabel}
                focusKey={focus.kind === 'signal' ? focus.key : null}
                onToggleSignal={toggleSignal}
                onOpenDrill={openDrill}
              />
            }
          />

          {/* Alternativa textual da primeira dobra. Não é `sr-only` por acaso:
              o mesmo texto alimenta leitor de tela e a impressão do relatório,
              onde o vidro e o aparelho não existem. */}
          <p className="sr-only print:not-sr-only print:block">{pulse.summary}</p>

          {/* 2 — Indicadores primários, em superfície limpa. */}
          <Reveal>
            <KpiStrip lead={leadCell} cells={cells} period={period} />
          </Reveal>

          {/* 3 — Núcleo analítico: uma dominante + auxiliares. */}
          <Reveal>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <EvolutionPanel
                agg={snapshot.base}
                seriesKey={seriesKey}
                range={range}
                onRangeChange={setRange}
                scopeLabel={scopeLabel}
              />
              <AttentionFunnel
                stages={pulse.funnel}
                onSelect={(stageKey) => openDrill(FUNNEL_DRILL[stageKey] ?? 'atencao')}
              />
            </div>
          </Reveal>

          <Reveal>
            <div className="grid gap-5 xl:grid-cols-2">
              <SignalRanking
                rows={signals}
                activeKey={focus.kind === 'signal' ? focus.key : null}
                onSelect={toggleSignal}
                windowLabel={meta.label}
              />
              <OutcomeComposition
                outcomes={snapshot.operations.outcomes}
                windowInline={meta.inline}
                dark={dark}
              />
            </div>
          </Reveal>

          {/* 4 — Leitura de apoio, abaixo da dobra. */}
          <Reveal>
            <div className="space-y-3">
              <SectionLabel>Operação</SectionLabel>
              <InterventionsPanel
                operations={snapshot.operations}
                period={period}
                actionLabel="Ver os desfechos"
                onOpenQueue={() => openDrill('intervencoes')}
              />
            </div>
          </Reveal>

          <p className="px-1 pb-2 text-[11px] leading-relaxed text-ink-4">
            <span className="font-mono tabular">{int(snapshot.base.monitored)}</span> alunos
            monitorados no escopo <span className="text-ink-3">{scopeLabel.toLowerCase()}</span>. Os
            agregados vêm do censo institucional; a fila e os dossiês operam sobre a amostra de
            alunos carregada nesta versão.
          </p>

          {/* O aprofundamento, sempre dentro desta aba. */}
          <DrillPanel
            drill={drill}
            snapshot={snapshot}
            pulse={pulse}
            signals={signals}
            onClose={() => setDrill(null)}
          />
        </>
      )}
    </motion.div>
  );
}
