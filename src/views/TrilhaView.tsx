import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Compass,
  ExternalLink,
  FileText,
  Link2,
  Printer,
  RotateCcw,
  TriangleAlert,
  UserSearch,
} from 'lucide-react';
import type { Student, TrilhaBand, TrilhaConfig } from '../types';
import type { ShellActions } from '../App';
import { useApp } from '../state/AppContext';
import { CALENDARS, CALENDAR_ENTRIES, SEMESTER } from '../data/academicCalendars';
import { DEFAULT_TRILHA_CONFIG } from '../data/trilhaConfig';
import { DEFAULT_PREVIEW, TRILHA_PREVIEWS, previewByRa } from '../data/trilhaPreview';
import {
  BAND_LABEL,
  buildTrilha,
  resolveCalendar,
} from '../lib/trilha';
import { searchKey } from '../lib/format';
import { todayIso } from '../lib/calendarDates';
import { pageVariants } from '../lib/motion';
import { Card, EmptyState, PageHeader, SectionLabel, Tabs } from '../components/ui/Surfaces';
import { SearchInput, Segmented } from '../components/ui/Fields';
import type { SegmentedOption } from '../components/ui/Fields';
import { Button } from '../components/ui/Button';
import { Avatar, CohortBadge, ModalityBadge, Pill } from '../components/ui/Badges';
import { IPhone } from '../components/device/IPhone';
import { AnchietaPhoneApp } from '../components/device/AnchietaPhoneApp';
import type { PhoneScreen } from '../components/device/AnchietaPhoneApp';
import { TrilhaAudit } from '../components/trilha/TrilhaAudit';
import { TrilhaSheet } from '../components/trilha/TrilhaSheet';
import { TrilhaConfigPanel } from '../components/trilha/TrilhaConfigPanel';

/* ==========================================================================
   Trilha do Aluno
   --------------------------------------------------------------------------
   Aba própria, vizinha da Gestão de PUSH, e não uma seção do Onboarding 90
   dias. O motivo não é espaço, é verbo: o Onboarding é uma FILA DE TRABALHO
   (quais calouros precisam de contato, recortada por janela de dias) e serve a
   equipe de acolhimento. Esta é um GERADOR: recebe um RA e produz o artefato
   daquele aluno. Usuário diferente, gesto diferente — e misturar engordaria a
   fila dos 90 dias, que é o oposto do que se pediu.

   UM CAMPO, DUAS SUB-ABAS, E ACABOU

   O pedido foi explícito: nada da complexidade da Gestão de PUSH. Então o
   gerador tem um campo de RA e nenhum filtro, porque um gerador trabalha com um
   aluno por vez — filtro é ferramenta de quem olha a base, e a base tem tela
   própria. Os poucos controles que existem aqui não filtram: eles trocam a
   PERGUNTA (qual tela do aparelho, qual faixa simulada).

   OS CINCO PERFIS SÃO ATALHO, NÃO ESTADO — E É POR ISSO QUE DÁ PARA SAIR DELES

   A aba abre num perfil de demonstração porque abrir vazia desperdiça o
   primeiro segundo de quem chega. O que ela NÃO pode fazer é prender: o campo
   de RA continua vivo ao lado dos atalhos, o perfil aberto aparece marcado na
   fileira, e o cabeçalho do aluno carrega um «Trocar de aluno» que devolve a
   tela ao estado de busca. Sem essa saída, o perfil aberto lia como seleção
   travada em vez de sugestão.

   O SIMULADOR DE FAIXA É A PEÇA QUE RESPONDE À DÚVIDA DE PRODUTO

   A pergunta que abriu este projeto — «o que faz sentido mostrar para quem se
   matricula hoje e começa em quatro meses, contra quem começa semana que vem?»
   — não se responde lendo especificação. Se responde vendo. O controle de faixa
   reconstrói o mesmo aluno nas quatro situações, e a diferença aparece na tela
   do aparelho: a faixa antecipada não tem linha do tempo nenhuma, a véspera tem
   cinco passos e duas semanas de datas.

   Ele é um SIMULADOR e diz isso em todo lugar onde aparece, porque uma prévia
   que parece estado real é pior que nenhuma prévia.
   ========================================================================== */

type Tab = 'trilha' | 'configuracao';

const TABS: { value: Tab; label: string }[] = [
  { value: 'trilha', label: 'Trilha do aluno' },
  { value: 'configuracao', label: 'Configuração' },
];

const BAND_OPTIONS: SegmentedOption<'real' | TrilhaBand>[] = [
  { value: 'real', label: 'Situação real' },
  { value: 'antecipada', label: BAND_LABEL.antecipada },
  { value: 'confortavel', label: BAND_LABEL.confortavel },
  { value: 'vespera', label: BAND_LABEL.vespera },
  { value: 'em-curso', label: BAND_LABEL['em-curso'] },
];

/* «Sua modalidade» entrou na fileira porque é a tela em que os perfis de
   demonstração abrem: sem ela, o segmentado ficava sem pastilha acesa e o
   controle parecia quebrado. Os dois rótulos mais longos encolheram para o
   controle não passar da largura que já tinha com quatro. */
const SCREEN_OPTIONS: SegmentedOption<PhoneScreen>[] = [
  { value: 'inicio', label: 'Início' },
  { value: 'datas', label: 'Datas' },
  { value: 'trilha', label: 'Comece por aqui' },
  { value: 'modalidade', label: 'Sua modalidade' },
  { value: 'completo', label: 'Calendário' },
];

/**
 * Ofertas encerradas.
 *
 * A linha continua no site e os alunos continuam na base histórica — a
 * transcrição do calendário não mente sobre o que está publicado. O que não faz
 * sentido é OFERECER uma delas como exemplo do que a trilha entrega hoje: a
 * oferta híbrida de Gestão de RH acabou, e um atalho para ela manda quem abre a
 * aba conhecer o produto por uma turma que não existe mais.
 *
 * Quando outra oferta encerrar, é esta linha que muda.
 */
const OFERTA_ENCERRADA = /Recursos Humanos/;

/**
 * Os alunos reais que a aba oferece como atalho, e as travas que decidem quais.
 *
 * A régua anterior fazia o contrário do que este atalho serve para fazer:
 * oferecia de propósito os casos ruins — um aluno SEM calendário publicado e
 * duas linhas de Gestão de RH, cuja oferta híbrida não existe mais. Quem abre a
 * aba para ver a trilha funcionando caía direto num «não há documento de
 * origem», e um atalho que entrega vazio não é atalho.
 *
 * Os casos ruins não sumiram do produto: continuam resolvidos quando o RA é
 * digitado, contados na aba de Configuração e explicados no cabeçalho. O que
 * mudou é que a tela deixou de EMPURRÁ-LOS.
 *
 *   1. `exata` — só quem tem o próprio documento publicado, nunca o da outra
 *      coorte e nunca curso sem calendário nenhum.
 *   2. grade cadastrada — sem disciplina o aparelho não tem o que mostrar no
 *      card do dia, em Horários nem em Notas.
 *   3. um por calendário — cinco alunos do mesmo PDF presencial seriam cinco
 *      vezes o mesmo teste; a variedade que interessa é a de documento.
 *   4. oferta viva, pela regra acima.
 *
 * Exportada porque é uma regra de dado com um teste próprio, e não um detalhe
 * de renderização.
 */
export function baseExamples(students: Student[], limit = 5): Student[] {
  const seen = new Set<string>();
  const out: Student[] = [];
  for (const student of students) {
    if (student.academic.disciplines.length === 0) continue;
    if (OFERTA_ENCERRADA.test(student.course)) continue;
    const { calendar, match } = resolveCalendar(student, CALENDARS, CALENDAR_ENTRIES);
    if (match !== 'exata' || !calendar || seen.has(calendar.id)) continue;
    seen.add(calendar.id);
    out.push(student);
    if (out.length === limit) break;
  }
  return out;
}

/** Um perfil de demonstração abre na tela que ele existe para demonstrar. */
function screenFor(ra: string | null | undefined): PhoneScreen {
  return !ra || previewByRa(ra) ? 'modalidade' : 'inicio';
}

export function TrilhaView({
  actions,
  raParam,
}: {
  actions: ShellActions;
  /** RA na URL, para mandar a trilha de um aluno por link. */
  raParam?: string | null;
}) {
  const { students, toast } = useApp();

  const [tab, setTab] = useState<Tab>('trilha');
  const [query, setQuery] = useState(raParam && !previewByRa(raParam) ? raParam : '');
  const [ra, setRa] = useState<string | null>(raParam ?? DEFAULT_PREVIEW.ra);
  const [screen, setScreen] = useState<PhoneScreen>(screenFor(raParam));
  const [bandChoice, setBandChoice] = useState<'real' | TrilhaBand>('real');
  const [config, setConfig] = useState<TrilhaConfig>(DEFAULT_TRILHA_CONFIG);

  const today = todayIso();
  const dirty = JSON.stringify(config) !== JSON.stringify(DEFAULT_TRILHA_CONFIG);

  /* O hash é a verdade sobre qual aluno está aberto, e não o estado local:
     sem isto, o Voltar do navegador mudava a URL e a tela ficava onde estava.

     A guarda de primeira montagem existe porque `null` na URL passou a ter
     DOIS significados: «acabei de abrir a aba», que merece o perfil padrão, e
     «pedi para trocar de aluno», que precisa mesmo esvaziar a tela. Sem ela, o
     Trocar de aluno reabria o perfil de Fonoaudiologia no mesmo quadro. */
  const mounted = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setRa(raParam ?? null);
    setQuery(raParam && !previewByRa(raParam) ? raParam : '');
    setScreen(screenFor(raParam));
    setBandChoice('real');
    if (raParam) setTab('trilha');
  }, [raParam]);

  /* -- Busca ------------------------------------------------------------- */
  const matches = useMemo(() => {
    const q = searchKey(query);
    if (!q) return [];
    return students
      .filter((s) => searchKey(s.ra).includes(q) || searchKey(s.name).includes(q))
      .slice(0, 6);
  }, [students, query]);

  const preview = previewByRa(ra);

  const student = useMemo(
    () => preview?.student ?? (ra ? students.find((s) => s.ra === ra) : undefined),
    [students, ra, preview],
  );

  /* -- Atalhos de exemplo, pela regra declarada em `baseExamples`. -------- */
  const examples = useMemo(() => baseExamples(students), [students]);

  const model = useMemo(
    () =>
      student
        ? buildTrilha(
            student,
            CALENDARS,
            CALENDAR_ENTRIES,
            config,
            today,
            bandChoice === 'real' ? undefined : bandChoice,
          )
        : undefined,
    [student, config, today, bandChoice],
  );

  const phoneModel = model && preview ? { ...model, delta: { ...model.delta, simulated: true } } : model;

  const open = (value: string) => {
    setRa(value);
    setQuery(previewByRa(value) ? '' : value);
    setScreen(screenFor(value));
    setBandChoice('real');
    actions.goto('trilha', value);
  };

  /** Devolve a tela ao estado de busca, que é a saída que faltava.
      O cursor vai junto: quem pediu para trocar de aluno quer digitar um RA, e
      obrigar a um segundo clique no campo é a metade do gesto que faltava. */
  const clear = () => {
    setRa(null);
    setQuery('');
    setScreen('modalidade');
    setBandChoice('real');
    actions.goto('trilha', null);
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6"
    >
      <div className="print-hide space-y-6">
        <PageHeader
          eyebrow={
            <>
              <Compass className="h-3.5 w-3.5" />
              Trilha de entrada e calendário pessoal · {SEMESTER}
            </>
          }
          title="Trilha do Aluno"
          description="Busque um aluno para ver exatamente o que aparece no aplicativo e quais datas do calendário se aplicam a ele."
        />

        <Tabs layoutId="trilha-tabs" tabs={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === 'configuracao' ? (
        <div className="print-hide">
          <TrilhaConfigPanel
            config={config}
            onChange={setConfig}
            onReset={() => {
              setConfig(DEFAULT_TRILHA_CONFIG);
              toast('info', 'Configuração restaurada', 'A trilha voltou ao padrão institucional.');
            }}
            dirty={dirty}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ---- Os cinco atalhos e o campo. Nada mais. ---------------- */}
          <Card className="print-hide" padded={false}>
            <div className="space-y-4 p-4">
              <div className="space-y-2">
                <SectionLabel
                  action={<span className="text-[11px] text-ink-4">Calendário oficial · grade ilustrativa</span>}
                >
                  Perfis de demonstração
                </SectionLabel>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {TRILHA_PREVIEWS.map((item) => {
                    const active = ra === item.ra;
                    return (
                      <button
                        key={item.ra}
                        type="button"
                        aria-pressed={active}
                        onClick={() => open(item.ra)}
                        className={[
                          'rounded-lg border px-3 py-2 text-left transition-colors',
                          active
                            ? 'border-brand bg-brand-soft'
                            : 'border-hairline bg-surface-2 hover:border-brand-border hover:bg-surface-hover',
                        ].join(' ')}
                      >
                        <span
                          className={`block truncate text-[12px] font-semibold ${active ? 'text-brand-text' : 'text-ink'}`}
                        >
                          {item.chip}
                        </span>
                        <span className="mt-0.5 block truncate text-[10.5px] text-ink-3">
                          {item.student.modality} · {item.student.shift}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
                <div className="min-w-[15rem] max-w-md flex-1">
                  <SearchInput
                    value={query}
                    onValueChange={setQuery}
                    placeholder="RA ou nome do aluno"
                    inputRef={searchRef}
                  />
                </div>
                {student && (
                  <Button variant="ghost" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={clear}>
                    Trocar de aluno
                  </Button>
                )}
              </div>

              {query && matches.length > 0 && ra !== query && (
                <div className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
                  {matches.map((s) => {
                    const match = resolveCalendar(s, CALENDARS, CALENDAR_ENTRIES).match;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => open(s.ra)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
                      >
                        <Avatar initials={s.initials} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-ink">
                            {s.name}
                          </span>
                          <span className="block truncate text-[11px] text-ink-3">
                            {s.ra} · {s.course}
                          </span>
                        </span>
                        {match === 'nenhuma' && (
                          <Pill tone="warn">sem calendário</Pill>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {query && matches.length === 0 && (
                <p className="text-[12px] text-ink-3">
                  Nenhum aluno com esse RA ou nome na base.
                </p>
              )}

              {!student && examples.length > 0 && (
                <div className="space-y-2">
                  <SectionLabel
                    action={<span className="text-[11px] text-ink-4">Um por calendário publicado</span>}
                  >
                    Exemplos da base
                  </SectionLabel>
                  <div className="flex flex-wrap gap-2">
                    {examples.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => open(s.ra)}
                        className="rounded-full border border-hairline bg-surface-2 px-3 py-1.5 text-[11px] font-medium text-ink-2 transition-colors hover:border-brand-border hover:text-brand-text"
                      >
                        {s.name.split(' ')[0]} · {s.ra}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {!model || !student ? (
            <div className="print-hide">
              <EmptyState
                icon={<UserSearch className="h-5 w-5" />}
                title="Informe um RA para montar a trilha"
                message="A tela devolve a trilha de entrada e a linha do tempo pessoal daquele aluno, com o calendário do curso dele resolvido e citado. Os cinco perfis acima abrem sem busca."
              />
            </div>
          ) : (
            <>
              {/* ---- Cabeçalho resolvido ----------------------------- */}
              <Card className="print-hide" padded={false}>
                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Avatar initials={student.initials} size="lg" />
                      <div className="min-w-0">
                        <h2 className="text-[15px] font-semibold text-ink">{preview ? preview.label : student.name}</h2>
                        <p className="mt-0.5 text-[12px] text-ink-3">
                          {preview ? `Perfil de demonstração · ${preview.note}` : `RA ${student.ra} · ${student.course}`}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <ModalityBadge modality={student.modality} />
                          <CohortBadge
                            cohort={student.cohort}
                            days={student.journey.daysSinceEnrollment}
                          />
                          <Pill dot={false}>{student.shift}</Pill>
                          <Pill dot={false}>{student.period}º período</Pill>
                          <Pill dot={false} tone={student.turma ? 'neutral' : 'warn'}>
                            {student.turma ? `Turma ${student.turma}` : 'Turma não informada'}
                          </Pill>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        icon={<Link2 className="h-3.5 w-3.5" />}
                        onClick={() => {
                          const url = `${window.location.origin}${window.location.pathname}#/trilha/${student.ra}`;
                          void navigator.clipboard?.writeText(url);
                          toast('success', 'Link copiado', preview ? `O perfil de ${preview.chip} abre direto neste endereço.` : `A trilha de ${student.name.split(' ')[0]} abre direto neste endereço.`);
                        }}
                      >
                        Copiar link
                      </Button>
                      <Button
                        variant="ghost"
                        icon={<Printer className="h-3.5 w-3.5" />}
                        onClick={() => window.print()}
                      >
                        Imprimir a folha
                      </Button>
                      <Button
                        variant="ghost"
                        icon={<ExternalLink className="h-3.5 w-3.5" />}
                        disabled={Boolean(preview)}
                        onClick={() => actions.openStudent(student.id)}
                      >
                        Dossiê 360°
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
                    {model.resolution.calendar ? (
                      <p className="min-w-0 text-[12px] text-ink-3"><span className="font-medium text-ink">Calendário:</span> {model.resolution.calendar.shortName} · {model.totalCount} datas</p>
                    ) : (
                      <p className="flex items-center gap-1.5 text-[12px] text-crit-ink"><TriangleAlert className="h-3.5 w-3.5" />{model.resolution.note}</p>
                    )}
                    {model.resolution.calendar && <a href={model.resolution.calendar.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-text hover:underline"><FileText className="h-3 w-3" />PDF oficial</a>}
                  </div>

                  <details className="border-t border-hairline pt-3">
                    <summary className="cursor-pointer text-[11px] font-medium text-brand-text">Simular outro momento de matrícula</summary>
                    <div className="mt-3"><Segmented layoutId="trilha-band" options={BAND_OPTIONS} value={bandChoice} onChange={setBandChoice} /></div>
                    {model.delta.simulated && <button type="button" onClick={() => setBandChoice('real')} className="mt-2 flex items-center gap-1 text-[11px] font-medium text-brand-text"><RotateCcw className="h-3 w-3" />Voltar à situação real</button>}
                  </details>
                </div>
              </Card>

              {/* ---- O aparelho e a auditoria ---------------------- */}
              <div className="print-hide grid gap-6 xl:grid-cols-[auto_minmax(0,1fr)]">
                <div>
                  <Segmented layoutId="trilha-screen" options={SCREEN_OPTIONS} value={screen} onChange={setScreen} />
                  <IPhone
                    label={`Aplicativo Grupo Anchieta — trilha de ${preview ? preview.label : student.name}`}
                    glow={model.totalCount === 0 ? 20 : 62}
                    glowTone="var(--brand-3)"
                  >
                    <AnchietaPhoneApp model={phoneModel!} screen={screen} onScreen={setScreen} />
                  </IPhone>
                </div>

                <TrilhaAudit model={model} />
              </div>

              <div className="trilha-print-source"><TrilhaSheet model={model} /></div>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}
