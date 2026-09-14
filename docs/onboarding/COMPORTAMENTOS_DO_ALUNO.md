# Onboarding · catálogo de comportamentos do aluno

Tudo o que o aluno **faz ou deixa de fazer** e que a operação pode ler como sinal. A lista está
para ser cortada: marque `[x]` no que entra, risque o que sai, escreva o que falta.

> **Como ler cada linha.** `Sinal` é o campo do sistema que já responde por aquele
> comportamento — quando está vazio, o comportamento existe na vida e **não existe no dado**, e
> isso está marcado com ⚠️. `Janela` é quando o comportamento importa. `Ação` é o que a operação
> faz hoje, ou o que propomos.
>
> **Números da base de hoje:** 54 alunos, 9 calouros (6 híbridos, 3 presenciais), 45 veteranos.
> 53 com app instalado, 18 com grade cadastrada, 2 com turma definida.

| Família | Comportamentos | Já tem sinal | Sem dado |
|---|---:|---:|---:|
| A · Chegada e acesso | 10 | 4 | 6 |
| B · Reconhecimento | 6 | 2 | 4 |
| C · Estudo no AVA | 9 | 7 | 2 |
| D · Presença | 7 | 3 | 4 |
| E · Ritmo e sumiço | 7 | 6 | 1 |
| F · Avaliação | 8 | 5 | 3 |
| G · Prazos administrativos | 7 | 1 | 6 |
| H · Financeiro | 8 | 8 | 0 |
| I · Relacionamento | 8 | 6 | 2 |
| J · Risco e saída | 7 | 5 | 2 |
| K · Sinais positivos | 6 | 5 | 1 |
| **Total** | **83** | **52** | **31** |

---

## A · Chegada e acesso

O que separa «matriculado» de «aluno». Nos primeiros dias é a única coisa que existe para ler.

| # | Comportamento | Sinal | Janela | Ação proposta | |
|---|---|---|---|---|---|
| A1 | Assinou contrato e entregou documentos | ⚠️ sem dado | D0 | passo bloqueante da trilha | [ ] |
| A2 | **Não** entregou documento pendente | ⚠️ sem dado | D0 a D30 | contato humano antes da aula 1 | [ ] |
| A3 | Instalou o app | `engagement.appInstalled` | sempre | sem app, nada chega: é a 1ª pergunta do atendente | [ ] |
| A4 | **Não** instalou o app | mesmo campo | sempre | push é impossível; vai por WhatsApp e e-mail | [ ] |
| A5 | Aceitou receber notificação | ⚠️ sem dado | D0 a D7 | app instalado com push negado é app mudo | [ ] |
| A6 | Fez o primeiro acesso ao portal | ⚠️ sem dado | D0 a D14 | passo bloqueante | [ ] |
| A7 | Trocou a senha provisória | ⚠️ sem dado | D0 a D14 | é onde trava mais gente do que se imagina | [ ] |
| A8 | Fez o primeiro acesso ao AVA | `engagement.lastAccessDaysAgo` | D0 a D30 | `ACO-02` dispara com 5 dias sem acesso | [ ] |
| A9 | Abriu o boleto e viu o vencimento | ⚠️ sem dado | D0 a D30 | passo não bloqueante | [ ] |
| A10 | Matriculou-se **depois** do início das aulas | `enrolledAt` + `classesStart` | contínua | trilha do «já perdi coisas», sem contagem regressiva | [ ] |

**Falta alguma?** `____`

---

## B · Reconhecimento

O aluno saber onde ele estuda, quando e com quem. É a família mais invisível e a que mais gera
ligação para o suporte.

| # | Comportamento | Sinal | Janela | Ação proposta | |
|---|---|---|---|---|---|
| B1 | Consultou «Horários das Aulas» no app | ⚠️ sem dado | véspera do dia 1 | passo bloqueante da trilha | [ ] |
| B2 | Reconheceu a própria turma | `Student.turma` (2 de 54) | véspera | sem isso, a trilha não resolve «21 ou 22/08» | [ ] |
| B3 | Sabe o prédio e a sala | ⚠️ sem dado | véspera | a trilha diz que não sabe e manda para o app | [ ] |
| B4 | Sabe o nome das disciplinas do módulo | `academic.disciplines` (18 de 54) | primeiras 2 semanas | é o insumo da tradução | [ ] |
| B5 | Sabe quem é o coordenador do curso | ⚠️ sem dado | primeiras 4 semanas | candidato a passo novo da trilha | [ ] |
| B6 | Sabe a diferença entre portal, app e AVA | ⚠️ sem dado | primeiras 2 semanas | a ambientação on-line existe para isto | [ ] |

**Falta alguma?** `____`

---

## C · Estudo no AVA

| # | Comportamento | Sinal | Janela | Ação proposta | |
|---|---|---|---|---|---|
| C1 | Entrou no AVA pela primeira vez | `lastAccessDaysAgo` | D0 a D30 | marca o passo como feito | [ ] |
| C2 | Baixou o e-book da 1ª disciplina | ⚠️ sem dado | liberação (31/07) | híbrido e EaD; 1º momento em que o AVA vira concreto | [ ] |
| C3 | Entregou a primeira atividade no prazo | `deliveryRate` / `lateAssignments` | primeiras 4 semanas | **o comportamento que mais prevê o semestre** | [ ] |
| C4 | Atrasou a primeira entrega | `academic.lateAssignments` | primeiras 4 semanas | contato de acolhimento, não cobrança | [ ] |
| C5 | Tem atividade pendente acumulando | `Discipline.pendingActivities` | contínua | `ENG-04` com taxa de entrega abaixo de 60% | [ ] |
| C6 | Taxa de entrega abaixo de 60% | `engagement.deliveryRate` | contínua | push + fila de onboarding | [ ] |
| C7 | Participou de fórum | `engagement.forumInteractions` | contínua | sinal fraco sozinho, bom em conjunto | [ ] |
| C8 | Horas semanais no AVA abaixo do esperado | `engagement.weeklyHours` | contínua | compõe o Health Score | [ ] |
| C9 | Assistiu à aula ao vivo (Ponto a Ponto) | ⚠️ sem dado | contínua | o calendário cita, o sistema não lê | [ ] |

**Falta alguma?** `____`

---

## D · Presença

| # | Comportamento | Sinal | Janela | Ação proposta | |
|---|---|---|---|---|---|
| D1 | Compareceu ao primeiro dia de aula | ⚠️ sem dado | dia 1 | a falta no dia 1 é o sinal mais forte que existe | [ ] |
| D2 | Faltou no primeiro dia | ⚠️ sem dado | dia 1 | contato humano em 24h | [ ] |
| D3 | Participou da integração | passo da trilha, sem evidência ⚠️ | primeiras 2 semanas | hoje marcado à mão | [ ] |
| D4 | Compareceu ao primeiro encontro presencial (híbrido) | ⚠️ sem dado | conforme o ritmo | `ENG-05` avisa na véspera, ninguém confere depois | [ ] |
| D5 | Frequência entre 75% e 80% | `academic.attendancePercent` | contínua | `ACD-01`, tom de atenção | [ ] |
| D6 | Frequência abaixo de 75% | mesmo campo | contínua | `ACD-02`, tom de conversa | [ ] |
| D7 | Queda de frequência em relação ao ciclo anterior | `attendancePrevPercent` | contínua | é o que torna «queda» mensurável, não opinião | [ ] |

**Falta alguma?** `____`

---

## E · Ritmo e sumiço

A família mais bem servida de dado hoje.

| # | Comportamento | Sinal | Janela | Ação proposta | |
|---|---|---|---|---|---|
| E1 | 5 dias sem acessar, sendo calouro | `lastAccessDaysAgo` | D0 a D30 | `ACO-02` | [ ] |
| E2 | 7 a 13 dias sem acessar | `lastAccessDaysAgo` | contínua | `ENG-01` | [ ] |
| E3 | 14 dias ou mais sem acessar | `lastAccessDaysAgo` | contínua | `ENG-02` + fila | [ ] |
| E4 | Acessos caíram 40% ou mais | `accessesLast30Days` vs `Prev30Days` | contínua | `ENG-03` | [ ] |
| E5 | Curva de acesso em queda contínua | `engagement.accessTrend` (8 semanas) | contínua | alimenta o radar de engajamento | [ ] |
| E6 | Voltou a acessar depois do sumiço | `accessTrend` | contínua | **reconhecimento**, não silêncio | [ ] |
| E7 | Estuda só em bloco, na véspera da prova | ⚠️ sem dado | contínua | derivável da curva; vale como sinal? | [ ] |

**Falta alguma?** `____`

---

## F · Avaliação

| # | Comportamento | Sinal | Janela | Ação proposta | |
|---|---|---|---|---|---|
| F1 | Vai fazer a primeira prova da vida universitária | coorte + calendário | D0 a D60 | `ACO-06`, 3 dias antes | [ ] |
| F2 | Faltou a uma prova | ⚠️ sem dado | **48 horas** | o push reativo de maior valor do sistema | [ ] |
| F3 | Pediu substitutiva dentro da janela | ⚠️ sem dado | 48h | confirmar recebimento fecha o ciclo | [ ] |
| F4 | Perdeu a janela de 48 horas | ⚠️ sem dado | após 48h | não há o que avisar; há o que aprender | [ ] |
| F5 | Nota abaixo de 6 em alguma disciplina | `Discipline.grade` | por bimestre | `ACD-03` + convite à monitoria | [ ] |
| F6 | Média geral abaixo de 6 sendo calouro | `academic.gpa` | primeiro bimestre | `ACO-04` | [ ] |
| F7 | Tem disciplina em recuperação | `academic.failingSubjects` | fim de bimestre | `ACD-06` | [ ] |
| F8 | Disciplina dispensada | `Discipline.exempted` | contínua | a data **aparece marcada**, não some | [ ] |

**Falta alguma?** `____`

---

## G · Prazos administrativos

Os assassinos silenciosos: nenhuma aula lembra e nenhum professor menciona. São 5 a 8 linhas de
`prazo` por calendário, e as que mais travam formatura.

| # | Comportamento | Sinal | Janela | Ação proposta | |
|---|---|---|---|---|---|
| G1 | Tem DP pendente e não se inscreveu | `academic.dependencies` | fecha **21/08** | `ACD-04`; irrecuperável | [ ] |
| G2 | Não protocolou Atividades Complementares | ⚠️ sem dado | fecha **07/12** | `ACD-07` acima de 60% do curso | [ ] |
| G3 | Deve horas de Prática Extensionista | ⚠️ sem dado | fecha **23/11** | o calendário manda conferir no app; quase ninguém confere | [ ] |
| G4 | Não fez atividade do Bagagem | ⚠️ sem dado | fecha 07/12 | relevância média hoje | [ ] |
| G5 | Não se candidatou a representante de classe | ⚠️ sem dado | 04 a 31/08 | interesse, não consequência | [ ] |
| G6 | Não se inscreveu na monitoria | ⚠️ sem dado | 20/07 a 10/08 | família `programa`, recolhida por padrão | [ ] |
| G7 | Não fez rematrícula na janela | ⚠️ sem dado | fim do semestre | `RET-04`; irrecuperável quando houver prazo | [ ] |

**Falta alguma?** `____`

---

## H · Financeiro

A única família com cobertura de dado completa.

| # | Comportamento | Sinal | Janela | Ação proposta | |
|---|---|---|---|---|---|
| H1 | Em dia | `financial.situation` | mensal | `FIN-01`, 3 dias antes do vencimento | [ ] |
| H2 | 1 parcela em atraso, dentro da janela preventiva | `insidePreventiveWindow` | mensal | `FIN-02`, tom de lembrete | [ ] |
| H3 | 2 ou mais parcelas em atraso | `overdueCount` | mensal | `FIN-03`, convite a negociar | [ ] |
| H4 | Negociação firmada | `hasNegotiation` | conforme acordo | `FIN-04`, lembrete da parcela do acordo | [ ] |
| H5 | Sem bolsa e com atraso | `scholarshipPercent` | contínua | `FIN-05`, apresenta financiamento | [ ] |
| H6 | Bolsista integral | `scholarshipPercent` | contínua | nenhum aviso de cobrança, nunca | [ ] |
| H7 | Dias de atraso na parcela mais antiga | `daysOverdue` | contínua | alimenta o radar preventivo | [ ] |
| H8 | Atraso + sumiço no AVA ao mesmo tempo | dois campos | contínua | o par mais preditivo de evasão | [ ] |

**Falta alguma?** `____`

---

## I · Relacionamento

| # | Comportamento | Sinal | Janela | Ação proposta | |
|---|---|---|---|---|---|
| I1 | Recebeu o push | `PushDispatch.status = Enviado` | por disparo | é o recibo institucional | [ ] |
| I2 | Abriu o push | `status = Aberto` | por disparo | «entregue às 09h00, aberto às 12h47» | [ ] |
| I3 | Não recebeu (sem app) | `status = Não entregue` | por disparo | 1ª coisa que o atendente precisa saber | [ ] |
| I4 | Nunca abre push de uma categoria | derivável ⚠️ | 30 dias | calibra o teto semanal | [ ] |
| I5 | Procurou o atendimento por conta própria | `Interaction` | contínua | sinal positivo, lido como negativo hoje | [ ] |
| I6 | Não responde a contato | `InteractionOutcome = Sem contato` | por caso | muda o canal, não repete o mesmo | [ ] |
| I7 | Recusou atendimento | `InteractionOutcome` | por caso | respeitar e registrar | [ ] |
| I8 | Tem canal de preferência | ⚠️ sem dado | contínua | hoje o canal é escolhido pelo atendente | [ ] |

**Falta alguma?** `____`

---

## J · Risco e saída

| # | Comportamento | Sinal | Janela | Ação proposta | |
|---|---|---|---|---|---|
| J1 | Visitou a página de cancelamento | `visitedCancellationPage` | imediata | `RET-02`; o sinal mais direto que existe | [ ] |
| J2 | Health Score caiu 10 pontos em 30 dias | `scoreDelta30d` | 30 dias | `RET-01` | [ ] |
| J3 | Health Score abaixo de 40 | `healthScore` | contínua | `RET-03`, convite ao atendimento | [ ] |
| J4 | Pediu trancamento | ⚠️ sem dado | imediata | caso de retenção com SLA próprio | [ ] |
| J5 | Pediu transferência para outra instituição | ⚠️ sem dado | imediata | idem | [ ] |
| J6 | Sumiu antes da primeira aula | `enrolledAt` + acesso zero | pré-início | **a evasão que ninguém mede hoje** | [ ] |
| J7 | Calouro travado: 3+ passos abertos após 30 dias | `onboardingSteps` | D30 a D90 | `ACO-03` | [ ] |

**Falta alguma?** `____`

---

## K · Sinais positivos

O sistema hoje é quase todo feito de alerta. Reconhecimento é barato e sustenta o canal.

| # | Comportamento | Sinal | Janela | Ação proposta | |
|---|---|---|---|---|---|
| K1 | Frequência igual ou acima de 95% | `attendancePercent` | por bimestre | `REC-01` | [ ] |
| K2 | Recuperou ritmo (+10 no score) | `scoreDelta30d` | 30 dias | `REC-02` | [ ] |
| K3 | Chegou à metade do curso | `journey.progressPercent` | marco | `REC-03` | [ ] |
| K4 | Concluiu todos os passos da trilha | `onboardingSteps` | D0 a D90 | tela de conclusão + aposentadoria visível | [ ] |
| K5 | Entregou tudo no prazo no bimestre | `deliveryRate` | por bimestre | candidato a reconhecimento novo | [ ] |
| K6 | Virou monitor | ⚠️ sem dado | por bimestre | candidato a reconhecimento novo | [ ] |

**Falta alguma?** `____`

---

## Decisões que este catálogo pede

**C-01 · Os 31 comportamentos sem dado.** Entram na lista mesmo assim, para virar requisito de
integração, ou saem até existir o dado?
- [ ] entram marcados &nbsp;&nbsp; [ ] saem &nbsp;&nbsp; [ ] outro: `____`

**C-02 · Quais cinco comportamentos importam mais nos primeiros 30 dias?**
*Proposta:* A4 (sem app), A8 (nunca entrou no AVA), D2 (faltou no dia 1), C3 (primeira entrega)
e J6 (sumiu antes de começar).
- [ ] confirmo &nbsp;&nbsp; [ ] outros: `____`

**C-03 · Quais viram push automático e quais viram contato humano?**
*Proposta:* tudo o que tem saída clara vira push; A2, D2, J4, J5 e J6 exigem pessoa.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**C-04 · A fila de «travados» do Onboarding 90 dias usa hoje três critérios:**
5+ dias sem acesso, 3 ou menos passos concluídos, ou taxa de entrega abaixo de 50%.
- [ ] confirmo &nbsp;&nbsp; [ ] outros critérios: `____`

**C-05 · Os seis rótulos de onboarding de hoje são idênticos para os 54 alunos.**
A trilha propõe doze passos que variam por modalidade e por faixa.
- [ ] migrar para os doze &nbsp;&nbsp; [ ] manter os seis &nbsp;&nbsp; [ ] outro: `____`

**C-06 · Um comportamento pode disparar no máximo quantos contatos por semana?**
*Proposta:* o mesmo teto de 3 da régua de calendário, contado junto.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**C-07 · O que este catálogo não cobre e deveria?**
- [ ] `____`

---

**Documentos irmãos**

- [../PERGUNTAS_TRILHA_DO_ALUNO.md](../PERGUNTAS_TRILHA_DO_ALUNO.md) — o que aparece no app de cada aluno
- [../push/00_INDICE_E_TRONCO_COMUM.md](../push/00_INDICE_E_TRONCO_COMUM.md) — os onze calendários
