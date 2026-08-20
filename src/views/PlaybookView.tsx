import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Ban,
  BookMarked,
  Check,
  ChevronDown,
  Copy,
  ListOrdered,
  MessageSquareQuote,
  Target,
} from 'lucide-react';
import type { RadarKey } from '../types';
import type { ShellActions } from '../App';
import { useApp } from '../state/AppContext';
import { collapseVariants, pageVariants } from '../lib/motion';
import { Callout, Card, CardHeader, PageHeader, SectionLabel } from '../components/ui/Surfaces';
import { Button, LinkButton } from '../components/ui/Button';
import { Pill, RadarBadge } from '../components/ui/Badges';
import { RADARS } from '../lib/radars';

/* ==========================================================================
   Playbook
   --------------------------------------------------------------------------
   The operating manual, kept next to the work instead of in a shared drive.
   Each protocol declares the objective, the ordered steps, the script and — the
   part usually missing from playbooks — what NOT to do, because most failed
   retention calls fail in the first sentence.
   ========================================================================== */

interface Protocol {
  radar: RadarKey;
  title: string;
  when: string;
  objective: string;
  steps: string[];
  script: string;
  doNot: string[];
  register: string;
}

const PROTOCOLS: Protocol[] = [
  {
    radar: 'evasao',
    title: 'Intenção de saída, trancamento ou cancelamento',
    when: 'Sinais combinados: ausência prolongada, inadimplência e consulta ao trancamento.',
    objective:
      'Entender a causa real antes de qualquer proposta e, se houver caminho, construir a alternativa junto com o aluno.',
    steps: [
      'Ativar o Freio Concorrente antes do primeiro contato — o aluno não pode receber cobrança automática no meio da conversa.',
      'Ler o dossiê 360° inteiro. Chegar sabendo o nome da disciplina crítica e o valor exato em aberto.',
      'Abrir por escuta: "liguei para entender seu momento", nunca por "identificamos uma pendência".',
      'Mapear a causa-raiz: financeira, acadêmica, de rotina, de saúde ou de propósito.',
      'Apresentar apenas as opções pré-autorizadas: repactuação, transferência de turno, plano de estudos, migração de modalidade.',
      'Fechar com um compromisso datado e registrar o caso com follow-up obrigatório em até 72 horas.',
    ],
    script:
      'Olá [Nome], sou [Especialista] do Centro de Sucesso ao Aluno da UniAnchieta. Antes de qualquer trâmite, fiz questão de falar com você para entender seu momento e ver o que a gente consegue construir junto para você seguir na graduação sem sobrecarregar sua rotina. Você tem uns minutos agora?',
    doNot: [
      'Não mencionar que o sistema detectou a visita à página de trancamento.',
      'Não abrir pelo valor da dívida nem pelo Health Score.',
      'Não prometer isenção ou abono que não esteja pré-autorizado.',
      'Não encerrar o caso sem follow-up agendado.',
    ],
    register:
      'Causa-raiz na fala do aluno · opções apresentadas · o que ele aceitou · data do retorno combinado.',
  },
  {
    radar: 'academico',
    title: 'Queda de desempenho e risco de reprovação',
    when: 'Duas ou mais disciplinas abaixo de 5,0, faltas no limite regimental ou dependência acumulada.',
    objective:
      'Transformar um boletim ruim em um plano de recuperação concreto, com uma primeira ação datada.',
    steps: [
      'Identificar a disciplina crítica — uma, não o boletim inteiro. Foco vence dispersão.',
      'Verificar se o problema é de conteúdo (nota baixa com presença alta) ou de rotina (presença em queda).',
      'Ativar monitoria e plantão de dúvidas da disciplina específica.',
      'Se houver risco de reprovação por frequência, informar explicitamente quantas faltas restam.',
      'Levar à coordenação as alternativas estruturais: reposição, transferência de turma, ajuste de turno.',
      'Fechar com uma única primeira tarefa pequena e verificável.',
    ],
    script:
      'Olá [Nome]! Aqui é do Centro de Sucesso ao Aluno. Estou acompanhando sua turma de [Curso] e vi que [Disciplina] pode estar pedindo mais atenção neste bimestre. Temos monitoria gratuita e conseguimos montar um plano de estudos com a coordenação, ajustado ao horário que funciona para você. Qual o melhor dia para conversarmos 10 minutos?',
    doNot: [
      'Não listar todas as notas baixas de uma vez — o aluno desliga.',
      'Não usar tom de advertência regimental antes de oferecer apoio.',
      'Não encerrar sem uma tarefa concreta e datada.',
    ],
    register:
      'Disciplina priorizada · dificuldade relatada · apoio ativado · primeira entrega combinada e data.',
  },
  {
    radar: 'engajamento',
    title: 'Desengajamento no AVA',
    when: 'Sete dias ou mais sem login, queda superior a 40% nos acessos ou duas entregas consecutivas perdidas.',
    objective:
      'Reduzir o atrito que está impedindo o acesso e recolocar o aluno no ritmo do módulo.',
    steps: [
      'Verificar se é problema de acesso (navegação, senha, dispositivo) ou de rotina (tempo, prioridade).',
      'Enviar o link direto do módulo em atraso — nunca "acesse o AVA".',
      'Se for calouro, abrir a plataforma junto com o aluno pelo celular e instalar o app na chamada.',
      'Reforçar o prazo real da próxima entrega e o que exatamente precisa ser feito esta semana.',
      'Agendar verificação de novo login em até 5 dias.',
    ],
    script:
      'Olá [Nome]! Aqui é do Centro de Sucesso ao Aluno da UniAnchieta. Passando para saber como está o seu módulo — sem cobrança, é conversa mesmo. Notei que faz alguns dias que você não acessa o AVA e quero garantir que não é nada travando por lá. Preciso te mandar o link direto da atividade desta semana?',
    doNot: [
      'Não escrever "você está com pendências" — soa como advertência.',
      'Não pedir que o aluno "procure no portal". Envie o caminho pronto.',
      'Não tratar híbrido como presencial: uma falta quinzenal não é abandono.',
    ],
    register:
      'Motivo da ausência · link enviado · apoio técnico prestado · data de verificação do novo acesso.',
  },
  {
    radar: 'financeiro',
    title: 'Mediação financeira preventiva',
    when: 'Primeiro atraso entre D+5 e D+20, recorrência ou negociação vencida sem confirmação.',
    objective:
      'Chegar a uma condição que o aluno consiga cumprir de verdade, preservando a matrícula.',
    steps: [
      'Atender em ambiente reservado — dado financeiro não se trata em área comum (LGPD).',
      'Abrir por solução, nunca por valor: "liguei para resolver, não para cobrar".',
      'Entender a causa: perda de renda, mudança de emprego, despesa inesperada, erro no boleto.',
      'Apresentar as condições pré-autorizadas e simular ao vivo 2 ou 3 cenários de parcelamento.',
      'Verificar bolsas internas, desconto de pontualidade e programas de financiamento aplicáveis.',
      'Emitir o documento na hora e enviar o resumo por escrito no canal do aluno.',
    ],
    script:
      'Olá [Nome]! Aqui é do Centro de Sucesso ao Aluno da UniAnchieta. Estou entrando em contato para te ajudar a resolver uma pendência da mensalidade antes que ela atrapalhe sua rematrícula — e isso a gente resolve junto. Consigo simular condições facilitadas e emitir o PIX ou boleto na hora com você. Pode ser hoje?',
    doNot: [
      'Não abrir a conversa pelo valor devido.',
      'Não citar cobrança externa como ameaça.',
      'Não desligar o Freio Concorrente antes do acordo ser cumprido.',
    ],
    register:
      'Causa da dificuldade · condição apresentada · condição aceita · data do primeiro pagamento.',
  },
  {
    radar: 'atendimento',
    title: 'Experiência, reclamação e reincidência',
    when: 'Avaliação abaixo de 6, protocolo há mais de 5 dias sem resposta ou dois chamados sobre o mesmo tema.',
    objective:
      'Fechar o ciclo com quem resolve, sem novo repasse, e recuperar a confiança institucional.',
    steps: [
      'Assumir o caso com o contexto 360° completo antes de falar com o aluno.',
      'Reconhecer a falha explicitamente. Reincidência sem reconhecimento vira pedido de saída.',
      'Levar a resolução, não o encaminhamento: o aluno já foi repassado antes.',
      'Confirmar com o aluno que o problema foi resolvido, não apenas registrado.',
      'Registrar a causa-raiz do atrito para que o processo seja corrigido, não só o caso.',
    ],
    script:
      'Olá [Nome]! Aqui é do Centro de Sucesso ao Aluno. Vi que você já procurou a gente sobre [Assunto] e que isso não foi resolvido como deveria — a falha foi nossa. Assumi o seu caso pessoalmente e vou acompanhar até o fim. Me confirma o que ainda está pendente para eu resolver hoje?',
    doNot: [
      'Não repassar o aluno para outro setor sem antes registrar o contexto.',
      'Não justificar a demora com processo interno.',
      'Não encerrar sem confirmação do próprio aluno.',
    ],
    register:
      'Assunto reincidente · falha identificada no processo · resolução entregue · confirmação do aluno.',
  },
];

export function PlaybookView({ actions }: { actions: ShellActions }) {
  const { toast, settings } = useApp();
  const [open, setOpen] = useState<RadarKey | null>('evasao');
  const [copied, setCopied] = useState<RadarKey | null>(null);

  const copy = async (protocol: Protocol) => {
    try {
      await navigator.clipboard.writeText(protocol.script);
      setCopied(protocol.radar);
      window.setTimeout(() => setCopied(null), 1800);
      toast('success', 'Roteiro copiado', 'Ajuste os campos entre colchetes antes de enviar.');
    } catch {
      toast('warning', 'Não foi possível copiar', 'Selecione o texto manualmente.');
    }
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Manual operacional"
        title="Playbook de atendimento"
        description="Um protocolo por radar, com objetivo, passo a passo, roteiro pronto e — o que costuma faltar — a lista do que não fazer. A maioria dos contatos de retenção se perde na primeira frase."
        actions={
          <Button
            variant="secondary"
            iconRight={<ArrowRight className="h-3.5 w-3.5" />}
            onClick={() => actions.goto('fila')}
          >
            Ir para a fila
          </Button>
        }
      />

      {/* The universal rule */}
      <Card tone="band" padded={false}>
        <div className="relative p-5 sm:p-6">
          <CardHeader
            eyebrow="Regra de contato humano"
            title="Motivo → Objetivo → Abordagem → Resultado → Próxima ação"
            subtitle="Todo contato segue esta sequência. O atendente não recebe apenas um alerta: recebe contexto, objetivo e recomendação."
          />
          <div className="relative mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { n: '01', label: 'Motivo', detail: 'Por que este aluno apareceu na fila.' },
              { n: '02', label: 'Objetivo', detail: 'O que precisa mudar depois desta conversa.' },
              { n: '03', label: 'Abordagem', detail: 'Por qual ângulo abrir, e por qual canal.' },
              { n: '04', label: 'Resultado', detail: 'O que ficou combinado, na fala do aluno.' },
              { n: '05', label: 'Próxima ação', detail: 'Quando e como verificar se funcionou.' },
            ].map((step) => (
              <div
                key={step.n}
                className="rounded-lg bg-band-inset p-3.5"
              >
                <p className="font-mono text-[10px] font-semibold tracking-[0.1em] text-band-ink-2">
                  {step.n}
                </p>
                <p className="mt-1.5 text-[13px] font-semibold text-band-ink">{step.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-band-ink-2">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Protocols */}
      <div className="space-y-3">
        <SectionLabel>Protocolos por radar</SectionLabel>

        {PROTOCOLS.map((protocol) => {
          const isOpen = open === protocol.radar;
          const radar = RADARS[protocol.radar];

          return (
            <Card key={protocol.radar} padded={false} className="overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : protocol.radar)}
                className="flex w-full items-start justify-between gap-4 p-5 text-left transition-colors hover:bg-surface-hover"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <RadarBadge radar={protocol.radar} full />
                    <Pill dot={false} mono>
                      SLA {settings.slaHours[protocol.radar]}h úteis
                    </Pill>
                    <Pill dot={false}>{radar.specialty}</Pill>
                  </div>
                  <h3 className="mt-2 text-[15px] leading-snug font-semibold text-ink">{protocol.title}</h3>
                  <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-3">
                    {protocol.when}
                  </p>
                </div>

                <span className="flex shrink-0 items-center gap-2 pt-1">
                  <span className="hidden font-mono text-[10.5px] font-semibold text-ink-4 sm:block">
                    {isOpen ? 'recolher' : 'ver protocolo'}
                  </span>
                  <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="h-4 w-4 text-ink-4" />
                  </motion.span>
                </span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    variants={collapseVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="overflow-hidden border-t border-hairline bg-surface-2"
                  >
                    <div className="space-y-5 p-5">
                      <Callout tone="info" icon={<Target className="h-3.5 w-3.5" />} title="Objetivo do contato">
                        {protocol.objective}
                      </Callout>

                      <div>
                        <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink-4">
                          <ListOrdered className="h-3.5 w-3.5" />
                          Passo a passo
                        </p>
                        <ol className="mt-3 space-y-2">
                          {protocol.steps.map((step, i) => (
                            <li key={step} className="flex gap-3">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface font-mono text-[10px] font-semibold text-ink-3">
                                {i + 1}
                              </span>
                              <span className="text-[12.5px] leading-relaxed text-ink-2">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink-4">
                              <MessageSquareQuote className="h-3.5 w-3.5" />
                              Roteiro de abertura
                            </p>
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => copy(protocol)}
                              icon={
                                copied === protocol.radar ? (
                                  <Check className="h-3 w-3 text-ok" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )
                              }
                            >
                              {copied === protocol.radar ? 'Copiado' : 'Copiar'}
                            </Button>
                          </div>
                          <div className="mt-2.5 rounded-lg bg-surface p-4">
                            <p className="text-[12.5px] leading-relaxed text-ink-2">
                              “{protocol.script}”
                            </p>
                          </div>
                          <p className="mt-2 text-[11px] text-ink-4">
                            Substitua os campos entre colchetes. O Copiloto gera esta mensagem já
                            personalizada com os sinais reais do aluno.
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="relative overflow-hidden rounded-lg bg-surface-2 p-3.5 pl-4">
                            <span className="absolute inset-y-0 left-0 w-0.5 bg-crit" />
                            <p className="flex items-center gap-1.5 text-[11px] font-medium text-crit-ink">
                              <Ban className="h-3.5 w-3.5" />
                              Não fazer
                            </p>
                            <ul className="mt-2.5 space-y-1.5">
                              {protocol.doNot.map((d) => (
                                <li key={d} className="flex gap-2 text-[11.5px] leading-relaxed text-ink-2">
                                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-crit" />
                                  {d}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="rounded-lg bg-surface p-3.5">
                            <p className="text-[11px] font-medium text-ink-4">
                              Registro mínimo obrigatório
                            </p>
                            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-2">
                              {protocol.register}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
                        <Button
                          size="sm"
                          variant="secondary"
                          iconRight={<ArrowRight className="h-3.5 w-3.5" />}
                          onClick={() => actions.goto('radares', protocol.radar)}
                        >
                          Abrir {radar.label}
                        </Button>
                        <LinkButton onClick={() => actions.goto('fila')}>
                          Ver casos deste radar na fila
                        </LinkButton>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>

      {/* Governance reminders */}
      <Card>
        <CardHeader
          eyebrow="Regras de proteção"
          title="O que sustenta a operação"
          subtitle="Sem governança o modelo não é sustentável, e a tecnologia passa a substituir o julgamento humano nos casos em que ele mais importa."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              risk: 'Excesso de alertas',
              guard: 'Poucos radares no início, falsos positivos medidos e gatilhos revisados com dado.',
            },
            {
              risk: 'Health Score incorreto',
              guard: 'Motivos sempre visíveis e revisão humana disponível. É indicador, não sentença.',
            },
            {
              risk: 'Atendente virar vendedor',
              guard: 'Foco em causa, solução adequada e experiência — não em retenção a qualquer custo.',
            },
            {
              risk: 'Comunicação excessiva',
              guard: 'Freio Concorrente pausa réguas automáticas sempre que há atendimento humano aberto.',
            },
            {
              risk: 'IA decidindo sozinha',
              guard: 'O copiloto prepara e sugere. A decisão e o registro são sempre do especialista.',
            },
            {
              risk: 'Dados desatualizados',
              guard: 'Score recalculado a cada interação; origem e data de cada sinal ficam registradas.',
            },
          ].map((item) => (
            <div key={item.risk} className="rounded-lg bg-surface-2 p-3.5">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                <BookMarked className="h-3.5 w-3.5 text-ink-4" />
                {item.risk}
              </p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3">{item.guard}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-hairline pt-4">
          <LinkButton
            onClick={() => actions.goto('governanca')}
            iconRight={<ArrowRight className="h-3.5 w-3.5" />}
          >
            Configurar parâmetros em Governança
          </LinkButton>
        </div>
      </Card>
    </motion.div>
  );
}
