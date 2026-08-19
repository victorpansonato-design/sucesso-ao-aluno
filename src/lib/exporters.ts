import type { Case, Interaction, Specialist, Student } from '../types';
import { RADARS } from './radars';
import { fullDate, stamp } from './format';

/* ==========================================================================
   Report extraction
   --------------------------------------------------------------------------
   Directors and the Reitoria do not log into an operations cockpit — they ask
   for a file. These builders produce Excel-friendly CSV (BOM + semicolons, so
   pt-BR Excel parses columns and accents correctly on first open) and a
   print-ready executive view.
   ========================================================================== */

function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: (string | number | boolean | null)[][]): string {
  const lines = [headers.map(csvCell).join(';'), ...rows.map((r) => r.map(csvCell).join(';'))];
  // UTF-8 BOM keeps acentuação intact when Excel opens the file directly.
  return `﻿${lines.join('\r\n')}`;
}

export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/* -- Student base --------------------------------------------------------- */

export function exportStudents(students: Student[]): void {
  const headers = [
    'RA',
    'Nome',
    'Curso',
    'Área',
    'Modalidade',
    'Campus',
    'Período',
    'Turno',
    'Coorte',
    'Health Score',
    'Classificação',
    'Tendência',
    'Média',
    'Frequência %',
    'Dependências',
    'Situação financeira',
    'Parcelas em aberto',
    'Saldo devedor',
    'Último acesso AVA (dias)',
    'Acessos 30d',
    'Taxa de entrega %',
    'Progresso do curso %',
    'Previsão de conclusão',
  ];

  const rows = students.map((s) => [
    s.ra,
    s.name,
    s.course,
    s.courseArea,
    s.modality,
    s.campus,
    s.period,
    s.shift,
    s.cohort,
    s.healthScore,
    s.status,
    s.trend === 'up' ? 'Alta' : s.trend === 'down' ? 'Queda' : 'Estável',
    s.academic.gpa.toFixed(1).replace('.', ','),
    Math.round(s.academic.attendancePercent),
    s.academic.dependencies,
    s.financial.situation,
    s.financial.overdueCount,
    s.financial.outstanding.toFixed(2).replace('.', ','),
    s.engagement.lastAccessDaysAgo,
    s.engagement.accessesLast30Days,
    Math.round(s.engagement.deliveryRate),
    s.journey.progressPercent,
    s.journey.completionForecast,
  ]);

  downloadFile(`anchieta-base-alunos-${fileStamp()}.csv`, toCsv(headers, rows));
}

/* -- Case ledger ---------------------------------------------------------- */

export function exportCases(cases: Case[], students: Student[], specialists: Specialist[]): void {
  const headers = [
    'Protocolo',
    'Abertura',
    'RA',
    'Aluno',
    'Curso',
    'Modalidade',
    'Campus',
    'Coorte',
    'Radar',
    'Prioridade',
    'Status',
    'Especialidade',
    'Responsável',
    'SLA (h úteis)',
    'Vencimento SLA',
    'Primeiro contato',
    'Encerramento',
    'Motivo do encerramento',
    'Reaberturas',
    'Freio concorrente',
    'Sinais',
  ];

  const rows = cases.map((c) => {
    const s = students.find((x) => x.id === c.studentId);
    const owner = specialists.find((x) => x.id === c.assigneeId);
    return [
      c.protocol,
      fullDate(c.openedAt),
      s?.ra ?? '',
      s?.name ?? '',
      s?.course ?? '',
      s?.modality ?? '',
      s?.campus ?? '',
      s?.cohort ?? '',
      RADARS[c.radar].label,
      c.priority,
      c.status,
      c.specialty,
      owner?.name ?? 'Não atribuído',
      c.slaHours,
      stamp(c.slaDueAt),
      c.firstContactAt ? stamp(c.firstContactAt) : '',
      c.closedAt ? stamp(c.closedAt) : '',
      c.closingReason ?? '',
      c.reopenCount,
      c.hold.active ? 'Ativo' : 'Desligado',
      c.signals.join(' | '),
    ];
  });

  downloadFile(`anchieta-casos-${fileStamp()}.csv`, toCsv(headers, rows));
}

/* -- Evasion reasons by course / campus ---------------------------------- */

export interface EvasionRow {
  course: string;
  campus: string;
  modality: string;
  reason: string;
  count: number;
}

/**
 * The report the Reitoria asks for: why students actually left, grouped by
 * course and campus. Built only from cases closed as `Evasão Inevitável`, so
 * the reasons are recorded verdicts rather than model guesses.
 */
export function evasionBreakdown(cases: Case[], students: Student[]): EvasionRow[] {
  const bucket = new Map<string, EvasionRow>();

  for (const c of cases) {
    if (c.status !== 'Evasão Inevitável') continue;
    const s = students.find((x) => x.id === c.studentId);
    if (!s) continue;
    const reason = c.closingReason ?? 'Motivo não registrado';
    const key = `${s.course}|${s.campus}|${s.modality}|${reason}`;
    const existing = bucket.get(key);
    if (existing) existing.count += 1;
    else bucket.set(key, { course: s.course, campus: s.campus, modality: s.modality, reason, count: 1 });
  }

  return [...bucket.values()].sort((a, b) => b.count - a.count || a.course.localeCompare(b.course));
}

export function exportEvasionReport(cases: Case[], students: Student[]): void {
  const rows = evasionBreakdown(cases, students).map((r) => [
    r.course,
    r.campus,
    r.modality,
    r.reason,
    r.count,
  ]);
  downloadFile(
    `anchieta-motivos-evasao-${fileStamp()}.csv`,
    toCsv(['Curso', 'Campus', 'Modalidade', 'Motivo registrado', 'Ocorrências'], rows),
  );
}

/* -- Intervention ledger -------------------------------------------------- */

export function exportInteractions(interactions: Interaction[], students: Student[]): void {
  const headers = [
    'Data',
    'RA',
    'Aluno',
    'Canal',
    'Tipo',
    'Resultado',
    'Causa identificada',
    'Intervenção realizada',
    'Resultado do contato',
    'Próximo passo',
    'Data do próximo passo',
    'Especialista',
    'Impacto no score',
  ];

  const rows = [...interactions]
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((i) => {
      const s = students.find((x) => x.id === i.studentId);
      return [
        stamp(i.at),
        s?.ra ?? '',
        s?.name ?? '',
        i.channel,
        i.kind,
        i.outcome,
        i.cause,
        i.intervention,
        i.result,
        i.nextStep,
        i.nextStepDate ? fullDate(i.nextStepDate) : '',
        i.specialistName,
        i.scoreDelta,
      ];
    });

  downloadFile(`anchieta-intervencoes-${fileStamp()}.csv`, toCsv(headers, rows));
}

/** Hands the current view to the browser's print/PDF pipeline. */
export function printReport(): void {
  window.print();
}
