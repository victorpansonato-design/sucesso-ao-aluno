import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type {
  AppNotification,
  Case,
  CaseStatus,
  Cohort,
  FollowUp,
  GovernanceSettings,
  Interaction,
  Modality,
  Priority,
  RadarKey,
  ScoreResult,
  Specialist,
  Student,
  Toast,
  ToastKind,
  WeightProfile,
} from '../types';
import {
  CASES,
  CURRENT_USER_ID,
  DEFAULT_SETTINGS,
  FOLLOW_UPS,
  INTERACTIONS,
  NOTIFICATIONS,
  SPECIALISTS,
  STUDENTS,
} from '../data/seed';
import { KEYS, load, pruneOldSchemas, resetAll, save } from '../lib/storage';
import { computeScore, scoreContextFor } from '../lib/healthScore';
import { CLOSING_SCORE_EFFECT, canTransition, isOpen, isTerminal } from '../lib/caseFlow';
import { RADARS, activeRadars } from '../lib/radars';
import { addBusinessHours } from '../lib/sla';
import { nowIso } from '../lib/format';

/* ==========================================================================
   Application state
   --------------------------------------------------------------------------
   One store, one set of rules. Two decisions shape everything here:

   1. Health Scores are DERIVED, never stored as authored values. The seed ships
      raw signals; the engine computes the number at boot and after every
      mutation. That is what makes "registrar interação atualiza o score em
      tempo real" true rather than a claim.

   2. Every mutation is a transaction that touches all the surfaces it should:
      registering an interaction writes the interaction, appends the timeline
      event, advances the case through the state machine, recomputes the score,
      schedules the follow-up, emits the notification and raises the toast. A
      caller never has to remember to also update something else.
   ========================================================================== */

const SUPPRESSED_RULERS = [
  'Régua de cobrança automática',
  'SMS promocional de rematrícula',
  'E-mail marketing institucional',
  'Push de atividade pendente',
];

export interface CohortFilter {
  value: 'Todos' | Cohort;
}

interface AppState {
  /* Data */
  students: Student[];
  cases: Case[];
  interactions: Interaction[];
  followUps: FollowUp[];
  specialists: Specialist[];
  notifications: AppNotification[];
  settings: GovernanceSettings;
  currentUser: Specialist;

  /* Global filters — every view reads these */
  modalityFilter: 'Todas' | Modality;
  setModalityFilter: (v: 'Todas' | Modality) => void;
  cohortFilter: 'Todos' | Cohort;
  setCohortFilter: (v: 'Todos' | Cohort) => void;
  campusFilter: string;
  setCampusFilter: (v: string) => void;
  semester: string;
  setSemester: (v: string) => void;
  resetFilters: () => void;
  filtersActive: boolean;

  /* Derived selectors */
  scopedStudents: Student[];
  scopedCases: Case[];
  getStudent: (id: string) => Student | undefined;
  getCase: (id: string) => Case | undefined;
  getSpecialist: (id: string | null) => Specialist | undefined;
  scoreOf: (studentId: string) => ScoreResult | undefined;
  interactionsOf: (studentId: string) => Interaction[];
  followUpsOf: (studentId: string) => FollowUp[];
  casesOf: (studentId: string) => Case[];
  radarsOf: (studentId: string) => RadarKey[];
  caseLoadOf: (specialistId: string) => number;

  /* Case mutations */
  claimCase: (caseId: string) => void;
  transitionCase: (caseId: string, to: CaseStatus, reason?: string) => void;
  reassignCase: (caseId: string, specialistId: string, reason: string) => void;
  closeCase: (caseId: string, to: 'Acordo Firmado' | 'Evasão Inevitável' | 'Cancelado', reason: string, note: string) => void;
  reopenCase: (caseId: string, reason: string) => void;
  setHold: (caseId: string, active: boolean) => void;
  addCaseNote: (caseId: string, text: string) => void;
  createCase: (input: {
    studentId: string;
    title: string;
    radar: RadarKey;
    priority: Priority;
    signals: string[];
    diagnosis: string;
    recommendedAction: string;
    assigneeId: string | null;
  }) => string;

  /* Student mutations */
  logInteraction: (input: Omit<Interaction, 'id' | 'at' | 'timestamp' | 'specialistId' | 'specialistName' | 'scoreDelta'>) => void;
  scheduleFollowUp: (input: { studentId: string; caseId?: string; title: string; dueDate: string; notes: string }) => void;
  completeFollowUp: (id: string) => void;
  cancelFollowUp: (id: string) => void;
  reviewAlert: (studentId: string, alertId: string, verdict: 'confirmado' | 'descartado') => void;

  /* Governance */
  updateSettings: (patch: Partial<GovernanceSettings>) => void;
  updateWeights: (modality: Modality, weights: WeightProfile) => void;
  restoreDemoBase: () => void;

  /* Notifications & toasts */
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  toasts: Toast[];
  toast: (kind: ToastKind, title: string, detail: string, action?: Toast['action']) => void;
  dismissToast: (id: string) => void;

  /* Theme */
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const Ctx = createContext<AppState | null>(null);

let idCounter = 0;
function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36)}`;
}

/**
 * Applies the score engine to a whole base. Runs at boot and whenever a
 * governance parameter changes.
 *
 * Trend is *derived*, not authored: the same engine is run a second time
 * against the student's previous-cycle values (frequência anterior, acessos do
 * ciclo anterior). The difference between the two scores is the real movement,
 * which is what makes "alunos em queda de score" an actionable number instead
 * of a decorative one.
 */
function rescoreAll(
  students: Student[],
  interactions: Interaction[],
  settings: GovernanceSettings,
): Student[] {
  return students.map((student) => {
    const cohort: Cohort =
      student.journey.daysSinceEnrollment <= settings.onboardingWindowDays ? 'Calouro' : 'Veterano';
    const withCohort = cohort === student.cohort ? student : { ...student, cohort };

    const ctx = scoreContextFor(withCohort, interactions, settings.weights);
    const result = computeScore(withCohort, ctx);

    // Reconstruct the previous cycle from the metrics we deliberately keep a
    // prior value for, then score it with the same weights.
    const previousCycle: Student = {
      ...withCohort,
      academic: {
        ...withCohort.academic,
        attendancePercent: withCohort.academic.attendancePrevPercent,
      },
      engagement: {
        ...withCohort.engagement,
        accessesLast30Days: withCohort.engagement.accessesPrev30Days,
        accessesPrev30Days: withCohort.engagement.accessesPrev30Days,
        // A month ago the student was, by definition, not yet absent this long.
        lastAccessDaysAgo: 0,
      },
    };
    const previous = computeScore(previousCycle, ctx);
    const delta = result.total - previous.total;

    return {
      ...withCohort,
      healthScore: result.total,
      status: result.status,
      trend: delta > 2 ? 'up' : delta < -2 ? 'down' : 'flat',
      scoreDelta30d: delta,
    };
  });
}

export function AppProvider({ children }: { children: ReactNode }) {
  /* -- Boot ------------------------------------------------------------- */

  const booted = useRef(false);
  if (!booted.current) {
    pruneOldSchemas();
    booted.current = true;
  }

  const [settings, setSettings] = useState<GovernanceSettings>(() =>
    load(KEYS.settings, DEFAULT_SETTINGS),
  );
  const [interactions, setInteractions] = useState<Interaction[]>(() =>
    load(KEYS.interactions, INTERACTIONS),
  );
  const [students, setStudents] = useState<Student[]>(() => {
    const stored = load<Student[] | null>(KEYS.students, null);
    const base = stored ?? STUDENTS;
    const storedInteractions = load<Interaction[] | null>(KEYS.interactions, null) ?? INTERACTIONS;
    const storedSettings = load<GovernanceSettings>(KEYS.settings, DEFAULT_SETTINGS);
    // Scores are always recomputed on load — stored numbers are never trusted.
    return rescoreAll(base, storedInteractions, storedSettings);
  });
  const [cases, setCases] = useState<Case[]>(() => load(KEYS.cases, CASES));
  const [followUps, setFollowUps] = useState<FollowUp[]>(() => load(KEYS.followUps, FOLLOW_UPS));
  const [specialists] = useState<Specialist[]>(() => load(KEYS.specialists, SPECIALISTS));
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    load(KEYS.notifications, NOTIFICATIONS),
  );

  const currentUser = useMemo(
    () => specialists.find((s) => s.id === CURRENT_USER_ID) ?? specialists[0],
    [specialists],
  );

  /* -- Persistence ------------------------------------------------------ */

  useEffect(() => save(KEYS.students, students), [students]);
  useEffect(() => save(KEYS.cases, cases), [cases]);
  useEffect(() => save(KEYS.interactions, interactions), [interactions]);
  useEffect(() => save(KEYS.followUps, followUps), [followUps]);
  useEffect(() => save(KEYS.notifications, notifications), [notifications]);
  useEffect(() => save(KEYS.settings, settings), [settings]);

  /* -- Theme ------------------------------------------------------------ */

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = load<'light' | 'dark' | null>(KEYS.theme, null);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    save(KEYS.theme, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), []);

  /* -- Toasts ----------------------------------------------------------- */

  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (kind: ToastKind, title: string, detail: string, action?: Toast['action']) => {
      const id = uid('toast');
      setToasts((prev) => [...prev.slice(-3), { id, kind, title, detail, action }]);
      const timer = window.setTimeout(() => dismissToast(id), action ? 8000 : 5200);
      timers.current.set(id, timer);
    },
    [dismissToast],
  );

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current.clear();
    },
    [],
  );

  /* -- Global filters --------------------------------------------------- */

  const [modalityFilter, setModalityFilter] = useState<'Todas' | Modality>('Todas');
  const [cohortFilter, setCohortFilter] = useState<'Todos' | Cohort>('Todos');
  const [campusFilter, setCampusFilter] = useState<string>('Todos');
  const [semester, setSemester] = useState<string>('2026/2');

  const resetFilters = useCallback(() => {
    setModalityFilter('Todas');
    setCohortFilter('Todos');
    setCampusFilter('Todos');
  }, []);

  const filtersActive =
    modalityFilter !== 'Todas' || cohortFilter !== 'Todos' || campusFilter !== 'Todos';

  const scopedStudents = useMemo(
    () =>
      students.filter((s) => {
        if (modalityFilter !== 'Todas' && s.modality !== modalityFilter) return false;
        if (cohortFilter !== 'Todos' && s.cohort !== cohortFilter) return false;
        if (campusFilter !== 'Todos' && s.campus !== campusFilter) return false;
        return true;
      }),
    [students, modalityFilter, cohortFilter, campusFilter],
  );

  const scopedIds = useMemo(() => new Set(scopedStudents.map((s) => s.id)), [scopedStudents]);
  const scopedCases = useMemo(
    () => cases.filter((c) => scopedIds.has(c.studentId)),
    [cases, scopedIds],
  );

  /* -- Selectors -------------------------------------------------------- */

  const studentIndex = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const caseIndex = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);
  const specialistIndex = useMemo(() => new Map(specialists.map((s) => [s.id, s])), [specialists]);

  const getStudent = useCallback((id: string) => studentIndex.get(id), [studentIndex]);
  const getCase = useCallback((id: string) => caseIndex.get(id), [caseIndex]);
  const getSpecialist = useCallback(
    (id: string | null) => (id ? specialistIndex.get(id) : undefined),
    [specialistIndex],
  );

  const scoreOf = useCallback(
    (studentId: string) => {
      const student = studentIndex.get(studentId);
      if (!student) return undefined;
      return computeScore(student, scoreContextFor(student, interactions, settings.weights));
    },
    [studentIndex, interactions, settings.weights],
  );

  const interactionsOf = useCallback(
    (studentId: string) =>
      interactions.filter((i) => i.studentId === studentId).sort((a, b) => b.timestamp - a.timestamp),
    [interactions],
  );

  const followUpsOf = useCallback(
    (studentId: string) =>
      followUps
        .filter((f) => f.studentId === studentId)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [followUps],
  );

  const casesOf = useCallback(
    (studentId: string) =>
      cases
        .filter((c) => c.studentId === studentId)
        .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()),
    [cases],
  );

  const radarsOf = useCallback(
    (studentId: string) => {
      const student = studentIndex.get(studentId);
      if (!student) return [];
      return activeRadars(student, { segregateOnboarding: settings.segregateOnboarding });
    },
    [studentIndex, settings.segregateOnboarding],
  );

  const caseLoadOf = useCallback(
    (specialistId: string) =>
      cases.filter((c) => c.assigneeId === specialistId && isOpen(c.status)).length,
    [cases],
  );

  /* -- Internal helpers ------------------------------------------------- */

  const pushNotification = useCallback((n: Omit<AppNotification, 'id' | 'at' | 'read'>) => {
    setNotifications((prev) => [{ id: uid('ntf'), at: nowIso(), read: false, ...n }, ...prev].slice(0, 40));
  }, []);

  const appendTimeline = useCallback(
    (studentId: string, event: Omit<Student['timeline'][number], 'id'>) => {
      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId ? { ...s, timeline: [{ id: uid('evt'), ...event }, ...s.timeline] } : s,
        ),
      );
    },
    [],
  );

  const recordHistory = useCallback(
    (kase: Case, to: CaseStatus, by: string): Case['history'] => [
      ...kase.history,
      { id: uid('h'), from: kase.status, to, at: nowIso(), by },
    ],
    [],
  );

  /**
   * Rescores one student against the current interaction log. Used after any
   * mutation that could move the number, plus an optional bonus for a closed
   * agreement (which reflects the intervention itself, not the raw signals).
   */
  const rescoreStudent = useCallback(
    (studentId: string, bonus = 0, nextInteractions?: Interaction[]) => {
      const log = nextInteractions ?? interactions;
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== studentId) return s;
          const result = computeScore(s, scoreContextFor(s, log, settings.weights));
          const total = Math.min(100, result.total + bonus);
          const delta = total - s.healthScore;
          return {
            ...s,
            healthScore: total,
            status: result.status,
            trend: delta > 1 ? 'up' : delta < -1 ? 'down' : 'flat',
            scoreDelta30d: s.scoreDelta30d + delta,
          };
        }),
      );
    },
    [interactions, settings.weights],
  );

  /* -- Case mutations --------------------------------------------------- */

  const claimCase = useCallback(
    (caseId: string) => {
      const kase = caseIndex.get(caseId);
      if (!kase) return;
      const student = studentIndex.get(kase.studentId);
      const alreadyMine = kase.assigneeId === currentUser.id;
      const willContact = kase.status === 'Pendente';

      setCases((prev) =>
        prev.map((c) => {
          if (c.id !== caseId) return c;
          const to: CaseStatus = willContact ? 'Em Contato' : c.status;
          return {
            ...c,
            assigneeId: currentUser.id,
            status: to,
            firstContactAt: c.firstContactAt ?? nowIso(),
            history: willContact ? recordHistory(c, to, currentUser.name) : c.history,
            // Humano-Primeiro: taking a case suspends the competing rulers.
            hold:
              settings.humanFirst && !c.hold.active
                ? {
                    active: true,
                    activatedBy: `${currentUser.name} (regra Humano-Primeiro)`,
                    activatedAt: nowIso(),
                    suppressed: SUPPRESSED_RULERS,
                    blockedCount: c.hold.blockedCount,
                  }
                : c.hold,
          };
        }),
      );

      appendTimeline(kase.studentId, {
        at: nowIso(),
        kind: 'intervencao',
        title: `Caso ${kase.protocol} assumido por ${currentUser.name}`,
        detail: settings.humanFirst
          ? 'Especialista assumiu a responsabilidade e o Freio Concorrente foi ativado automaticamente.'
          : 'Especialista assumiu a responsabilidade pelo caso.',
        author: 'Especialista',
        tag: 'Atendimento',
      });

      toast(
        'success',
        alreadyMine ? 'Caso iniciado' : 'Caso assumido',
        `${kase.protocol} · ${student?.name ?? 'aluno'}. ${
          settings.humanFirst ? 'Freio Concorrente ativado.' : 'Registre o contato ao final da tratativa.'
        }`,
      );
    },
    [caseIndex, studentIndex, currentUser, settings.humanFirst, appendTimeline, recordHistory, toast],
  );

  const transitionCase = useCallback(
    (caseId: string, to: CaseStatus, reason?: string) => {
      const kase = caseIndex.get(caseId);
      if (!kase) return;
      if (!canTransition(kase.status, to)) {
        toast('warning', 'Transição não permitida', `Um caso em "${kase.status}" não pode ir para "${to}".`);
        return;
      }

      setCases((prev) =>
        prev.map((c) =>
          c.id === caseId
            ? {
                ...c,
                status: to,
                history: recordHistory(c, to, currentUser.name),
                firstContactAt: to === 'Em Contato' ? (c.firstContactAt ?? nowIso()) : c.firstContactAt,
                notes: reason
                  ? [...c.notes, { id: uid('n'), author: currentUser.name, text: reason, at: nowIso() }]
                  : c.notes,
              }
            : c,
        ),
      );

      appendTimeline(kase.studentId, {
        at: nowIso(),
        kind: 'intervencao',
        title: `Caso ${kase.protocol}: ${kase.status} → ${to}`,
        detail: reason ?? `Status atualizado por ${currentUser.name}.`,
        author: 'Especialista',
        tag: 'Fluxo',
      });

      toast('info', 'Status atualizado', `${kase.protocol} agora está em "${to}".`);
    },
    [caseIndex, currentUser.name, appendTimeline, recordHistory, toast],
  );

  const reassignCase = useCallback(
    (caseId: string, specialistId: string, reason: string) => {
      const kase = caseIndex.get(caseId);
      const target = specialistIndex.get(specialistId);
      if (!kase || !target) return;

      setCases((prev) =>
        prev.map((c) =>
          c.id === caseId
            ? {
                ...c,
                assigneeId: specialistId,
                specialty: target.specialty,
                status: canTransition(c.status, 'Encaminhado') ? 'Encaminhado' : c.status,
                history: canTransition(c.status, 'Encaminhado')
                  ? recordHistory(c, 'Encaminhado', currentUser.name)
                  : c.history,
                notes: [
                  ...c.notes,
                  {
                    id: uid('n'),
                    author: currentUser.name,
                    text: `Encaminhado para ${target.name} (${target.specialty}). Motivo: ${reason}`,
                    at: nowIso(),
                  },
                ],
              }
            : c,
        ),
      );

      appendTimeline(kase.studentId, {
        at: nowIso(),
        kind: 'intervencao',
        title: `Caso encaminhado para ${target.name}`,
        detail: `${kase.protocol} transferido para a especialidade ${target.specialty}. Motivo: ${reason}`,
        author: 'Especialista',
        tag: 'Encaminhamento',
      });

      pushNotification({
        kind: 'atribuicao',
        title: 'Caso encaminhado',
        detail: `${kase.protocol} foi transferido para ${target.name} (${target.specialty}).`,
        studentId: kase.studentId,
        caseId,
      });

      toast('success', 'Caso encaminhado', `${kase.protocol} agora é de ${target.name}.`);
    },
    [caseIndex, specialistIndex, currentUser.name, appendTimeline, recordHistory, pushNotification, toast],
  );

  const closeCase = useCallback(
    (
      caseId: string,
      to: 'Acordo Firmado' | 'Evasão Inevitável' | 'Cancelado',
      reason: string,
      note: string,
    ) => {
      const kase = caseIndex.get(caseId);
      if (!kase) return;
      const student = studentIndex.get(kase.studentId);

      setCases((prev) =>
        prev.map((c) =>
          c.id === caseId
            ? {
                ...c,
                status: to,
                closedAt: nowIso(),
                closingReason: reason,
                history: recordHistory(c, to, currentUser.name),
                notes: note
                  ? [...c.notes, { id: uid('n'), author: currentUser.name, text: note, at: nowIso() }]
                  : c.notes,
                // Closing releases the hold: automated journey rulers resume.
                hold: { ...c.hold, active: false },
              }
            : c,
        ),
      );

      appendTimeline(kase.studentId, {
        at: nowIso(),
        kind: to === 'Evasão Inevitável' ? 'alerta' : 'marco',
        title:
          to === 'Acordo Firmado'
            ? `Acordo de permanência firmado — ${kase.protocol}`
            : to === 'Evasão Inevitável'
              ? `Saída registrada — ${kase.protocol}`
              : `Caso descartado — ${kase.protocol}`,
        detail: `Motivo registrado: ${reason}.${note ? ` ${note}` : ''}`,
        author: 'Especialista',
        tag: to === 'Acordo Firmado' ? 'Retenção' : to === 'Evasão Inevitável' ? 'Evasão' : 'Calibração',
      });

      rescoreStudent(kase.studentId, CLOSING_SCORE_EFFECT[to] ?? 0);

      if (to === 'Acordo Firmado') {
        pushNotification({
          kind: 'sucesso',
          title: 'Aluno retido',
          detail: `${student?.name ?? 'Aluno'} — acordo firmado: ${reason}.`,
          studentId: kase.studentId,
          caseId,
        });
      }

      toast(
        to === 'Evasão Inevitável' ? 'warning' : 'success',
        to === 'Acordo Firmado'
          ? 'Aluno retido'
          : to === 'Evasão Inevitável'
            ? 'Saída registrada'
            : 'Caso descartado',
        to === 'Acordo Firmado'
          ? `${kase.protocol} encerrado. Health Score de ${student?.name.split(' ')[0] ?? 'aluno'} recalculado.`
          : to === 'Evasão Inevitável'
            ? `Motivo "${reason}" registrado e disponível no relatório executivo.`
            : `Alerta marcado como improcedente. O radar usará isso para calibração.`,
      );
    },
    [caseIndex, studentIndex, currentUser.name, appendTimeline, recordHistory, rescoreStudent, pushNotification, toast],
  );

  const reopenCase = useCallback(
    (caseId: string, reason: string) => {
      const kase = caseIndex.get(caseId);
      if (!kase) return;

      setCases((prev) =>
        prev.map((c) =>
          c.id === caseId
            ? {
                ...c,
                status: 'Em Contato',
                closedAt: undefined,
                closingReason: undefined,
                reopenCount: c.reopenCount + 1,
                assigneeId: c.assigneeId ?? currentUser.id,
                history: recordHistory(c, 'Em Contato', currentUser.name),
                notes: [
                  ...c.notes,
                  { id: uid('n'), author: currentUser.name, text: `Reabertura: ${reason}`, at: nowIso() },
                ],
              }
            : c,
        ),
      );

      appendTimeline(kase.studentId, {
        at: nowIso(),
        kind: 'intervencao',
        title: `Caso ${kase.protocol} reaberto`,
        detail: `Motivo: ${reason}. A intervenção anterior não se sustentou.`,
        author: 'Especialista',
        tag: 'Reabertura',
      });

      toast('warning', 'Caso reaberto', `${kase.protocol} voltou para "Em Contato".`);
    },
    [caseIndex, currentUser, appendTimeline, recordHistory, toast],
  );

  const setHold = useCallback(
    (caseId: string, active: boolean) => {
      const kase = caseIndex.get(caseId);
      if (!kase) return;

      setCases((prev) =>
        prev.map((c) =>
          c.id === caseId
            ? {
                ...c,
                hold: active
                  ? {
                      active: true,
                      activatedBy: currentUser.name,
                      activatedAt: nowIso(),
                      suppressed: SUPPRESSED_RULERS,
                      blockedCount: c.hold.blockedCount,
                    }
                  : { ...c.hold, active: false },
              }
            : c,
        ),
      );

      appendTimeline(kase.studentId, {
        at: nowIso(),
        kind: 'intervencao',
        title: active ? 'Freio Concorrente ativado' : 'Freio Concorrente desativado',
        detail: active
          ? `${SUPPRESSED_RULERS.length} réguas automáticas suspensas para não conflitar com o contato humano.`
          : 'Réguas automáticas de jornada reativadas.',
        author: 'Sistema',
        tag: 'Governança',
      });

      toast(
        'info',
        active ? 'Freio Concorrente ativado' : 'Réguas reativadas',
        active
          ? 'Cobrança, marketing e push automáticos suspensos durante a tratativa.'
          : 'As comunicações automáticas de jornada voltam a rodar para este aluno.',
      );
    },
    [caseIndex, currentUser.name, appendTimeline, toast],
  );

  const addCaseNote = useCallback(
    (caseId: string, text: string) => {
      setCases((prev) =>
        prev.map((c) =>
          c.id === caseId
            ? { ...c, notes: [...c.notes, { id: uid('n'), author: currentUser.name, text, at: nowIso() }] }
            : c,
        ),
      );
      toast('success', 'Observação registrada', 'A nota ficou anexada ao histórico do caso.');
    },
    [currentUser.name, toast],
  );

  const createCase = useCallback(
    (input: {
      studentId: string;
      title: string;
      radar: RadarKey;
      priority: Priority;
      signals: string[];
      diagnosis: string;
      recommendedAction: string;
      assigneeId: string | null;
    }) => {
      const student = studentIndex.get(input.studentId);
      const openedAt = nowIso();
      const slaHours = settings.slaHours[input.radar];
      const id = uid('case');
      const sequence = 900 + cases.length + 1;

      const newCase: Case = {
        id,
        protocol: `CSA-2026-${String(sequence).padStart(4, '0')}`,
        studentId: input.studentId,
        title: input.title,
        radar: input.radar,
        signals: input.signals.length > 0 ? input.signals : ['Abertura manual pela equipe'],
        priority: input.priority,
        status: input.assigneeId ? 'Em Contato' : 'Pendente',
        specialty: RADARS[input.radar].specialty,
        assigneeId: input.assigneeId,
        openedAt,
        slaHours,
        slaDueAt: addBusinessHours(openedAt, slaHours, settings.businessHours),
        firstContactAt: input.assigneeId ? openedAt : undefined,
        diagnosis: input.diagnosis,
        recommendedAction: input.recommendedAction,
        hold: {
          active: settings.humanFirst && input.assigneeId !== null,
          activatedBy: input.assigneeId ? currentUser.name : '',
          activatedAt: input.assigneeId ? openedAt : '',
          suppressed: input.assigneeId ? SUPPRESSED_RULERS : [],
          blockedCount: 0,
        },
        notes: [],
        history: [{ id: uid('h'), from: null, to: 'Pendente', at: openedAt, by: currentUser.name }],
        reopenCount: 0,
      };

      setCases((prev) => [newCase, ...prev]);

      appendTimeline(input.studentId, {
        at: openedAt,
        kind: 'alerta',
        title: `Caso ${newCase.protocol} aberto manualmente`,
        detail: `${input.title} — ${RADARS[input.radar].label}, prioridade ${input.priority}, SLA de ${slaHours} horas úteis.`,
        author: 'Especialista',
        tag: 'Abertura',
      });

      toast('success', 'Caso aberto', `${newCase.protocol} · ${student?.name ?? 'aluno'} entrou na fila.`);
      return id;
    },
    [studentIndex, cases.length, settings, currentUser.name, appendTimeline, toast],
  );

  /* -- Student mutations ------------------------------------------------ */

  const logInteraction = useCallback(
    (
      input: Omit<
        Interaction,
        'id' | 'at' | 'timestamp' | 'specialistId' | 'specialistName' | 'scoreDelta'
      >,
    ) => {
      const student = studentIndex.get(input.studentId);
      if (!student) return;

      const at = nowIso();
      const record: Interaction = {
        ...input,
        id: uid('int'),
        at,
        timestamp: Date.now(),
        specialistId: currentUser.id,
        specialistName: currentUser.name,
        scoreDelta: 0,
      };

      const nextInteractions = [record, ...interactions];
      setInteractions(nextInteractions);

      appendTimeline(input.studentId, {
        at,
        kind: 'intervencao',
        title: `${input.kind} via ${input.channel} — ${input.outcome}`,
        detail: `Causa: ${input.cause} · Intervenção: ${input.intervention} · Resultado: ${input.result} · Próximo passo: ${input.nextStep}`,
        author: 'Especialista',
        tag: input.kind,
      });

      // The score reads the interaction log, so this is what makes it move.
      rescoreStudent(input.studentId, 0, nextInteractions);

      if (input.nextStep && input.nextStepDate) {
        setFollowUps((prev) => [
          {
            id: uid('fu'),
            studentId: input.studentId,
            caseId: input.caseId,
            title: input.nextStep,
            dueDate: input.nextStepDate as string,
            notes: `Definido no registro de ${input.kind.toLowerCase()} via ${input.channel}.`,
            ownerId: currentUser.id,
            ownerName: currentUser.name,
            status: 'Agendado',
            createdAt: at,
          },
          ...prev,
        ]);
      }

      const scoreAfter = computeScore(
        student,
        scoreContextFor(student, nextInteractions, settings.weights),
      );
      const delta = scoreAfter.total - student.healthScore;

      toast(
        'success',
        'Interação registrada',
        `Histórico de ${student.name.split(' ')[0]} atualizado.${
          delta !== 0 ? ` Health Score ${delta > 0 ? '+' : ''}${delta} ponto(s).` : ''
        }${input.nextStepDate ? ' Acompanhamento agendado.' : ''}`,
      );
    },
    [studentIndex, currentUser, interactions, settings.weights, appendTimeline, rescoreStudent, toast],
  );

  const scheduleFollowUp = useCallback(
    (input: { studentId: string; caseId?: string; title: string; dueDate: string; notes: string }) => {
      const student = studentIndex.get(input.studentId);
      setFollowUps((prev) => [
        {
          id: uid('fu'),
          studentId: input.studentId,
          caseId: input.caseId,
          title: input.title,
          dueDate: input.dueDate,
          notes: input.notes,
          ownerId: currentUser.id,
          ownerName: currentUser.name,
          status: 'Agendado',
          createdAt: nowIso(),
        },
        ...prev,
      ]);

      appendTimeline(input.studentId, {
        at: nowIso(),
        kind: 'marco',
        title: `Acompanhamento agendado: ${input.title}`,
        detail: input.notes || 'Sem observações adicionais.',
        author: 'Especialista',
        tag: 'Follow-up',
      });

      toast('success', 'Acompanhamento agendado', `${input.title} — ${student?.name ?? 'aluno'}.`);
    },
    [studentIndex, currentUser, appendTimeline, toast],
  );

  const completeFollowUp = useCallback(
    (id: string) => {
      setFollowUps((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'Concluído' } : f)));
      toast('success', 'Acompanhamento concluído', 'Marcado como realizado no histórico do aluno.');
    },
    [toast],
  );

  const cancelFollowUp = useCallback(
    (id: string) => {
      setFollowUps((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'Cancelado' } : f)));
      toast('info', 'Acompanhamento cancelado', 'Removido da agenda sem registro de execução.');
    },
    [toast],
  );

  const reviewAlert = useCallback(
    (studentId: string, alertId: string, verdict: 'confirmado' | 'descartado') => {
      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId
            ? {
                ...s,
                alerts: s.alerts.map((a) =>
                  a.id === alertId
                    ? { ...a, review: verdict, reviewedBy: currentUser.name, reviewedAt: nowIso() }
                    : a,
                ),
              }
            : s,
        ),
      );

      appendTimeline(studentId, {
        at: nowIso(),
        kind: 'alerta',
        title: verdict === 'confirmado' ? 'Alerta confirmado pela equipe' : 'Alerta descartado pela equipe',
        detail:
          verdict === 'confirmado'
            ? 'Diagnóstico do radar validado. Contabiliza como acerto na precisão do radar.'
            : 'Falso positivo registrado. Contabiliza para recalibração dos gatilhos do radar.',
        author: 'Especialista',
        tag: 'Calibração',
      });

      toast(
        verdict === 'confirmado' ? 'success' : 'info',
        verdict === 'confirmado' ? 'Alerta confirmado' : 'Alerta descartado',
        'O veredito alimenta a precisão do radar em Indicadores.',
      );
    },
    [currentUser.name, appendTimeline, toast],
  );

  /* -- Governance ------------------------------------------------------- */

  const updateSettings = useCallback(
    (patch: Partial<GovernanceSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        // Changing the onboarding window or the weights re-segments and
        // re-ranks the entire base, so the whole app must reflect it at once.
        setStudents((current) => rescoreAll(current, interactions, next));
        return next;
      });
    },
    [interactions],
  );

  const updateWeights = useCallback(
    (modality: Modality, weights: WeightProfile) => {
      setSettings((prev) => {
        const next = { ...prev, weights: { ...prev.weights, [modality]: weights } };
        setStudents((current) => rescoreAll(current, interactions, next));
        return next;
      });
    },
    [interactions],
  );

  const restoreDemoBase = useCallback(() => {
    resetAll();
    setSettings(DEFAULT_SETTINGS);
    setInteractions(INTERACTIONS);
    setStudents(rescoreAll(STUDENTS, INTERACTIONS, DEFAULT_SETTINGS));
    setCases(CASES);
    setFollowUps(FOLLOW_UPS);
    setNotifications(NOTIFICATIONS);
    resetFilters();
    toast('success', 'Base restaurada', 'Todos os dados de demonstração voltaram ao estado inicial.');
  }, [resetFilters, toast]);

  /* -- Notifications ---------------------------------------------------- */

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  /* -- Assemble --------------------------------------------------------- */

  const value: AppState = {
    students,
    cases,
    interactions,
    followUps,
    specialists,
    notifications,
    settings,
    currentUser,

    modalityFilter,
    setModalityFilter,
    cohortFilter,
    setCohortFilter,
    campusFilter,
    setCampusFilter,
    semester,
    setSemester,
    resetFilters,
    filtersActive,

    scopedStudents,
    scopedCases,
    getStudent,
    getCase,
    getSpecialist,
    scoreOf,
    interactionsOf,
    followUpsOf,
    casesOf,
    radarsOf,
    caseLoadOf,

    claimCase,
    transitionCase,
    reassignCase,
    closeCase,
    reopenCase,
    setHold,
    addCaseNote,
    createCase,

    logInteraction,
    scheduleFollowUp,
    completeFollowUp,
    cancelFollowUp,
    reviewAlert,

    updateSettings,
    updateWeights,
    restoreDemoBase,

    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    toasts,
    toast,
    dismissToast,

    theme,
    toggleTheme,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp precisa estar dentro de <AppProvider>.');
  return ctx;
}

/** Convenience: derived queue metrics used by the sidebar and the cockpit. */
export function useQueueStats() {
  const { scopedCases, cases, currentUser, settings, scopedStudents } = useApp();

  return useMemo(() => {
    const open = scopedCases.filter((c) => isOpen(c.status));
    const mine = open.filter((c) => c.assigneeId === currentUser.id);
    return {
      open,
      openCount: open.length,
      critical: open.filter((c) => c.priority === 'Crítico').length,
      unassigned: open.filter((c) => c.assigneeId === null).length,
      mine,
      mineCount: mine.length,
      minePending: mine.filter((c) => c.status === 'Pendente').length,
      closed: scopedCases.filter((c) => isTerminal(c.status)),
      retained: cases.filter((c) => c.status === 'Acordo Firmado').length,
      lost: cases.filter((c) => c.status === 'Evasão Inevitável').length,
      onboarding: scopedStudents.filter((s) => s.cohort === 'Calouro').length,
      segregated: settings.segregateOnboarding,
    };
  }, [scopedCases, cases, currentUser.id, settings.segregateOnboarding, scopedStudents]);
}
