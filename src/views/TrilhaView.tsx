import { useEffect, useMemo, useState } from 'react';
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
import { FONO_PREVIEW } from '../data/trilhaPreview';
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

const SCREEN_OPTIONS: SegmentedOption<PhoneScreen>[] = [
  { value: 'inicio', label: 'Início' },
  { value: 'datas', label: 'Minhas datas' },
  { value: 'trilha', label: 'Comece por aqui' },
  { value: 'completo', label: 'Calendário completo' },
];

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
  const [query, setQuery] = useState(raParam === FONO_PREVIEW.ra ? '' : raParam ?? '');
  const [ra, setRa] = useState<string | null>(raParam ?? FONO_PREVIEW.ra);
  const [screen, setScreen] = useState<PhoneScreen>(raParam ? 'inicio' : 'modalidade');
  const [bandChoice, setBandChoice] = useState<'real' | TrilhaBand>('real');
  const [config, setConfig] = useState<TrilhaConfig>(DEFAULT_TRILHA_CONFIG);

  const today = todayIso();
  const dirty = JSON.stringify(config) !== JSON.stringify(DEFAULT_TRILHA_CONFIG);

  /* O hash é a verdade sobre qual aluno está aberto, e não o estado local:
     sem isto, o Voltar do navegador mudava a URL e a tela ficava onde estava. */
  useEffect(() => {
    setRa(raParam ?? FONO_PREVIEW.ra);
    setQuery(raParam === FONO_PREVIEW.ra ? '' : raParam ?? '');
    setScreen(!raParam || raParam === FONO_PREVIEW.ra ? 'modalidade' : 'inicio');
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

  const student = useMemo(
    () => ra === FONO_PREVIEW.ra ? FONO_PREVIEW : (ra ? students.find((s) => s.ra === ra) : undefined),
    [students, ra],
  );

  const isPreview = student?.id === FONO_PREVIEW.id;

  /* -- Atalhos de exemplo ------------------------------------------------
     Derivados da base, não escritos à mão: um veterano e um calouro do curso em
     que a trilha foi conferida contra o PDF, e um aluno sem calendário
     publicado, que é o caso que mais precisa ser visto para não ser esquecido. */
  const examples = useMemo(() => {
    const pick = (fn: (s: Student) => boolean) => students.find(fn);
    const rh = (s: Student) => /Recursos Humanos/.test(s.course);
    const list = [
      pick((s) => rh(s) && s.cohort === 'Veterano'),
      pick((s) => rh(s) && s.cohort === 'Calouro'),
      pick((s) => resolveCalendar(s, CALENDARS, CALENDAR_ENTRIES).match === 'nenhuma'),
      pick((s) => s.modality === 'Presencial' && s.academic.disciplines.length > 0),
    ];
    return list.filter((s): s is Student => Boolean(s));
  }, [students]);

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

  const phoneModel = model && isPreview ? { ...model, delta: { ...model.delta, simulated: true } } : model;

  const open = (value: string) => {
    setRa(value);
    setQuery(value === FONO_PREVIEW.ra ? '' : value);
    setScreen(value === FONO_PREVIEW.ra ? 'modalidade' : 'inicio');
    setBandChoice('real');
    actions.goto('trilha', value);
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
          {/* ---- O campo. Um só. ------------------------------------- */}
          <Card className="print-hide" padded={false}>
            <div className="space-y-4 p-4">
              <button type="button" onClick={() => open(FONO_PREVIEW.ra)} className="text-[13px] font-medium text-brand-text hover:underline">
                Prévia: Fonoaudiologia · Ingressante híbrido
              </button>
              <div className="max-w-md">
                <SearchInput
                  value={query}
                  onValueChange={setQuery}
                  placeholder="RA ou nome do aluno"
                  autoFocus
                />
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
                  <SectionLabel>Exemplos da base</SectionLabel>
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
                message="A tela devolve a trilha de entrada e a linha do tempo pessoal daquele aluno, com o calendário do curso dele resolvido e citado."
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
                        <h2 className="text-[15px] font-semibold text-ink">{isPreview ? 'Fonoaudiologia · Ingressante híbrido' : student.name}</h2>
                        <p className="mt-0.5 text-[12px] text-ink-3">
                          {isPreview ? 'Perfil de demonstração · disciplinas e dispensa ilustrativas · calendário oficial' : `RA ${student.ra} · ${student.course}`}
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
                          toast('success', 'Link copiado', `A trilha de ${student.name.split(' ')[0]} abre direto neste endereço.`);
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
                        disabled={isPreview}
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
                    label={`Aplicativo Grupo Anchieta — trilha de ${student.name}`}
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
