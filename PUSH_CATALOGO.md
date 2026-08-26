# Gestão de PUSH — catálogo para validação

> Documento gerado a partir dos dados do sistema (`src/data/academicCalendars.ts`,
> `src/data/pushCatalog.ts` e `src/lib/push.ts`). Tudo o que está aqui já está
> no ar na aba **Gestão de PUSH** e é editável pelo lápis — este arquivo existe
> para ser lido, riscado e devolvido, não para ser a fonte da verdade.

**Semestre:** 2026/2 · **Calendários:** 9 · **Linhas transcritas:** 491 · **Avisos gerados:** 625 · **Mensagens personalizadas:** 31

---

## 1. O que veio dos PDFs

A pasta `src/calendarios_academicos` tem **19 arquivos**, mas são **9 calendários**:
o mesmo PDF foi exportado várias vezes com nomes diferentes. A identificação foi
por hash do conteúdo — o nome do arquivo não diz nada (há calendário de veterano
salvo como "Ingressantes…" e vice-versa).

| # | Calendário | Modalidade | Público | Ritmo | Linhas | Avisos | Arquivo de origem |
|---|---|---|---|---|---|---|---|
| 1 | **Cursos Presencial de Direito · 2º semestre** | Presencial | Ingressante e veterano | Diário | 43 | 52 | `Curso Presencial Direito.pdf` |
| 2 | **Cursos Presencial (exceto Direito) · 2º semestre** | Presencial | Ingressante e veterano | Diário | 46 | 55 | `Cursos Presenciais Diurno-Noturno (1).pdf` |
| 3 | **Cursos Semanais (Ingressantes e Veteranos) — terças e quintas · 2º semestre** | Híbrido | Ingressante e veterano | Semanal | 58 | 74 | `Ingressantes de janeiro à dezembro de 2026 (18) (1).pdf` <br>*(+1 cópia idêntica)* |
| 4 | **Cursos Quinzenais às sextas e sábados — (ADS) Veteranos · 2º semestre** | Híbrido | Veterano | Quinzenal | 51 | 67 | `Veteranos (2) (1).pdf` |
| 5 | **Cursos Semanais aos sábados · 2º semestre** | Híbrido | Ingressante e veterano | Semanal | 61 | 76 | `Ingressantes de janeiro à dezembro de 2026 (20) (1).pdf` <br>*(+1 cópia idêntica)* |
| 6 | **Cursos Semanais às sextas e sábados (exceto Direito) · 2º semestre** | Híbrido | Ingressante e veterano | Semanal | 59 | 74 | `Ingressantes de janeiro à dezembro de 2026 (27) (1).pdf` <br>*(+1 cópia idêntica)* |
| 7 | **Curso de Direito às sextas e sábados · 2º semestre** | Híbrido | Ingressante e veterano | Semanal | 68 | 90 | `Ingressantes de janeiro à dezembro de 2026 (13).pdf` <br>*(+1 cópia idêntica)* |
| 8 | **Cursos Quinzenais — Ingressantes · 2º semestre** | Híbrido | Ingressante | Quinzenal | 55 | 71 | `Veteranos (15) (1).pdf` <br>*(+2 cópias idênticas)* |
| 9 | **Cursos Quinzenais — Veteranos · 2º semestre** | Híbrido | Veterano | Quinzenal | 50 | 66 | `Ingressantes de janeiro à dezembro de 2026 (10) (1).pdf` <br>*(+4 cópias idênticas)* |

## 2. ⚠️ Mapeamento curso × calendário — **precisa da sua validação**

Este é o único ponto do sistema em que eu chutei, e é o mais importante: é por
ele que o aluno é ligado à régua dele. O PDF diz o **ritmo dos encontros**
("quinzenais às sextas e sábados") e nunca diz **quais cursos**. A leitura abaixo
é a mais provável, mas se um curso estiver no calendário errado o aluno recebe
aviso de prova que não é dele.

Dá para corrigir direto na tela: **Gestão de PUSH → Calendários → abrir → aba Cursos**.

| Calendário | Cursos atribuídos (chute a validar) |
|---|---|
| **Presencial · Direito** | `Bacharelado em Direito` |
| **Presencial · demais cursos** | `Bacharelado em Ciências Contábeis` · `Bacharelado em Administração` · `Bacharelado em Psicologia` · `Bacharelado em Enfermagem` · `Bacharelado em Fisioterapia` · `Bacharelado em Nutrição` · `Bacharelado em Educação Física` · `Engenharia de Software` · `Engenharia Civil` · `Ciência da Computação` · `Bacharelado em Arquitetura e Urbanismo` |
| **Semanal · terças e quintas** | `Bacharelado em Administração` · `Bacharelado em Ciências Contábeis` |
| **Quinzenal · ADS veteranos** | `Tecnologia em Análise e Desenv. de Sistemas` |
| **Semanal · sábados** | `Licenciatura em Pedagogia` · `Engenharia de Software` · `Ciência da Computação` |
| **Semanal · sextas e sábados** | `Tecnologia em Logística` · `Tecnologia em Gestão de Recursos Humanos` · `Tecnologia em Gestão Financeira` |
| **Semanal · Direito sextas e sábados** | `Bacharelado em Direito` |
| **Quinzenal · ingressantes** | `Bacharelado em Enfermagem` · `Bacharelado em Nutrição` · `Tecnologia em Análise e Desenv. de Sistemas` |
| **Quinzenal · veteranos** | `Bacharelado em Enfermagem` · `Bacharelado em Nutrição` |

**Pistas que usei:**

- A *Cerimônia do Jaleco* aparece no presencial (exceto Direito) e no quinzenal de
  ingressantes → coloquei Enfermagem e Nutrição no quinzenal.
- O calendário quinzenal de veteranos de ADS é o único nominal → ADS veterano vai nele,
  e ADS ingressante cai no quinzenal genérico de ingressantes.
- Direito tem dois calendários próprios (presencial e sextas/sábados).
- O resto ficou distribuído por afinidade de área. **Confira curso a curso.**

> **Nota:** há um aluno na base de amostra (Alexandre Prado Vilela) matriculado em
> *Tecnologia em Análise e Desenv. de Sistemas* na modalidade **Presencial**, que o
> catálogo oferece só em Híbrido. Ele aparece na aba sem calendário atribuído. É uma
> inconsistência que já existia no `seed.ts`, anterior a esta aba.

## 3. Cadência da régua

Um aviso por evento relevante, na hora em que ainda dá para agir. Só o que custa
nota, dinheiro ou prazo ganha um segundo toque antecipado. Três toques em tudo
treinaria o aluno a silenciar o app — e aí perdemos o único canal que chega nele.

| Tipo de evento | Aviso principal | Reforço antecipado |
|---|---|---|
| **Avaliação** (P1, P2, substitutiva, recuperação, integrativa) | no dia, 07h00 | 3 dias antes, 09h00 |
| **Prazo** (DP, atividades complementares, extensão, Bagagem) | véspera do fim, 10h00 | 1 semana antes, 10h00 |
| **Aula / disciplina / encontro presencial** | véspera, 18h00 | — |
| **Feriado e recesso** | véspera, 17h00 | — |
| **Evento on-line** | no dia, 3h antes do evento | — |
| **Programa** (monitoria, extensão, Bagagem, Libras) | no dia da abertura, 09h00 | — |

Nenhum push sai antes das 07h30 nem depois das 21h00.

### Relevância — o que vira push e o que não vira

`relevance` é a única coisa do calendário que **não** veio do PDF: é juízo
operacional, e é editável linha a linha.

- **Alta** → o aluno perde nota, dinheiro ou prazo se não souber. Vira push com reforço.
- **Média** → ajuda e evita ligação no suporte. Vira um push único.
- **Baixa** → só interessa a monitor e secretaria. Fica registrado e **não** vira push.

Ficaram de fora (relevância baixa):

- Período para entrega do relatório final de Monitoria do primeiro semestre. *(em 9 calendários)*
- Término do Programa de Monitoria do primeiro bimestre. *(em 7 calendários)*
- Período para entrega do relatório final de Monitoria do primeiro bimestre. *(em 7 calendários)*
- Término do Programa de Monitoria do segundo bimestre. *(em 7 calendários)*
- Ambientação Vida do Monitor. *(em 2 calendários)*
- Período de entrega do relatório parcial de Monitoria. *(em 2 calendários)*
- Data máxima para lançamento de nota da N1. *(em 2 calendários)*
- Término do Programa de Monitoria. *(em 2 calendários)*
- Data máxima para lançamento de nota da N2 e N3. *(em 2 calendários)*

Se você quiser qualquer uma dessas no app, é só subir a relevância no lápis da
aba Calendário — o aviso é gerado na hora.

## 4. ⚠️ Divergências encontradas nos PDFs oficiais

Transcrevi tudo **exatamente como está impresso**, inclusive onde o PDF se
contradiz. Corrigir em silêncio seria pior: quem confere confere contra o
arquivo, não contra o meu palpite. Cada linha abaixo aparece na tela com um
aviso amarelo até alguém decidir.

### Semanal · terças e quintas

1. **01, 10, 17 e 24/09** — Encontros presenciais da disciplina híbrida 2 do primeiro bimestre.
   > O PDF imprime «01, 10, 17 e 24/09», mas a híbrida 2 se encontra às quintas — 01/09 é terça. Provável erro de digitação de 03/09 na origem.

2. **26/11** — Prova 2 (P2) da disciplina híbrida 1 do segundo bimestre.
   > O PDF repete «híbrida 1» nas duas linhas (24/11 e 26/11). Pela grade de quintas, esta é a híbrida 2.

### Quinzenal · ADS veteranos

3. **27/10** — Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.
   > Transcrito como está impresso. Pela sequência do calendário — a 1ª híbrida do segundo bimestre começou em 29/09 — esta deveria ser a 2ª do SEGUNDO bimestre.

4. **13 e 14/11** — Segundo encontro presencial da 2ª disciplina — Atividades Avaliativas e Prova 1 (P1) do segundo bimestre.
   > O PDF imprime «Prova 1 (P1)» no segundo encontro. Pelo padrão dos demais encontros, é a P2.

### Semanal · sábados

5. **27/10** — Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.
   > Transcrito como está impresso. Pela sequência do calendário — a 1ª híbrida do segundo bimestre começou em 29/09 — esta deveria ser a 2ª do SEGUNDO bimestre.

### Semanal · sextas e sábados

6. **27/10** — Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.
   > Transcrito como está impresso. Pela sequência do calendário — a 1ª híbrida do segundo bimestre começou em 29/09 — esta deveria ser a 2ª do SEGUNDO bimestre.

### Semanal · Direito sextas e sábados

7. **27/10** — Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.
   > Transcrito como está impresso. Pela sequência do calendário — a 1ª híbrida do segundo bimestre começou em 29/09 — esta deveria ser a 2ª do SEGUNDO bimestre.

8. **14 e 28/11** — Aplicação da Prova Oficial das disciplinas de Estudo Dirigido e Digitais Especiais.
   > O PDF imprime «14 e 28/11»; nos demais calendários a mesma prova cai em 27 e 28/11.

### Quinzenal · ingressantes

9. **27/10** — Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.
   > Transcrito como está impresso. Pela sequência do calendário — a 1ª híbrida do segundo bimestre começou em 29/09 — esta deveria ser a 2ª do SEGUNDO bimestre.

### Quinzenal · veteranos

10. **27/10** — Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre.
   > Transcrito como está impresso. Pela sequência do calendário — a 1ª híbrida do segundo bimestre começou em 29/09 — esta deveria ser a 2ª do SEGUNDO bimestre.

Nenhuma delas foi alterada no sistema. Me diga qual é a versão correta e eu ajusto.

### Diferenças entre calendários que **não** são erro

Encontradas na conferência linha a linha, e mantidas como estão:

- O evento on-line *Prática Extensionista* é transmitido em duas sessões (29/08 às 9h
  e 03/09 às 19h) em oito calendários. No **semanal de sextas e sábados (exceto
  Direito)** só a sessão das 9h é impressa.
- A linha de abertura da Prática Extensionista (25/08) é escrita de forma diferente
  nesse mesmo calendário: não cita a Eletiva e manda "consultar os projetos disponíveis".
- O **quinzenal de veteranos** não imprime a abertura da disciplina digital do 2º
  bimestre em 29/09, que os outros calendários híbridos trazem.

## 5. Catálogo de PUSH personalizados

Estes não seguem data: seguem o aluno. A condição de cada um é avaliada contra
Health Score, acesso ao AVA, frequência, notas, situação financeira e etapa da
jornada — e só dispara para quem bate nela.

Três regras valeram para todos os textos:

1. **`#NOME#` é o primeiro nome, sempre.** Push que começa com o nome do aluno é
   lido; push que começa com "Prezado(a) discente" é arrastado para o lado.
2. **O push nunca acusa.** "Você está com 4 faltas" virou "faltam poucas aulas para
   o limite" — o objetivo é o aluno abrir o app, não se justificar.
3. **Todo push termina em algo que dá para fazer hoje**: um botão do app, uma pessoa
   para procurar, um prazo. Aviso sem saída vira ansiedade.

O **intervalo** existe porque a condição continua verdadeira depois do disparo. Sem
ele, o aluno com duas parcelas em atraso receberia a mesma mensagem todo dia até
pagar — e desinstalaria o app antes disso.

### Acolhimento e chegada do ingressante

#### `ACO-01` · Boas-vindas — primeira semana

- **Dispara quando:** Ingressante com até 7 dias de matrícula.
- **Público:** ingressantes
- **Repete no máximo a cada:** 180 dias

> **Bem-vindo(a), #NOME#!**  
> Sua jornada no UniAnchieta começou. Abra o app em «Horários das Aulas» e veja onde e quando sua primeira aula acontece. Qualquer dúvida, fale com a gente por aqui.

#### `ACO-02` · AVA ainda não acessado

- **Dispara quando:** Ingressante com mais de 5 dias sem acessar o AVA nos primeiros 30 dias.
- **Público:** ingressantes
- **Repete no máximo a cada:** 7 dias

> **#NOME#, seu AVA está esperando**  
> Suas disciplinas, materiais e atividades ficam no Ambiente Virtual de Aprendizagem. Leva dois minutos para entrar a primeira vez — e a gente te ajuda se travar.

#### `ACO-03` · Onboarding travado

- **Dispara quando:** Ingressante com 3 ou mais etapas de onboarding pendentes após 30 dias.
- **Público:** ingressantes
- **Repete no máximo a cada:** 14 dias

> **Faltam poucos passos, #NOME#**  
> Ainda tem etapa pendente na sua chegada ao UniAnchieta. Veja quais em «Minha Jornada» no app — são rápidas e destravam seu semestre.

#### `ACO-04` · Convite à monitoria

- **Dispara quando:** Ingressante com média abaixo de 6,0 no primeiro bimestre.
- **Público:** ingressantes
- **Repete no máximo a cada:** 21 dias

> **#NOME#, a monitoria é de graça**  
> Tem monitor da sua área disponível para tirar dúvida antes da próxima prova. Consulte os horários no app e agende — quem usa monitoria tira, em média, um ponto a mais.

#### `ACO-05` · App não instalado

- **Dispara quando:** Aluno sem o App Grupo Anchieta instalado.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 30 dias

> **Tudo do seu curso cabe no bolso**  
> #NOME#, horários, notas, faltas, boletos e o Mural ficam no App Grupo Anchieta. Instale e configure as notificações para não perder prazo nenhum.

#### `ACO-06` · Primeira prova do ingressante

- **Dispara quando:** Ingressante a 3 dias da primeira avaliação do semestre.
- **Público:** ingressantes
- **Repete no máximo a cada:** 180 dias

> **Sua primeira prova, #NOME#**  
> É normal ficar tenso. Confira sala e horário no app, chegue 15 minutos antes e leve documento com foto. Se algo acontecer no dia, você tem 48h para pedir substitutiva.

### Engajamento no AVA

#### `ENG-01` · Sumiço de 7 dias

- **Dispara quando:** 7 a 13 dias sem acesso ao AVA.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 10 dias

> **Faz uma semana, #NOME#**  
> Seu AVA ficou parado por sete dias e o conteúdo continua andando. Entre hoje e veja o que está aberto — se o problema for tempo ou senha, a gente resolve junto.

#### `ENG-02` · Sumiço de 14 dias

- **Dispara quando:** 14 dias ou mais sem acesso ao AVA.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 14 dias

> **#NOME#, a gente sentiu sua falta**  
> Duas semanas sem acesso é tempo suficiente para acumular pendência. Responda esta mensagem ou procure o Sucesso ao Aluno — dá para reorganizar sem perder o semestre.

#### `ENG-03` · Queda de ritmo

- **Dispara quando:** Queda de 40% ou mais nos acessos ao AVA em relação aos 30 dias anteriores.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 21 dias

> **Seu ritmo caiu, #NOME#**  
> Você acessava bem mais o AVA no mês passado. Se mudou trabalho, horário ou algo em casa, fala com a gente — dá para ajustar antes de virar nota baixa.

#### `ENG-04` · Atividades não entregues

- **Dispara quando:** Taxa de entrega de atividades abaixo de 60%.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 10 dias

> **Tem atividade te esperando**  
> #NOME#, parte das suas atividades ainda não foi enviada e elas contam na média. Veja a lista no AVA e comece pelas de prazo mais curto.

#### `ENG-05` · Encontro presencial amanhã (híbrido)

- **Dispara quando:** Aluno híbrido na véspera de um encontro presencial da sua disciplina.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 1 dias

> **Amanhã tem encontro presencial**  
> #NOME#, amanhã é dia de encontro presencial da sua disciplina híbrida. Confira o horário no app — é nele que acontecem as atividades avaliativas do bimestre.

#### `ENG-06` · Prática Extensionista parada

- **Dispara quando:** Aluno sem horas de Prática Extensionista lançadas até novembro.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 15 dias

> **Suas horas de extensão, #NOME#**  
> A Prática Extensionista é obrigatória para colar grau e o prazo de submissão fecha em 23/11. Veja quantas horas faltam no app e escolha um projeto ainda esta semana.

### Vida acadêmica: frequência, nota e prazo

#### `ACD-01` · Frequência no limite

- **Dispara quando:** Frequência entre 75% e 80% em qualquer disciplina.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 14 dias

> **Atenção com as faltas, #NOME#**  
> Sua frequência em uma das disciplinas está perto do limite de 75%. Abaixo disso, reprova por falta mesmo com nota boa. Confira o detalhe no app.

#### `ACD-02` · Frequência abaixo do limite

- **Dispara quando:** Frequência abaixo de 75% em qualquer disciplina.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 10 dias

> **#NOME#, precisamos falar sobre suas faltas**  
> Uma das suas disciplinas já passou do limite de faltas. Ainda existem caminhos — procure a coordenação do curso ou responda aqui e a gente te orienta hoje.

#### `ACD-03` · Nota abaixo da média

- **Dispara quando:** Média parcial abaixo de 6,0 em uma ou mais disciplinas.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 21 dias

> **Dá tempo de virar, #NOME#**  
> Sua média parcial em uma disciplina está abaixo de 6,0. Ainda tem P2, substitutiva e recuperação pela frente — e monitoria de graça para chegar preparado.

#### `ACD-04` · Dependência sem inscrição

- **Dispara quando:** Aluno com dependência pendente durante o período de inscrição em DP.
- **Público:** veteranos
- **Repete no máximo a cada:** 10 dias

> **Sua DP fecha inscrição em breve**  
> #NOME#, você tem disciplina em dependência e a inscrição em DP e Adaptação vai até 21/08. Deixar para depois empurra sua formatura em um semestre.

#### `ACD-05` · Substitutiva — janela de 48h

- **Dispara quando:** Aluno ausente em prova aplicada nas últimas 24 horas.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 2 dias

> **Você tem 48h, #NOME#**  
> Constou falta na sua prova. Se teve motivo justificável, peça a substitutiva pela secretaria virtual com o documento anexado — o prazo é de 48h a partir da prova.

#### `ACD-06` · Recuperação disponível

- **Dispara quando:** Aluno com média final insuficiente antes do período de recuperação.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 15 dias

> **Sua chance de recuperação, #NOME#**  
> Você está apto à prova de recuperação. Confira dia, horário e conteúdo no app — é a última avaliação do semestre e vale a nota da disciplina inteira.

#### `ACD-07` · Atividades Complementares em aberto

- **Dispara quando:** Aluno dos períodos finais com carga de Atividades Complementares incompleta.
- **Público:** veteranos
- **Repete no máximo a cada:** 20 dias

> **Falta protocolar suas horas**  
> #NOME#, o último dia para protocolar as Atividades Complementares é 07/12. Sem elas não sai o diploma — junte os certificados e envie ainda este mês.

### Financeiro

#### `FIN-01` · Vencimento em 3 dias

- **Dispara quando:** Mensalidade a vencer em 3 dias, aluno adimplente.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 25 dias

> **Sua mensalidade vence em 3 dias**  
> #NOME#, o boleto deste mês está disponível no app, em «Financeiro». Pagando até o vencimento você mantém o desconto de pontualidade.

#### `FIN-02` · Atraso dentro da janela preventiva

- **Dispara quando:** 1 parcela em atraso há menos de 15 dias.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 12 dias

> **Vamos resolver isso juntos, #NOME#**  
> Consta uma parcela em aberto. Enquanto está no começo, dá para negociar sem juros pesados e sem bloqueio — fale com o Financeiro pelo app hoje.

#### `FIN-03` · Duas ou mais parcelas em atraso

- **Dispara quando:** 2 ou mais parcelas em atraso, sem negociação ativa.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 15 dias

> **#NOME#, existe uma saída**  
> Sua situação financeira está travando sua matrícula do próximo semestre. Temos condições de parcelamento e bolsas — responda aqui e a gente monta uma proposta.

#### `FIN-04` · Negociação firmada — lembrete

- **Dispara quando:** Aluno com negociação em andamento e parcela do acordo a vencer.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 25 dias

> **Seu acordo continua de pé**  
> #NOME#, a próxima parcela do seu acordo vence em breve. Manter em dia garante sua rematrícula e o acesso liberado ao AVA.

#### `FIN-05` · Bolsa e financiamento

- **Dispara quando:** Aluno inadimplente sem bolsa e sem negociação.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 30 dias

> **Você já pesquisou bolsa, #NOME#?**  
> O UniAnchieta tem bolsas internas, convênios e financiamento estudantil. Vale cinco minutos de conversa antes de tomar qualquer decisão sobre o curso.

### Retenção

#### `RET-01` · Health Score em queda

- **Dispara quando:** Queda de 10 pontos ou mais no Health Score em 30 dias.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 30 dias

> **Como você está, #NOME#?**  
> Notamos que este mês foi mais difícil que o anterior. Não precisa ser nota nem dinheiro — se estiver acontecendo alguma coisa, responde aqui que a gente escuta.

#### `RET-02` · Visitou a página de cancelamento

- **Dispara quando:** Aluno acessou a página de trancamento ou cancelamento nos últimos 7 dias.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 30 dias

> **Antes de decidir, #NOME#**  
> Existem alternativas ao trancamento: mudança de turno, de modalidade, redução de carga e renegociação. Uma conversa de dez minutos pode abrir uma porta que você não viu.

#### `RET-03` · Risco crítico — convite ao atendimento

- **Dispara quando:** Health Score abaixo de 40.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 20 dias

> **Vamos conversar, #NOME#?**  
> O Sucesso ao Aluno separou um horário para você. É uma conversa sem cobrança, para entender o que está pesando e montar um plano possível. Responda aqui para agendar.

#### `RET-04` · Rematrícula aberta

- **Dispara quando:** Período de rematrícula aberto para aluno regular.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 20 dias

> **Sua vaga do próximo semestre**  
> #NOME#, a rematrícula já está aberta no app. Garantir cedo mantém seu horário e sua turma — e evita fila na secretaria em janeiro.

### Reconhecimento

#### `REC-01` · Frequência exemplar

- **Dispara quando:** Frequência acima de 95% no bimestre.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 60 dias

> **Presença nota dez, #NOME#**  
> Sua frequência neste bimestre está entre as melhores do curso. Constância é o que separa quem termina de quem tranca — continue assim.

#### `REC-02` · Recuperação de ritmo

- **Dispara quando:** Health Score subiu 10 pontos ou mais em 30 dias.
- **Público:** ingressantes e veteranos
- **Repete no máximo a cada:** 60 dias

> **Você virou o jogo, #NOME#**  
> Seus indicadores melhoraram bastante no último mês. Isso é resultado do que você fez — e a gente está aqui se precisar manter o ritmo.

#### `REC-03` · Metade do curso

- **Dispara quando:** Aluno cruzou 50% do progresso do curso.
- **Público:** veteranos
- **Repete no máximo a cada:** 180 dias

> **Metade do caminho, #NOME#**  
> Você passou dos 50% do seu curso. Vale olhar agora as horas de extensão e as atividades complementares — quem organiza na metade não corre no fim.

## 6. Amostra da régua — dois calendários

### Cursos Presencial (exceto Direito) · 2º semestre

| Data | Hora | Momento | Título | Mensagem |
|---|---|---|---|---|
| 20/08 | 10:00 | véspera do prazo | **Amanhã é o último dia, #NOME#** | Período de inscrição em DP (Dependência) e Adaptação. O prazo termina em 21 de agosto. Depois disso só com processo na secretaria — e nem sempre é aceito. |
| 24/08 | 18:00 | na véspera | **Suas digitais começam amanhã** | Início das disciplinas digitais regulares — 25 de agosto. As disciplinas digitais correm pelo AVA, no seu ritmo — mas com prazo. Entre e veja o cronograma. |
| 24/08 | 18:00 | na véspera | **Sua nova disciplina abre amanhã** | Início, no AVA, do bloco 1 das atividades on-line das disciplinas presenciais com carga horária EaD — 25 de agosto. Entre no AVA para ver o plano de ensino e os prazos das primeiras atividades. |
| 25/08 | 09:00 | no dia | **Suas horas de extensão abriram** | Início da Prática Extensionista e Eletiva via sistema, disponíveis no App Grupo Anchieta. A Prática Extensionista é obrigatória para colar grau. Veja quantas horas faltam no app. |
| 29/08 | 07:30 | no dia | **Hoje tem evento, #NOME#** | Evento on-line: Prática Extensionista — Tudo o que você precisa saber — 29 de agosto. Horário: 09h (horário de Brasília). Local: Canal do Youtube do UniAnchieta. |
| 30/08 | 10:00 | véspera do prazo | **Amanhã é o último dia, #NOME#** | Período para eleição dos representantes e vice-representantes de classe. O prazo termina em 31 de agosto e leva poucos minutos no app. |
| 03/09 | 16:00 | no dia | **Hoje tem evento, #NOME#** | Evento on-line: Prática Extensionista — Tudo o que você precisa saber — 3 de setembro. Horário: 19h (horário de Brasília). Local: Canal do Youtube do UniAnchieta. |
| 06/09 | 17:00 | na véspera | **Amanhã não tem aula, #NOME#** | Feriado — Dia da Independência do Brasil, em 07/09. As atividades presenciais ficam suspensas, mas os prazos do AVA continuam valendo: confira o que vence nesta semana. |
| 25/09 | 09:00 | 3 dias antes | **#NOME#, prova daqui a 3 dias** | Período de aplicação da P1 — na segunda, 28 de setembro. Horário de início — Diurno: 07h30 · Noturno: 19h30. Confira sala e horário no App Grupo Anchieta e organize seu estudo desde já. |
| 28/09 | 07:00 | no dia | **Hoje tem prova, #NOME#** | Período de aplicação da P1 — de 28 de setembro a 9 de outubro. Horário de início — Diurno: 07h30 · Noturno: 19h30. Leve documento com foto e chegue com antecedência. Se faltar, você tem 48h para pedir substitutiva pela secretaria virtual com documento anexado. |
| 05/10 | 18:00 | na véspera | **Novas disciplinas amanhã, #NOME#** | Início das Disciplinas Digitais Especiais e Estudo Dirigido — 6 de outubro. Estudo Dirigido e Digitais Especiais têm prova própria — comece pelo cronograma no AVA. |
| 11/10 | 17:00 | na véspera | **Feriado e recesso, #NOME#** | Feriado e Recesso — Nossa Senhora Aparecida e Dia do Professor, em 12 e 13/10. As atividades presenciais ficam suspensas, mas os prazos do AVA continuam valendo: confira o que vence nesta semana. |
| 14/10 | 09:00 | 3 dias antes | **#NOME#, prova daqui a 3 dias** | Aplicação da Prova Substitutiva da P1 — no sábado, 17 de outubro. Confira sala e horário no App Grupo Anchieta e organize seu estudo desde já. |

*Régua completa: 55 avisos, de julho a dezembro. Veja na tela.*

### Cursos Semanais (Ingressantes e Veteranos) — terças e quintas · 2º semestre

| Data | Hora | Momento | Título | Mensagem |
|---|---|---|---|---|
| 20/08 | 10:00 | véspera do prazo | **Amanhã é o último dia, #NOME#** | Período de inscrição em DP (Dependência) e Adaptação. O prazo termina em 21 de agosto. Depois disso só com processo na secretaria — e nem sempre é aceito. |
| 22/08 | 09:00 | 3 dias antes | **#NOME#, prova daqui a 3 dias** | Prova 1 (P1) da disciplina híbrida 1 do primeiro bimestre — na terça, 25 de agosto. Confira sala e horário no App Grupo Anchieta e organize seu estudo desde já. |
| 24/08 | 09:00 | 3 dias antes | **#NOME#, prova daqui a 3 dias** | Prova 1 (P1) da disciplina híbrida 2 do primeiro bimestre — na quinta, 27 de agosto. Confira sala e horário no App Grupo Anchieta e organize seu estudo desde já. |
| 25/08 | 07:00 | no dia | **Hoje tem prova, #NOME#** | Prova 1 (P1) da disciplina híbrida 1 do primeiro bimestre — 25 de agosto. Leve documento com foto e chegue com antecedência. Se faltar, você tem 48h para pedir substitutiva pela secretaria virtual com documento anexado. |
| 25/08 | 09:00 | no dia | **Suas horas de extensão abriram** | Início da Prática Extensionista e Eletiva via sistema, disponíveis no App Grupo Anchieta. A Prática Extensionista é obrigatória para colar grau. Veja quantas horas faltam no app. |
| 27/08 | 07:00 | no dia | **Hoje tem prova, #NOME#** | Prova 1 (P1) da disciplina híbrida 2 do primeiro bimestre — 27 de agosto. Leve documento com foto e chegue com antecedência. Se faltar, você tem 48h para pedir substitutiva pela secretaria virtual com documento anexado. |
| 29/08 | 07:30 | no dia | **Hoje tem evento, #NOME#** | Evento on-line: Prática Extensionista — Tudo o que você precisa saber — 29 de agosto. Horário: 09h (horário de Brasília). Local: Canal do Youtube do UniAnchieta. |
| 30/08 | 10:00 | véspera do prazo | **Amanhã é o último dia, #NOME#** | Período para eleição dos representantes e vice-representantes de classe. O prazo termina em 31 de agosto e leva poucos minutos no app. |
| 31/08 | 18:00 | na véspera | **Seus encontros presenciais, #NOME#** | Encontros presenciais da disciplina híbrida 1 do primeiro bimestre — nos dias 01, 08, 15 e 22/09. É no encontro presencial que acontecem as atividades avaliativas — confira o horário no app e não perca nenhum. |
| 31/08 | 18:00 | na véspera | **Seus encontros presenciais, #NOME#** | Encontros presenciais da disciplina híbrida 2 do primeiro bimestre — nos dias 01, 10, 17 e 24/09. É no encontro presencial que acontecem as atividades avaliativas — confira o horário no app e não perca nenhum. |
| 03/09 | 16:00 | no dia | **Hoje tem evento, #NOME#** | Evento on-line: Prática Extensionista — Tudo o que você precisa saber — 3 de setembro. Horário: 19h (horário de Brasília). Local: Canal do Youtube do UniAnchieta. |
| 06/09 | 17:00 | na véspera | **Amanhã não tem aula, #NOME#** | Feriado — Dia da Independência do Brasil, em 07/09. As atividades presenciais ficam suspensas, mas os prazos do AVA continuam valendo: confira o que vence nesta semana. |
| 19/09 | 09:00 | 3 dias antes | **#NOME#, prova daqui a 3 dias** | Prova 2 (P2) da disciplina híbrida 1 do primeiro bimestre — na terça, 22 de setembro. Confira sala e horário no App Grupo Anchieta e organize seu estudo desde já. |
| 21/09 | 09:00 | 3 dias antes | **#NOME#, prova daqui a 3 dias** | Prova 2 (P2) da disciplina híbrida 2 do primeiro bimestre — na quinta, 24 de setembro. Confira sala e horário no App Grupo Anchieta e organize seu estudo desde já. |
| 22/09 | 07:00 | no dia | **Hoje tem prova, #NOME#** | Prova 2 (P2) da disciplina híbrida 1 do primeiro bimestre — 22 de setembro. Leve documento com foto e chegue com antecedência. Se faltar, você tem 48h para pedir substitutiva pela secretaria virtual com documento anexado. |
| 24/09 | 07:00 | no dia | **Hoje tem prova, #NOME#** | Prova 2 (P2) da disciplina híbrida 2 do primeiro bimestre — 24 de setembro. Leve documento com foto e chegue com antecedência. Se faltar, você tem 48h para pedir substitutiva pela secretaria virtual com documento anexado. |
| 26/09 | 09:00 | 3 dias antes | **#NOME#, prova on-line em 3 dias** | Período de realização on-line, por meio do AVA, da prova das Disciplinas Digitais Regulares do primeiro bimestre — abre na terça, 29 de setembro. São três tentativas pelo AVA, sem substitutiva nem recuperação. Organize o seu tempo. |
| 28/09 | 18:00 | na véspera | **Sua nova disciplina abre amanhã** | Início, no AVA, da disciplina digital do segundo bimestre — 29 de setembro. Entre no AVA para ver o plano de ensino e os prazos das primeiras atividades. |
| 28/09 | 18:00 | na véspera | **Sua nova disciplina abre amanhã** | Início, no AVA, das disciplinas híbridas 1 e 2 do segundo bimestre — 29 de setembro. Entre no AVA para ver o plano de ensino e os prazos das primeiras atividades. |
| 28/09 | 18:00 | na véspera | **Amanhã tem encontro presencial** | Encontro presencial da disciplina híbrida 1 do segundo bimestre — 29 de setembro. É no encontro presencial que acontecem as atividades avaliativas — confira o horário no app e não perca nenhum. |
| 29/09 | 07:00 | no dia | **Sua prova on-line abriu, #NOME#** | Período de realização on-line, por meio do AVA, da prova das Disciplinas Digitais Regulares do primeiro bimestre — de 29 de setembro a 5 de outubro. São três tentativas pelo AVA e, por isso, não há substitutiva nem recuperação. Não deixe para o último dia. |
| 30/09 | 09:00 | 3 dias antes | **#NOME#, prova daqui a 3 dias** | Aplicação das provas substitutivas das disciplinas híbridas do primeiro bimestre — no sábado, 3 de outubro. Confira sala e horário no App Grupo Anchieta e organize seu estudo desde já. |
| 30/09 | 18:00 | na véspera | **Seus encontros presenciais, #NOME#** | Encontros presenciais da disciplina híbrida 2 do segundo bimestre — nos dias 01, 08, 15, 22 e 29/10. É no encontro presencial que acontecem as atividades avaliativas — confira o horário no app e não perca nenhum. |
| 03/10 | 07:00 | no dia | **Hoje tem prova, #NOME#** | Aplicação das provas substitutivas das disciplinas híbridas do primeiro bimestre — 3 de outubro. Leve documento com foto e chegue com antecedência. |
| 05/10 | 18:00 | na véspera | **Novas disciplinas amanhã, #NOME#** | Início das Disciplinas Digitais Especiais e Estudo Dirigido — 6 de outubro. Estudo Dirigido e Digitais Especiais têm prova própria — comece pelo cronograma no AVA. |
| 05/10 | 18:00 | na véspera | **Seus encontros presenciais, #NOME#** | Encontros presenciais da disciplina híbrida 1 do segundo bimestre — nos dias 06, 20 e 27/10. É no encontro presencial que acontecem as atividades avaliativas — confira o horário no app e não perca nenhum. |
| 06/10 | 09:00 | no dia | **A monitoria começou, #NOME#** | Início da Monitoria do segundo bimestre. Monitoria é gratuita e para todo mundo — veja os horários no app e agende sua dúvida. |
| 11/10 | 17:00 | na véspera | **Feriado e recesso, #NOME#** | Feriado e Recesso — Nossa Senhora Aparecida e Dia do Professor, em 12 e 13/10. As atividades presenciais ficam suspensas, mas os prazos do AVA continuam valendo: confira o que vence nesta semana. |

*Régua completa: 74 avisos, de julho a dezembro. Veja na tela.*

## 7. Categorias usadas

| Chave | Rótulo | Onde aparece |
|---|---|---|
| `aula` | Aula | calendário |
| `prova` | Avaliação | calendário e personalizados |
| `prazo` | Prazo | calendário e personalizados |
| `evento` | Evento | calendário |
| `feriado` | Feriado | calendário |
| `programa` | Programa | calendário |
| `financeiro` | Financeiro | personalizados |
| `engajamento` | Engajamento | personalizados |
| `acolhimento` | Acolhimento | personalizados |

---

## O que eu preciso de você

1. **Seção 2** — a lista de cursos de cada calendário. É o que mais importa.
2. **Seção 4** — as divergências dos PDFs: qual é a data certa?
3. **Seção 3** — a lista de relevância baixa: alguma dessas deveria virar push?
4. **Seção 5** — o tom e o texto das mensagens personalizadas.

Pode riscar direto neste arquivo, ou editar na tela pelo lápis — as duas coisas
chegam no mesmo lugar.
