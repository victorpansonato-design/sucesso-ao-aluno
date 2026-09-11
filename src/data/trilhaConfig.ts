import type { TrilhaConfig, TrilhaStep } from '../types';

/* ==========================================================================
   Trilha de entrada — os passos e o que a operação ajusta
   --------------------------------------------------------------------------
   A régua de acolhimento de hoje tem seis rótulos («Contrato assinado»,
   «Primeiro acesso ao portal», …) e eles são IDÊNTICOS para os 54 alunos da
   base. Serve para a fila dos 90 dias, que só precisa saber quantos marcos
   faltam. Não serve para entregar ao aluno: o primeiro passo de quem estuda a
   distância não é o primeiro passo de quem entra no campus amanhã, e mandar os
   dois a mesma lista é o começo do «isso não é pra mim».

   DUAS DIMENSÕES, E AS DUAS IMPORTAM
   Cada passo declara em que MODALIDADES vale e em que FAIXAS de Δ aparece.

     · Modalidade é óbvia: o e-book da disciplina híbrida não existe para o
       presencial diurno.
     · Faixa é a que muda tudo. Quem se matriculou para começar em quatro meses
       não precisa reconhecer turma e horário — eles não existem ainda. Quem
       começa na semana que vem não precisa de nada além das cinco coisas que
       têm de estar prontas no primeiro dia.

   `done` aqui é sempre `false`. É gabarito, não estado: `buildSteps` em
   `lib/trilha.ts` devolve cópias com `done` e `evidence` preenchidos a partir
   dos sinais que o sistema realmente tem. Um passo marcado como concluído sem
   evidência seria a tela mentindo sobre o que sabe.
   ========================================================================== */

/** Todas as faixas. Explícito para o passo que vale em qualquer uma. */
const SEMPRE: TrilhaStep['bands'] = ['antecipada', 'confortavel', 'vespera', 'em-curso'];

/** Da véspera em diante — quando turma, horário e AVA já existem de verdade. */
const DA_VESPERA: TrilhaStep['bands'] = ['vespera', 'em-curso'];

/** Depois da matrícula processada, mas ainda antes de a rotina começar. */
const ANTES_DA_ROTINA: TrilhaStep['bands'] = ['confortavel', 'vespera', 'em-curso'];

const A_DISTANCIA: TrilhaStep['modalities'] = ['Híbrido', 'EaD'];

function step(s: Omit<TrilhaStep, 'done'>): TrilhaStep {
  return { ...s, done: false };
}

/**
 * Os passos, na ordem em que o aluno os cumpre.
 *
 * A ordem é a do caminho real, não a da importância: o boleto vem antes do AVA
 * porque é o que trava a matrícula, e a integração vem depois do horário porque
 * não dá para ir a um encontro sem saber onde ele é.
 */
export const TRILHA_STEPS: TrilhaStep[] = [
  step({
    id: 'contrato',
    title: 'Contrato assinado',
    action: 'Confirme que o contrato e os documentos foram aceitos na secretaria.',
    place: 'secretaria',
    bands: SEMPRE,
    modalities: [],
    blocking: true,
  }),
  step({
    id: 'app',
    title: 'Instale o app Grupo Anchieta',
    action: 'É por ele que chegam aviso de prova, prazo e mudança de sala.',
    place: 'app',
    bands: SEMPRE,
    modalities: [],
    blocking: true,
  }),
  step({
    id: 'portal',
    title: 'Primeiro acesso ao portal do aluno',
    action: 'Entre com o seu RA e troque a senha provisória.',
    place: 'portal',
    bands: SEMPRE,
    modalities: [],
    blocking: true,
  }),
  step({
    id: 'boleto',
    title: 'Confira o boleto e o dia do vencimento',
    action: 'Em «Cobranças a Pagar», no app. Guarde o dia do mês.',
    place: 'financeiro',
    bands: SEMPRE,
    modalities: [],
    blocking: false,
  }),
  step({
    id: 'ava',
    title: 'Entre no AVA',
    action: 'É onde ficam as aulas gravadas, os e-books e as entregas com prazo.',
    place: 'ava',
    bands: ANTES_DA_ROTINA,
    modalities: [],
    blocking: true,
  }),
  step({
    id: 'horarios',
    title: 'Confira seus horários e sua turma',
    action: 'Em «Horários das Aulas», no app. Confirme o dia, a hora e o prédio.',
    place: 'app',
    bands: DA_VESPERA,
    modalities: [],
    blocking: true,
  }),
  step({
    id: 'dp',
    title: 'Inscreva-se em DP ou Adaptação, se precisar',
    action: 'A janela fecha e não reabre. Se tem disciplina pendente, resolva agora.',
    place: 'secretaria',
    bands: SEMPRE,
    modalities: [],
    blocking: false,
  }),
  step({
    id: 'ebook',
    title: 'Baixe o e-book da primeira disciplina',
    action: 'O material é liberado no AVA antes do primeiro encontro.',
    place: 'ava',
    bands: DA_VESPERA,
    modalities: A_DISTANCIA,
    blocking: false,
  }),
  step({
    id: 'ambientacao',
    title: 'Participe da ambientação on-line',
    action: 'Uma hora que explica o AVA, a biblioteca virtual e como funciona o seu ritmo.',
    place: 'app',
    bands: DA_VESPERA,
    modalities: A_DISTANCIA,
    blocking: false,
  }),
  step({
    id: 'integracao',
    title: 'Participe da integração',
    action: 'Conheça o campus, a turma e quem procurar quando algo travar.',
    place: 'campus',
    bands: DA_VESPERA,
    modalities: [],
    blocking: false,
  }),
  step({
    id: 'extensionista',
    title: 'Entenda a Prática Extensionista',
    action: 'São horas obrigatórias para formar. Veja quantas faltam no app.',
    place: 'app',
    bands: ANTES_DA_ROTINA,
    modalities: [],
    blocking: false,
  }),
  step({
    id: 'primeira-entrega',
    title: 'Entregue a primeira atividade',
    action: 'A primeira entrega no prazo é o que mais prevê como o semestre vai correr.',
    place: 'ava',
    bands: ['em-curso'],
    modalities: [],
    blocking: false,
  }),
];

/* ==========================================================================
   O recorte
   ========================================================================== */

export const DEFAULT_TRILHA_CONFIG: TrilhaConfig = {
  steps: TRILHA_STEPS,

  /**
   * `programa` é a família de monitoria, Libras, Bagagem e eletivas.
   *
   * É exatamente a classe em que «importância é relativa» é verdade: interessa
   * muito a uns e nada a outros, e não há critério institucional que decida por
   * eles. Fica recolhida no recorte pessoal e INTEIRA no calendário completo,
   * contada no «N de M» — nunca apagada.
   *
   * O que não entra aqui, e é deliberado: `prazo`. Um prazo de Prática
   * Extensionista parece administrativo e chato, e é o que mais trava formatura.
   * Recolhê-lo por parecer chato é o erro que este produto existe para não
   * cometer.
   */
  collapsed: ['programa'],

  /**
   * Até onde o recorte olha à frente, por faixa.
   *
   * Zero na faixa antecipada não é um horizonte curto, é a ausência de
   * calendário: quem se matriculou para começar em quatro meses não tem
   * calendário publicado, e a tela diz isso em vez de mostrar as datas do
   * semestre errado.
   *
   * 45 dias em curso cobre o bloco de provas seguinte em qualquer um dos onze
   * ritmos — o quinzenal, que é o mais espaçado, tem encontro a cada 14 dias.
   */
  horizonDays: {
    antecipada: 0,
    confortavel: 30,
    vespera: 14,
    'em-curso': 45,
  },
};
