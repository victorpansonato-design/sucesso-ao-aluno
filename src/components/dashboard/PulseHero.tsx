import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from 'lucide-react';
import type { HeroColumn, PulseCall, PulseModel } from '../../lib/pulse';
import type { DrillKey } from './PulsePhoneApp';
import { Card } from '../ui/Surfaces';
import { Button } from '../ui/Button';
import { Denominator, Hint } from '../ui/Hint';
import { CrystalGlassCard, GlassLabel, GlassPill, GlassValue } from '../ui/CrystalGlass';
import { AnimatedNumber } from '../ui/Charts';
import { Reveal } from '../ui/Reveal';
import { decimal, int } from '../../lib/format';

/* ==========================================================================
   Pulso do ciclo — a primeira dobra
   --------------------------------------------------------------------------
   A dobra responde quatro perguntas, nesta ordem, e a ordem é a hierarquia
   tipográfica da própria tela:

     1. Como a base está?        → a frase, no maior corpo do sistema
     2. O que mudou?             → o delta do indicador protagonista
     3. Quantos precisam de mim? → as três chamadas compactas
     4. O que eu faço agora?     → um botão, com destino nomeado

   A composição é assimétrica porque simetria aqui seria mentira: a coluna da
   esquerda decide e o aparelho da direita informa e pilota. Duas metades iguais
   fariam o gestor escolher por onde começar, que é exatamente o problema que o
   diagnóstico apontou — "muitos blocos com peso visual semelhante".

   Três coisas mudaram nesta versão, e cada uma tem um motivo de leitura:

     · A FRASE VIROU ABERTURA EDITORIAL. Ela era um `<h2>` de 27px dentro de um
       cartão branco, disputando peso com o número ao lado. Agora ocupa uma
       superfície de azul institucional, sozinha, no maior corpo da página. O
       painel passa a ter um começo — e um painel executivo que não tem começo
       obriga o leitor a construir a hierarquia sozinho, toda manhã.
     · O PROTAGONISTA VIROU UMA PLACA DE VIDRO SOBRE UM GRÁFICO. Era um líquido
       subindo atrás de uma lâmina fosca, com um véu branco sólido cobrindo o
       terço superior para o texto passar contraste — e um vidro que precisa de
       véu não é vidro. Agora o CARTÃO é o gráfico (a série diária da taxa, em
       colunas verdes, sobre a grade de 0 a 100) e o vidro é uma placa apoiada
       sobre ele, carregando o texto. Ver `ui/CrystalGlass`.
     · O APARELHO CRESCEU PARA O TAMANHO REAL. Ver `components/device/IPhone`.
       Ele deixou de ser uma vinheta de 314px e virou o objeto de mesma altura
       que a coluna inteira — porque ele agora é o CONTROLE do dashboard, e um
       controle do tamanho de um selo não convida ninguém a tocar.
     · NENHUMA CHAMADA SAI DA ABA. Elas abriam a Fila de Atendimento, que é a
       ferramenta do atendente. Agora abrem o detalhe do indicador aqui mesmo.

   O indicador protagonista continua sendo a TAXA DE ESTABILIZAÇÃO, e a escolha
   é de dado, não de gosto: é o número que todos os outros da tela existem para
   explicar, é genuinamente 0–100 (então a altura da coluna é honesta) e tem
   denominador auditável. O Health Score médio seria o candidato óbvio e foi
   descartado de propósito — o censo guarda FAIXAS, não uma média, e publicar
   uma estimativa com o peso de uma medição é o começo de todo painel em que
   ninguém confia.
   ========================================================================== */

export function PulseHero({
  pulse,
  series,
  onOpenDrill,
  device,
}: {
  pulse: PulseModel;
  /** A série diária da taxa de estabilização — as colunas atrás do vidro. */
  series: HeroColumn[];
  onOpenDrill: (key: DrillKey) => void;
  /** O aparelho. Injetado para que o hero não conheça o mockup. */
  device: React.ReactNode;
}) {
  const { hero } = pulse;

  /* `items-stretch` e não `items-start`: o aparelho tem altura fixa (898pt) e a
     coluna da esquerda precisa acompanhá-la, senão sobram ~200px de vazio ao
     lado do aparelho e a dobra lê como um layout que não fechou. */
  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-stretch">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {/* -- 1. A abertura editorial ---------------------------------- */}
        <EditorialOpening headline={pulse.headline} />

        {/* -- 2. O protagonista, as chamadas e a ação ------------------- */}
        <Card className="flex flex-1 flex-col">
          <div className="grid flex-1 gap-4 sm:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            <CrystalGlassCard
              columns={series}
              meterLabel={hero.label}
              meterText={`${decimal(hero.value, 1)}% — ${int(hero.numerator)} de ${int(hero.denominator)} ${hero.denominatorLabel}`}
              seriesLabel={`${hero.label} dia a dia nos últimos ${series.length} dias`}
              minHeight={392}
              className="h-full"
              footer={
                <>
                  <GlassPill onClick={() => onOpenDrill('estabilizacao')}>
                    Do que ela é feita
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </GlassPill>
                  <GlassPill className="font-mono text-[11px] font-medium text-ink-2">
                    {series.length} dias
                  </GlassPill>
                </>
              }
            >
              <div className="flex items-start justify-between gap-2">
                <GlassLabel>{hero.label}</GlassLabel>
                <Hint label="a taxa de estabilização" align="right">
                  {hero.definition}
                </Hint>
              </div>

              <p className="mt-3 flex items-baseline gap-1">
                <GlassValue>
                  <AnimatedNumber value={hero.value} decimals={1} format={false} countUp={false} />
                </GlassValue>
                <span className="font-mono text-[22px] leading-none font-medium text-ink-2">%</span>
              </p>

              <p className="mt-3">
                <HeroDelta deltaPP={hero.deltaPP} comparison={hero.comparison} />
              </p>
            </CrystalGlassCard>

            {/* `flex-1` em cada item para as três dividirem a altura do objeto
                de vidro ao lado. Com `space-y` simples elas ficavam no topo e
                sobrava vazio no pé da coluna, que lia como bug de alinhamento
                em vez de respiro. */}
            <ul className="flex min-w-0 flex-col gap-2.5">
              {pulse.calls.map((call) => (
                <li key={call.key} className="flex min-h-0 flex-1">
                  <CallTile call={call} onOpenDrill={onOpenDrill} />
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Denominator
              numerator={int(hero.numerator)}
              numeratorLabel={hero.numeratorLabel}
              denominator={int(hero.denominator)}
              denominatorLabel={hero.denominatorLabel}
            />

            <Button
              variant="primary"
              size="md"
              title={pulse.priority.why}
              onClick={() => onOpenDrill(priorityDrill(pulse))}
              iconRight={<ArrowRight className="h-4 w-4" />}
              className="shrink-0"
            >
              {priorityLabel(pulse)}
            </Button>
          </div>
        </Card>
      </div>

      <div className="flex shrink-0 justify-center xl:justify-start">{device}</div>
    </div>
  );
}

/* -- A abertura editorial --------------------------------------------------
   Azul institucional chapado e A FRASE. Nada mais.

   Ela tinha três blocos de texto e cada um foi cortado por um motivo diferente:

     · A LINHA DE CIMA ("Leitura automática do ciclo · janela hoje", com ponto
       pulsante e uma nota explicando que a frase vem de regras determinísticas
       e não de IA) descrevia o MECANISMO da peça. Quem lê o painel quer saber
       como a base está, não como a frase foi montada — e a janela já está
       escolhida no controle imediatamente acima, então imprimi-la aqui era
       repetir o filtro que o leitor acabou de clicar.
     · O PARÁGRAFO DE BAIXO era o `priority.why`: a justificativa de qual item
       é o mais urgente. Ele não desapareceu do produto — é o `title` do botão
       de ação no pé da dobra, que é onde a justificativa importa, porque é ali
       que ela vira uma decisão.

   O que sobra é o maior corpo da página, sozinho numa cor cheia. Uma abertura
   com três níveis de texto não abre nada: ela obriga o leitor a decidir qual
   dos três ler primeiro, que é o trabalho que a hierarquia deveria ter feito.

   Ela aparece UMA vez por tela. Repetida, deixa de ser abertura e vira papel
   de parede, que é o destino de todo recurso visual usado duas vezes. */

/* A medida e a altura mínima são as duas metades do MESMO conserto, e o
   conserto é de layout shift, não de tipografia.

   A frase é reescrita a cada troca de recorte, e as redações possíveis vão de
   ~70 a ~96 caracteres. Em 26ch isso oscilava entre três e quatro linhas: cada
   clique num sinal do aparelho crescia ou encolhia a lâmina azul em ~48px e
   empurrava a página inteira para baixo do cursor. Era isso — e não a
   renderização — que se via como um salto no clique.

   Em 32ch a redação mais longa cabe em três linhas, e `min-h` reserva as três
   sempre. A lâmina passa a ter altura constante enquanto o texto dentro dela
   muda, que é a única forma de um bloco de conteúdo variável não ser um
   trampolim. A reserva é em `em` para acompanhar os três tamanhos de fonte do
   breakpoint sem três números mágicos.

   O `flex items-center` é a outra metade da reserva: sem ele a frase de duas
   linhas fica colada no topo e a folga sobra toda embaixo, e a lâmina lê como
   um bloco que alguém esqueceu de fechar. Centralizada, a mesma folga vira
   respiro simétrico e a altura constante deixa de ser perceptível. */
function EditorialOpening({ headline }: { headline: string }) {
  return (
    <Reveal y={10}>
      <section className="editorial-slab px-6 py-8 sm:px-8 sm:py-10">
        <h2 className="flex max-w-[32ch] min-h-[calc(3*1.08em)] items-center text-[30px] leading-[1.08] font-semibold tracking-[-0.032em] text-white sm:text-[38px] lg:text-[44px]">
          {headline}
        </h2>
      </section>
    </Reveal>
  );
}

/* -- Delta do protagonista ------------------------------------------------ */

/**
 * A variação de uma taxa é em PONTOS PERCENTUAIS, nunca em porcentagem.
 * "De 71% para 73%" é +2 p.p., e chamar isso de "+2,8%" é um erro de leitura
 * que um painel executivo não pode cometer duas vezes.
 */
function HeroDelta({ deltaPP, comparison }: { deltaPP: number | null; comparison: string }) {
  if (deltaPP === null) {
    return (
      <span className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-2">
        <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        sem base de comparação no período anterior
      </span>
    );
  }

  const flat = Math.abs(deltaPP) < 0.05;
  const rising = deltaPP > 0;
  const Icon = flat ? Minus : rising ? ArrowUpRight : ArrowDownRight;

  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-ink-2">
      <Icon
        className={`h-3.5 w-3.5 shrink-0 ${flat ? '' : rising ? 'text-vital-ink' : 'text-crit-ink'}`}
        aria-hidden="true"
      />
      <span className="font-mono font-semibold text-ink tabular">
        {flat ? 'estável' : `${rising ? '+' : '−'}${decimal(Math.abs(deltaPP), 1)} p.p.`}
      </span>
      <span>{comparison}</span>
    </span>
  );
}

/* -- Chamada compacta ------------------------------------------------------
   Continua sendo um botão, mas o destino mudou de rota para painel. Quem lê o
   Dashboard é a gestão, e mandá-la para a Fila de Atendimento — a ferramenta do
   atendente — para entender um número é responder "abra o sistema" a quem
   perguntou "como estamos". */

function CallTile({
  call,
  onOpenDrill,
}: {
  call: PulseCall;
  onOpenDrill: (key: DrillKey) => void;
}) {
  const ink =
    call.tone === 'crit' ? 'text-crit-ink' : call.tone === 'warn' ? 'text-warn-ink' : 'text-ink';

  return (
    <button
      type="button"
      onClick={() => onOpenDrill(call.key as DrillKey)}
      className="group flex w-full items-center gap-3 rounded-xl bg-surface-2 px-4 py-3.5 text-left transition-colors hover:bg-surface-3"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-ink-3">{call.label}</span>
        <span className="mt-0.5 block truncate text-[11px] text-ink-4">{call.detail}</span>
      </span>
      <span className={`shrink-0 font-mono text-[26px] leading-none font-medium tabular ${ink}`}>
        <AnimatedNumber value={call.value} resetOnChange />
      </span>
      <ArrowRight
        className="h-3.5 w-3.5 shrink-0 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />
    </button>
  );
}

/* -- A prioridade, traduzida para um painel desta aba ---------------------
   `pulse.priority` carrega uma rota porque o Cockpit também o consome. Aqui a
   rota é ignorada e a mesma prioridade vira o detalhe correspondente — a
   decisão de não sair da aba é DESTA tela, não do modelo. */

function priorityDrill(pulse: PulseModel): DrillKey {
  switch (pulse.priority.key) {
    case 'sla':
      return 'sla';
    case 'alto-risco':
      return 'alto-risco';
    case 'fila':
      return 'intervencoes';
    default:
      return 'estabilizacao';
  }
}

function priorityLabel(pulse: PulseModel): string {
  switch (pulse.priority.key) {
    case 'sla':
      return 'Analisar o prazo de 1º contato';
    case 'alto-risco':
      return 'Analisar o alto risco';
    case 'fila':
      return 'Analisar as intervenções';
    default:
      return 'Analisar a estabilização';
  }
}
