import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  BellOff,
  BellRing,
  ChevronRight,
  ExternalLink,
  FileText,
  Search,
  Users2,
  X,
} from 'lucide-react';
import type { AcademicCalendar, CalendarEntry, CalendarEvent, PushRule } from '../../types';
import { entriesOfCalendar, SOURCE_PAGES } from '../../data/academicCalendars';
import { searchKey } from '../../lib/format';
import { shortDay, todayIso } from '../../lib/calendarDates';
import { audienceLabel, nextRule, stampOf } from '../../lib/push';
import type { PushStore } from '../../lib/pushStore';
import { pageVariants, staggerContainer, staggerItem } from '../../lib/motion';
import { Callout, Card, EmptyState, SectionLabel } from '../ui/Surfaces';
import { Button } from '../ui/Button';
import { Chip, SearchInput, Segmented } from '../ui/Fields';
import { Pill } from '../ui/Badges';
import { EventEditor, RuleEditor } from './PushEditors';
import {
  BrandBand,
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
   Calendários
   --------------------------------------------------------------------------
   O site não publica nove calendários; publica trinta e três linhas, uma por
   curso e público, e várias apontam para o mesmo PDF. Esta tela é a mesma
   lista, na mesma ordem, com os mesmos nomes.

   Poderia ser mais curta agrupando por arquivo. Seria mais curta e errada: a
   coordenação não procura "o quinzenal de veteranos", procura "Fonoaudiologia
   veterano". Uma lista que obriga a saber de antemão qual PDF cobre o seu curso
   é uma lista que só serve para quem já sabe a resposta.

   Por isso a busca é o primeiro controle da tela: digita-se o nome do curso e
   sobra o que interessa.
   ========================================================================== */

type GroupFilter = 'todos' | 'presencial' | 'hibrido' | 'ead';
type AudienceFilter = 'Todos' | 'Ingressante' | 'Veterano';

const GROUP_OPTIONS: { value: GroupFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'presencial', label: 'Presencial' },
  { value: 'hibrido', label: 'Híbridos' },
  { value: 'ead', label: 'EAD' },
];

export function CalendarBrowser({
  store,
  openId,
  onOpen,
}: {
  store: PushStore;
  openId: string | null;
  onOpen: (entryId: string | null) => void;
}) {
  const entry = openId ? store.entries.find((e) => e.id === openId) : undefined;
  const calendar = entry ? store.calendars.find((c) => c.id === entry.calendarId) : undefined;

  if (entry && calendar) {
    return (
      <EntryDetail entry={entry} calendar={calendar} store={store} onBack={() => onOpen(null)} />
    );
  }
  return <EntryList store={store} onOpen={onOpen} />;
}

/* -- Lista ---------------------------------------------------------------- */

function EntryList({ store, onOpen }: { store: PushStore; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<GroupFilter>('todos');
  const [audience, setAudience] = useState<AudienceFilter>('Todos');
  const today = todayIso();

  const filtered = useMemo(() => {
    const q = searchKey(query);
    return store.entries.filter((e) => {
      if (group !== 'todos' && e.group !== group) return false;
      if (audience !== 'Todos' && e.audience !== 'Ambos' && e.audience !== audience) return false;
      if (!q) return true;
      const calendar = store.calendars.find((c) => c.id === e.calendarId);
      return (
        searchKey(e.course).includes(q) ||
        searchKey(e.groupLabel).includes(q) ||
        searchKey(calendar?.shortName ?? '').includes(q)
      );
    });
  }, [store.entries, store.calendars, query, group, audience]);

  /* Agrupado pelo rótulo do site, na ordem em que o site apresenta. */
  const sections = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    filtered.forEach((e) => {
      const bucket = map.get(e.groupLabel);
      if (bucket) bucket.push(e);
      else map.set(e.groupLabel, [e]);
    });
    return [...map.entries()];
  }, [filtered]);

  const pending = useMemo(
    () =>
      Object.values(store.rulesByCalendar)
        .flat()
        .filter((r) => r.enabled && r.sendDate >= today).length,
    [store.rulesByCalendar, today],
  );

  const active = query !== '' || group !== 'todos' || audience !== 'Todos';

  return (
    <div className="space-y-4">
      <BrandBand
        value={store.entries.length}
        unit="combinações"
        headline="de curso e público publicadas pela instituição para 2026/2"
        stats={[
          { label: 'calendários distintos', value: store.calendars.length },
          { label: 'linhas transcritas', value: store.calendars.reduce((s, c) => s + c.events.length, 0) },
          { label: 'avisos por disparar', value: pending },
        ]}
        action={{
          label: 'Ver no site da instituição',
          href: SOURCE_PAGES.hibridos,
        }}
      />

      {/* Busca primeiro: é o controle que a tela existe para oferecer. */}
      <Card padded={false} className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder="Digite o nome do curso: Fonoaudiologia, Direito, Nutrição…"
            className="lg:max-w-md lg:flex-1"
          />
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <Segmented
              layoutId="push-cal-grupo"
              value={group}
              onChange={setGroup}
              options={GROUP_OPTIONS.map((o) => ({
                ...o,
                count:
                  o.value === 'todos'
                    ? store.entries.length
                    : store.entries.filter((e) => e.group === o.value).length,
              }))}
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
            {active && (
              <Button
                variant="ghost"
                size="xs"
                icon={<X className="h-3.5 w-3.5" />}
                onClick={() => {
                  setQuery('');
                  setGroup('todos');
                  setAudience('Todos');
                }}
              >
                Limpar
              </Button>
            )}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search className="h-5 w-5" />}
            title="Nenhum curso com esse nome"
            message="A busca cobre o nome do curso como o site escreve. Tente só a primeira palavra."
          />
        </Card>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-4"
        >
          {sections.map(([label, items]) => (
            <Card key={label} padded={false}>
              <div className="px-5 pt-4">
                <SectionLabel
                  action={
                    <span className="font-mono text-[11px] text-ink-4">{items.length}</span>
                  }
                >
                  {label}
                </SectionLabel>
              </div>
              <div className="divide-y divide-hairline">
                {items.map((entry) => (
                  <motion.div key={entry.id} variants={staggerItem}>
                    <EntryRow entry={entry} store={store} today={today} onOpen={onOpen} />
                  </motion.div>
                ))}
              </div>
            </Card>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function EntryRow({
  entry,
  store,
  today,
  onOpen,
}: {
  entry: CalendarEntry;
  store: PushStore;
  today: string;
  onOpen: (id: string) => void;
}) {
  const calendar = store.calendars.find((c) => c.id === entry.calendarId);
  const rules = store.rulesByCalendar[entry.calendarId] ?? [];
  const enabled = rules.filter((r) => r.enabled);
  const pending = enabled.filter((r) => r.sendDate >= today).length;
  const divergences = calendar?.events.filter((e) => e.note).length ?? 0;
  const next = nextRule(rules);

  return (
    <button
      onClick={() => onOpen(entry.id)}
      className="group flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-hover"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-semibold text-ink">{entry.course}</span>
          <Pill dot={false}>{audienceLabel(entry.audience)}</Pill>
          {divergences > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warn-ink">
              <AlertTriangle className="h-3 w-3" />
              {divergences}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11.5px] text-ink-3">{calendar?.name}</p>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <span className="block font-mono text-[15px] leading-none font-medium text-ink">
          {enabled.length}
        </span>
        <span className="mt-1 block text-[10.5px] text-ink-4">avisos</span>
      </div>

      <div className="hidden w-36 shrink-0 md:block">
        {next ? (
          <>
            <span className="block font-mono text-[15px] leading-none font-medium text-brand-text">
              {pending}
            </span>
            <span className="mt-1 block text-[10.5px] text-ink-3">
              por disparar, o próximo em {shortDay(next.sendDate)}
            </span>
          </>
        ) : (
          <span className="block text-[10.5px] text-ink-4">régua concluída</span>
        )}
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-ink-4 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

/* -- Detalhe -------------------------------------------------------------- */

type DetailTab = 'calendario' | 'regua';

function EntryDetail({
  entry,
  calendar,
  store,
  onBack,
}: {
  entry: CalendarEntry;
  calendar: AcademicCalendar;
  store: PushStore;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>('calendario');
  const rules = store.rulesByCalendar[calendar.id] ?? [];
  const upcoming = nextRule(rules);
  const shared = entriesOfCalendar(calendar.id).filter((e) => e.id !== entry.id);

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-4">
      <div>
        <Button
          variant="ghost"
          size="xs"
          icon={<ArrowLeft className="h-3.5 w-3.5" />}
          onClick={onBack}
        >
          Todos os calendários
        </Button>
      </div>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <Pill dot={false}>{entry.groupLabel}</Pill>
              <Pill dot={false}>{audienceLabel(entry.audience)}</Pill>
              <Pill dot={false}>{calendar.modality}</Pill>
              <Pill dot={false}>{calendar.semester}</Pill>
            </div>
            <h2 className="text-[20px] leading-tight font-semibold text-ink">{entry.course}</h2>
            <p className="mt-1 text-[12.5px] text-ink-2">{calendar.name}</p>
            <a
              href={calendar.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-brand-text transition-colors hover:text-brand-2"
            >
              <FileText className="h-3 w-3" />
              {calendar.source}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <Segmented
            layoutId="push-cal-detalhe"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'calendario', label: 'Calendário', count: calendar.events.length },
              {
                value: 'regua',
                label: 'Régua de PUSH',
                count: rules.filter((r) => r.enabled).length,
              },
            ]}
          />
        </div>

        {shared.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-hairline pt-3 text-[11.5px] text-ink-3">
            <Users2 className="h-3.5 w-3.5 shrink-0 text-ink-4" />
            <span>Este mesmo PDF vale também para</span>
            {shared.map((e) => (
              <span key={e.id} className="rounded-sm bg-surface-2 px-1.5 py-0.5 text-ink-2">
                {e.course} · {audienceLabel(e.audience).toLowerCase()}
              </span>
            ))}
          </div>
        )}

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
     meses, senão o marcador apareceria uma vez por mês futuro. */
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
                {skipped} linha{skipped > 1 ? 's' : ''} do calendário{' '}
                {skipped > 1 ? 'ficaram' : 'ficou'} de fora por ser assunto de monitor ou de
                secretaria. Mude a relevância na aba Calendário para incluir.
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
                            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
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
