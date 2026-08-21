import type { Case, Modality, Specialist, Student } from '../types';

/* ==========================================================================
   Roteamento — qual especialista atende qual caso
   --------------------------------------------------------------------------
   O plano operacional descreve a cadeia assim:

     Radar identifica → Sistema classifica → Caso chega ao especialista correto
     → Humano atua → Resultado é registrado

   Este módulo é o terceiro elo, e ele tem exatamente uma regra: um caso é meu
   se bate na minha ESPECIALIDADE **e** na minha MODALIDADE.

   A segunda metade não é burocracia. Uma queda de nota no presencial se resolve
   com monitoria, reposição e conversa com a coordenação de curso; a mesma queda
   no híbrido quase sempre é o aluno que perdeu o ritmo entre dois encontros, e
   se resolve no AVA. É o mesmo radar, o mesmo sinal e dois ofícios diferentes —
   e é por isso que a equipe tem Acadêmico duas vezes.

   Antes o pool de "sem dono" filtrava só por especialidade, então um caso
   presencial aparecia como disponível para quem só atende híbrido. Funcionava
   porque havia uma pessoa por especialidade; com a matriz montada, viraria fila
   errada todos os dias.
   ========================================================================== */

/** Cobre todas as modalidades — a camada transversal (Retenção, Onboarding). */
export function isTransversal(specialist: Specialist): boolean {
  return specialist.modality === 'Todas';
}

/** A modalidade do especialista atende a modalidade do aluno? */
export function coversModality(specialist: Specialist, modality: Modality): boolean {
  return isTransversal(specialist) || specialist.modality === modality;
}

/**
 * Este caso pertence à fila deste especialista?
 *
 * `student` é opcional porque a amostra pode não conter o aluno de um caso; sem
 * ele a modalidade não pode ser verificada, e aí a especialidade decide sozinha
 * — errar por incluir é melhor que sumir com um caso da fila de todo mundo.
 */
export function serves(specialist: Specialist, kase: Case, student?: Student): boolean {
  if (kase.specialty !== specialist.specialty) return false;
  if (!student) return true;
  return coversModality(specialist, student.modality);
}

/**
 * Quem pode assumir este caso, do mais folgado para o mais carregado.
 *
 * A ordem é por capacidade livre porque distribuir por ordem alfabética ou por
 * id concentra tudo na mesma pessoa. O especialista da modalidade vem antes do
 * transversal: o transversal existe para transbordo, não para ser a primeira
 * opção.
 */
export function candidatesFor(
  kase: Case,
  student: Student | undefined,
  specialists: Specialist[],
  loadOf: (specialistId: string) => number,
): Specialist[] {
  return specialists
    .filter((s) => serves(s, kase, student))
    .sort((a, b) => {
      const dedicated = Number(isTransversal(a)) - Number(isTransversal(b));
      if (dedicated !== 0) return dedicated;
      const freeA = a.capacity - loadOf(a.id);
      const freeB = b.capacity - loadOf(b.id);
      if (freeA !== freeB) return freeB - freeA;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
}

/** Rótulo curto da função, do jeito que a equipe fala: "Acadêmico · Presencial". */
export function roleLabel(specialist: Specialist): string {
  return isTransversal(specialist)
    ? `${specialist.specialty} · transversal`
    : `${specialist.specialty} · ${specialist.modality}`;
}
