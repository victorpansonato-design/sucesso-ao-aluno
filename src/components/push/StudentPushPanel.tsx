import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  BellRing,
  CalendarRange,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { Modality, PushDispatch, Student } from '../../types';
import { useApp } from '../../state/AppContext';
import { COURSE_NAMES } from '../../data/catalog';
import { searchKey } from '../../lib/format';
import { shortDay, todayIso } from '../../lib/calendarDates';
import { audienceLabel, audienceOf, calendarForStudent, entryForStudent, historyFor } from '../../lib/push';
import { Send } from 'lucide-react';
import type { PushStore } from '../../lib/pushStore';
import { staggerContainer, staggerItem } from '../../lib/motion';
import { Card, EmptyState, Row, SectionLabel } from '../ui/Surfaces';
import { Drawer } from '../ui/Overlay';
import { Button } from '../ui/Button';
import { SearchInput, Segmented, Select } from '../ui/Fields';
import { Avatar, HealthBadge, ModalityBadge } from '../ui/Badges';
import {
  BrandBand,
  CategoryTag,
  DeliveryTag,
  NextUpBanner,
  NotificationPreview,
  groupByMonth,
  monthLabel,
} from './PushBits';

/* ==========================================================================
   Alunos × PUSH
   --------------------------------------------------------------------------
   A pergunta que esta tela responde é sempre a mesma, e ela chega por
   telefone: "o aluno diz que não foi avisado — o que a gente mandou para ele?"

   Por isso o dossiê não mostra a régua do curso; mostra o que saiu para AQUELE
   celular, com o nome dele dentro e o status de entrega ao lado. Um aluno sem
   o aplicativo instalado aparece com tudo "não entregue", que é a resposta
   verdadeira e a que resolve a ligação em dez segundos.
   ========================================================================== */

type ModalityFilter = 'Todas' | Modality;
type AudienceFilter = 'Todos' | 'Ingressante' | 'Veterano';

export function StudentPushPanel({ store }: { store: PushStore }) {
  const { students } = useApp();
  const [query, setQuery] = useState('');
  const [course, setCourse] = useState<'Todos' | string>('Todos');
  const [modality, setModality] = useState<ModalityFilter>('Todas');
  const [audience, setAudience] = useState<AudienceFilter>('Todos');
  const [openId, setOpenId] = useState<string | null>(null);

  const today = todayIso();

  const filtered = useMemo(() => {
    const q = searchKey(query);
    return students
      .filter((s) => {
        if (modality !== 'Todas' && s.modality !== modality) return false;
        if (course !== 'Todos' && s.course !== course) return false;
        if (audience !== 'Todos' && audienceOf(s) !== audience) return false;
        if (!q) return true;
        return (
          searchKey(s.name).includes(q) ||
          searchKey(s.ra).includes(q) ||
          searchKey(s.course).includes(q)
        );
      })
      .sort((a, b) => a.healthScore - b.healthScore);
  }, [students, query, course, modality, audience]);

  const counts = useMemo(
    () => ({
      todas: students.length,
      Presencial: students.filter((s) => s.modality === 'Presencial').length,
      Híbrido: students.filter((s) => s.modality === 'Híbrido').length,
      ingressante: students.filter((s) => s.cohort === 'Calouro').length,
      veterano: students.filter((s) => s.cohort === 'Veterano').length,
    }),
    [students],
  );

  const open = openId ? (students.find((s) => s.id === openId) ?? null) : null;

  const active =
    query !== '' || course !== 'Todos' || modality !== 'Todas' || audience !== 'Todos';

  /* Cobertura: quantos alunos da base caem numa linha do site e recebem régua.
     É o número que diz se a Gestão de PUSH está de fato ligada na base, e o
     único desta aba que muda o que alguém faz a seguir. */
  const covered = useMemo(
    () => students.filter((s) => entryForStudent(s, store.entries)).length,
    [students, store.entries],
  );
  const noApp = useMemo(
    () => students.filter((s) => !s.engagement.appInstalled).length,
    [students],
  );

  return (
    <>
      <div className="space-y-4">
        <BrandBand
          value={covered}
          unit={`de ${students.length}`}
          headline="alunos da base já ligados a um calendário e recebendo a régua do curso"
          stats={[
            { label: 'sem calendário', value: students.length - covered },
            { label: 'sem o app instalado', value: noApp },
            { label: 'mensagens ativas', value: store.templates.filter((t) => t.active).length },
          ]}
        />

        {/* Filtros */}
        <Card padded={false} className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Nome do aluno, RA ou curso…"
              className="lg:max-w-sm lg:flex-1"
            />
            <div className="min-w-0 lg:w-72">
              <Select value={course} onChange={(e) => setCourse(e.target.value)}>
                <option value="Todos">Todos os cursos</option>
                {COURSE_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <Segmented
                layoutId="push-alunos-modalidade"
                value={modality}
                onChange={setModality}
                options={[
                  { value: 'Todas', label: 'Todas', count: counts.todas },
                  { value: 'Presencial', label: 'Presencial', count: counts.Presencial },
                  { value: 'Híbrido', label: 'Híbrido', count: counts.Híbrido },
                ]}
              />
              <Segmented
                layoutId="push-alunos-tipo"
                value={audience}
                onChange={setAudience}
                options={[
                  { value: 'Todos', label: 'Todos' },
                  { value: 'Ingressante', label: 'Ingressante 2026', count: counts.ingressante },
                  { value: 'Veterano', label: 'Veterano', count: counts.veterano },
                ]}
              />
              {active && (
                <Button
                  variant="ghost"
                  size="xs"
                  icon={<X className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setQuery('');
                    setCourse('Todos');
                    setModality('Todas');
                    setAudience('Todos');
                  }}
                >
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Lista */}
        <Card padded={false}>
          <div className="px-5 pt-4">
            <SectionLabel
              action={
                <span className="font-mono text-[11px] text-ink-4">
                  {filtered.length} de {students.length}
                </span>
              }
            >
              Alunos
            </SectionLabel>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              title="Nenhum aluno com esses filtros"
              message="Ajuste o curso, a modalidade ou o tipo de aluno para ver a base."
            />
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="divide-y divide-hairline"
            >
              {filtered.map((student) => (
                <motion.div key={student.id} variants={staggerItem}>
                  <StudentRow
                    student={student}
                    store={store}
                    today={today}
                    onOpen={() => setOpenId(student.id)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </Card>
      </div>

      <StudentPushDrawer
        student={open}
        store={store}
        today={today}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}

/* -- Uma linha da base ---------------------------------------------------- */

function StudentRow({
  student,
  store,
  today,
  onOpen,
}: {
  student: Student;
  store: PushStore;
  today: string;
  onOpen: () => void;
}) {
  const entry = entryForStudent(student, store.entries);
  const calendar = calendarForStudent(student, store.calendars, store.entries);
  const rules = calendar ? (store.rulesByCalendar[calendar.id] ?? []) : [];
  const history = useMemo(
    () => historyFor(student, calendar, rules, store.templates, today),
    [student, calendar, rules, store.templates, today],
  );
  const next = history.scheduled[0];

  return (
    <Row onClick={onOpen} className="group px-5 py-3">
      <div className="flex items-center gap-3">
        <Avatar initials={student.initials} tone={student.status} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-ink">{student.name}</span>
            <HealthBadge status={student.status} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-ink-3">
            <span className="truncate">{student.course}</span>
            <span className="text-ink-4">·</span>
            <span>{student.modality}</span>
            <span className="text-ink-4">·</span>
            <span>{student.cohort === 'Calouro' ? 'Ingressante 2026' : 'Veterano'}</span>
          </div>
        </div>

        <div className="hidden shrink-0 text-right sm:block">
          <span className="block font-mono text-[15px] leading-none font-medium text-ink">
            {student.healthScore}
          </span>
          <span className="mt-1 block text-[10.5px] text-ink-4">Health Score</span>
        </div>

        <div className="hidden shrink-0 text-right md:block">
          <span className="block font-mono text-[15px] leading-none font-medium text-ink">
            {history.sent.length}
          </span>
          <span className="mt-1 block text-[10.5px] text-ink-4">push enviados</span>
        </div>

        <div className="hidden shrink-0 md:block md:w-52">
          <span className="block truncate text-[11.5px] text-ink-2">
            {entry ? `${entry.course} · ${audienceLabel(entry.audience).toLowerCase()}` : 'sem calendário'}
          </span>
          {/* O próximo push é o que o atendente precisa saber antes de ligar:
              "espera, ele recebe um aviso amanhã de qualquer forma". */}
          {next ? (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] font-medium text-brand-text">
              <Send className="h-2.5 w-2.5" />
              próximo em {shortDay(next.sentAt.slice(0, 10))}
            </span>
          ) : (
            <span className="mt-0.5 block text-[10.5px] text-ink-4">nada agendado</span>
          )}
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-ink-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Row>
  );
}

/* -- Dossiê de PUSH do aluno ---------------------------------------------- */

function StudentPushDrawer({
  student,
  store,
  today,
  onClose,
}: {
  student: Student | null;
  store: PushStore;
  today: string;
  onClose: () => void;
}) {
  const entry = student ? entryForStudent(student, store.entries) : undefined;
  const calendar = student ? calendarForStudent(student, store.calendars, store.entries) : undefined;
  const rules = calendar ? (store.rulesByCalendar[calendar.id] ?? []) : [];
  const history = useMemo(
    () => (student ? historyFor(student, calendar, rules, store.templates, today) : null),
    [student, calendar, rules, store.templates, today],
  );

  const [tab, setTab] = useState<'historico' | 'proximos'>('historico');

  return (
    <Drawer open={Boolean(student)} onClose={onClose} width="lg" label="Push do aluno">
      {student && history && (
        <div className="flex h-full flex-col">
          {/* Cabeçalho */}
          <header className="shrink-0 border-b border-hairline p-5">
            <div className="flex items-start gap-3">
              <Avatar initials={student.initials} size="lg" tone={student.status} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-[16px] leading-tight font-semibold text-ink">
                    {student.name}
                  </h2>
                  <HealthBadge status={student.status} solid />
                </div>
                <p className="mt-1 text-[12px] text-ink-3">
                  RA {student.ra} · {student.period}º período
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="-mt-1 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-4 transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
              <Fact label="Health Score" value={String(student.healthScore)} mono />
              <Fact label="Curso" value={student.course} />
              <Fact label="Modalidade" value={<ModalityBadge modality={student.modality} />} />
              <Fact
                label="Tipo de aluno"
                value={student.cohort === 'Calouro' ? 'Ingressante 2026' : 'Veterano'}
              />
            </dl>

            <div className="mt-4 flex items-center gap-2.5 rounded-lg bg-surface-2 p-3">
              <CalendarRange className="h-4 w-4 shrink-0 text-ink-3" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-ink-4">
                  Calendário acadêmico atribuído
                  {entry ? ` · ${entry.groupLabel}` : ''}
                </p>
                <p className="truncate text-[12.5px] font-medium text-ink">
                  {entry
                    ? `${entry.course} · ${audienceLabel(entry.audience).toLowerCase()}`
                    : 'Nenhuma linha do site cobre este curso e modalidade'}
                </p>
                {calendar && (
                  <p className="truncate text-[11px] text-ink-3">{calendar.name}</p>
                )}
              </div>
              {!student.engagement.appInstalled && (
                <span className="shrink-0 text-[11px] font-semibold text-crit-ink">
                  App não instalado
                </span>
              )}
            </div>

            {history.scheduled[0] && (
              <div className="mt-2.5">
                <NextUpBanner
                  stamp={`${shortDay(history.scheduled[0].sentAt.slice(0, 10))} · ${history.scheduled[0].sentAt.slice(11, 16)}`}
                  title={history.scheduled[0].title}
                  detail={history.scheduled[0].body}
                  onOpen={() => setTab('proximos')}
                />
              </div>
            )}
          </header>

          {/* Abas */}
          <div className="shrink-0 px-5 pt-3">
            <Segmented
              full
              layoutId="push-dossie"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'historico', label: 'Histórico', count: history.sent.length },
                { value: 'proximos', label: 'Próximos', count: history.scheduled.length },
              ]}
            />
          </div>

          {/* Conteúdo */}
          <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-5 pb-5">
            {tab === 'historico' ? (
              <DispatchList
                items={history.sent}
                empty="Nenhum push saiu para este aluno ainda."
                emptyHint="Assim que a régua do calendário alcançar uma data, os avisos aparecem aqui."
              />
            ) : (
              <DispatchList
                items={history.scheduled}
                empty="Nada agendado daqui para frente."
                emptyHint="O semestre já passou de todos os avisos da régua deste calendário."
              />
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Fact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-ink-4">{label}</dt>
      <dd
        className={`mt-0.5 truncate text-[13px] font-medium text-ink ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}

function DispatchList({
  items,
  empty,
  emptyHint,
}: {
  items: PushDispatch[];
  empty: string;
  emptyHint: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        compact
        icon={<BellRing className="h-5 w-5" />}
        title={empty}
        message={emptyHint}
      />
    );
  }

  const months = groupByMonth(items, (d) => d.sentAt.slice(0, 10));

  return (
    <div className="space-y-4 pt-3">
      {months.map(([key, group]) => (
        <section key={key}>
          <div className="flex items-baseline gap-2 border-b border-hairline pb-1.5">
            <h3 className="text-[12px] font-semibold text-ink-3">{monthLabel(key)}</h3>
            <span className="font-mono text-[11px] text-ink-4">{group.length}</span>
          </div>
          <div className="mt-3 space-y-3">
            {group.map((dispatch) => (
              <article key={dispatch.id}>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-ink-3">
                    {shortDay(dispatch.sentAt.slice(0, 10))} · {dispatch.sentAt.slice(11, 16)}
                  </span>
                  <CategoryTag category={dispatch.category} />
                  {dispatch.origin === 'personalizado' && (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-3">
                      <SlidersHorizontal className="h-2.5 w-2.5" />
                      personalizado
                    </span>
                  )}
                  <span className="ml-auto">
                    <DeliveryTag status={dispatch.status} />
                  </span>
                </div>
                <NotificationPreview
                  title={dispatch.title}
                  body={dispatch.body}
                  muted={dispatch.status === 'Não entregue'}
                />
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
