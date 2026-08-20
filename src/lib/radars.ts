import type { Modality, Priority, RadarKey, Specialty, Student } from '../types';

/* ==========================================================================
   The five radars
   --------------------------------------------------------------------------
   Every radar answers the golden rule from the operating plan: "which
   behaviour are we trying to change, or which risk are we trying to avoid?"
   If a rule cannot answer that, it does not belong here.

   `evaluate()` is the actual detection code. It reads a student's raw signals
   and returns the concrete evidence strings the attendant sees — so a case is
   never "the system said so", it is always a list of facts.
   ========================================================================== */

export interface RadarDefinition {
  key: RadarKey;
  label: string;
  shortLabel: string;
  /** The behaviour this radar exists to change. */
  purpose: string;
  triggers: string[];
  guidance: string;
  defaultSlaHours: number;
  defaultPriority: Priority;
  specialty: Specialty;
  /** Which modalities this radar is meaningful for. */
  appliesTo: Modality[];
  /** Returns the matched evidence, or an empty array when the radar is quiet. */
  evaluate: (student: Student) => string[];
}

export const RADAR_ORDER: RadarKey[] = [
  'evasao',
  'academico',
  'engajamento',
  'financeiro',
  'atendimento',
];

export const RADARS: Record<RadarKey, RadarDefinition> = {
  evasao: {
    key: 'evasao',
    label: 'Radar de Evasão',
    shortLabel: 'Evasão',
    purpose:
      'Interceptar a decisão de sair antes que ela seja tomada, cruzando sinais que isolados não alarmam mas somados indicam ruptura.',
    triggers: [
      'Queda de frequência superior a 30% combinada a mensalidade atrasada há mais de 15 dias',
      'Visita à página de trancamento ou cancelamento no portal do aluno',
      'Três ou mais radares distintos ativos simultaneamente',
      'Ausência total no AVA por 14 dias ou mais',
    ],
    guidance:
      'Contato humano prioritário do Especialista de Retenção. Escuta ativa antes de qualquer proposta; nunca abrir com cobrança. Freio Concorrente obrigatório.',
    defaultSlaHours: 4,
    defaultPriority: 'Crítico',
    specialty: 'Retenção',
    appliesTo: ['Presencial', 'Híbrido'],
    evaluate: (s) => {
      const hits: string[] = [];
      const attendanceDrop = s.academic.attendancePrevPercent - s.academic.attendancePercent;

      if (s.engagement.visitedCancellationPage) {
        hits.push('Acessou a página de trancamento/cancelamento no portal');
      }
      if (attendanceDrop >= 30 && s.financial.daysOverdue > 15) {
        hits.push(
          `Frequência caiu ${Math.round(attendanceDrop)} p.p. com mensalidade em atraso há ${s.financial.daysOverdue} dias`,
        );
      }
      if (s.engagement.lastAccessDaysAgo >= 14) {
        hits.push(`${s.engagement.lastAccessDaysAgo} dias sem qualquer acesso ao AVA`);
      }
      if (s.financial.overdueCount >= 2 && s.academic.attendancePercent < 75) {
        hits.push(
          `${s.financial.overdueCount} parcelas em aberto e frequência abaixo do mínimo regimental (${Math.round(s.academic.attendancePercent)}%)`,
        );
      }
      return hits;
    },
  },

  academico: {
    key: 'academico',
    label: 'Radar Acadêmico',
    shortLabel: 'Acadêmico',
    purpose:
      'Recuperar desempenho enquanto ainda há semestre para recuperar — antes do fechamento das notas, não depois.',
    triggers: [
      'Média parcial inferior a 5,0 em duas ou mais disciplinas',
      'Três faltas consecutivas na mesma disciplina',
      'Frequência abaixo do mínimo regimental de 75%',
      'Dependência acumulada de semestres anteriores',
    ],
    guidance:
      'Encaminhamento para monitoria, plano de estudos com a coordenação e agenda de reposição. Foco na disciplina crítica, não no boletim inteiro.',
    defaultSlaHours: 24,
    defaultPriority: 'Alto',
    specialty: 'Acadêmico',
    appliesTo: ['Presencial', 'Híbrido'],
    evaluate: (s) => {
      const hits: string[] = [];
      const failing = s.academic.disciplines.filter((d) => d.grade > 0 && d.grade < 5);
      if (failing.length >= 2) {
        hits.push(
          `Média abaixo de 5,0 em ${failing.length} disciplinas: ${failing.map((d) => d.name).join(', ')}`,
        );
      } else if (s.academic.failingSubjects >= 2) {
        hits.push(`${s.academic.failingSubjects} disciplinas com média abaixo de 5,0`);
      }

      const nearLimit = s.academic.disciplines.filter(
        (d) => d.absenceLimit > 0 && d.absences >= d.absenceLimit - 1,
      );
      if (nearLimit.length > 0) {
        hits.push(
          `No limite de faltas em ${nearLimit.map((d) => `${d.name} (${d.absences}/${d.absenceLimit})`).join(', ')}`,
        );
      }
      if (s.academic.attendancePercent < 75) {
        hits.push(
          `Frequência global em ${Math.round(s.academic.attendancePercent)}% — abaixo do mínimo de 75%`,
        );
      }
      if (s.academic.dependencies > 0) {
        hits.push(`${s.academic.dependencies} dependência(s) acumulada(s)`);
      }
      if (s.academic.lateAssignments >= 3) {
        hits.push(`${s.academic.lateAssignments} atividades avaliativas em atraso`);
      }
      return hits;
    },
  },

  engajamento: {
    key: 'engajamento',
    label: 'Radar de Engajamento AVA',
    shortLabel: 'Engajamento',
    purpose:
      'Manter o ritmo de estudo digital. No híbrido, entre um encontro e o próximo, o login é o equivalente funcional da presença em sala.',
    triggers: [
      'Mais de 7 dias sem login na plataforma virtual',
      'Queda superior a 40% nos acessos em relação ao ciclo anterior',
      'Duas entregas avaliativas consecutivas não realizadas',
      'Queda de 50% nas interações em fóruns e videoaulas',
    ],
    guidance:
      'Mensagem acolhedora com link direto do módulo em atraso e o guia "Como funciona meu módulo?". Sem tom de cobrança.',
    defaultSlaHours: 48,
    defaultPriority: 'Médio',
    specialty: 'Engajamento',
    appliesTo: ['Presencial', 'Híbrido'],
    evaluate: (s) => {
      const hits: string[] = [];
      if (s.engagement.lastAccessDaysAgo >= 7) {
        hits.push(`${s.engagement.lastAccessDaysAgo} dias sem login no AVA`);
      }
      const drop = accessDropPercent(s);
      if (drop >= 40) {
        hits.push(
          `Queda de ${drop}% nos acessos ao AVA (${s.engagement.accessesPrev30Days} → ${s.engagement.accessesLast30Days} em 30 dias)`,
        );
      }
      if (s.engagement.deliveryRate < 70) {
        hits.push(`Taxa de entrega de atividades em ${Math.round(s.engagement.deliveryRate)}%`);
      }
      if (s.engagement.forumInteractions === 0 && s.modality !== 'Presencial') {
        hits.push('Nenhuma interação em fóruns no módulo corrente');
      }
      return hits;
    },
  },

  financeiro: {
    key: 'financeiro',
    label: 'Radar Financeiro Preventivo',
    shortLabel: 'Financeiro',
    purpose:
      'Resolver o atraso enquanto ele ainda é conversa, na janela entre D+5 e D+20, antes de virar cobrança externa e impedimento de rematrícula.',
    triggers: [
      'Primeira mensalidade em aberto entre D+5 e D+20',
      'Atraso recorrente em dois ou mais ciclos',
      'Termo de negociação vencido sem confirmação de pagamento',
      'Combinação de pendência financeira com queda acadêmica',
    ],
    guidance:
      'Oferta de repactuação sem juros punitivos e apoio na emissão de PIX/boleto. Mediação, nunca cobrança.',
    defaultSlaHours: 24,
    defaultPriority: 'Alto',
    specialty: 'Financeiro',
    appliesTo: ['Presencial', 'Híbrido'],
    evaluate: (s) => {
      const hits: string[] = [];
      if (s.financial.daysOverdue >= 5 && s.financial.insidePreventiveWindow) {
        hits.push(
          `Mensalidade em aberto há ${s.financial.daysOverdue} dias — dentro da janela preventiva`,
        );
      }
      if (s.financial.overdueCount >= 2) {
        hits.push(
          `${s.financial.overdueCount} parcelas vencidas, saldo de ${s.financial.outstanding.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
        );
      }
      if (s.financial.situation === 'Negociação em andamento' && s.financial.daysOverdue > 0) {
        hits.push('Termo de negociação em aberto sem confirmação de pagamento');
      }
      if (s.financial.daysOverdue > 20) {
        hits.push('Atraso ultrapassou a janela preventiva — risco de cobrança externa');
      }
      return hits;
    },
  },

  atendimento: {
    key: 'atendimento',
    label: 'Radar de Experiência & Atendimento',
    shortLabel: 'Atendimento',
    purpose:
      'Impedir que uma insatisfação mal resolvida se transforme em pedido de saída. Reincidência é o sinal, não o volume.',
    triggers: [
      'Avaliação inferior a 6 em pesquisa de disciplina ou atendimento',
      'Protocolo aberto há mais de 5 dias sem resposta da secretaria',
      'Dois ou mais chamados sobre o mesmo assunto',
      'Reclamação registrada na Ouvidoria',
    ],
    guidance:
      'Assumir o caso com contexto 360° completo, reconhecer a falha e fechar o ciclo com quem resolve — sem novo repasse.',
    defaultSlaHours: 12,
    defaultPriority: 'Alto',
    specialty: 'Experiência',
    appliesTo: ['Presencial', 'Híbrido'],
    evaluate: (s) => {
      const hits: string[] = [];
      const open = s.alerts.filter((a) => a.radar === 'atendimento' && a.review !== 'descartado');
      for (const a of open) hits.push(...a.signals);
      return hits;
    },
  },
};

/** Percentage drop in AVA accesses versus the previous 30-day window. */
export function accessDropPercent(s: Student): number {
  const prev = s.engagement.accessesPrev30Days;
  if (prev <= 0) return 0;
  const drop = ((prev - s.engagement.accessesLast30Days) / prev) * 100;
  return drop > 0 ? Math.round(drop) : 0;
}

/**
 * Runs every applicable radar. Onboarding students are intentionally kept out
 * of the evasion radar: their risk profile is adaptation, not abandonment, and
 * mixing the two is exactly what corrupts a retention funnel.
 */
export function activeRadars(
  student: Student,
  opts: { segregateOnboarding: boolean } = { segregateOnboarding: true },
): RadarKey[] {
  return RADAR_ORDER.filter((key) => {
    const def = RADARS[key];
    if (!def.appliesTo.includes(student.modality)) return false;
    if (key === 'evasao' && opts.segregateOnboarding && student.cohort === 'Calouro') return false;
    return def.evaluate(student).length > 0;
  });
}

/** All evidence strings for one radar / one student. */
export function radarEvidence(student: Student, key: RadarKey): string[] {
  return RADARS[key].evaluate(student);
}

export function radarLabel(key: RadarKey): string {
  return RADARS[key].label;
}
