import { useMemo } from 'react';
import { motion } from 'motion/react';
import type { ShellActions } from '../App';
import { useApp } from '../state/AppContext';
import { pageVariants } from '../lib/motion';
import { Segmented } from '../components/ui/Fields';
import { Reveal } from '../components/ui/Reveal';
import { useClock } from '../lib/sla';
import { indicatorsModel } from '../lib/indicators';
import {
  exportCases,
  exportEvasionReport,
  exportInteractions,
  exportStudents,
  printReport,
} from '../lib/exporters';
import { ExportMenu } from '../components/indicators/ExportMenu';
import type { ExportGroup } from '../components/indicators/ExportMenu';
import { IndicatorsHeader } from '../components/indicators/IndicatorsHeader';
import { ExecutivePanel } from '../components/indicators/ExecutivePanel';
import { BaseHealthPanel } from '../components/indicators/BaseHealthPanel';
import { OperationPanel } from '../components/indicators/OperationPanel';
import { RetentionPanel } from '../components/indicators/RetentionPanel';
import { TeamPanel } from '../components/indicators/TeamPanel';
import { int } from '../lib/format';

/* ==========================================================================
   Indicadores — workspace analítico
   --------------------------------------------------------------------------
   Era uma rolagem única com visão executiva, saúde da base, operação, retenção,
   radares, equipe e exportações empilhadas. Tudo estava lá, e era justamente o
   problema: numa página só, nada tem prioridade e nada pode ser comparado,
   porque comparar exige ver duas coisas ao mesmo tempo — e a rolagem garante
   que você nunca veja.

   Virou um workspace de cinco abas, e a aba mora na URL:

     #/indicadores/visao-executiva
     #/indicadores/saude-da-base
     #/indicadores/operacao
     #/indicadores/retencao
     #/indicadores/equipe

   O roteador do projeto já entende `#/rota/:param` — é o mesmo mecanismo com
   que `#/alunos/:faixa` e `#/radares/:chave` funcionam. Não foi preciso
   inventar estado de query: a aba é compartilhável por link, sobrevive ao botão
   Voltar e pode ser colada num e-mail para a coordenação abrir exatamente o
   painel de que se está falando.

   -- O que mudou nesta versão -------------------------------------------

   O diagnóstico foi "não notei diferenças grandes", e ele era justo: seis
   painéis de conteúdo correto abaixo de um cabeçalho de 24px que dizia
   "Indicadores" e nada mais. Três coisas foram consertadas, e nenhuma delas é
   um efeito:

     1. A TELA PASSOU A TER UMA ABERTURA. `IndicatorsHeader` nomeia o painel
        ativo no maior corpo do sistema e imprime o tamanho da amostra ANTES do
        primeiro número. O aviso de amostra, que antes era um `Callout` no meio
        do painel executivo, subiu para onde é lido antes de poder causar o
        erro que ele previne. Cada painel também declarava a sua tese num
        parágrafo, e os seis parágrafos saíram: a pastilha da aba já nomeia o
        assunto e o título grande já o repete, então a terceira descrição da
        mesma tela era prosa sobre o produto em vez de leitura da operação.
     2. AS ABAS VIRARAM UM CONTROLE FÍSICO. Um sublinhado de 2px em seis abas
        não diz onde você está com a rapidez que um workspace exige; a pastilha
        translúcida com espessura diz, e ela DESLIZA entre as opções, então a
        troca de aba é um movimento contínuo em vez de um corte.
     3. A TAXA DE REVERSÃO GANHOU UM OBJETO. Ver `ExecutivePanel`: ela virou
        uma placa de vidro apoiada sobre a MESMA taxa desenhada por
        especialista, porque uma reversão global de 60% pode ser uma equipe
        homogênea ou duas pessoas carregando o número de seis — e as duas
        situações pedem decisões opostas. Os outros três indicadores ficaram em
        superfície limpa: quatro objetos de material numa linha não é
        hierarquia, é um arco-íris.

   -- A regra de público -------------------------------------------------

   Indicadores é uma superfície de RELATÓRIO. Antes, quase todo elemento
   clicável levava para outra rota: a distribuição de score abria a Base de
   Alunos filtrada, os contadores de operação abriam a Fila de Atendimento, as
   linhas de radar abriam a tela de Radares, a tabela de casos abria o caso na
   fila. Eram atalhos bons para quem vai TRABALHAR aquela lista, e desvios para
   quem está lendo um relatório — e quem lê esta tela é a gestão.

   Agora o aprofundamento acontece em `ui/MetricSheet`, sobre o mesmo modelo que
   o painel já calculou. A última saída que restava — o botão para a configuração
   de radares em Governança — foi embora junto com a aba que a hospedava.

   -- A poda -------------------------------------------------------------

   As reorganizações anteriores nunca tiravam indicador; esta tirou dois, e o
   critério não foi espaço na tela:

     · A ABA QUALIDADE DOS RADARES saiu inteira. A precisão de um radar é
       `confirmados ÷ julgados`, e julgar cada alerta como confirmado ou
       descartado é hoje uma ação lateral que ninguém executa — a métrica morava
       permanentemente em "amostra insuficiente". Um indicador que estrutura não
       alimenta não melhora com redesenho. Quando o julgamento virar campo
       obrigatório do encerramento do caso, a aba volta com sentido; até lá, o
       volume de casos por radar continua em Operação, que é o que o sistema
       mede sozinho.
     · RECEITA PRESERVADA saiu da Visão executiva e da Retenção. Ver
       `lib/indicators.ts` para a fórmula e o motivo.

   O que as reorganizações anteriores já tinham feito, e continua valendo: o
   bloco de exportações virou um menu `Exportar` com o RECORTE de cada arquivo
   declarado; toda taxa tem denominador visível; `Health Score médio` nunca
   imprime `0` por ausência de amostra; contagem e percentual são colunas.
   ========================================================================== */

interface TabSpec {
  value: string;
  /** Rótulo curto, para a pastilha. */
  label: string;
  /** Nome do painel no corpo de display da abertura. */
  display: string;
}

const TABS = [
  {
    value: 'visao-executiva',
    label: 'Visão executiva',
    display: 'Visão executiva',
  },
  {
    value: 'saude-da-base',
    label: 'Saúde da base',
    display: 'Saúde da base',
  },
  {
    value: 'operacao',
    label: 'Operação',
    display: 'Operação',
  },
  {
    value: 'retencao',
    label: 'Retenção',
    display: 'Retenção',
  },
  {
    value: 'equipe',
    label: 'Equipe',
    display: 'Equipe',
  },
] as const satisfies readonly TabSpec[];

export type IndicatorTab = (typeof TABS)[number]['value'];

const DEFAULT_TAB: IndicatorTab = 'visao-executiva';

/** Um parâmetro desconhecido cai na aba padrão em vez de renderizar nada. */
function tabFromParam(param: string | null): IndicatorTab {
  const hit = TABS.find((t) => t.value === param);
  return hit ? hit.value : DEFAULT_TAB;
}

export function IndicatorsView({
  actions,
  tabParam,
}: {
  actions: ShellActions;
  tabParam?: string | null;
}) {
  const {
    students,
    scopedStudents,
    cases,
    scopedCases,
    interactions,
    specialists,
    settings,
    followUps,
    getStudent,
    theme,
  } = useApp();
  const now = useClock();
  const dark = theme === 'dark';

  const tab = tabFromParam(tabParam ?? null);
  const spec = TABS.find((t) => t.value === tab)!;

  const model = useMemo(
    () =>
      indicatorsModel({
        students,
        scopedStudents,
        cases,
        scopedCases,
        interactions,
        specialists,
        settings,
        followUps,
        now,
      }),
    [
      students,
      scopedStudents,
      cases,
      scopedCases,
      interactions,
      specialists,
      settings,
      followUps,
      now,
    ],
  );

  /* -- Exportações, agrupadas e com o recorte declarado ------------------- */
  const exportGroups: ExportGroup[] = useMemo(
    () => [
      {
        label: 'Base de alunos',
        items: [
          {
            key: 'students-scoped',
            label: 'Alunos do recorte atual',
            volume: `${int(model.sampleSize)} registros`,
            scope: 'recorte',
            run: () => exportStudents(scopedStudents),
          },
          {
            key: 'students-all',
            label: 'Todos os alunos da amostra',
            volume: `${int(model.sampleTotal)} registros`,
            scope: 'completa',
            run: () => exportStudents(students),
          },
        ],
      },
      {
        label: 'Operação',
        items: [
          {
            key: 'cases',
            label: 'Casos e SLA',
            volume: `${int(cases.length)} protocolos`,
            scope: 'completa',
            run: () => exportCases(cases, students, specialists),
          },
          {
            key: 'interactions',
            label: 'Intervenções registradas',
            volume: `${int(interactions.length)} registros`,
            scope: 'completa',
            run: () => exportInteractions(interactions, students),
          },
        ],
      },
      {
        label: 'Retenção',
        items: [
          {
            key: 'evasion',
            label: 'Motivos de evasão',
            volume: `${int(model.evasion.length)} linhas agregadas`,
            scope: 'completa',
            run: () => exportEvasionReport(cases, students),
          },
        ],
      },
    ],
    [
      model.sampleSize,
      model.sampleTotal,
      model.evasion.length,
      scopedStudents,
      students,
      cases,
      specialists,
      interactions,
    ],
  );

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="print-report space-y-5"
    >
      <IndicatorsHeader
        display={spec.display}
        sampleSize={model.sampleSize}
        sampleTotal={model.sampleTotal}
        actions={<ExportMenu groups={exportGroups} onPrint={printReport} />}
      >
        {/* A aba é uma rota. Trocar de aba entra no histórico, então Voltar
            volta para a aba anterior — e o link pode ser compartilhado.
            O `overflow-x-auto` existe para os 390px: seis pastilhas não cabem
            numa largura de celular, e comprimi-las produziria seis alvos de
            toque de 48px de largura com o texto cortado. */}
        <div className="scroll-slim -mx-1 overflow-x-auto px-1 pb-1">
          <Segmented<IndicatorTab>
            layoutId="indicators-tabs"
            value={tab}
            onChange={(next) => actions.goto('indicadores', next)}
            options={TABS.map((t) => ({ value: t.value, label: t.label }))}
          />
        </div>
      </IndicatorsHeader>

      <div role="tabpanel" aria-label={spec.label}>
        {tab === 'visao-executiva' && <ExecutivePanel model={model} dark={dark} />}

        {tab === 'saude-da-base' && (
          <Reveal>
            <BaseHealthPanel model={model} scopedStudents={scopedStudents} dark={dark} />
          </Reveal>
        )}

        {tab === 'operacao' && (
          <Reveal>
            <OperationPanel model={model} getStudent={getStudent} />
          </Reveal>
        )}

        {tab === 'retencao' && (
          <Reveal>
            <RetentionPanel model={model} />
          </Reveal>
        )}

        {tab === 'equipe' && (
          <Reveal>
            <TeamPanel model={model} />
          </Reveal>
        )}
      </div>

      <p className="px-1 pb-2 text-[11px] leading-relaxed text-ink-4">
        Base de demonstração. Todos os indicadores desta tela são calculados sobre a amostra
        operacional de <span className="font-mono tabular">{int(model.sampleTotal)}</span> alunos
        com dossiê completo — o Dashboard agrega o censo institucional, que é maior. Nenhum número
        daqui deve ser apresentado como resultado de produção.
      </p>
    </motion.div>
  );
}
