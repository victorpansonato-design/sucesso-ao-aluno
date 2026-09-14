import type { Discipline, Student } from '../types';
import { STUDENTS } from './seed';

/** Nomes ilustrativos autorizados para esta prévia, não uma grade oficial. */
const disciplines: Discipline[] = [
  { id: 'fono-demo-1', code: 'DEMO-1', name: 'Anatomia Humana', format: 'Híbrida', exempted: true, calendarSlot: { bimester: 1, ordinal: 1 } },
  { id: 'fono-demo-2', code: 'DEMO-2', name: 'Introdução à Fonoaudiologia', format: 'Híbrida', calendarSlot: { bimester: 1, ordinal: 2 } },
  { id: 'fono-demo-3', code: 'DEMO-3', name: 'Leitura e Produção de Textos', format: 'Digital' },
].map((discipline) => ({
  teacher: 'Docente a confirmar', grade: 0, attendancePercent: 0, absences: 0,
  absenceLimit: 0, pendingActivities: 0, schedule: 'Consulte o calendário acadêmico',
  status: 'Em curso', ...discipline,
})) as Discipline[];

/** Perfil isolado de demonstração. Não entra na base nem altera um aluno real. */
export const FONO_PREVIEW: Student = {
  ...STUDENTS[0],
  id: 'previa-fono', ra: 'previa-fono', name: 'Aluno ingressante', initials: 'AI',
  cpfMasked: '', email: '', phone: '', course: 'Fonoaudiologia', courseArea: 'Saúde',
  modality: 'Híbrido', cohort: 'Calouro', period: 1, turma: undefined,
  academic: { gpa: 0, attendancePercent: 0, attendancePrevPercent: 0, subjects: 3, dependencies: 0, lateAssignments: 0, failingSubjects: 0, disciplines },
  financial: { situation: 'Regular', monthlyFee: 0, dueDay: 0, outstanding: 0, overdueCount: 0, daysOverdue: 0, lastPayment: '', hasNegotiation: false, scholarshipPercent: 0, insidePreventiveWindow: false },
  engagement: { lastAccessDaysAgo: 0, accessesLast30Days: 0, accessesPrev30Days: 0, weeklyHours: 0, deliveryRate: 0, forumInteractions: 0, accessTrend: [], appInstalled: false, visitedCancellationPage: false },
  journey: { progressPercent: 0, completionForecast: '', admissionSemester: '2026/2', daysSinceEnrollment: 0, moduleName: 'Módulo de ingresso', onboardingSteps: [] },
  alerts: [], timeline: [],
};
