# Perguntas para lapidar a Trilha do Aluno

O que aparece no app de cada aluno, em cada momento de ingresso, em cada um dos calendários.

> **Escopo.** Os onze calendários publicados para 2026/2, **menos Recursos Humanos híbrido**,
> cuja oferta está encerrada. Sobram 32 linhas no site, 22 cursos distintos e 749 disparos
> somados no semestre.
>
> **O que este arquivo não é.** Não é um questionário aberto. Cada pergunta já vem com a
> resposta que o sistema dá hoje ou com a que recomendamos, para que a conversa seja
> **confirmar, corrigir ou derrubar** — não inventar do zero.
>
> **Como responder.** Marque `[x]` no que está fechado. Onde discordar, escreva na linha
> `outro:`. Pergunta sem marca volta na próxima rodada. As perguntas têm código (`T-001`) para
> a gente poder falar delas por telefone sem abrir o arquivo.

**Índice**

| Parte | Assunto | Perguntas |
|---|---|---|
| 1 | A régua de tipos de aluno — a matriz inteira | T-001 a T-012 |
| 2 | Momento 1 · matrícula antecipada (mais de 60 dias) | T-013 a T-026 |
| 3 | Momento 2 · com folga (15 a 60 dias) | T-027 a T-042 |
| 4 | Momento 3 · véspera (3 a 14 dias) | T-043 a T-057 |
| 5 | Momento 4 · semestre em curso | T-058 a T-076 |
| 6 | O veterano, que não tem momento de ingresso | T-077 a T-085 |
| 7 | Pergunta por tipo de calendário | T-086 a T-108 |
| 8 | O conjunto irrecuperável | T-109 a T-118 |
| 9 | Tradução: disciplina, turno, turma, local | T-119 a T-132 |
| 10 | O contador «N de M» e a citação do PDF | T-133 a T-140 |
| 11 | Quando o sistema não sabe | T-141 a T-148 |
| 12 | Os passos da trilha de entrada | T-149 a T-163 |
| 13 | A cara da UniAnchieta | T-164 a T-180 |
| 14 | O app: ícones, primeira dobra, aposentadoria | T-181 a T-192 |
| 15 | Push e trilha: o teto e o corte | T-193 a T-201 |
| 16 | Os dados que faltam | T-202 a T-210 |
| 17 | Governança, respaldo e LGPD | T-211 a T-220 |
| 18 | O que fica fora da primeira versão | T-221 a T-228 |

---

## Parte 1 · A régua de tipos de aluno

A trilha cruza quatro variáveis, e só quatro. Antes de qualquer pergunta de conteúdo, é preciso
concordar que são estas.

| Variável | Valores | De onde vem | O que decide |
|---|---|---|---|
| **Momento de ingresso (Δ)** | antecipada · com folga · véspera · em curso | `hoje → início das aulas` | quanto da trilha cabe e até onde o calendário olha |
| **Coorte** | Calouro (90 dias) · Veterano | `Student.cohort` | se existe trilha de entrada |
| **Modalidade** | Presencial · Híbrido · EaD | `Student.modality` | quais passos existem e qual PDF se aplica |
| **Resolução do calendário** | exata · outra coorte · nenhuma | `resolveCalendar` | se há linha do tempo a entregar |

A faixa sai de **hoje até o primeiro dia de aula**, não da data da matrícula. Medir pelo
histórico colocava um veterano do quarto módulo em «matrícula antecipada» porque ele se
matriculou 662 dias antes deste semestre: verdade aritmética, absurdo operacional.

**T-001 · As quatro variáveis bastam?**
Falta alguma que mude o que o aluno vê — campus, turno, bolsa, ingresso por transferência,
segunda graduação, aluno especial?
*Proposta:* bastam as quatro na v1; turno entra como dado de tradução (T-121), não como recorte.
- [ ] confirmo &nbsp;&nbsp; [ ] falta: `____`

**T-002 · Os cortes das faixas.**
Hoje: mais de 60 dias = antecipada · 15 a 60 = com folga · 3 a 14 = véspera · menos de 3 = em curso.
- [ ] confirmo &nbsp;&nbsp; [ ] outros cortes: `____`

**T-003 · O horizonte de cada faixa.**
Até onde o recorte olha à frente: antecipada **0 dias** (não há calendário), com folga **30**,
véspera **14**, em curso **45**.
*Por que 45 em curso:* cobre o próximo bloco de provas mesmo no ritmo mais espaçado, o quinzenal.
- [ ] confirmo &nbsp;&nbsp; [ ] outros: `____`

**T-004 · Transferido e aluno de segunda graduação entram como calouro?**
Eles têm o app, conhecem o portal, mas não conhecem esta instituição.
*Proposta:* entram como calouro na régua dos 90 dias, com a trilha marcando os passos de
«já conheço» como concluídos quando houver evidência.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-005 · Aluno que ingressa em DP/adaptação sem ser calouro.**
Ele tem um calendário, uma prova e um prazo — mas nenhuma trilha de entrada.
- [ ] só calendário, sem trilha &nbsp;&nbsp; [ ] trilha curta de 3 passos &nbsp;&nbsp; [ ] outro: `____`

**T-006 · Aluno que troca de curso ou de modalidade no meio do semestre.**
O calendário muda debaixo dele, e as datas já entregues param de valer.
*Proposta:* a trilha recalcula na hora e o app mostra um aviso único: «seu calendário mudou
porque seu curso mudou», com link para o novo PDF.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-007 · Aluno trancado ou em abandono.**
Continua recebendo calendário e push?
*Proposta:* para tudo, exceto financeiro e a janela de rematrícula.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-008 · Formando (último semestre).**
Ele tem datas que ninguém mais tem: colação, entrega de documentação, quitação.
*Proposta:* faixa própria na v2; na v1, entra como veterano com destaque no irrecuperável.
- [ ] confirmo &nbsp;&nbsp; [ ] merece faixa já na v1 &nbsp;&nbsp; [ ] outro: `____`

**T-009 · Quem manda quando a coorte e o momento divergem?**
Um veterano que se matriculou ontem numa disciplina nova é veterano ou é véspera?
*Proposta:* a **coorte** manda na trilha de entrada, o **momento** manda no calendário. São
eixos independentes, e é assim que o motor já trata.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-010 · Um aluno pode ver mais de um calendário?**
Ex.: híbrido cursando uma DP presencial.
*Proposta:* na v1, um calendário por aluno, com nota de que a DP tem datas próprias. Dois
calendários simultâneos dobram a superfície de erro.
- [ ] confirmo &nbsp;&nbsp; [ ] precisa dos dois já na v1 &nbsp;&nbsp; [ ] outro: `____`

**T-011 · A trilha é por aluno ou por matrícula?**
Aluno com duas matrículas ativas (duas graduações).
- [ ] por matrícula, com seletor no topo &nbsp;&nbsp; [ ] por aluno, tudo junto &nbsp;&nbsp; [ ] outro: `____`

**T-012 · Quem pode gerar a trilha de um aluno na ferramenta interna?**
*Proposta:* acolhimento, coordenação de curso e secretaria. Financeiro só lê.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

---

## Parte 2 · Momento 1 · matrícula antecipada

**Mais de 60 dias até a primeira aula.** Inclui todo mundo que assinou para 2027.

O fato desconfortável: **o calendário do semestre dele ainda não existe.** Não é limitação a
esconder, é informação. E o risco dominante aqui não é perder prazo — é **esquecer que se
matriculou**.

**T-013 · O app mostra alguma data nesta faixa?**
*Proposta:* nenhuma data do calendário acadêmico. Só a promessa com data: «seu calendário fica
disponível aqui em janeiro de 2027».
- [ ] confirmo &nbsp;&nbsp; [ ] mostrar datas do semestre atual como referência &nbsp;&nbsp; [ ] outro: `____`

**T-014 · Projetar 2027 deslocando 2026 em 365 dias está descartado?**
*Proposta:* descartado, e é a decisão mais importante desta parte. Produz datas plausíveis e
erradas, com a nossa assinatura, num formato que parece oficial. Feriado muda de dia da semana
e calendário acadêmico não é periódico.
- [ ] confirmo o descarte &nbsp;&nbsp; [ ] discordo, porque: `____`

**T-015 · Qual é a data-promessa exata que o app exibe?**
«Disponível em janeiro de 2027» ou uma data cheia?
- [ ] mês &nbsp;&nbsp; [ ] data cheia: `____` &nbsp;&nbsp; [ ] «assim que a coordenação publicar»

**T-016 · O que substitui o calendário nesta faixa?**
*Proposta:* quatro blocos — como funciona a sua modalidade, quais acessos você vai ter,
documentos que faltam, e o que acontece na primeira semana.
- [ ] confirmo &nbsp;&nbsp; [ ] tirar: `____` &nbsp;&nbsp; [ ] acrescentar: `____`

**T-017 · Quais passos da trilha aparecem aqui?**
Hoje: contrato, app, portal, boleto e DP. Os outros sete só aparecem depois.
- [ ] confirmo &nbsp;&nbsp; [ ] outro conjunto: `____`

**T-018 · Instalar o app faz sentido a 4 meses do início?**
Argumento a favor: é o canal. Contra: app instalado e mudo por 4 meses é app desinstalado.
*Proposta:* pedir a instalação, e alimentar o app nesta faixa com conteúdo de relação (T-019).
- [ ] confirmo &nbsp;&nbsp; [ ] adiar o pedido para 30 dias antes &nbsp;&nbsp; [ ] outro: `____`

**T-019 · Cadência de contato nesta faixa.**
*Proposta:* 1 mensagem a cada 30 dias, de manutenção de relação, nunca de prazo.
- [ ] confirmo &nbsp;&nbsp; [ ] quinzenal &nbsp;&nbsp; [ ] só quando houver novidade &nbsp;&nbsp; [ ] outro: `____`

**T-020 · O que se diz nessas mensagens?**
Liste o que faz sentido: bastidores do campus, apresentação de coordenador, calendário do
vestibular de amigos, bolsa de indicação, material de nivelamento…
- [ ] `____`

**T-021 · O boleto aparece nesta faixa?**
*Proposta:* sim, com o dia do vencimento em destaque — é a informação que a família pede.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-022 · Documentos pendentes aparecem com prazo?**
*Proposta:* sim, é a única contagem regressiva legítima nesta faixa.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-023 · A trilha desta faixa é imprimível para a família?**
*Proposta:* sim. É a faixa em que mais gente lê junto com o aluno.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-024 · A faixa vira qual, e quando?**
*Proposta:* vira «com folga» sozinha, quando faltarem 60 dias, e o app avisa uma vez: «seu
calendário chegou».
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-025 · Medimos desistência antes de começar nesta faixa?**
*Proposta:* sim, e é o indicador principal dela. Hoje ninguém mede.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-026 · Alguém da operação fala com esse aluno, ou só o app?**
- [ ] só app &nbsp;&nbsp; [ ] um contato humano no meio do caminho &nbsp;&nbsp; [ ] outro: `____`

---

## Parte 3 · Momento 2 · com folga (15 a 60 dias)

A faixa confortável. Cabe a trilha inteira, com contagem regressiva, e o primeiro mês de datas.

**T-027 · 30 dias de horizonte de calendário é o certo?**
*Proposta:* sim. Em outubro, dezembro é ruído — com a exceção do irrecuperável, que aparece sempre.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-028 · A contagem regressiva fica na primeira dobra?**
*Proposta:* sim, «faltam 34 dias para a sua primeira aula», com a data e o dia da semana.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-029 · A contagem é para a primeira aula ou para a matrícula estar completa?**
- [ ] primeira aula &nbsp;&nbsp; [ ] documentação &nbsp;&nbsp; [ ] as duas, empilhadas &nbsp;&nbsp; [ ] outro: `____`

**T-030 · Quais são as três primeiras coisas da tela nesta faixa?**
*Proposta:* 1) contagem regressiva, 2) passos que faltam, 3) as próximas datas.
- [ ] confirmo &nbsp;&nbsp; [ ] outra ordem: `____`

**T-031 · O aluno já vê o nome das disciplinas nesta faixa?**
Só existe grade depois da alocação de turma.
*Proposta:* mostra quando houver; quando não houver, diz «sua grade fica disponível quando a
turma for fechada», sem inventar.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-032 · O e-book da primeira disciplina entra aqui?**
Nos híbridos ele é liberado em 31/07, antes das aulas.
*Proposta:* entra assim que a data estiver dentro dos 30 dias.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-033 · A ambientação on-line entra aqui?**
01/08 e 05/08, nos híbridos e no EAD.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-034 · O prazo de DP (fecha 21/08) aparece mesmo para quem não tem DP?**
*Proposta:* aparece para veterano e para quem tem pendência conhecida; para o calouro sem
histórico, aparece uma vez, com a pergunta «você tem disciplina pendente de outra instituição?».
- [ ] confirmo &nbsp;&nbsp; [ ] mostrar para todos &nbsp;&nbsp; [ ] outro: `____`

**T-035 · Cadência de push nesta faixa.**
*Proposta:* 2 ou 3 no total da faixa inteira, mais os do irrecuperável.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-036 · A monitoria e o Bagagem aparecem?**
São `programa`, a família que o recorte recolhe por padrão.
*Proposta:* recolhidos, mas visíveis num bloco «também disponível para você», contados no «N de M».
- [ ] confirmo &nbsp;&nbsp; [ ] mostrar abertos &nbsp;&nbsp; [ ] outro: `____`

**T-037 · A Prática Extensionista aparece nesta faixa?**
Ela abre em 25/08 e fecha em 23/11, e é o que mais trava formatura.
*Proposta:* aparece na abertura e vira irrecuperável no prazo de entrega.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-038 · Feriado aparece nesta faixa?**
*Proposta:* sim, mas só os que caem dentro dos 30 dias e **só os que atingem o dia de aula
daquele aluno** — feriado de segunda para quem estuda sábado é ruído.
- [ ] confirmo &nbsp;&nbsp; [ ] mostrar todos &nbsp;&nbsp; [ ] outro: `____`

**T-039 · O card de feriado diz que o AVA continua valendo?**
*Proposta:* sim, sempre. «Sem aula» não é «sem entrega» é a confusão mais cara do semestre.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-040 · Mostramos o mapa do campus e o prédio nesta faixa?**
- [ ] sim &nbsp;&nbsp; [ ] só na véspera &nbsp;&nbsp; [ ] outro: `____`

**T-041 · A trilha impressa ainda é oferecida aqui?**
*Proposta:* sim, mas o botão sai da primeira dobra e vai para o rodapé.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-042 · Quando o aluno cumpre todos os passos antes do prazo, o que aparece?**
*Proposta:* tela de conclusão explícita, e o card da trilha se recolhe sozinho, deixando a
primeira dobra para «Minhas datas».
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

---

## Parte 4 · Momento 3 · véspera (3 a 14 dias)

Faixa de emergência. Aqui a compressão importa mais que a completude, com uma exceção escrita.

**T-043 · A trilha reduz a cinco passos?**
*Proposta:* acesso ao portal, app instalado, AVA aberto, horário e turma reconhecidos, e o
primeiro dia (onde, que horas, o que levar). O resto espera.
- [ ] confirmo &nbsp;&nbsp; [ ] outro conjunto: `____`

**T-044 · O irrecuperável sobrepõe a compressão?**
Exemplo real: quem se matricula em 10/08 tem a inscrição em DP fechando em **21/08**, onze dias
depois. «Passo 9 de 12» seria o lugar natural dele, e seria o lugar errado.
*Proposta:* o irrecuperável entra na trilha comprimida, sempre, mesmo fora dos cinco passos.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-045 · 14 dias de calendário é suficiente?**
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-046 · O que exatamente o card «primeiro dia» diz?**
*Proposta:* data, dia da semana, horário do turno do aluno, prédio e sala se houver, o que levar,
e quem procurar se algo der errado.
- [ ] confirmo &nbsp;&nbsp; [ ] tirar: `____` &nbsp;&nbsp; [ ] acrescentar: `____`

**T-047 · E se não soubermos a sala?**
*Proposta:* diz que não sabe e manda para «Horários das Aulas» no app, que é onde a informação
vive. Nunca chuta.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-048 · Cadência de push na véspera.**
*Proposta:* diário e curto nas duas semanas iniciais, um assunto por mensagem.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-049 · Existe push de «amanhã é seu primeiro dia»?**
*Proposta:* sim, na véspera às 18h, e é o push mais importante da faixa.
- [ ] confirmo &nbsp;&nbsp; [ ] outro horário: `____`

**T-050 · Existe mensagem no próprio dia 1?**
*Proposta:* sim, uma só, de manhã, com «se algo der errado, procure X».
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-051 · O aluno de EAD e o de híbrido têm «primeiro dia»?**
Eles não entram no campus — para eles, o dia 1 é a abertura da disciplina no AVA.
*Proposta:* sim, com texto próprio por modalidade.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-052 · O passo «participe da integração» vale para EAD?**
Hoje ele vale para todas as modalidades e o lugar é `campus`.
- [ ] manter para todos &nbsp;&nbsp; [ ] só presencial e híbrido &nbsp;&nbsp; [ ] outro: `____`

**T-053 · Documentação pendente nesta faixa bloqueia o quê?**
*Proposta:* a trilha marca como bloqueante e diz o que acontece se não resolver até o dia 1.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-054 · Quem não instalou o app nesta faixa recebe o quê, e por onde?**
*Proposta:* WhatsApp e e-mail com o link da trilha HTML, que funciona sem login.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-055 · O link HTML da trilha expira?**
*Proposta:* não expira, mas carrega selo de «atualizado em» e a frase de que o documento
oficial é o calendário publicado em anchieta.br.
- [ ] confirmo &nbsp;&nbsp; [ ] expira em: `____`

**T-056 · O link é único por aluno e sem senha. Isso é aceitável?**
Ver também T-214.
- [ ] sim, com token não adivinhável &nbsp;&nbsp; [ ] exigir data de nascimento &nbsp;&nbsp; [ ] outro: `____`

**T-057 · O que a trilha diz para quem tem menos de 3 dias mas ainda não começou?**
*Proposta:* já é «em curso» pela régua. Confirmar se o corte é esse mesmo.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

---

## Parte 5 · Momento 4 · semestre em curso

**A faixa mais comum, e hoje a menos tratada.** As linhas do site dizem literalmente
«Ingressantes de janeiro à dezembro de 2026»: a entrada é contínua. Quem se matricula com o
semestre andando **já perdeu coisas**.

**T-058 · A trilha diz o que já passou?**
*Proposta:* sim, em três blocos — o que passou e dá para recuperar, o que passou e não dá, e o
que vem agora. Calar sobre o que passou é a origem do «ninguém me avisou».
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-059 · Nenhuma contagem regressiva para data no passado.**
É o bug que qualquer implementação ingênua produz no primeiro dia.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-060 · O que se diz sobre um prazo já perdido?**
*Proposta:* nomeia o prazo, diz que fechou, e diz o que dá para fazer agora (processo na
secretaria, próxima janela). Nunca só «fechou».
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-061 · O aluno que entra em setembro faz as provas de agosto?**
Pergunta de secretaria, mas a tela precisa de uma resposta.
- [ ] a coordenação define caso a caso &nbsp;&nbsp; [ ] existe regra escrita: `____`

**T-062 · 45 dias de horizonte está certo?**
*Proposta:* sim, cobre o próximo bloco de provas em qualquer um dos onze ritmos.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-063 · O que fica no bloco «guardado»?**
*Proposta:* irrecuperáveis fora dos 45 dias — Atividades Complementares (07/12), relatório de
extensão (23/11), fim do semestre (23/12). Sempre visíveis, fora da fila cronológica.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-064 · Quantos itens cabem na fila «próximas datas» antes de virar lista?**
*Proposta:* 5 na primeira dobra, com «ver todas» logo abaixo.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-065 · A trilha de entrada continua existindo para quem entrou atrasado?**
*Proposta:* sim, comprimida, e com o passo «primeira entrega» ganhando destaque, porque é o que
mais prevê como o semestre vai correr.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-066 · A janela de 48 horas é reativa, disparada pela falta e não pela data.**
Provavelmente o push de maior valor unitário do sistema.
*Proposta:* entra como fase 4, depois da tela. Confirmar que é assim.
- [ ] confirmo &nbsp;&nbsp; [ ] antecipar para a v1 &nbsp;&nbsp; [ ] outro: `____`

**T-067 · Quem dispara o gatilho da falta?**
Depende do lançamento de frequência pelo docente.
- [ ] lançamento do docente &nbsp;&nbsp; [ ] lista de presença digital &nbsp;&nbsp; [ ] outro: `____`

**T-068 · Em quanto tempo depois da falta o aviso sai?**
*Proposta:* até 2 horas depois do lançamento, e nunca fora da janela 07h30–21h00.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-069 · A trilha mostra frequência e nota, ou só datas?**
*Proposta:* só datas na v1. Nota e frequência já vivem no app e duplicá-las cria duas verdades.
- [ ] confirmo &nbsp;&nbsp; [ ] mostrar também &nbsp;&nbsp; [ ] outro: `____`

**T-070 · O aluno vê quantas horas de extensão ainda deve?**
O próprio calendário manda conferir no app.
*Proposta:* a trilha não repete o número, mas leva para a tela onde ele está, em vez de só citar.
- [ ] confirmo &nbsp;&nbsp; [ ] mostrar o número na trilha &nbsp;&nbsp; [ ] outro: `____`

**T-071 · Disciplina dispensada aparece na linha do tempo?**
O modelo já tem `Discipline.exempted` e `TimelineItem.exempted`.
*Proposta:* aparece marcada como dispensada, não some. Sumir levanta a dúvida «será que eu
perdi essa prova?».
- [ ] confirmo &nbsp;&nbsp; [ ] sumir &nbsp;&nbsp; [ ] outro: `____`

**T-072 · Aluno em DP vê as datas da DP junto com as do módulo?**
- [ ] junto, marcadas &nbsp;&nbsp; [ ] em bloco separado &nbsp;&nbsp; [ ] outro: `____`

**T-073 · Rematrícula entra na trilha do veterano em curso?**
*Proposta:* entra, e é irrecuperável quando tiver prazo declarado.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-074 · O fim do semestre (23/12) aparece o semestre todo?**
*Proposta:* fica em «guardado» o tempo todo e sobe para a fila nos últimos 45 dias.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-075 · Depois de 23/12, o que a tela mostra?**
*Proposta:* «o semestre acabou», o resumo do que ficou pendente e a data de volta.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-076 · A trilha some quando o semestre acaba, ou vira histórico?**
*Proposta:* vira histórico, acessível, e o novo semestre substitui a fila.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

---

## Parte 6 · O veterano

Ele não tem momento de ingresso. `delta` para ele é um número sem sentido — a distância entre a
matrícula dele e o início **deste** semestre pode passar de 600 dias.

**T-077 · Para o veterano a tela mostra o semestre de ingresso no lugar do Δ.**
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-078 · O veterano tem trilha de entrada?**
*Proposta:* não tem os doze passos. Tem um bloco curto de «começo de semestre»: confira sua
grade, seu boleto, seus horários, e inscreva-se em DP se precisar.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-079 · Esse bloco de começo de semestre aparece por quantos dias?**
*Proposta:* 21 dias a partir do início das aulas.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-080 · Quais irrecuperáveis são só do veterano?**
Hoje: inscrição em DP (fecha 21/08), Atividades Complementares e prazo de extensão para quem
está acima de 60% do curso.
- [ ] confirmo &nbsp;&nbsp; [ ] acrescentar: `____`

**T-081 · O veterano recebe o mesmo texto de prova que o calouro?**
*Proposta:* o mesmo conteúdo, tom mais seco. O calouro precisa de «chegue 15 minutos antes».
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-082 · A partir de que módulo a formatura entra na conversa?**
*Proposta:* a partir de 60% de progresso, que é o corte que o push de Atividades Complementares
já usa.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-083 · Veterano que voltou de trancamento é calouro para a trilha?**
- [ ] sim, trilha curta &nbsp;&nbsp; [ ] não, veterano normal &nbsp;&nbsp; [ ] outro: `____`

**T-084 · O veterano vê a contagem «N de M» também?**
*Proposta:* sim. O contador não é recurso de calouro, é o mecanismo de honestidade.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-085 · Na base de hoje, 45 dos 54 alunos são veteranos.**
A trilha foi desenhada pensando no calouro. Vale a proporção real?
- [ ] sim, o calouro é o caso de maior valor &nbsp;&nbsp; [ ] rebalancear &nbsp;&nbsp; [ ] outro: `____`

---

## Parte 7 · Pergunta por tipo de calendário

Os onze documentos, com o que cada um tem de próprio. Os arquivos completos de eventos estão
em [docs/push/](push/).

**T-086 · Presencial diurno e noturno** — 46 linhas, 55 disparos, 18 irrecuperáveis, 1 linha no site
(vale para todos os cursos presenciais).
É o único calendário que serve dezenas de cursos por uma linha «catch-all». O aluno vê o
cabeçalho «Todos os cursos presenciais diurnos e noturnos».
- [ ] o cabeçalho pode dizer o nome do curso dele em vez disso &nbsp;&nbsp; [ ] manter genérico

**T-087 · Presencial diurno e noturno** imprime «Diurno: 07h30. Noturno: 19h30» nas provas.
A trilha resolve pelo turno do aluno e mostra um horário só.
- [ ] confirmo &nbsp;&nbsp; [ ] mostrar os dois sempre &nbsp;&nbsp; [ ] outro: `____`

**T-088 · Presencial Direito** — 43 linhas, 52 disparos. 78% igual ao presencial geral.
Vale manter dois documentos ou juntar num só com a diferença marcada?
- [ ] manter dois &nbsp;&nbsp; [ ] juntar &nbsp;&nbsp; [ ] outro: `____`

**T-089 · Quinzenal veteranos** — 50 linhas, 66 disparos, 7 cursos (sem RH).
Um erro numa linha deste PDF atinge sete cursos de uma vez. Precisa de aprovação diferente?
- [ ] mesma aprovação &nbsp;&nbsp; [ ] dupla checagem &nbsp;&nbsp; [ ] outro: `____`

**T-090 · Quinzenal veteranos** não imprime a abertura da disciplina digital do 2º bimestre
(29/09) que os outros híbridos trazem. É omissão do PDF ou a oferta é diferente mesmo?
- [ ] omissão, corrigir &nbsp;&nbsp; [ ] é diferente mesmo &nbsp;&nbsp; [ ] confirmar com a coordenação

**T-091 · Quinzenal ingressantes** — 55 linhas, 71 disparos, 6 cursos.
É o calendário do calouro híbrido, o público-alvo número um da trilha.
- [ ] ele vira o piloto da v1 &nbsp;&nbsp; [ ] outro piloto: `____`

**T-092 · Bissemanal terças e quintas** — 58 linhas, 74 disparos, 2 cursos, **21 linhas exclusivas**
(36% do documento). É o mais diferente da família híbrida.
- [ ] merece validação própria, linha a linha &nbsp;&nbsp; [ ] segue o padrão

**T-093 · Bissemanal** tem a divergência do «01, 10, 17 e 24/09»: a híbrida 2 encontra às
quintas e 01/09 é terça. Provável erro de 03/09 na origem.
- [ ] corrigir para 03/09 &nbsp;&nbsp; [ ] manter como impresso &nbsp;&nbsp; [ ] confirmar

**T-094 · Semanal aos sábados** — 61 linhas, 76 disparos, 6 cursos.
Para este aluno, feriado de segunda a sexta é ruído quase total.
*Proposta:* o recorte por dia de aula é objetivamente correto aqui, não é curadoria.
- [ ] confirmo &nbsp;&nbsp; [ ] mostrar todos os feriados &nbsp;&nbsp; [ ] outro: `____`

**T-095 · Semanal sextas e sábados** — 59 linhas, 74 disparos, 2 cursos de engenharia.
Só este PDF imprime a sessão das 9h do evento de Prática Extensionista, sem a das 19h.
- [ ] está certo, é oferta diferente &nbsp;&nbsp; [ ] é omissão do PDF &nbsp;&nbsp; [ ] confirmar

**T-096 · Semipresencial Direito** — 68 linhas, 90 disparos, **27 irrecuperáveis**, 21 provas.
É o calendário mais pesado do conjunto e o aluno com mais datas de prova do sistema.
*Proposta:* é o caso que sozinho justifica a trilha. Ele encara 32 datas de prova em 21 linhas,
e **nenhuma delas nomeia uma disciplina**.
- [ ] confirmo a prioridade &nbsp;&nbsp; [ ] outro: `____`

**T-097 · Semipresencial Direito** imprime «14 e 28/11» para a Prova Oficial de Estudo Dirigido,
enquanto os outros calendários põem a mesma prova em 27 e 28/11.
- [ ] corrigir para 27 e 28/11 &nbsp;&nbsp; [ ] manter &nbsp;&nbsp; [ ] confirmar

**T-098 · Quinzenal ADS veteranos** — 51 linhas, 67 disparos, 1 curso.
Único curso num PDF próprio. Vale documento separado ou entra no quinzenal de veteranos?
- [ ] separado &nbsp;&nbsp; [ ] juntar &nbsp;&nbsp; [ ] outro: `____`

**T-099 · Quinzenal ADS** imprime «Prova 1 (P1)» no segundo encontro, onde o padrão dos demais
diz P2.
- [ ] corrigir para P2 &nbsp;&nbsp; [ ] manter &nbsp;&nbsp; [ ] confirmar

**T-100 · Semanal Estética** — 60 linhas, 75 disparos, 1 curso.
Curso com prática de laboratório. O calendário não diz nada sobre material de prática.
- [ ] acrescentar linha de material &nbsp;&nbsp; [ ] não é do calendário &nbsp;&nbsp; [ ] outro: `____`

**T-101 · EAD** — 48 linhas, 49 disparos, **só 7 irrecuperáveis** e 4 datas de prova.
É o calendário mais leve, e o aluno mais sozinho.
*Proposta:* para o EAD, o valor da trilha não está nas datas, está nos passos e no ritmo.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-102 · EAD** imprime «Veterenos» (erro de digitação) em 06/10 e «primeiro bimestre» numa
linha de 17 a 30/11, que pertence ao segundo.
- [ ] corrigir as duas &nbsp;&nbsp; [ ] manter como impresso &nbsp;&nbsp; [ ] confirmar

**T-103 · Pedagogia ingressante aponta para o calendário de EAD.**
Está correto em relação ao site. Mas dizer «este é o seu calendário» e mostrar o cabeçalho
«Cursos EAD» para um aluno matriculado como híbrido é uma contradição que ele lê antes de nós.
- [ ] rótulo próprio: `____` &nbsp;&nbsp; [ ] nota explicando a oferta &nbsp;&nbsp; [ ] corrigir a matrícula

**T-104 · Serviço Social ingressante** tem o mesmo caso.
- [ ] mesma decisão de T-103 &nbsp;&nbsp; [ ] outro: `____`

**T-105 · A divergência de 27/10 aparece em 7 dos 11 calendários:**
«Início, no AVA, da 2ª disciplina híbrida do primeiro bimestre», quando pela sequência deveria
ser do **segundo**. É a divergência mais espalhada do conjunto.
- [ ] corrigir nos 7 de uma vez &nbsp;&nbsp; [ ] manter &nbsp;&nbsp; [ ] confirmar com a coordenação

**T-106 · Oito cursos têm só calendário de veterano** (Administração, ADS, Ciências Contábeis,
Eng. Civil, Eng. de Produção, Estética, Fisioterapia) **e quatro têm só de ingressante**
(Ed. Física terça/quinta, Eng. Controle e Automação, Pedagogia, Serviço Social).
Um calouro de Administração híbrida não tem para onde apontar.
*Proposta atual do motor:* usa o documento da outra coorte, com aviso na tela, porque o ritmo
de encontros é propriedade do curso e não da coorte.
- [ ] confirmo &nbsp;&nbsp; [ ] não mostrar nada &nbsp;&nbsp; [ ] outro: `____`

**T-107 · Três cursos híbridos não têm calendário em coorte nenhuma**
(Logística, Engenharia de Software, Gestão Financeira). Hoje esses alunos não recebem push nem
calendário, e ninguém na tela é avisado disso.
- [ ] publicar calendário para eles &nbsp;&nbsp; [ ] a tela diz que não existe &nbsp;&nbsp; [ ] outro: `____`

**T-108 · Quando a instituição desmembrar um PDF compartilhado, quem avisa o sistema?**
- [ ] `____`

---

## Parte 8 · O conjunto irrecuperável

A lista que nenhuma configuração recolhe. Não mede interesse, mede dano. Hoje ela captura de
**7 linhas no EAD a 27 no Direito semipresencial**.

| Regra | O que captura | Por quê |
|---|---|---|
| `prova` | provas, substitutivas, recuperações | não se repete fora das datas do calendário |
| `sub48` | qualquer linha com a janela de 48 horas | o prazo conta da prova perdida, não da descoberta |
| `ultimo-dia` | toda linha «Último dia para…» | trava formatura e nenhuma aula lembra |
| `dp` | inscrição em DP e Adaptação | a janela fecha e não reabre no semestre |
| `extensionista` | prazos de Prática Extensionista | horas obrigatórias para formar |
| `fim-semestre` | fim do semestre e lançamento de notas | depois dela não há o que negociar |
| `financeiro` | vencimentos e prazos de negociação | declarada, sem linha de calendário hoje |

**T-109 · A lista está completa?**
- [ ] confirmo &nbsp;&nbsp; [ ] falta: `____`

**T-110 · Alguma dessas sete não deveria estar?**
- [ ] nenhuma &nbsp;&nbsp; [ ] tirar: `____`

**T-111 · A lista fica visível na aba de Configuração com a contagem ao vivo?**
*Proposta:* sim. É o que impede alguém de esvaziá-la sem perceber, e é a resposta auditável
para «por que o aluno não foi avisado».
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-112 · Quem pode alterar essa lista?**
*Proposta:* só com justificativa registrada e nome de quem alterou.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-113 · O irrecuperável aparece nas quatro faixas, inclusive na antecipada?**
Na antecipada não há calendário. Então: aparece o quê?
*Proposta:* na antecipada aparecem só os irrecuperáveis sem data (documentação), porque os
outros ainda não existem.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-114 · O irrecuperável tem tratamento visual próprio no app?**
*Proposta:* sim, uma marca discreta e constante — nunca vermelho de alarme, que perde efeito
quando 27 itens o usam.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-115 · A regra `financeiro` está declarada mas nenhum calendário traz essas linhas.**
De onde vêm os vencimentos?
- [ ] do financeiro, por integração &nbsp;&nbsp; [ ] não entra na v1 &nbsp;&nbsp; [ ] outro: `____`

**T-116 · «Último dia para protocolar as Atividades Complementares» (07/12) atinge todo mundo?**
Inclusive o calouro do primeiro módulo, que ainda não tem horas a protocolar.
- [ ] todos &nbsp;&nbsp; [ ] só acima de X% do curso: `____`

**T-117 · Quantos avisos um irrecuperável pode gerar?**
Hoje: prova alta = 2 (D-3 e D-0); prazo alto = 2 (D-7 e D-1).
- [ ] confirmo &nbsp;&nbsp; [ ] três para o irrecuperável &nbsp;&nbsp; [ ] outro: `____`

**T-118 · O irrecuperável fura o teto de 3 por semana?**
*Proposta:* fura. O teto corta o resto.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

---

## Parte 9 · Tradução

O valor da trilha não está em filtrar, está em traduzir. Esta é a linha real de Direito:

> **21 e 22/08** — Terceiro encontro presencial da 1ª disciplina híbrida – Prova 1 (P1) do
> primeiro bimestre. *Horário de início. Diurno: 07h30. Noturno: 19h30.*

O aluno precisa de quatro coisas que o documento não diz: qual é a «1ª disciplina híbrida»
dele, se ele vai no dia 21 ou no 22, qual dos dois horários é o dele, e o que acontece se
faltar. Nenhuma se resolve filtrando.

**T-119 · A tradução mostra o nome da disciplina quando o ordinal do PDF casa com a grade.**
Hoje só 18 dos 54 alunos da base têm grade cadastrada.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-120 · Quando não há grade, o card diz «sua turma e disciplina: confirme com a coordenação».**
*Proposta:* sim. Um card que diz «não sei qual é a sua» é útil; um que adivinha é um passivo.
- [ ] confirmo &nbsp;&nbsp; [ ] outro texto: `____`

**T-121 · O horário sai do turno do aluno quando o PDF imprime «Diurno / Noturno».**
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-122 · Quando o PDF não imprime horário nenhum, a trilha não inventa.**
Exemplo real: o quinzenal não imprime horário nas provas — o `detail` delas é a regra das 48
horas. Um 19h30 saído da nossa cabeça faria o aluno perder uma prova das 08h.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-123 · Linha com dois dias de prova e sem dado de turma: a trilha mostra os dois e diz que não sabe.**
*Proposta:* sim, e nunca escolhe. Escolher errado uma data de prova é o pior erro possível.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-124 · Quando o dado de turma chega ao sistema?**
Hoje 2 dos 54 alunos têm `turma` preenchida.
- [ ] `____`

**T-125 · Qual é o texto exato de «depende da sua turma»?**
*Proposta:* «21 ou 22/08 — depende da sua turma. Confirme com a coordenação.»
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-126 · A regra das 48 horas entra em todo card de prova ou só quando o PDF a imprime?**
*Proposta:* entra quando o PDF a imprime — e a regra reativa (T-066) cobre o resto, na hora
em que ela importa.
- [ ] confirmo &nbsp;&nbsp; [ ] em todos &nbsp;&nbsp; [ ] outro: `____`

**T-127 · O local só aparece quando o PDF diz (campus, AVA, canal do YouTube).**
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-128 · O dia da semana é calculado da data. Verificável, então pode.**
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-129 · Quem revisa os títulos traduzidos?**
*Proposta:* coordenação de curso valida a primeira rodada por calendário; depois só o que mudar.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-130 · O nome do professor entra no card da prova?**
O modelo tem `Discipline.teacher`.
- [ ] sim &nbsp;&nbsp; [ ] não, muda demais &nbsp;&nbsp; [ ] outro: `____`

**T-131 · «P1», «P2», «substitutiva», «integrativa» — o aluno entende esses nomes?**
*Proposta:* usar o nome oficial com uma linha do que é, na primeira vez que aparece no semestre.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-132 · Existe glossário no app?**
DP, adaptação, AVA, Bagagem, Prática Extensionista, Atividades Complementares, Estudo Dirigido,
Digitais Especiais, Conteúdo Ponto a Ponto.
- [ ] sim, uma tela &nbsp;&nbsp; [ ] explicação inline &nbsp;&nbsp; [ ] outro: `____`

---

## Parte 10 · O contador e a citação do PDF

Os dois mecanismos que separam **priorizar** de **omitir**.

**T-133 · O rodapé permanente diz «você está vendo 8 das 61 datas do calendário do seu curso»
com link para o completo.**
*Proposta:* sim, sempre visível, na mesma tela, não escondido em menu. O número torna a omissão
visível e quantificada.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-134 · O cabeçalho nunca diz «todas as suas datas».**
Diz «suas próximas datas», «o que se aplica a você». Palavra escolhida aqui é superfície jurídica.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-135 · Todo card carrega o texto oficial literal por baixo do traduzido.**
*Proposta:* sim, num toque. Nosso texto está **em cima do** oficial, nunca **em vez do** oficial.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-136 · As divergências conhecidas aparecem no card do aluno, ou só na ferramenta interna?**
São 13 no conjunto, e o aluno vai ler a data errada no PDF se abrir.
- [ ] aparecem para o aluno &nbsp;&nbsp; [ ] só interno até a coordenação decidir &nbsp;&nbsp; [ ] outro: `____`

**T-137 · Quando a nossa renderização e o PDF divergirem, o PDF ganha e a tela mostra os dois.**
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-138 · O link do PDF abre dentro do app ou no navegador?**
- [ ] dentro &nbsp;&nbsp; [ ] navegador &nbsp;&nbsp; [ ] outro: `____`

**T-139 · A tela do calendário completo mostra o motivo de cada item ter ficado de fora?**
O modelo já guarda `hiddenReason`.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-140 · Guardamos recibo de entrega e de abertura por aluno?**
O modelo já tem `PushDispatch.status` com `Agendado / Enviado / Aberto / Não entregue`.
*Proposta:* sim, e é o que muda a defesa institucional de «estava publicado» para «foi entregue
no celular deste aluno em 03/09 às 09h00, e ele abriu às 12h47».
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

---

## Parte 11 · Quando o sistema não sabe

Três respostas possíveis, e nenhuma delas é o silêncio.

**T-141 · Calendário resolvido pela outra coorte: o que a tela diz?**
Texto atual: «O site publica o calendário de X apenas para veteranos. O ritmo de encontros é do
curso, então este documento vale — mas confira com a coordenação antes de tratar as datas como
definitivas para esta coorte.»
- [ ] confirmo &nbsp;&nbsp; [ ] outro texto: `____`

**T-142 · Esse aviso aparece para o aluno ou só na ferramenta interna?**
- [ ] os dois &nbsp;&nbsp; [ ] só interno &nbsp;&nbsp; [ ] outro: `____`

**T-143 · Sem calendário nenhum: o que a tela diz?**
Texto atual: «O site não publica calendário de X na modalidade Y, em nenhuma coorte. Sem
documento de origem, não há trilha de datas a gerar.»
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-144 · Nesse caso, o aluno ainda recebe a trilha de entrada (os passos)?**
*Proposta:* sim. Os passos não dependem de calendário.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-145 · E recebe algum push?**
*Proposta:* só os personalizados, que nascem do perfil e não do calendário.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-146 · Quem é avisado internamente quando um aluno cai no vazio?**
*Proposta:* a coordenação do curso, numa lista na aba de Configuração, com a contagem.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-147 · Existe prazo para resolver um curso sem calendário?**
- [ ] `____`

**T-148 · A tela de erro oferece um caminho humano («fale com a coordenação»)?**
*Proposta:* sim, com nome e canal, não só «entre em contato».
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

---

## Parte 12 · Os passos da trilha de entrada

Doze passos, cada um declarando em que faixas vale e em que modalidades existe. Hoje a régua de
acolhimento tem seis rótulos **idênticos para os 54 alunos da base** — o que serve para a fila
dos 90 dias e não serve para entregar ao aluno.

| # | Passo | Onde | Faixas | Modalidades | Bloqueante |
|---|---|---|---|---|---|
| 1 | Contrato assinado | secretaria | todas | todas | sim |
| 2 | Instale o app Grupo Anchieta | app | todas | todas | sim |
| 3 | Primeiro acesso ao portal | portal | todas | todas | sim |
| 4 | Confira o boleto e o vencimento | financeiro | todas | todas | não |
| 5 | Entre no AVA | ava | da folga em diante | todas | sim |
| 6 | Confira horários e turma | app | da véspera | todas | sim |
| 7 | Inscreva-se em DP ou Adaptação | secretaria | todas | todas | não |
| 8 | Baixe o e-book da 1ª disciplina | ava | da véspera | híbrido e EaD | não |
| 9 | Participe da ambientação on-line | app | da véspera | híbrido e EaD | não |
| 10 | Participe da integração | campus | da véspera | todas | não |
| 11 | Entenda a Prática Extensionista | app | da folga em diante | todas | não |
| 12 | Entregue a primeira atividade | ava | em curso | todas | não |

**T-149 · Doze passos é demais, de menos ou o certo?**
- [ ] certo &nbsp;&nbsp; [ ] reduzir para: `____` &nbsp;&nbsp; [ ] acrescentar: `____`

**T-150 · A ordem está certa?**
Ela é a do caminho real, não a da importância: o boleto vem antes do AVA porque trava a
matrícula; a integração vem depois do horário porque não dá para ir sem saber onde é.
- [ ] confirmo &nbsp;&nbsp; [ ] outra ordem: `____`

**T-151 · Os cinco passos bloqueantes são os certos?**
Contrato, app, portal, AVA, horários.
- [ ] confirmo &nbsp;&nbsp; [ ] outro conjunto: `____`

**T-152 · O que «bloqueante» significa na prática para o aluno?**
*Proposta:* trava o primeiro dia de aula. Não trava acesso ao app.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-153 · Um passo só é marcado como feito com evidência do sistema.**
Sem evidência, fica aberto. A tela mostra de onde veio o «feito».
- [ ] confirmo &nbsp;&nbsp; [ ] o aluno pode marcar sozinho &nbsp;&nbsp; [ ] outro: `____`

**T-154 · Quais sinais servem de evidência para cada passo?**
- contrato: `____`
- app: `engagement.appInstalled`
- portal: `____`
- AVA: `engagement.lastAccessDaysAgo`
- horários: `____`
- boleto: `____`
- integração: `____`
- primeira entrega: `engagement.deliveryRate` / `academic.lateAssignments`

**T-155 · O passo do e-book e o da ambientação são só de híbrido e EaD.**
O presencial não tem e-book de disciplina híbrida.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-156 · Falta um passo de biblioteca virtual?**
A ambientação cita AVA e biblioteca juntos.
- [ ] acrescentar &nbsp;&nbsp; [ ] não &nbsp;&nbsp; [ ] outro: `____`

**T-157 · Falta um passo de carteirinha / acesso à catraca?**
- [ ] acrescentar &nbsp;&nbsp; [ ] não &nbsp;&nbsp; [ ] outro: `____`

**T-158 · Falta um passo de e-mail institucional?**
- [ ] acrescentar &nbsp;&nbsp; [ ] não &nbsp;&nbsp; [ ] outro: `____`

**T-159 · Falta um passo de «conheça seu coordenador» com nome e canal?**
- [ ] acrescentar &nbsp;&nbsp; [ ] não &nbsp;&nbsp; [ ] outro: `____`

**T-160 · Os passos nascem por modalidade. Nascem também por curso?**
*Proposta:* não na v1. Modalidade e faixa já dão 12 combinações úteis; curso daria 22 listas
para manter.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-161 · Cada passo mostra quanto tempo leva?**
*Proposta:* sim, quando for verdade: «leva 2 minutos».
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-162 · Um passo pendente vira push automático?**
Hoje o `ACO-03` dispara com 3 ou mais etapas pendentes após 30 dias.
- [ ] confirmo &nbsp;&nbsp; [ ] outro corte: `____`

**T-163 · Quem vê o progresso dos passos além do aluno?**
- [ ] acolhimento &nbsp;&nbsp; [ ] coordenação &nbsp;&nbsp; [ ] os dois &nbsp;&nbsp; [ ] outro: `____`

---

## Parte 13 · A cara da UniAnchieta

Três regras já valem para todo texto de push e devem valer para a trilha inteira:
**`#NOME#` é sempre o primeiro nome**, **o texto nunca acusa**, e **todo aviso termina em algo
que dá para fazer hoje**.

**T-164 · Essas três regras valem para a trilha também?**
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-165 · A trilha trata o aluno por «você».**
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-166 · Nada de travessão nos textos do aluno.**
O calendário oficial usa travessão o tempo todo («Feriado – Natal») e num push isso lê como
texto de máquina. A régua já troca por dois-pontos ou ponto final.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-167 · Nada de emoji?**
- [ ] nenhum &nbsp;&nbsp; [ ] só em acolhimento e reconhecimento &nbsp;&nbsp; [ ] outro: `____`

**T-168 · Tamanho máximo de título e corpo de push.**
*Proposta:* título até 40 caracteres, corpo até 180 — o que cabe na notificação sem cortar.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-169 · Nenhum push antes das 07h30 nem depois das 21h00.**
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-170 · Domingo e feriado pode?**
- [ ] pode &nbsp;&nbsp; [ ] não &nbsp;&nbsp; [ ] só o irrecuperável &nbsp;&nbsp; [ ] outro: `____`

**T-171 · A trilha assina como quem?**
- [ ] UniAnchieta &nbsp;&nbsp; [ ] Grupo Anchieta &nbsp;&nbsp; [ ] Centro de Sucesso ao Aluno &nbsp;&nbsp; [ ] outro: `____`

**T-172 · Direção visual: vidro cristalino sobre o gráfico, azul institucional nos cards,
tudo resolvido dentro da aba.**
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-173 · A tela do aparelho usa cores literais, não os tokens do tema.**
Motivo já documentado: a tela de um aparelho é fonte de luz própria e não inverte com o tema
do sistema.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-174 · Sem maçã e sem etiqueta de modelo na simulação do aparelho.**
Marca de terceiro na primeira dobra de sistema institucional é ruído jurídico antes de ser visual.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-175 · Que cor identifica o irrecuperável?**
*Proposta:* não é cor, é rótulo. Vermelho em 27 itens deixa de significar alguma coisa.
- [ ] confirmo &nbsp;&nbsp; [ ] cor: `____`

**T-176 · As categorias têm ícone próprio?**
Avaliação, prazo, aula, feriado, evento, programa.
- [ ] sim &nbsp;&nbsp; [ ] não &nbsp;&nbsp; [ ] outro: `____`

**T-177 · A versão impressa sai com data de geração, link para a versão viva e a frase de que
o documento oficial é o calendário publicado em anchieta.br.**
Quando alguém imprimir em fevereiro e reclamar em novembro, o papel diz onde estava a verdade.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-178 · A trilha impressa cabe em quantas páginas?**
*Proposta:* teto de 2 páginas. Mais que isso não é levado para casa.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-179 · Acessibilidade: contraste, tamanho mínimo de fonte, leitor de tela.**
- [ ] segue o padrão do sistema &nbsp;&nbsp; [ ] requisito específico: `____`

**T-180 · O texto é o mesmo em app, portal e impresso?**
*Proposta:* sim, uma fonte e três renderizações. Escrever separado garante que vão divergir, e
o dia em que divergirem é o dia em que a citação do PDF deixa de valer.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

---

## Parte 14 · O app: ícones, primeira dobra, aposentadoria

**T-181 · Dois elementos na home: «Minhas datas» permanente e «Comece por aqui» temporário.**
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-182 · «Minhas datas» carrega a próxima data no próprio ícone («Prova 1 · sáb 22»).**
Um ícone que carrega informação é olhado; um que carrega só um rótulo é aprendido e ignorado.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-183 · «Comece por aqui» é card de largura inteira, não ícone, com barra de progresso.**
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-184 · A trilha se aposenta visivelmente, com tela de conclusão.**
Desaparecer sem aviso parece bug.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-185 · Depois de aposentada, continua achável no menu?**
- [ ] sim &nbsp;&nbsp; [ ] não &nbsp;&nbsp; [ ] outro: `____`

**T-186 · Em quantos dias ela se aposenta se o aluno não concluir os passos?**
*Proposta:* fica enquanto houver passo bloqueante aberto; os não bloqueantes vencem em 90 dias.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-187 · O nome da aba na ferramenta interna é «Trilha do Aluno».**
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-188 · O nome no app, para o aluno, é «Minhas datas» e «Comece por aqui».**
- [ ] confirmo &nbsp;&nbsp; [ ] outros: `____`

**T-189 · A aba interna fica logo abaixo de Gestão de PUSH.**
PUSH é a metade que fala, Trilha é a metade que responde. Ler as duas juntas na navegação é ler
a coisa certa.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-190 · Atalho «ver a trilha deste aluno» no Onboarding 90 dias e no dossiê 360°.**
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-191 · A aba tem duas sub-abas: Trilha (gerador) e Configuração (curadoria). Não três.**
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-192 · Cada alteração de configuração mostra quantos alunos ela afeta.**
Mudar uma classificação em silêncio é o modo de falha desta aba.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

---

## Parte 15 · Push e trilha: o teto e o corte

A régua gera hoje **749 disparos no semestre**, somando os onze calendários. A média é de 2 a 4
por semana por aluno, mas **a semana de 30/11 chega a 7 a 9 em dez dos onze calendários** — onde
P2, substitutiva, recuperação, prazo de extensão (23/11) e Atividades Complementares (07/12)
colidem.

**T-193 · Existe teto de 3 avisos por semana por aluno?**
*Proposta:* existe. Nove notificações em sete dias treina o aluno a silenciar o app, e o app é o
único canal que chega sem depender de ele abrir alguma coisa.
- [ ] confirmo &nbsp;&nbsp; [ ] outro número: `____` &nbsp;&nbsp; [ ] sem teto

**T-194 · O que o teto corta primeiro?**
*Proposta:* na ordem — programa, evento, feriado, aula, prazo médio. Nunca irrecuperável.
- [ ] confirmo &nbsp;&nbsp; [ ] outra ordem: `____`

**T-195 · O que sai do teto vira um push agregado apontando para «Minhas datas»?**
*Proposta:* sim. Os avisos não desaparecem: viram um só, que aponta para a tela onde a colisão
está desenhada.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-196 · O teto conta push personalizado também, ou só a régua?**
- [ ] os dois juntos &nbsp;&nbsp; [ ] separados &nbsp;&nbsp; [ ] outro: `____`

**T-197 · A trilha acrescenta push novo na v1?**
*Proposta:* não. A v1 adiciona a superfície de consulta e **corta** push.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-198 · O Freio Concorrente suspende também os avisos de calendário?**
Hoje ele suspende réguas concorrentes quando um humano assume o caso.
- [ ] suspende tudo &nbsp;&nbsp; [ ] mantém o irrecuperável &nbsp;&nbsp; [ ] outro: `____`

**T-199 · O aluno pode desligar famílias de aviso?**
*Proposta:* fora da v1. Configurar interesse antes de saber o que as opções significam é
escolher no escuro.
- [ ] confirmo &nbsp;&nbsp; [ ] permitir já &nbsp;&nbsp; [ ] outro: `____`

**T-200 · Se ele desligar, o irrecuperável continua saindo?**
- [ ] sim &nbsp;&nbsp; [ ] não &nbsp;&nbsp; [ ] outro: `____`

**T-201 · Medimos taxa de abertura por categoria para calibrar o teto?**
- [ ] sim &nbsp;&nbsp; [ ] não &nbsp;&nbsp; [ ] outro: `____`

---

## Parte 16 · Os dados que faltam

Quatro lacunas. As três primeiras são pequenas e destravam tudo.

**T-202 · `Student.enrolledAt` (data da matrícula, ISO).**
Sem ela, Δ não existe e a régua de momentos inteira não roda. `daysSinceEnrollment` não
substitui: é relativo a hoje e não diz quando foi.
- [ ] quem entrega: `____` &nbsp;&nbsp; [ ] quando: `____`

**T-203 · `AcademicCalendar.classesStart` declarado, não inferido.**
Já está preenchido nos onze, com 04/08 para todos em 2026/2. Precisa de conferência contra o PDF.
- [ ] conferido &nbsp;&nbsp; [ ] conferir: `____`

**T-204 · `Student.turma`.**
É o que resolve «21 ou 22/08». Hoje 2 de 54.
- [ ] quem entrega: `____` &nbsp;&nbsp; [ ] quando: `____`

**T-205 · `academic.disciplines` populado.**
Hoje 18 de 54, e é o insumo da tradução, que é o valor principal.
- [ ] quem entrega: `____` &nbsp;&nbsp; [ ] quando: `____`

**T-206 · Sala e prédio por turma.**
- [ ] existe onde: `____` &nbsp;&nbsp; [ ] não existe

**T-207 · Data de lançamento de frequência, para o gatilho reativo das 48 horas.**
- [ ] existe onde: `____` &nbsp;&nbsp; [ ] não existe

**T-208 · Situação de documentação pendente, por aluno.**
- [ ] existe onde: `____` &nbsp;&nbsp; [ ] não existe

**T-209 · Confirmação de instalação do app e de aceite de notificação.**
`engagement.appInstalled` existe; aceite de notificação não.
- [ ] acrescentar &nbsp;&nbsp; [ ] não &nbsp;&nbsp; [ ] outro: `____`

**T-210 · Enquanto os dados não chegam, a trilha sai mesmo assim?**
*Proposta:* sai, com degradação graciosa: sem disciplina, mostra o texto oficial e uma linha
honesta. O produto vale proporcionalmente à cobertura, e 18 de 54 já é mais que zero.
- [ ] confirmo &nbsp;&nbsp; [ ] esperar os dados &nbsp;&nbsp; [ ] outro: `____`

---

## Parte 17 · Governança, respaldo e LGPD

**T-211 · A trilha é uma vista, nunca a fonte. Nenhuma data existe só nela.**
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-212 · Quem responde quando a trilha e o PDF divergirem numa data de prova?**
- [ ] `____`

**T-213 · Guardamos versão de cada trilha entregue, para auditoria?**
*Proposta:* sim — a versão do calendário, a data de geração e o recibo de entrega.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-214 · O link HTML fora do login expõe quais dados?**
*Proposta:* nome, curso, modalidade, turno e datas. Sem RA completo, sem CPF, sem nota, sem
situação financeira.
- [ ] confirmo &nbsp;&nbsp; [ ] tirar: `____` &nbsp;&nbsp; [ ] acrescentar: `____`

**T-215 · Quanto tempo o link fica válido depois da formatura ou do cancelamento?**
- [ ] `____`

**T-216 · A geração da trilha de um aluno entra no log de acesso a dado sensível?**
O sistema já tem modo LGPD estrito com máscara de CPF e log de leitura.
- [ ] confirmo &nbsp;&nbsp; [ ] outro: `____`

**T-217 · A trilha aparece no dossiê 360° do aluno para o atendente?**
- [ ] sim &nbsp;&nbsp; [ ] não &nbsp;&nbsp; [ ] outro: `____`

**T-218 · Quem aprova uma mudança de relevância que afeta sete cursos de uma vez?**
Caso real: o quinzenal de veteranos.
- [ ] `____`

**T-219 · As 13 divergências têm prazo para decisão?**
- [ ] `____`

**T-220 · Quem é o dono do documento de cada calendário para 2027/1?**
- [ ] `____`

---

## Parte 18 · O que fica fora da primeira versão

**T-221 · Projeção de datas de 2027.** Fora. Ver T-014.
- [ ] confirmo &nbsp;&nbsp; [ ] discordo: `____`

**T-222 · PDF gerado no servidor por aluno.** Fora — o HTML imprimível cobre o caso com uma
fonte só, e um PDF é uma fotografia com a nossa assinatura que continua errada para sempre.
- [ ] confirmo &nbsp;&nbsp; [ ] discordo: `____`

**T-223 · Preferências de interesse para o aluno.** Fora. Padrão é mostrar; aprender pelo
comportamento depois.
- [ ] confirmo &nbsp;&nbsp; [ ] discordo: `____`

**T-224 · Push novo.** Fora. A v1 corta, não adiciona.
- [ ] confirmo &nbsp;&nbsp; [ ] discordo: `____`

**T-225 · Lista de passos por curso.** Fora — modalidade e faixa bastam na v1.
- [ ] confirmo &nbsp;&nbsp; [ ] discordo: `____`

**T-226 · Dois calendários simultâneos por aluno.** Fora. Ver T-010.
- [ ] confirmo &nbsp;&nbsp; [ ] discordo: `____`

**T-227 · Integração com calendário do celular (.ics).**
Não estava na conversa e é barato. Entra?
- [ ] entra na v1 &nbsp;&nbsp; [ ] v2 &nbsp;&nbsp; [ ] nunca

**T-228 · O que mais fica de fora, e por quê?**
- [ ] `____`

---

## Fechamento

Se for para levar uma frase:

> O produto não é o filtro. É a tradução — dizer «Prova 1 de Teoria Geral do Processo, sábado
> 22/08, 19h30» onde o PDF diz «Terceiro encontro presencial da 1ª disciplina híbrida – P1 do
> primeiro bimestre».

E o que protege a instituição não é mostrar menos com cuidado: é mostrar traduzido, citar o
oficial embaixo, contar em voz alta quantas datas ficaram de fora, e guardar o recibo de entrega.

**Documentos irmãos**

- [docs/push/00_INDICE_E_TRONCO_COMUM.md](push/00_INDICE_E_TRONCO_COMUM.md) — os onze calendários, o que têm em comum e o que é exclusivo
- [docs/onboarding/COMPORTAMENTOS_DO_ALUNO.md](onboarding/COMPORTAMENTOS_DO_ALUNO.md) — o catálogo de comportamentos
- [TRILHA_E_CALENDARIO.md](../TRILHA_E_CALENDARIO.md) — o estudo de decisão que fundamenta as propostas daqui
- [PUSH_CATALOGO.md](../PUSH_CATALOGO.md) — o catálogo de push já validado
