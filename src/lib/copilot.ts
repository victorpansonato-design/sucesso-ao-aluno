import type { ApproachAngle, Case, Channel, Student } from '../types';
import { accessDropPercent } from './radars';
import { firstName, money } from './format';

/* ==========================================================================
   Copiloto de Abordagem
   --------------------------------------------------------------------------
   Prepares the attendant, it does not decide for them. Three deliberately
   different angles — because the same signal has different root causes, and
   opening with the wrong one costs the conversation:

     · Pedagógica / Empática  — the student is struggling with the content
                                or the routine. Lead with listening.
     · Financeira / Negocial  — money is the blocker. Lead with a concrete,
                                pre-authorised option, never with the debt.
     · Carreira / Futuro      — motivation has faded. Reconnect the course to
                                why they enrolled in the first place.

   Generation is deterministic and reads the student's real signals, so the
   script is auditable and available offline. The `generateApproaches` seam is
   where a live model call can be substituted without touching the UI.
   ========================================================================== */

export interface Approach {
  angle: ApproachAngle;
  label: string;
  /** When this angle is the right opening move. */
  whenToUse: string;
  /** The single objective of the contact. */
  objective: string;
  /** Ready-to-send WhatsApp message. */
  whatsapp: string;
  /** Phone call outline. */
  phone: string[];
  /** In-person session outline. */
  inPerson: string[];
  /** Facts the attendant must have at hand before opening their mouth. */
  evidence: string[];
  /** Recommended fit 0–100, from the student's actual signal mix. */
  fit: number;
}

export interface Briefing {
  headline: string;
  summary: string;
  rootCauseHypotheses: string[];
  doNot: string[];
  approaches: Approach[];
}

const SIGNATURE = 'Equipe de Sucesso ao Aluno · UniAnchieta';

function evidenceFor(s: Student): string[] {
  const out: string[] = [];
  const drop = accessDropPercent(s);

  out.push(`Health Score ${s.healthScore}/100 — ${s.status} (perfil ${s.modality})`);
  out.push(
    `Média ${s.academic.gpa.toFixed(1).replace('.', ',')} · frequência ${Math.round(s.academic.attendancePercent)}%`,
  );
  if (drop >= 25) {
    out.push(`Acessos ao AVA caíram ${drop}% (${s.engagement.accessesPrev30Days} → ${s.engagement.accessesLast30Days})`);
  }
  if (s.engagement.lastAccessDaysAgo >= 3) {
    out.push(`Último acesso ao AVA há ${s.engagement.lastAccessDaysAgo} dias`);
  }
  if (s.financial.overdueCount > 0) {
    out.push(
      `${s.financial.overdueCount} parcela(s) em aberto · ${money(s.financial.outstanding)} · ${s.financial.daysOverdue} dias`,
    );
  }
  if (s.academic.dependencies > 0) out.push(`${s.academic.dependencies} dependência(s) acumulada(s)`);
  const critical = s.academic.disciplines.filter((d) => d.grade > 0 && d.grade < 6);
  if (critical.length > 0) {
    out.push(`Disciplina(s) crítica(s): ${critical.map((d) => `${d.name} (${d.grade.toFixed(1).replace('.', ',')})`).join(', ')}`);
  }
  if (s.engagement.visitedCancellationPage) {
    out.push('Consultou a página de trancamento no portal — tratar com máxima delicadeza');
  }
  return out;
}

/* -- Fit scoring: which angle the data actually recommends ---------------- */

function fitScores(s: Student): Record<ApproachAngle, number> {
  const drop = accessDropPercent(s);

  let financeira = 10;
  if (s.financial.overdueCount >= 1) financeira += 40;
  if (s.financial.overdueCount >= 2) financeira += 20;
  if (s.financial.daysOverdue > 15) financeira += 15;
  if (s.financial.hasNegotiation) financeira += 10;
  if (s.financial.situation === 'Bolsista integral') financeira = 5;

  let pedagogica = 20;
  if (s.academic.gpa < 6.5) pedagogica += 30;
  if (s.academic.failingSubjects > 0) pedagogica += 20;
  if (s.academic.lateAssignments > 0) pedagogica += 12;
  if (s.academic.attendancePercent < 80) pedagogica += 15;
  if (drop >= 40) pedagogica += 10;

  let carreira = 15;
  if (drop >= 25) carreira += 20;
  if (s.engagement.lastAccessDaysAgo >= 7) carreira += 20;
  if (s.engagement.visitedCancellationPage) carreira += 30;
  if (s.journey.progressPercent > 50) carreira += 15;
  if (s.academic.gpa >= 7.5 && s.engagement.lastAccessDaysAgo >= 5) carreira += 15;

  const cap = (n: number) => Math.min(97, Math.max(8, Math.round(n)));
  return { pedagogica: cap(pedagogica), financeira: cap(financeira), carreira: cap(carreira) };
}

/* -- Angle builders ------------------------------------------------------- */

function pedagogica(s: Student, fit: number, evidence: string[]): Approach {
  const name = firstName(s.name);
  const hardest =
    [...s.academic.disciplines].filter((d) => d.grade > 0).sort((a, b) => a.grade - b.grade)[0];
  const subject = hardest?.name ?? 'suas disciplinas do período';

  return {
    angle: 'pedagogica',
    label: 'Pedagógica & Empática',
    whenToUse:
      'A dificuldade é com o conteúdo, com o ritmo de estudo ou com a conciliação da rotina. Nada aqui se resolve com pressão.',
    objective: `Entender o que mudou na rotina de ${name} e sair da conversa com um plano de estudo concreto.`,
    whatsapp: [
      `Olá, ${name}! Aqui é da ${SIGNATURE.split(' · ')[0]} da UniAnchieta.`,
      '',
      `Estou acompanhando sua turma de ${s.course} e passei para saber como você está — sem cobrança nenhuma, é conversa mesmo.`,
      '',
      `Notei que ${subject} pode estar pedindo mais atenção neste período. A gente tem monitoria gratuita e consegue montar um plano de estudos junto com a coordenação, ajustado ao horário que funciona pra você.`,
      '',
      'Qual o melhor dia e horário para a gente falar 10 minutinhos?',
    ].join('\n'),
    phone: [
      `Abertura: "Oi ${name}, tudo bem? É da equipe de Sucesso ao Aluno — não é cobrança, é só uma conversa."`,
      'Escuta ativa: perguntar abertamente o que mudou na rotina (trabalho, deslocamento, saúde, família). Ouvir sem interromper.',
      `Espelhar o que ouviu, sem julgamento, e só então trazer ${subject} como o ponto de apoio.`,
      'Oferta: monitoria da disciplina, plantão de dúvidas e plano de estudos com a coordenação.',
      'Fechamento: definir uma primeira ação pequena e datada (uma atividade, um plantão) e combinar o retorno.',
    ],
    inPerson: [
      'Reservar sala individual — a conversa envolve desempenho e não pode acontecer em balcão.',
      'Abrir o extrato acadêmico junto com o aluno, na tela, para que nada pareça escondido.',
      `Mapear com ele a ordem de prioridade das disciplinas, começando por ${subject}.`,
      'Assinar o plano de estudos e encaminhar formalmente à coordenação do curso.',
      'Agendar a revisão na própria agenda antes de encerrar o atendimento.',
    ],
    evidence,
    fit,
  };
}

function financeira(s: Student, fit: number, evidence: string[]): Approach {
  const name = firstName(s.name);
  const hasDebt = s.financial.overdueCount > 0;
  const installments = Math.min(12, Math.max(3, s.financial.overdueCount * 4));

  return {
    angle: 'financeira',
    label: 'Financeira & Negocial',
    whenToUse:
      'Existe pendência financeira na jornada. Abrir pelo valor devido encerra a conversa; abrir pela solução mantém o aluno.',
    objective: hasDebt
      ? `Chegar a uma condição que ${name} consiga pagar de verdade, preservando a matrícula.`
      : `Antecipar a orientação financeira antes de qualquer atraso virar problema para ${name}.`,
    whatsapp: [
      `Olá, ${name}! Aqui é da equipe de Sucesso ao Aluno da UniAnchieta.`,
      '',
      hasDebt
        ? 'Estou entrando em contato porque quero te ajudar a resolver uma pendência da sua mensalidade antes que ela atrapalhe sua rematrícula — e isso a gente resolve junto.'
        : 'Passando para conferir se está tudo tranquilo com a parte financeira do seu curso e para te lembrar dos canais de apoio.',
      '',
      hasDebt
        ? `Consigo simular condições facilitadas em até ${installments}x, sem juros punitivos, e emitir o PIX ou boleto na hora com você.`
        : 'Se em algum momento apertar, temos condições de repactuação e bolsas internas — me chama antes de o vencimento passar.',
      '',
      'Pode ser hoje? Me diz um horário e eu te ligo.',
    ].join('\n'),
    phone: [
      `Abertura: "${name}, é da equipe de Sucesso ao Aluno. Liguei para resolver, não para cobrar."`,
      'Entender a causa: perda de renda, mudança de emprego, despesa inesperada, problema no boleto.',
      hasDebt
        ? `Apresentar a condição pré-autorizada: até ${installments}x sem juros punitivos sobre ${money(s.financial.outstanding)}.`
        : 'Explicar as opções de apoio existentes e o canal direto para acioná-las.',
      'Verificar bolsas internas, descontos de pontualidade e programas de financiamento aplicáveis.',
      'Fechamento: confirmar a data do primeiro pagamento, emitir o documento na hora e enviar o resumo por escrito no WhatsApp.',
    ],
    inPerson: [
      'Atender em sala reservada — dado financeiro não se trata em área comum (LGPD).',
      'Mostrar o extrato completo com transparência total, sem letras miúdas.',
      `Simular ao vivo 2 ou 3 cenários de parcelamento e deixar ${name} escolher o que cabe no orçamento.`,
      'Assinar o termo de repactuação e emitir a primeira via na hora.',
      'Confirmar que o Freio Concorrente segue ativo até o acordo ser cumprido.',
    ],
    evidence,
    fit,
  };
}

function carreira(s: Student, fit: number, evidence: string[]): Approach {
  const name = firstName(s.name);
  const remaining = Math.max(1, s.totalPeriods - s.period + 1);

  return {
    angle: 'carreira',
    label: 'Carreira & Futuro',
    whenToUse:
      'O aluno não tem um problema pontual — perdeu o vínculo com o motivo de estar ali. Reconectar o propósito vem antes de qualquer processo.',
    objective: `Reconectar ${name} ao objetivo que o trouxe para ${s.course} e tornar visível o quanto já foi construído.`,
    whatsapp: [
      `Olá, ${name}! Aqui é da equipe de Sucesso ao Aluno da UniAnchieta.`,
      '',
      `Você já concluiu ${s.journey.progressPercent}% do curso de ${s.course} — faltam ${remaining} período(s) para a formação prevista em ${s.journey.completionForecast}.`,
      '',
      'Quero te mostrar o que já está disponível para quem chegou até aqui: oportunidades de estágio, projetos de extensão e o programa de empregabilidade com nossas empresas parceiras.',
      '',
      'Consegue 10 minutos esta semana para a gente olhar isso juntos?',
    ].join('\n'),
    phone: [
      `Abertura: "${name}, liguei para falar do seu futuro no curso, não de pendência."`,
      `Reconhecimento: nomear o que já foi conquistado — ${s.journey.progressPercent}% do curso, disciplinas vencidas, esforço investido.`,
      'Pergunta-chave: "O que te fez escolher esse curso? Isso ainda faz sentido pra você hoje?" — e ouvir de verdade.',
      'Conectar: estágio, extensão, monitoria remunerada, laboratórios e parcerias ligadas à área dele.',
      `Fechamento: combinar um próximo passo concreto e agendar a retomada em ${s.modality === 'Presencial' ? 'campus' : 'chamada'}.`,
    ],
    inPerson: [
      'Convidar para o Centro de Sucesso ao Aluno — o ambiente comunica pertencimento.',
      'Apresentar a trilha do curso e onde ele está nela, visualmente.',
      'Conectar com um veterano ou egresso da mesma área quando possível.',
      'Encaminhar para a Central de Carreiras e registrar o interesse.',
      'Registrar o acordo de continuidade e agendar o acompanhamento.',
    ],
    evidence,
    fit,
  };
}

/* -- Public API ----------------------------------------------------------- */

export function generateApproaches(student: Student, kase?: Case): Briefing {
  const evidence = evidenceFor(student);
  const fits = fitScores(student);
  const drop = accessDropPercent(student);
  const name = firstName(student.name);

  const approaches = [
    pedagogica(student, fits.pedagogica, evidence),
    financeira(student, fits.financeira, evidence),
    carreira(student, fits.carreira, evidence),
  ].sort((a, b) => b.fit - a.fit);

  const hypotheses: string[] = [];
  if (student.financial.overdueCount > 0) {
    hypotheses.push(
      `Restrição financeira: ${student.financial.overdueCount} parcela(s) em aberto há ${student.financial.daysOverdue} dias.`,
    );
  }
  if (drop >= 25 && student.academic.attendancePercent >= 85) {
    hypotheses.push(
      'Mudança de rotina externa: presença física preservada mas queda no estudo digital sugere alteração de trabalho ou de horário.',
    );
  }
  if (student.academic.failingSubjects > 0 || student.academic.gpa < 6.5) {
    hypotheses.push('Dificuldade de conteúdo: desempenho abaixo do esperado em disciplina específica.');
  }
  if (student.engagement.lastAccessDaysAgo >= 10) {
    hypotheses.push('Desconexão progressiva: ausência prolongada sem gatilho financeiro identificado.');
  }
  if (student.engagement.visitedCancellationPage) {
    hypotheses.push('Intenção de saída já formada — a decisão está em curso, não em cogitação.');
  }
  if (hypotheses.length === 0) {
    hypotheses.push('Sem causa-raiz evidente nos dados: o contato é de acompanhamento e escuta preventiva.');
  }

  const doNot = [
    'Não abrir a conversa pela pendência financeira nem pelo número do Health Score.',
    'Não prometer abono de falta, isenção ou desconto que não esteja pré-autorizado.',
    'Não repassar o aluno sem antes registrar o contexto no caso.',
  ];
  if (student.engagement.visitedCancellationPage) {
    doNot.push('Não mencionar que o sistema detectou a visita à página de trancamento.');
  }
  if (student.cohort === 'Calouro') {
    doNot.push('Não tratar como risco de evasão: é calouro em adaptação, a régua é de acolhimento.');
  }

  const topFactor = approaches[0];
  const headline =
    student.cohort === 'Calouro'
      ? `${name} está em onboarding — abordagem de acolhimento, não de retenção`
      : `Abertura recomendada: ${topFactor.label.toLowerCase()}`;

  const summary = [
    `${student.name} (${student.ra}) · ${student.course} · ${student.period}º período · ${student.modality}.`,
    `Health Score ${student.healthScore}/100 (${student.status}), tendência ${
      student.trend === 'up' ? 'de recuperação' : student.trend === 'down' ? 'de queda' : 'estável'
    }.`,
    kase
      ? `Caso ${kase.protocol} aberto pelo ${kase.radar === 'evasao' ? 'Radar de Evasão' : `radar de ${kase.radar}`}: ${kase.signals[0] ?? kase.diagnosis}.`
      : 'Contato proativo sem caso vinculado.',
    `Melhor ângulo de entrada pelos dados: ${topFactor.label} (${topFactor.fit}% de aderência).`,
  ].join(' ');

  return { headline, summary, rootCauseHypotheses: hypotheses, doNot, approaches };
}

/** Picks the script text for a given approach and channel. */
export function scriptFor(approach: Approach, channel: Channel): string {
  if (channel === 'WhatsApp' || channel === 'E-mail' || channel === 'Portal') {
    return approach.whatsapp;
  }
  const steps = channel === 'Presencial' ? approach.inPerson : approach.phone;
  return steps.map((step, i) => `${i + 1}. ${step}`).join('\n');
}

/** Builds a wa.me deep link with the script pre-filled. */
export function whatsappLink(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, '');
  const withCountry = clean.startsWith('55') ? clean : `55${clean}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

export function telLink(phone: string): string {
  return `tel:+55${phone.replace(/\D/g, '')}`;
}

export function mailLink(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
