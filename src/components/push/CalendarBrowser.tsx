import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  BellOff,
  BellRing,
  CalendarRange,
  ChevronRight,
  FileText,
  GraduationCap,
  Repeat,
} from 'lucide-react';
import type { AcademicCalendar, CalendarEvent, Modality, PushRule } from '../../types';
import { COURSES } from '../../data/catalog';
import { SOURCE_ALIASES } from '../../data/academicCalendars';
import { shortDay, todayIso } from '../../lib/calendarDates';
import { audienceLabel, nextRule, stampOf } from '../../lib/push';
import type { PushStore } from '../../lib/pushStore';
import { pageVariants, staggerContainer, staggerItem } from '../../lib/motion';
import { Callout, Card, EmptyState, SectionLabel } from '../ui/Surfaces';
import { Button } from '../ui/Button';
import { Chip, Segmented } from '../ui/Fields';
import { Pill } from '../ui/Badges';
import { EventEditor, RuleEditor } from './PushEditors';
import {
  CategoryTag,
  EditedMark,
  NextUpBanner,
  NextUpTag,
  NotificationPreview,
  PencilButton,
  RelevanceTag,
  TodayMarker,
  groupByMonth,
  monthLabel,
} from './PushBits';

/* ==========================================================================
   Calendários e réguas
   --------------------------------------------------------------------------
   Duas telas, uma dentro da outra. A lista responde "quais calendários existem
   e quem recebe cada um"; o detalhe responde "o que está escrito nele e o que
   sai no celular por causa disso".

   O detalhe tem três vistas porque são três trabalhos diferentes, feitos por
   pessoas diferentes em momentos diferentes do semestre:

     Calendário — conferir contra o PDF, uma vez, no começo.
     Régua      — escrever e revisar os avisos, ao longo do semestre.
     Cursos     — dizer quem é a turma deste calendário, quando o catálogo muda.

   Juntar as três numa página só era a versão "aba lotada": três alturas de
   rolagem para achar a linha que se quer corrigir.
   ========================================================================== */

type ModalityFilter = 'Todas' | Modality;
type AudienceFilter = 'Todos' | 'Ingressante' | 'Veterano';

export function CalendarBrowser({
  store,
  openId,
  onOpen,
}: {
  store: PushStore;
  openId: string | null;
  onOpen: (calendarId: string | null) => void;
}) {
  const calendar = openId ? store.calendars.find((c) => c.id === openId) : undefined;

  if (calendar) {
    return <CalendarDetail calendar={calendar} store={store} onBack={() => onOpen(null)} />;
  }
  return <CalendarList store={store} onOpen={onOpen} />;
}

/* -- Lista ---------------------------------------------------------------- */

function CalendarList({
  store,
  onOpen,
}: {
  store: PushStore;
  onOpen: (id: string) => void;
}) {
  const [modality, setModality] = useState<ModalityFilter>('Todas');
  const [audience, setAudience] = useState<AudienceFilter>('Todos');
  const today = todayIso();

  const filtered = store.calendars.filter((c) => {
    if (modality !== 'Todas' && c.modality !== modality) return false;
    if (audience !== 'Todos' && c.audience !== 'Ambos' && c.audience !== audience) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <Card padded={false} className="flex flex-wrap items-center gap-2 p-4">
        <Segmented
          layoutId="push-cal-modalidade"
          value={modality}
          onChange={setModality}
          options={[
            { value: 'Todas', label: 'Todas', count: store.calendars.length },
            {
              value: 'Presencial',
              label: 'Presencial',
              count: store.calendars.filter((c) => c.modality === 'Presencial').length,
            },
            {
              value: 'Híbrido',
              label: 'Híbrido',
              count: store.calendars.filter((c) => c.modality === 'Híbrido').length,
            },
          ]}
        />
        <Segmented
          layoutId="push-cal-publico"
          value={audience}
          onChange={setAudience}
          options={[
            { value: 'Todos', label: 'Todo público' },
            { value: 'Ingressante', label: 'Ingressante 2026' },
            { value: 'Veterano', label: 'Veterano' },
          ]}
        />
        <span className="ml-auto font-mono text-[11px] text-ink-4">
          {filtered.length} calendários · 2026/2
        </span>
      </Card>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid gap-3 lg:grid-cols-2"
      >
        {filtered.map((calendar) => {
          const rules = store.rulesByCalendar[calendar.id] ?? [];
          const active = rules.filter((r) => r.enabled);
          const pending = active.filter((r) => r.sendDate >= today).length;
          const divergences = calendar.events.filter((e) => e.note).length;
          return (
            <motion.button
              key={calendar.id}
              variants={staggerItem}
              onClick={() => onOpen(calendar.id)}
              className="group flex flex-col rounded-xl bg-surface p-5 text-left transition-colors hover:bg-surface-hover"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <Pill dot={false}>{calendar.modality}</Pill>
                    <Pill dot={false}>{audienceLabel(calendar.audience)}</Pill>
                    <Pill dot={false}>{calendar.rhythm}</Pill>
                  </div>
                  <h3 className="text-[14px] leading-snug font-semibold text-ink">
                    {calendar.name}
                  </h3>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-4 transition-transform group-hover:translate-x-0.5" />
              </div>

              <div className="mt-4 flex items-center gap-6">
                <Stat value={calendar.events.length} label="linhas do PDF" />
                <Stat value={active.length} label="avisos na régua" />
                {/* Azul só aqui: é o único dos três que ainda vai acontecer. */}
                <Stat value={pending} label="ainda por disparar" brand />
              </div>

              <p className="mt-3 line-clamp-2 border-t border-hairline pt-2.5 text-[11.5px] leading-relaxed text-ink-3">
                {calendar.courses.join(' · ') || 'Nenhum curso atribuído ainda.'}
              </p>

              {divergences > 0 && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-warn-ink">
                  <AlertTriangle className="h-3 w-3" />
                  {divergences} divergência{divergences > 1 ? 's' : ''} a validar no PDF
                </p>
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}

function Stat({ value, label, brand = false }: { value: number; label: string; brand?: boolean }) {
  return (
    <div className="min-w-0">
      <span
        className={[
          'block font-mono text-[18px] leading-none font-medium',
          brand ? 'text-brand-text' : 'text-ink',
        ].join(' ')}
      >
        {value}
      </span>
      <span className={`mt-1 block text-[10.5px] ${brand ? 'text-ink-3' : 'text-ink-4'}`}>
        {label}
      </span>
    </div>
  );
}

/* -- Detalhe -------------------------------------------------------------- */

type DetailTab = 'calendario' | 'regua' | 'cursos';

function CalendarDetail({
  calendar,
  store,
  onBack,
}: {
  calendar: AcademicCalendar;
  store: PushStore;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>('calendario');
  const rules = store.rulesByCalendar[calendar.id] ?? [];
  const upcoming = nextRule(rules);

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-4">
      <div>
        <Button variant="ghost" size="xs" icon={<ArrowLeft className="h-3.5 w-3.5" />} onClick={onBack}>
          Todos os calendários
        </Button>
      </div>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <Pill dot={false}>{calendar.modality}</Pill>
              <Pill dot={false}>{audienceLabel(calendar.audience)}</Pill>
              <Pill dot={false}>{calendar.rhythm}</Pill>
              <Pill dot={false}>{calendar.semester}</Pill>
            </div>
            <h2 className="text-[18px] leading-tight font-semibold text-ink">{calendar.name}</h2>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] text-ink-3">
              <FileText className="h-3 w-3" />
              {calendar.source}
              {(SOURCE_ALIASES[calendar.id]?.length ?? 0) > 1 && (
                <span className="text-ink-4">
                  · e mais {SOURCE_ALIASES[calendar.id].length - 1} cópia
                  {SOURCE_ALIASES[calendar.id].length > 2 ? 's' : ''} do mesmo arquivo
                </span>
              )}
            </p>
          </div>

          <Segmented
            layoutId="push-cal-detalhe"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'calendario', label: 'Calendário', count: calendar.events.length },
              { value: 'regua', label: 'Régua de PUSH', count: rules.filter((r) => r.enabled).length },
              { value: 'cursos', label: 'Cursos', count: calendar.courses.length },
            ]}
          />
        </div>

        {upcoming && (
          <div className="mt-4">
            <NextUpBanner
              stamp={stampOf(upcoming)}
              title={upcoming.title.replace(/#NOME#/g, 'aluno')}
              detail={upcoming.body.replace(/#NOME#/g, 'aluno')}
              onOpen={() => setTab('regua')}
            />
          </div>
        )}
      </Card>

      {tab === 'calendario' && <EventTable calendar={calendar} store={store} />}
      {tab === 'regua' && <RulerTable calendar={calendar} rules={rules} store={store} />}
      {tab === 'cursos' && <CourseAssignment calendar={calendar} store={store} />}
    </motion.div>
  );
}

/* -- Vista 1: o calendário como está no PDF ------------------------------- */

function EventTable({ calendar, store }: { calendar: AcademicCalendar; store: PushStore }) {
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const today = todayIso();
  const months = groupByMonth(calendar.events, (e) => e.start);

  /* Onde entra a régua do "hoje": antes da primeira linha que ainda não
     terminou. Calculado uma vez sobre a lista inteira, e não dentro do laço de
     meses — dentro do laço a primeira linha de cada mês futuro se acharia a
     primeira do calendário e o marcador apareceria cinco vezes. */
  const todayAnchor = calendar.events.find((e) => e.end >= today)?.id;

  return (
    <>
      <Card padded={false}>
        <div className="px-5 pt-4">
          <SectionLabel
            action={
              <span className="text-[11px] text-ink-4">
                Transcrito do PDF oficial · o lápis edita a linha
              </span>
            }
          >
            Calendário acadêmico
          </SectionLabel>
        </div>

        <div className="px-5 pb-4">
          {months.map(([key, group]) => (
            <section key={key}>
              <div className="sticky top-0 z-10 flex items-baseline gap-2 bg-surface/95 pt-4 pb-1.5 backdrop-blur">
                <h3 className="text-[12px] font-semibold text-ink-3">{monthLabel(key)}</h3>
                <span className="font-mono text-[11px] text-ink-4">{group.length}</span>
              </div>
              <div className="divide-y divide-hairline">
                {group.map((event) => {
                  const past = event.end < today;
                  const running = event.start <= today && event.end >= today;
                  return (
                    <div key={event.id}>
                      {event.id === todayAnchor && <TodayMarker label={shortDay(today)} />}
                      <div
                        className={[
                          'group relative flex items-start gap-3 py-3',
                          past ? 'opacity-55' : '',
                          running ? 'pl-3' : '',
                        ].join(' ')}
                      >
                        {/* Um trilho azul no que está acontecendo agora — o
                            mesmo azul do próximo disparo, dizendo "você está
                            aqui" nas duas telas. */}
                        {running && (
                          <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand" />
                        )}

                        <span className="w-32 shrink-0 pt-px font-mono text-[12px] leading-relaxed text-ink-2">
                          {event.dateLabel}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <p className="text-[13px] leading-snug font-medium text-ink">
                              {event.title}
                            </p>
                            {running && (
                              <span className="text-[11px] font-semibold text-brand-text">
                                em curso
                              </span>
                            )}
                            {store.editedEvents.has(event.id) && <EditedMark />}
                          </div>
                          {event.detail && (
                            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">
                              {event.detail}
                            </p>
                          )}
                          {event.note && (
                            <p className="mt-1.5 inline-flex items-start gap-1.5 text-[11px] leading-relaxed text-warn-ink">
                              <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                              {event.note}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-2.5">
                          <CategoryTag category={event.category} />
                          <span className="w-14 text-right">
                            <RelevanceTag relevance={event.relevance} />
                          </span>
                          <PencilButton
                            label="Editar linha"
                            edited={store.editedEvents.has(event.id)}
                            onClick={() => setEditing(event)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </Card>

      <EventEditor
        event={editing}
        edited={editing ? store.editedEvents.has(editing.id) : false}
        onSave={(patch) => {
          if (editing) store.editEvent(editing.id, patch);
          setEditing(null);
        }}
        onReset={() => {
          if (editing) store.resetEvent(editing.id);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
    </>
  );
}


/* -- Vista 2: a régua ----------------------------------------------------- */

function RulerTable({
  calendar,
  rules,
  store,
}: {
  calendar: AcademicCalendar;
  rules: PushRule[];
  store: PushStore;
}) {
  const [editing, setEditing] = useState<PushRule | null>(null);
  const [onlyActive, setOnlyActive] = useState(false);
  const today = todayIso();

  const visible = onlyActive ? rules.filter((r) => r.enabled) : rules;
  const months = groupByMonth(visible, (r) => r.sendDate);
  const eventTitle = (id: string) => calendar.events.find((e) => e.id === id)?.title;

  const upcoming = rules.filter((r) => r.enabled && r.sendDate >= today).length;
  const nextId = nextRule(rules)?.id;

  const skipped = useMemo(
    () => calendar.events.filter((e) => e.relevance === 'baixa').length,
    [calendar.events],
  );

  return (
    <>
      <Card padded={false}>
        <div className="px-5 pt-4">
          <SectionLabel
            action={
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-ink-4">
                  {upcoming} ainda por disparar
                </span>
                <Chip active={onlyActive} onClick={() => setOnlyActive((v) => !v)}>
                  Só ativos
                </Chip>
              </div>
            }
          >
            Régua de PUSH do semestre
          </SectionLabel>
        </div>

        <div className="px-5 pt-3">
          <Callout tone="info" icon={<BellRing className="h-3.5 w-3.5" />}>
            Um aviso por evento relevante, na hora em que ainda dá para agir. Provas e prazos
            ganham um segundo toque antecipado.
            {skipped > 0 && (
              <>
                {' '}
                {skipped} linha{skipped > 1 ? 's' : ''} do calendário {skipped > 1 ? 'ficaram' : 'ficou'}{' '}
                de fora por ser assunto de monitor ou de secretaria — mude a relevância na aba
                Calendário para incluir.
              </>
            )}
          </Callout>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            compact
            icon={<BellOff className="h-5 w-5" />}
            title="Nenhum aviso ativo"
            message="Ligue avisos na régua ou aumente a relevância das linhas do calendário."
          />
        ) : (
          <div className="px-5 pb-4">
            {months.map(([key, group]) => (
              <section key={key}>
                <div className="sticky top-0 z-10 flex items-baseline gap-2 bg-surface/95 pt-4 pb-1.5 backdrop-blur">
                  <h3 className="text-[12px] font-semibold text-ink-3">{monthLabel(key)}</h3>
                  <span className="font-mono text-[11px] text-ink-4">{group.length}</span>
                </div>
                <div className="divide-y divide-hairline">
                  {group.map((rule) => {
                    const isNext = rule.id === nextId;
                    const sent = rule.sendDate < today;
                    return (
                    <div
                      key={rule.id}
                      className={[
                        'group relative flex items-start gap-3 py-3.5',
                        sent ? 'opacity-60' : '',
                        isNext ? 'pl-3' : '',
                      ].join(' ')}
                    >
                      {/* A única linha azul da régua: a próxima a sair. */}
                      {isNext && (
                        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand" />
                      )}
                      <div className="w-32 shrink-0">
                        <span
                          className={[
                            'block font-mono text-[13px] leading-none font-medium',
                            isNext ? 'text-brand-text' : 'text-ink',
                          ].join(' ')}
                        >
                          {shortDay(rule.sendDate)}
                        </span>
                        <span
                          className={[
                            'mt-1 block font-mono text-[11px]',
                            isNext ? 'text-brand-text' : 'text-ink-3',
                          ].join(' ')}
                        >
                          {rule.sendTime}
                        </span>
                        <span className="mt-1.5 block text-[10.5px] text-ink-4">
                          {rule.offsetLabel}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          {isNext && <NextUpTag />}
                          <CategoryTag category={rule.category} />
                          {store.editedRules.has(rule.id) && <EditedMark />}
                          {sent && <span className="text-[11px] text-ink-4">já disparado</span>}
                        </div>
                        <NotificationPreview
                          title={rule.title}
                          body={rule.body}
                          muted={!rule.enabled}
                        />
                        <p className="mt-1.5 truncate text-[11px] text-ink-4">
                          Origem: {eventTitle(rule.eventId) ?? 'evento removido'}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => store.toggleRule(rule.id, !rule.enabled)}
                          title={rule.enabled ? 'Desligar aviso' : 'Ligar aviso'}
                          aria-label={rule.enabled ? 'Desligar aviso' : 'Ligar aviso'}
                          className={[
                            'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                            rule.enabled
                              ? 'text-ink-3 hover:bg-surface-3 hover:text-ink'
                              : 'text-ink-4 hover:bg-surface-3 hover:text-ink',
                          ].join(' ')}
                        >
                          {rule.enabled ? (
                            <BellRing className="h-3.5 w-3.5" />
                          ) : (
                            <BellOff className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <PencilButton
                          label="Editar aviso"
                          edited={store.editedRules.has(rule.id)}
                          onClick={() => setEditing(rule)}
                        />
                      </div>
                    </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </Card>

      <RuleEditor
        rule={editing}
        eventTitle={editing ? eventTitle(editing.eventId) : undefined}
        edited={editing ? store.editedRules.has(editing.id) : false}
        onSave={(patch) => {
          if (editing) store.editRule(editing.id, patch);
          setEditing(null);
        }}
        onReset={() => {
          if (editing) store.resetRule(editing.id);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

/* -- Vista 3: quem é a turma deste calendário ----------------------------- */

function CourseAssignment({
  calendar,
  store,
}: {
  calendar: AcademicCalendar;
  store: PushStore;
}) {
  const eligible = COURSES.filter((c) => c.modality.includes(calendar.modality));
  const selected = new Set(calendar.courses);

  const toggle = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    store.setCourses(calendar.id, [...next]);
  };

  // Cursos atribuídos que o catálogo não oferece nesta modalidade. Acontece
  // porque o calendário é a verdade da coordenação e o catálogo é a nossa —
  // e quando as duas divergem, quem manda é o calendário.
  const foreign = calendar.courses.filter((name) => !eligible.some((c) => c.name === name));

  return (
    <Card>
      <SectionLabel
        action={
          <span className="font-mono text-[11px] text-ink-4">{calendar.courses.length} marcados</span>
        }
      >
        Cursos que seguem este calendário
      </SectionLabel>

      <div className="mt-3">
        <Callout tone="warn" icon={<GraduationCap className="h-3.5 w-3.5" />} title="Confira antes de usar">
          Esta lista é a nossa leitura, não um dado publicado: o PDF diz o ritmo dos encontros
          («quinzenais às sextas e sábados») e não os cursos. É por ela que o aluno é ligado à sua
          régua — se um curso estiver no calendário errado, o aluno recebe o aviso errado.
        </Callout>
      </div>

      {foreign.length > 0 && (
        <div className="mt-3">
          <Callout tone="info" icon={<Repeat className="h-3.5 w-3.5" />}>
            {foreign.join(', ')} {foreign.length > 1 ? 'estão' : 'está'} neste calendário mas o
            catálogo não oferece {foreign.length > 1 ? 'esses cursos' : 'esse curso'} em{' '}
            {calendar.modality}.
          </Callout>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {eligible.map((course) => (
          <Chip
            key={course.name}
            active={selected.has(course.name)}
            onClick={() => toggle(course.name)}
          >
            {course.name}
          </Chip>
        ))}
        {foreign.map((name) => (
          <Chip key={name} active onClick={() => toggle(name)}>
            {name}
          </Chip>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-2.5 border-t border-hairline pt-4 text-[11.5px] text-ink-3">
        <CalendarRange className="h-3.5 w-3.5 shrink-0 text-ink-4" />
        Um aluno recebe a régua deste calendário quando o curso está marcado acima, a modalidade é{' '}
        {calendar.modality} e ele é {audienceLabel(calendar.audience).toLowerCase()}.
      </div>
    </Card>
  );
}
