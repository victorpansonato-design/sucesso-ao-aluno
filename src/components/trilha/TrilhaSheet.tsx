import type { ReactNode } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import type { TimelineItem, TrilhaModel, TrilhaStep } from '../../types';
import {
  BAND_LABEL,
  CONSEQUENCE_LABEL,
  PLACE_LABEL,
  bucketsOf,
  classesPhrase,
  countdownPhrase,
  datePhrase,
  deltaPhrase,
  stepProgress,
} from '../../lib/trilha';
import { SEMESTER, SOURCE_PAGES } from '../../data/academicCalendars';
import { fullDate } from '../../lib/format';
import { Callout, DataList } from '../ui/Surfaces';
import { Pill } from '../ui/Badges';

/* ==========================================================================
   TrilhaSheet — a folha imprimível
   --------------------------------------------------------------------------
   É a terceira renderização do MESMO `TrilhaModel` — as outras duas são a tela
   do aparelho e a régua de push — e é a única das três que o aluno leva para
   casa. Ela chega por um link de WhatsApp, abre sem senha, e é impressa ou
   salva em PDF por quem paga a mensalidade. Isso decide tudo o que está escrito
   aqui.

   DOCUMENTO, NÃO PAINEL
   Nenhuma animação, nenhum gradiente, nenhuma sombra, nenhum grid exótico:
   `h1`, `h2`, `ol`, `ul`, uma coluna, `bg-surface` e `text-ink`. Não é economia
   de esforço — é que metade do público desta folha vai ler uma FOTOCÓPIA dela.
   Um card com vidro e brilho vira um retângulo cinza no papel; uma hierarquia
   feita de tamanho, peso e fio sobrevive à impressora. Por isso também não há
   `motion` importado neste arquivo, e não pode haver.

   Os nomes de classe `trilha-sheet__*` existem para quem vai escrever o
   `@media print` em `src/index.css`: cabeçalho, seção, item, citação, passo e
   rodapé têm gancho próprio, e o componente não carrega CSS global nenhum.

   SEGUNDA PESSOA, E SÓ ONDE HÁ FRASE NOSSA A ESCREVER
   A voz é virada para o aluno («sua prova», «você tem 48 horas»), mas nenhuma
   afirmação sobre data, disciplina, horário ou local é redigida aqui: tudo isso
   vem de `item.title`, `item.lines`, `datePhrase` e `countdownPhrase`, que são
   do motor. O que este arquivo escreve são as frases sobre o DOCUMENTO — por
   que uma faixa existe, o que a folha não mostra, quem manda em caso de
   divergência. Duas redações do mesmo aviso divergem no dia em que alguém
   corrigir só uma, e é por isso que a linha da turma ambígua é PROMOVIDA para o
   destaque em vez de reescrita (ver `DateEntry`).

   AS TRÊS COISAS QUE NÃO SE NEGOCIAM NESTA FOLHA
   1. O contador «N de M» está no CORPO do documento, em tipo de leitura, com os
      dois números. Não é rodapé apagado: é o mecanismo que transforma recorte
      em escolha informada. Quando não há calendário, ele diz isso — «0 de 0»
      pareceria um recorte quando na verdade é a ausência de documento.
   2. Cada item cita o texto oficial, literal, com o rótulo de data como
      impresso, o nome do PDF e o link. O nosso texto fica EM CIMA do oficial,
      nunca EM VEZ dele; na divergência, o PDF ganha, e o rodapé diz isso.
   3. Onde o motor não sabe — turma não informada, disciplina não resolvida,
      calendário inexistente —, a folha DIZ que não sabe, no corpo e em
      destaque. Nada de preenchimento plausível: uma data de prova errada com a
      nossa assinatura é o pior erro que este produto pode cometer.

   O que esta folha deliberadamente NÃO traz: `BAND_DESCRIPTION`. Aquele texto
   está escrito na voz da operação («a trilha mostra o que vem agora») e explica
   o produto a quem o opera. O aluno não precisa da teoria do recorte, precisa
   do recorte e do contador. `BAND_LABEL` só aparece quando a faixa foi forçada
   pelo simulador, e aí o aviso é para quem imprimiu, não para o aluno.
   ========================================================================== */

/**
 * Data do documento.
 *
 * Já foi um contorno local: `fullDate` lia «2026-09-11» como meia-noite UTC e
 * devolvia 10/09/2026 no fuso de Brasília — um dia a menos justamente no selo
 * que o documento chama de «atualizado em». O conserto foi para dentro de
 * `lib/format`, onde `fullDate` agora reconhece a forma só-data e a ancora ao
 * meio-dia local. Esta função sobrou como nome: o documento fala de «data de
 * geração», não de «timestamp formatado», e ter o termo do documento aqui é o
 * que mantém o corpo do componente legível.
 */
function docDate(isoDay: string): string {
  return fullDate(isoDay);
}

/** «3 datas» · «1 data». Contagem com o substantivo certo, sempre. */
function count(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/* -- Peças do documento --------------------------------------------------- */

/**
 * Título de seção.
 *
 * Não reusa `SectionLabel` do kit por um motivo só: lá o título é `text-ink-3`,
 * cinza, porque num painel ele é uma legenda entre dez blocos. Num documento o
 * título de seção é a coisa mais forte da página depois do nome do aluno, e
 * cinza claro é o primeiro tom que a impressora perde.
 */
function SheetSection({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="trilha-sheet__section mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline-strong pb-1.5">
        <h2 className="break-after-avoid text-[13px] leading-snug font-semibold text-ink">
          {title}
        </h2>
        {meta && <span className="font-mono text-[10px] text-ink-3 tabular">{meta}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-brand-text underline underline-offset-2"
    >
      {children}
    </a>
  );
}

/**
 * A citação oficial de um item.
 *
 * Carrega o rótulo de data COMO IMPRESSO (`dateLabel`) ao lado do nome do PDF,
 * e não só o título: é o par que permite a alguém abrir o arquivo e achar a
 * linha em dez segundos — o que é a diferença entre uma citação e um enfeite de
 * citação.
 */
function OfficialQuote({ item }: { item: TimelineItem }) {
  return (
    <div className="trilha-sheet__quote mt-2.5 border-l-2 border-hairline-strong pl-3">
      <p className="text-[11px] leading-relaxed text-ink-3">
        No calendário oficial: <span className="text-ink-2">«{item.officialTitle}»</span>
      </p>
      {item.officialDetail && (
        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">«{item.officialDetail}»</p>
      )}
      <p className="mt-1 text-[10px] leading-relaxed text-ink-4">
        Impresso como «{item.dateLabel}» · {item.sourceName} ·{' '}
        <SourceLink href={item.sourceUrl}>abrir o PDF oficial</SourceLink>
      </p>
    </div>
  );
}

function DivergenceLine({ note }: { note: string }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-warn-ink">
      <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-semibold">Divergência a conferir no PDF: </span>
        {note}
      </span>
    </p>
  );
}

/** Um item da fila de datas, com tudo o que o motor resolveu e tudo o que não. */
function DateEntry({ item }: { item: TimelineItem }) {
  /* A frase que explica os dois dias de prova já vem escrita em `item.lines`,
     pelo motor, com as datas que o PDF imprime. Reescrevê-la aqui criaria uma
     segunda redação do mesmo aviso — então a linha do motor é PROMOVIDA para a
     faixa de destaque e sai da lista corrida, em vez de ser duplicada. O texto
     de reserva existe porque `ambiguousDay` é a verdade que manda: se o formato
     da linha mudar e o filtro não a achar, o aviso ainda tem de aparecer. */
  const destaque = item.ambiguousDay ? item.lines.filter((l) => /turma/i.test(l)) : [];
  const corridas = item.lines.filter((l) => !destaque.includes(l));

  return (
    <article className="trilha-sheet__item break-inside-avoid border-t border-hairline pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-mono text-[11px] font-medium text-ink-2">
          {datePhrase(item)} · {countdownPhrase(item.inDays)}
        </p>
        {item.consequence === 'irrecuperavel' ? (
          <Pill tone="crit" dot={false} solid>
            {CONSEQUENCE_LABEL.irrecuperavel}
          </Pill>
        ) : item.consequence === 'alta' ? (
          <Pill dot={false}>{CONSEQUENCE_LABEL.alta}</Pill>
        ) : null}
      </div>

      <h3 className="mt-1 text-[14px] leading-snug font-semibold text-ink">{item.title}</h3>

      {corridas.length > 0 && (
        <ul className="mt-1.5 space-y-1 text-[12.5px] leading-relaxed text-ink-2">
          {corridas.map((line, i) => (
            <li key={`${item.id}-linha-${i}`} className="flex gap-2">
              <span
                className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-4"
                aria-hidden="true"
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}

      {item.ambiguousDay && (
        <div className="mt-2.5">
          <Callout
            tone="warn"
            icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
            title="O seu dia depende da sua turma"
          >
            {destaque.length > 0
              ? destaque.join(' ')
              : 'O calendário imprime mais de um dia para esta data, um por turma, e o sistema não tem a sua. Confirme com a coordenação qual é o seu dia antes de contar com qualquer um deles.'}
          </Callout>
        </div>
      )}

      {item.officialNote && <DivergenceLine note={item.officialNote} />}

      <OfficialQuote item={item} />
    </article>
  );
}

/** Uma linha da faixa guardada: compacta, mas ainda com a citação de origem. */
function KeptRow({ item }: { item: TimelineItem }) {
  return (
    <li className="trilha-sheet__kept break-inside-avoid border-t border-hairline py-2.5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="w-32 shrink-0 font-mono text-[11px] font-medium text-ink-2">
          {datePhrase(item)}
        </span>
        <span className="min-w-0 flex-1 text-[12.5px] leading-snug font-semibold text-ink">
          {item.title}
        </span>
        <span className="font-mono text-[10px] text-ink-3">{countdownPhrase(item.inDays)}</span>
      </div>
      {item.officialNote && <DivergenceLine note={item.officialNote} />}
      <p className="mt-1 text-[10px] leading-relaxed text-ink-4">
        No calendário oficial: «{item.officialTitle}» · impresso como «{item.dateLabel}» ·{' '}
        {item.sourceName} · <SourceLink href={item.sourceUrl}>abrir o PDF oficial</SourceLink>
      </p>
    </li>
  );
}

/** Um passo da trilha de entrada, com a evidência de onde saiu o «concluído». */
function StepRow({ step, index }: { step: TrilhaStep; index: number }) {
  return (
    <li className="trilha-sheet__step break-inside-avoid flex gap-3">
      <span
        className={[
          'mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-sm font-mono text-[10px] font-semibold',
          step.done ? 'bg-brand text-on-brand' : 'bg-surface-2 text-ink-3',
        ].join(' ')}
        aria-hidden="true"
      >
        {step.done ? <Check className="h-3 w-3" /> : index + 1}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3
            className={[
              'text-[13px] leading-snug font-semibold',
              step.done ? 'text-ink-2' : 'text-ink',
            ].join(' ')}
          >
            {step.title}
          </h3>
          <Pill dot={false} mono>
            {PLACE_LABEL[step.place]}
          </Pill>
          {step.done && <span className="text-[11px] font-medium text-ink-3">concluído</span>}
        </div>

        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">{step.action}</p>

        {step.blocking && !step.done && (
          <p className="mt-1 text-[11px] leading-relaxed font-medium text-warn-ink">
            Este passo trava o seu primeiro dia de aula. Resolva antes dele.
          </p>
        )}

        {step.evidence && (
          <p className="mt-1 text-[11px] leading-relaxed text-ink-4">
            No sistema: {step.evidence}.
          </p>
        )}
      </div>
    </li>
  );
}

/* -- A folha -------------------------------------------------------------- */

export function TrilhaSheet({ model }: { model: TrilhaModel }) {
  const { student, resolution, delta, steps, today } = model;
  const buckets = bucketsOf(model);
  const progress = stepProgress(steps);
  const pdf = resolution.calendar;

  const semCalendario = resolution.match === 'nenhuma';

  /* A janela das 48 horas é o único caso em que o motor mantém no «agora» algo
     que já passou. Misturar isso numa seção chamada «suas próximas datas» seria
     dizer que uma prova de anteontem é próxima — então a folha separa as duas,
     e explica por que a de trás continua acionável. */
  const aindaDaTempo = buckets.agora.filter((i) => i.inDays < 0);
  const proximas = buckets.agora.filter((i) => i.inDays >= 0);
  const guardados = buckets.guardado;

  const folga = deltaPhrase(delta);
  const foraDaFolha = buckets.passado.length + buckets.recolhido.length;

  return (
    <article className="trilha-sheet mx-auto max-w-3xl bg-surface p-5 text-ink sm:p-7">
      {/* 1. Cabeçalho do documento ---------------------------------------- */}
      <header className="trilha-sheet__header">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-wide text-ink-3 uppercase">
              Centro de Sucesso ao Aluno · Trilha do Aluno
            </p>
            <h1 className="mt-1.5 text-[21px] leading-tight font-semibold tracking-tight text-ink">
              {student.name}
            </h1>
          </div>
          <span className="shrink-0 rounded-sm bg-surface-2 px-2 py-1 font-mono text-[10px] text-ink-2">
            Atualizado em {docDate(today)}
          </span>
        </div>

        <DataList
          className="mt-4"
          columns={4}
          items={[
            { label: 'RA', value: <span className="font-mono tabular">{student.ra}</span> },
            { label: 'Curso', value: student.course },
            { label: 'Modalidade e turno', value: `${student.modality} · ${student.shift}` },
            {
              label: 'Turma',
              value: student.turma ?? <span className="text-ink-3">turma não informada</span>,
            },
          ]}
        />

        <div className="mt-3 space-y-1 border-t border-hairline pt-3 text-[12px] leading-relaxed">
          <p className="text-ink-2">
            Semestre {SEMESTER} ·{' '}
            {folga ? `você ${folga}` : `ingresso em ${student.journey.admissionSemester}`}
          </p>
          {delta.classesStart && (
            <p className="text-ink-3">
              Primeiro dia de aula: {docDate(delta.classesStart)} — {classesPhrase(delta)}.
            </p>
          )}
          {pdf && (
            <p className="text-ink-3">
              Calendário de referência: {pdf.name} ·{' '}
              <SourceLink href={pdf.url}>{pdf.source}</SourceLink>
            </p>
          )}
        </div>
      </header>

      {/* Aviso de prévia: a faixa veio do simulador, não do dado do aluno. */}
      {delta.simulated && (
        <div className="mt-5">
          <Callout tone="warn" title="Prévia com faixa simulada">
            Esta folha foi gerada na faixa «{BAND_LABEL[delta.band]}», escolhida na tela de gestão.
            O recorte de datas e de passos abaixo não é o que este aluno veria hoje.
          </Callout>
        </div>
      )}

      {/* 2 e 3. Como o calendário deste aluno foi resolvido — ou não ------- */}
      {semCalendario ? (
        <SheetSection title="Não há calendário publicado para o seu curso">
          <div className="space-y-2.5 text-[12.5px] leading-relaxed text-ink-2">
            {resolution.note && <p>{resolution.note}</p>}
            <p>
              É por isso que esta folha não traz nenhuma data. Preferimos dizer que não sabemos a
              publicar, com a nossa assinatura, a data de um curso parecido com o seu. O que vem
              abaixo são os passos que valem de qualquer forma.
            </p>
            <p className="text-ink-3">
              Os calendários publicados ficam em{' '}
              <SourceLink href={SOURCE_PAGES.principal}>{SOURCE_PAGES.principal}</SourceLink>. Se o
              do seu curso aparecer lá, fale com a coordenação e peça esta folha de novo.
            </p>
          </div>
        </SheetSection>
      ) : (
        <>
          {resolution.match === 'outra-coorte' && resolution.note && (
            <div className="mt-5">
              <Callout
                tone="warn"
                icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
                title="Este é o calendário da outra coorte do seu curso"
              >
                {resolution.note}
              </Callout>
            </div>
          )}

          {delta.band === 'antecipada' && (
            <div className="mt-5">
              <Callout title="O seu semestre ainda não começou">
                As aulas do calendário do seu curso começam em {docDate(delta.classesStart)} —{' '}
                {classesPhrase(delta)}. Até lá esta folha traz só os passos: mostrar as datas de um
                semestre que não é o seu seria pior do que não mostrar data nenhuma.
              </Callout>
            </div>
          )}
        </>
      )}

      {/* 4. A trilha de entrada ------------------------------------------- */}
      <SheetSection
        title="Comece por aqui"
        meta={`${progress.done} de ${progress.total} concluídos`}
      >
        {steps.length === 0 ? (
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            Nenhum passo de entrada se aplica a você nesta altura do semestre.
          </p>
        ) : (
          <>
            {progress.blocking > 0 && (
              <p className="mb-4 text-[12px] leading-relaxed font-medium text-warn-ink">
                {progress.blocking === 1
                  ? 'Um destes passos trava o seu primeiro dia de aula e ainda está em aberto.'
                  : `${progress.blocking} destes passos travam o seu primeiro dia de aula e ainda estão em aberto.`}
              </p>
            )}
            <ol className="space-y-4">
              {steps.map((step, i) => (
                <StepRow key={step.id} step={step} index={i} />
              ))}
            </ol>
          </>
        )}
      </SheetSection>

      {/* 5 e 6. As datas -------------------------------------------------- */}
      {!semCalendario && (
        <>
          {aindaDaTempo.length > 0 && (
            <SheetSection
              title="Passou, mas ainda dá tempo de agir"
              meta={count(aindaDaTempo.length, 'data', 'datas')}
            >
              <p className="mb-4 text-[12px] leading-relaxed text-ink-2">
                O prazo de substitutiva conta da data da prova, não do dia em que você descobre que
                ele existe. Por isso estas datas continuam aqui, e não na lista do que já passou.
              </p>
              <div className="space-y-5">
                {aindaDaTempo.map((item) => (
                  <DateEntry key={item.id} item={item} />
                ))}
              </div>
            </SheetSection>
          )}

          <SheetSection title="Suas próximas datas" meta={count(proximas.length, 'data', 'datas')}>
            {proximas.length > 0 ? (
              <div className="space-y-5">
                {proximas.map((item) => (
                  <DateEntry key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-ink-2">
                Nenhuma data do calendário do seu curso cai na janela desta folha. Quantas existem
                no semestre inteiro está algumas linhas abaixo, e todas elas estão no PDF oficial.
              </p>
            )}
          </SheetSection>

          {guardados.length > 0 && (
            <SheetSection
              title="Não perca estes prazos"
              meta={count(guardados.length, 'prazo', 'prazos')}
            >
              <p className="mb-3 text-[12px] leading-relaxed text-ink-2">
                Estes ficam numa faixa separada, fora da fila cronológica, porque estão longe no
                calendário e são os que não dá para recuperar depois — e nenhuma aula lembra você
                deles.
              </p>
              <ul>
                {guardados.map((item) => (
                  <KeptRow key={item.id} item={item} />
                ))}
              </ul>
            </SheetSection>
          )}
        </>
      )}

      {/* 7. O contador, no corpo do documento ----------------------------- */}
      <SheetSection title="O que esta folha não mostra">
        {semCalendario ? (
          <p className="text-[13px] leading-relaxed text-ink">
            Esta folha não mostra nenhuma data do semestre, porque não existe calendário publicado
            para o seu curso nesta modalidade. Não houve recorte: faltou o documento de origem.
          </p>
        ) : (
          <>
            <p className="text-[13px] leading-relaxed text-ink">
              Você está vendo{' '}
              <span className="font-mono font-semibold tabular">{model.shownCount}</span> das{' '}
              <span className="font-mono font-semibold tabular">{model.totalCount}</span> datas do
              calendário do seu curso.
            </p>
            {foraDaFolha > 0 && (
              <p className="mt-2 text-[12px] leading-relaxed text-ink-2">
                Ficaram de fora{' '}
                {count(
                  buckets.passado.length,
                  'data que já aconteceu',
                  'datas que já aconteceram',
                )}{' '}
                e{' '}
                {count(
                  buckets.recolhido.length,
                  'que está fora da janela desta folha',
                  'que estão fora da janela desta folha',
                )}
                . Nenhuma foi apagada.
              </p>
            )}
          </>
        )}

        <p className="mt-3 text-[12px] leading-relaxed text-ink-2">
          O calendário completo do semestre, com todas as linhas,{' '}
          {pdf ? (
            <>
              é o documento «{pdf.name}»: <SourceLink href={pdf.url}>{pdf.url}</SourceLink>
            </>
          ) : (
            <>
              fica na página de calendários da instituição:{' '}
              <SourceLink href={SOURCE_PAGES.principal}>{SOURCE_PAGES.principal}</SourceLink>
            </>
          )}
        </p>
      </SheetSection>

      {/* 8. Rodapé jurídico ----------------------------------------------- */}
      <footer className="trilha-sheet__footer mt-10 border-t border-hairline-strong pt-4 text-[11px] leading-relaxed text-ink-3">
        <p>
          Documento gerado em {docDate(today)} pelo Centro de Sucesso ao Aluno para o RA{' '}
          <span className="font-mono tabular">{student.ra}</span>. A versão viva desta folha fica no
          mesmo endereço e é atualizada quando o calendário muda; o papel, não.
        </p>
        <p className="mt-2">
          O documento oficial é o calendário acadêmico publicado pela instituição em{' '}
          <SourceLink href={SOURCE_PAGES.principal}>{SOURCE_PAGES.principal}</SourceLink>. Em
          qualquer divergência entre esta folha e o calendário publicado, vale o calendário
          publicado.
        </p>
      </footer>
    </article>
  );
}
