import type { CaseStatus, InteractionOutcome } from '../types';

/* ==========================================================================
   Case state machine
   --------------------------------------------------------------------------
   The unit of work is the case, and a case that can jump anywhere is a case
   nobody can audit. Transitions are declared once, here; the UI asks this
   module what is legal and renders exactly those actions — which is how we
   guarantee no button in the app does nothing or does something surprising.

       Pendente ──▶ Em Contato ──▶ Aguardando Retorno
          │            │  │              │
          │            │  └──────────────┘  (aluno respondeu)
          │            ├──▶ Acordo Firmado        (terminal · +pontos)
          │            ├──▶ Evasão Inevitável     (terminal · aprendizado)
          │            └──▶ Encaminhado
          ├──▶ Encaminhado
          └──▶ Cancelado

   Terminal states can be reopened, which increments `reopenCount` — a metric
   the team actually watches, because reopening means the first intervention
   did not hold.
   ========================================================================== */

export const CASE_STATUSES: CaseStatus[] = [
  'Pendente',
  'Em Contato',
  'Aguardando Retorno',
  'Encaminhado',
  'Acordo Firmado',
  'Evasão Inevitável',
  'Cancelado',
];

export const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  Pendente: ['Em Contato', 'Encaminhado', 'Cancelado'],
  'Em Contato': ['Aguardando Retorno', 'Acordo Firmado', 'Evasão Inevitável', 'Encaminhado'],
  'Aguardando Retorno': ['Em Contato', 'Acordo Firmado', 'Evasão Inevitável', 'Encaminhado'],
  Encaminhado: ['Em Contato', 'Acordo Firmado', 'Cancelado'],
  'Acordo Firmado': ['Em Contato'],
  'Evasão Inevitável': ['Em Contato'],
  Cancelado: ['Pendente'],
};

export const TERMINAL_STATUSES: CaseStatus[] = ['Acordo Firmado', 'Evasão Inevitável', 'Cancelado'];

export function isTerminal(status: CaseStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isOpen(status: CaseStatus): boolean {
  return !isTerminal(status);
}

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: CaseStatus): CaseStatus[] {
  return ALLOWED_TRANSITIONS[from];
}

/* -- Presentation metadata ------------------------------------------------ */

export type StatusTone = 'neutral' | 'info' | 'warn' | 'ok' | 'crit' | 'muted';

export const STATUS_META: Record<
  CaseStatus,
  { tone: StatusTone; hint: string; verb: string }
> = {
  Pendente: {
    tone: 'info',
    hint: 'Detectado pelo radar, ainda sem responsável em contato.',
    verb: 'Assumir e iniciar contato',
  },
  'Em Contato': {
    tone: 'warn',
    hint: 'Especialista em tratativa ativa com o aluno.',
    verb: 'Marcar em contato',
  },
  'Aguardando Retorno': {
    tone: 'warn',
    hint: 'Contato feito, aguardando resposta ou decisão do aluno.',
    verb: 'Aguardar retorno do aluno',
  },
  Encaminhado: {
    tone: 'neutral',
    hint: 'Transferido para outra especialidade ou para a coordenação.',
    verb: 'Encaminhar',
  },
  'Acordo Firmado': {
    tone: 'ok',
    hint: 'Aluno retido com acordo de permanência registrado.',
    verb: 'Registrar acordo de permanência',
  },
  'Evasão Inevitável': {
    tone: 'crit',
    hint: 'Saída confirmada. O motivo alimenta a calibração dos radares.',
    verb: 'Registrar saída inevitável',
  },
  Cancelado: {
    tone: 'muted',
    hint: 'Alerta descartado — falso positivo ou situação já resolvida.',
    verb: 'Descartar caso',
  },
};

/** Score effect of closing a case, applied on top of the recomputed score. */
export const CLOSING_SCORE_EFFECT: Partial<Record<CaseStatus, number>> = {
  'Acordo Firmado': 15,
  Encaminhado: 4,
};

/**
 * Maps the outcome the attendant selected in the interaction form to the case
 * status that outcome implies. Returning `null` means "leave the status alone",
 * which is correct for a routine follow-up that changed nothing.
 */
export function statusFromOutcome(outcome: InteractionOutcome, current: CaseStatus): CaseStatus | null {
  const target: Record<InteractionOutcome, CaseStatus | null> = {
    Resolvido: 'Acordo Firmado',
    'Parcialmente resolvido': 'Aguardando Retorno',
    'Aguardando aluno': 'Aguardando Retorno',
    Encaminhado: 'Encaminhado',
    'Sem contato': 'Em Contato',
    'Recusou atendimento': 'Aguardando Retorno',
  };
  const next = target[outcome];
  if (!next || next === current) return null;
  return canTransition(current, next) ? next : null;
}

/** Reasons offered when closing a case — this list is the learning taxonomy. */
export const CLOSING_REASONS: Record<'retido' | 'perdido', string[]> = {
  retido: [
    'Acordo financeiro firmado',
    'Plano de estudos e monitoria acordados',
    'Dúvida de rotina/AVA esclarecida',
    'Reposição de conteúdo e abono encaminhados',
    'Transferência de turno ou modalidade',
    'Alerta improcedente — aluno já regularizado',
  ],
  perdido: [
    'Dificuldade financeira sem solução viável',
    'Mudança de cidade ou de rotina de trabalho',
    'Transferência para outra instituição',
    'Reprovação/desempenho — decisão de pausar',
    'Insatisfação com o curso ou a modalidade',
    'Motivo pessoal ou de saúde',
    'Sem contato após todas as tentativas',
  ],
};
