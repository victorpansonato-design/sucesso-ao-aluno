# Trilha do Aluno e Calendário Pessoal

Estudo de decisão — formato, equilíbrio com o calendário oficial e onde isto mora no sistema.

Escrito em 10/09/2026, contra os dados que já estão em `src/data/academicCalendars.ts`,
`src/lib/push.ts` e `src/data/seed.ts`. Nenhuma linha de código foi alterada.

---

## 1. A decisão, antes do raciocínio

Três perguntas foram feitas. As três têm resposta, e as três respostas são diferentes entre
si porque as duas metades da ideia têm físicas diferentes.

| Pergunta | Resposta |
|---|---|
| PDF, HTML ou app? | **As duas metades não têm o mesmo destino.** A trilha inicial vai para um **link HTML por aluno, fora do login, imprimível**. O calendário pessoal vai **dentro do app e do portal**, nativo. PDF por aluno como artefato único: não. |
| Dois ícones na home? | **Um permanente e um temporário.** «Minhas datas» fica para sempre. A trilha ocupa a primeira dobra só enquanto está ganhando o espaço, e se aposenta sozinha, visivelmente. |
| Onde mora aqui dentro? | **Aba nova, logo abaixo de Gestão de PUSH.** Não dentro do Onboarding 90 dias. Duas sub-abas: `Trilha` e `Configuração`. Campo de RA, e a simulação no iPhone que já existe. |

E a resposta para o medo central, que é a parte importante deste documento:

> **A trilha personalizada, feita do jeito certo, é um respaldo institucional mais forte que
> o PDF sozinho — não mais fraco.**

Hoje a instituição só consegue dizer «estava publicado no site». Com a trilha, ela passa a
dizer «foi entregue no celular deste aluno em 03/09 às 09h00, e ele abriu às 12h47». O modelo
já tem onde guardar isso: `PushDispatch` com `status: 'Agendado' | 'Enviado' | 'Aberto' |
'Não entregue'`. Publicação é uma defesa fraca. Entrega com recibo é uma defesa forte. A
seção 5 detalha as cinco regras que fazem a diferença entre as duas.

---

## 2. O que os dados dizem

Números medidos agora, rodando o próprio motor do sistema sobre os onze calendários.

### 2.1 Densidade por calendário

| Calendário | Eventos | Alta | Média | Baixa | Pushes/semestre | Datas de prova |
|---|---:|---:|---:|---:|---:|---:|
| Semipresencial Direito | 68 | 50 | 14 | 4 | **90** | **32** |
| Semanal aos sábados | 61 | 43 | 14 | 4 | 76 | 17 |
| Semanal Estética | 60 | 42 | 14 | 4 | 75 | 17 |
| Semanal sextas e sábados | 59 | 43 | 12 | 4 | 74 | 24 |
| Bissemanal terças e quintas | 58 | 44 | 10 | 4 | 74 | 18 |
| Quinzenal ingressantes | 55 | 37 | 14 | 4 | 71 | 18 |
| Quinzenal ADS veteranos | 51 | 34 | 13 | 4 | 67 | 26 |
| Quinzenal veteranos | 50 | 32 | 14 | 4 | 66 | 18 |
| EAD | 48 | 23 | 20 | 5 | 49 | 4 |
| Presencial diurno e noturno | 46 | 30 | 10 | 6 | 55 | 20 |
| Presencial Direito | 43 | 27 | 10 | 6 | 52 | 20 |

Onze PDFs, 33 linhas no site, 23 cursos distintos, 13 divergências de transcrição já
registradas. Semestre de 01/07 a 25/12. Aulas começaram em 04/08 para calouros presenciais.

### 2.2 O semestre não é uniforme

Média de 2,3 a 3,6 pushes por semana. Mas o pico é 7 a 9 avisos **na semana de 30/11**, em
dez dos onze calendários. É onde P2, substitutiva, recuperação, prazo da Prática Extensionista
(23/11) e Atividades Complementares (07/12) colidem.

Isto define uma coisa: **o push não pode carregar esta ideia sozinho.** Um aluno tranquilo em
setembro leva nove notificações numa semana de dezembro. Nessa semana ele não precisa de mais
aviso, precisa de um lugar onde a colisão está desenhada e dá para planejar. É o argumento
inteiro para existir uma superfície de consulta ao lado da régua de disparo: o push fica magro
porque a consulta é completa.

Eventos de alta relevância por mês, somando os onze calendários: julho 22, agosto 88, setembro
70, outubro 86, novembro 68, dezembro 71. Não há mês tranquilo. Há semanas.

### 2.3 Buracos que a ideia vai encontrar

Três coisas apareceram no levantamento e é melhor saber delas antes de desenhar tela.

**24% da base não tem calendário.** `calendarForStudent` devolve `undefined` para 13 dos 54
alunos do seed. Todos híbridos: Tecnologia em Logística, Engenharia de Software, Gestão
Financeira, Gestão de RH, e um Pedagogia veterano. O motivo está em `entryForStudent`: o bloco
`hibrido` não tem entrada `catchAll`, então curso híbrido sem linha própria no site cai no
vazio. Um calouro híbrido de Gestão de RH hoje não recebe nem push nem calendário.

**Oito cursos têm só calendário de veterano** (Administração, ADS, Ciências Contábeis, Eng.
Civil, Eng. de Produção, Estética, Fisioterapia, RH) e **quatro têm só de ingressante**
(Ed. Física terça/quinta, Eng. Controle e Automação, Pedagogia, Serviço Social). Um calouro de
Administração híbrida não tem para onde apontar.

**Pedagogia ingressante aponta para o calendário de EAD.** Está correto em relação ao site,
que publica assim. Mas numa tela que diz «este é o seu calendário» para um aluno matriculado
como híbrido, mostrar o cabeçalho «Cursos EAD» é uma contradição que o aluno vai ler antes de
nós. Precisa de rótulo próprio ou de nota explicando a oferta.

**Só 28% dos alunos têm disciplinas cadastradas** (15 de 54). Isto importa muito, e a seção 3
explica por quê: é justamente o dado que faz a tradução funcionar.

---

## 3. Por que a ideia funciona — e não é por filtrar

Vale separar duas coisas que a formulação inicial junta. A ideia foi descrita como cruzar
curso, modalidade, módulo e coorte para gerar uma linha do tempo «só com o que se aplica».
Isso é **subtração**. A subtração ajuda, mas é a parte pequena do valor, e é a parte que
carrega todo o risco jurídico.

O valor grande é **tradução**. E é aqui que o calendário oficial falha de um jeito que nenhum
filtro resolve.

### 3.1 O calendário oficial não fala de disciplinas, fala de posições

Esta é uma linha real do calendário de Direito semipresencial:

> **21 e 22/08** — Terceiro encontro presencial da 1ª disciplina híbrida – Prova 1 (P1) do
> primeiro bimestre.
> *Horário de início. Diurno: 07h30. Noturno: 19h30.*

Um aluno lendo isso precisa saber quatro coisas que o documento não diz:

1. **Qual é a «1ª disciplina híbrida» dele.** O calendário fala em ordinais de posição na
   grade. O aluno conhece as disciplinas pelo nome.
2. **Se ele vai no dia 21 ou no 22.** O PDF dá dois dias porque cobre duas turmas. Para o
   aluno, é uma pergunta com uma resposta, e ele não tem a resposta.
3. **Qual dos dois horários é o dele.** Está escrito «Diurno: 07h30. Noturno: 19h30» porque o
   documento serve os dois. O sistema sabe o turno dele (`Student.shift`).
4. **O que acontece se ele faltar.** A regra das 48 horas para substitutiva está no PDF, num
   parágrafo, longe da linha.

Nenhuma dessas quatro é resolvida filtrando. Todas são resolvidas traduzindo. E o sistema já
tem os dados: `Discipline` tem `name`, `teacher`, `format`, `schedule`; `Student` tem `shift`,
`period`, `modality`, `cohort`.

O mesmo evento, traduzido:

> **Prova 1 de Teoria Geral do Processo**
> Sábado, 22/08, às 19h30, no campus. Com o professor da disciplina.
>
> Se você faltar, tem **48 horas** para pedir substitutiva pela secretaria virtual, com
> documento comprobatório.
>
> *No calendário oficial: «Terceiro encontro presencial da 1ª disciplina híbrida – Prova 1
> (P1) do primeiro bimestre», 21 e 22/08 — PDF de Direito semipresencial.*

Nada foi omitido. Tudo foi resolvido. E a última linha é o que mantém a instituição coberta: o
texto oficial continua ali, literal, embaixo do nosso. Isto é a arquitetura que o
`academicCalendars.ts` já escolheu, quando decidiu transcrever inclusive os erros de digitação
(«Veterenos») e as datas que não fecham. A trilha só precisa honrar essa escolha.

### 3.2 A escala do problema, em números

Um aluno de Direito semipresencial encara **32 datas de prova** num semestre, distribuídas em
21 linhas de calendário, e **nenhuma delas nomeia uma disciplina**. Ele tem P1 e P2 de 1ª e 2ª
disciplina híbrida, P1 e P2 da digital de formação específica, prova das Digitais Regulares no
AVA, Prova Oficial de Estudo Dirigido e Digitais Especiais, mais substitutivas e recuperações
de cada família. Sete famílias de prova com nomes que só fazem sentido para quem montou a
grade.

Este é o aluno para quem a ideia vale mais. E ele não precisa que a gente esconda linhas —
precisa que a gente diga o nome da matéria.

### 3.3 Dependência de dados, dita com franqueza

A tradução depende de `academic.disciplines` estar populado, e hoje isso vale para 28% da
base. Onde não estiver, a trilha **não deve inventar nem calar**: mostra o evento com o texto
oficial e uma linha honesta — «sua turma e disciplina: confirme com a coordenação». Um card que
diz «não sei qual é a sua» é útil. Um card que adivinha é um passivo.

Mesma regra para os dois dias de prova: sem `turma` no modelo, a trilha mostra «21 ou 22/08 —
depende da sua turma» e não escolhe. Escolher errado uma data de prova é o pior erro que este
produto pode cometer.

---

## 4. Formato: PDF, HTML ou dentro do app

A dúvida original supõe que as duas metades competem pelo mesmo formato. Elas não competem,
porque a trilha e o calendário têm ciclos de vida opostos.

| | Trilha inicial | Calendário pessoal |
|---|---|---|
| Conteúdo | estável | muda o semestre todo |
| Leituras | 1 a 3 vezes | dezenas |
| Precisa saber que dia é hoje | não | **é a função inteira** |
| Quando é lido | **antes de o aluno ter acesso** | com acesso estabelecido |
| Público que olha junto | família, quem paga | só o aluno |

A quarta linha decide sozinha o formato da trilha.

### 4.1 A trilha não pode morar atrás do login que ela ensina a usar

O trabalho da trilha inclui «instale o app», «faça o primeiro acesso ao portal», «entre no
AVA». Se ela mora dentro do app, ela é inalcançável exatamente para quem mais precisa dela: o
aluno que acabou de assinar contrato e ainda não tem nada instalado. No seed, 89% dos calouros
têm o app — mas esses calouros têm entre 18 e 88 dias de matrícula. **No dia zero, esse número
é zero.**

Então a trilha precisa de um endereço que funcione com um toque num link de WhatsApp ou de
e-mail, sem senha, sem download, num celular. Isso é uma **página HTML por aluno, com link
estável**.

### 4.2 Por que HTML e não PDF, mesmo para a trilha

O PDF perde por quatro motivos, em ordem de importância:

1. **Um PDF é uma fotografia com a nossa assinatura.** Se uma data mudar — e treze
   divergências já foram encontradas nos próprios PDFs oficiais — o arquivo que está no
   celular do aluno continua errado, para sempre, com o nosso nome nele. É pior que o oficial
   estar errado: o oficial tem processo de revisão e é o documento de referência; o nosso seria
   um derivado com autoridade emprestada e sem processo.
2. **É exatamente o risco que se quer evitar.** Um PDF «só com o que importa para você» que
   não menciona o prazo de 21/08 para inscrição em DP, e o aluno perde o prazo: agora existe um
   documento nosso, datado, que não avisou. A defesa «estava publicado» fica mais fraca, não
   mais forte, porque nós mesmos produzimos a peça que omitiu.
3. **PDF não sabe que dia é hoje.** Metade do valor da ideia é «o que vem agora». Num formato
   congelado, essa metade morre no ato da geração.
4. **É aberto uma vez.** Um anexo recebido na matrícula não é reaberto em outubro.

O HTML resolve os quatro: atualiza na origem, carrega selo de «atualizado em», sabe a data de
hoje, abre no celular sem baixar, e **o aluno imprime ou salva em PDF se quiser** — o que
preserva a única vantagem real do PDF (levar para casa, mostrar para quem paga) sem herdar
nenhuma das desvantagens.

Um detalhe que não é detalhe: a versão impressa deve sair com **data de geração, link de volta
para a versão viva e a frase de que o documento oficial é o calendário publicado em
anchieta.br**. Assim, quando alguém imprimir em fevereiro e reclamar em novembro, o próprio
papel diz onde estava a verdade.

### 4.3 O calendário pessoal vai no app, e é onde ele tem que estar

Aqui não há dúvida real. Uma linha do tempo cujo valor é «o que se aplica a mim agora» precisa
do relógio, precisa da notificação e precisa de estar a um toque. O app é o único canal que
chega ao aluno sem depender de ele abrir alguma coisa — o próprio `src/types.ts` já registra
isso na abertura da seção de PUSH. E o portal recebe a mesma coisa, para quem estuda no
notebook.

Este é o argumento que fecha: **a régua de push e o calendário pessoal são a mesma peça vista
de dois lados.** O push é a metade que fala; o calendário é a metade que responde quando o
aluno vai olhar. Hoje o sistema tem só a metade que fala, e é por isso que o pico de nove
avisos numa semana de dezembro é um problema sem solução. Com a metade que responde, o push
pode ficar magro de propósito.

### 4.4 Os dois ícones na home

O instinto de colocar na primeira dobra está certo. O de deixar os dois ali para sempre, não.

A trilha é relevante por 30 a 45 dias e depois vira entulho pelo resto do curso. Ícone
permanente que não serve para nada ensina o aluno a ignorar aquela região da tela — e essa
região é a mesma onde mora «Minhas datas», que a gente quer que ele use por cinco anos.

Proposta:

- **«Minhas datas»** — permanente, primeira dobra, com a próxima data no próprio ícone
  («Prova 1 · sáb 22»). Um ícone que carrega informação é olhado; um que carrega só um rótulo é
  aprendido e depois ignorado.
- **«Comece por aqui»** — card, não ícone, ocupando largura na primeira dobra, com barra de
  progresso dos passos. Some quando os passos terminam, com uma tela de conclusão explícita
  («você concluiu a trilha»), e continua achável no menu. Aposentar-se visivelmente é
  importante: desaparecer sem aviso parece bug.

---

## 5. O equilíbrio com o calendário oficial

Este é o ponto mais delicado e o que mais merece regra escrita, porque é onde o produto pode
causar dano. Cinco princípios. Os dois primeiros resolvem quase tudo.

### Princípio 1 — Nunca subtrair. Ranquear, traduzir e adiar.

A linha do tempo pessoal **não pode ser um subconjunto apresentado como completo**. Precisa ser
o mesmo conjunto, reordenado, com o irrelevante recolhido mas presente e alcançável num gesto.

O mecanismo que torna isso verdade é barato e decisivo: **uma linha permanente, contada, no
rodapé da própria tela.**

> Você está vendo **8 das 61 datas** do calendário do seu curso.
> **Ver o calendário completo →**

Não é item de menu escondido. É uma frase com dois números, sempre visível, na mesma tela. O
número é o mecanismo de honestidade: ele torna a omissão **visível e quantificada**, e elimina
o «ninguém me disse que tinha mais coisa». Um aluno que leu «8 de 61» e não clicou fez uma
escolha informada. Um aluno que viu 8 datas sem saber que havia 61 foi induzido.

Consequência de redação: o cabeçalho **nunca** pode dizer «todas as suas datas». Diz «suas
próximas datas», «o que se aplica a você». Palavra escolhida aqui é superfície jurídica.

### Princípio 2 — O PDF oficial é citação em cada item, não alternativa ao item.

Todo card carrega a fonte: qual PDF, qual linha, como está impressa. Tocar no card abre o texto
literal do calendário embaixo da nossa versão amigável. Nosso texto nunca está **em vez do**
oficial; está **em cima do** oficial.

Isto resolve três coisas de uma vez:

- Quando a nossa renderização e o PDF divergirem, o aluno vê os dois e o PDF ganha.
- As treze divergências já conhecidas ficam expostas em vez de escondidas.
- O respaldo institucional **aumenta**: o aluno não foi só informado, foi informado com a linha
  oficial na mão.

O `academicCalendars.ts` já preserva `dateLabel` como impresso, `detail` com as linhas
complementares e `note` com as divergências. A infraestrutura para isto está pronta.

### Princípio 3 — Separar aplicabilidade, consequência e interesse.

A dificuldade com «importância é relativa» vem de três perguntas diferentes estarem sendo
tratadas como uma. Separadas, duas delas deixam de ser subjetivas:

| Dimensão | Quem decide | Natureza | O que faz na tela |
|---|---|---|---|
| **Aplicabilidade** | o sistema | fato objetivo, binário | **filtra** |
| **Consequência** | a instituição | classificação com critério | **ranqueia** |
| **Interesse** | o aluno | genuinamente subjetivo | **ordena e agrupa, nunca esconde** |

**Aplicabilidade** é factual e é o produto de verdade: o calendário de Direito híbrido
ingressante vale para este aluno; o prazo de inscrição em DP só vale se ele tem DP pendente; o
feriado de segunda não vale para quem só tem aula no sábado. Ninguém discute e não é opinião.

**Consequência** já está definida no código, e bem: em `src/types.ts`, `EventRelevance` é «alta
→ o aluno perde nota, dinheiro ou prazo se não souber». É um critério verificável, não um
palpite sobre gosto. Ele responde «o que este aluno perde se não souber», e essa pergunta tem
resposta institucional.

**Interesse** é onde a relatividade realmente vive: monitoria, Libras, Bagagem, eventos de
extensão, atividades da Consciência Negra. E a resposta para essa parte é: **não decidir pelo
aluno, e o padrão é mostrar.** Se ele quiser recolher uma família, ele recolhe, uma vez, e a
gente lembra. Configurar interesse *antes* de o aluno saber o que as opções significam é pedir
para ele escolher no escuro — motivo pelo qual isso fica fora da v1 (seção 11).

Com as três separadas, a frase «a importância é relativa» deixa de ser um impasse: só o terço
subjetivo é relativo, e esse terço nunca esconde nada.

### Princípio 4 — O conjunto irrecuperável, escrito e auditável.

Existe uma classe de evento que aparece **sempre, com peso cheio, para todo aluno a quem o
calendário se aplica**, independente de perfil, interesse ou configuração. Não é ajustável sem
justificativa registrada.

1. Qualquer coisa com janela de 48 horas — o texto de substitutiva (`SUB48` no código).
2. Toda linha «Último dia para…» — Atividades Complementares (07/12), Bagagem (07/12),
   relatórios de Prática Extensionista (23/11).
3. Fechamento de inscrição em DP e Adaptação (01/07 a **21/08**).
4. Todas as datas de prova, e as substitutivas e recuperações de cada família.
5. Fim do semestre letivo (23/12) e lançamento de notas.
6. Vencimentos financeiros e prazos de negociação.

Estes são os «não podemos omitir». Tudo o mais pode ser ranqueado. A lista precisa ser
constante nomeada, visível na aba de Configuração, com o número de eventos que ela captura
mostrado ao vivo — para que ninguém a esvazie sem perceber. É este item que dá à instituição
uma resposta auditável para «por que o aluno não foi avisado».

### Princípio 5 — Tempo vence conteúdo.

A maior causa de «ninguém me avisou» não é ausência de informação, é informação entregue quando
o aluno já não pode agir. A regra das 48 horas é o caso perfeito: contar isso na trilha de
fevereiro é decoração; contar duas horas depois de a falta ser lançada é decisivo.

Então, para a classe de eventos em que a importância é de fato relativa, o trabalho da trilha
não é **ranquear**, é **agendar**. E há um mecanismo que vale mais que qualquer card de
calendário e não é calendário nenhum: **o aviso reativo das 48 horas**, disparado pela falta,
não pela data. Ele nasce de `PushTemplate`, não de `PushRule`, e provavelmente é o push de
maior valor unitário de todo o sistema.

### 5.1 O risco que sobra, e ele é real

Uma vez que exista uma linha do tempo pessoal, o aluno vai — com razão — tratá-la como
autoritativa e **parar de ler o calendário oficial**. Esse é o medo original, e ele é legítimo.
Mas o mecanismo importa: o risco não é a gente esconder o calendário, é o aluno deixar de
procurar.

O que segura: o contador «8 de 61», a citação do PDF em cada item, o recibo de entrega, e a
redação que nunca reivindica completude. O que não segura: boa intenção.

E vale dizer o outro lado com a mesma clareza. Hoje o aluno **também** não lê o calendário
oficial — ele liga para o suporte. A escolha não é entre «aluno lê o PDF» e «aluno lê a
trilha». É entre «aluno não lê nada e liga» e «aluno lê a trilha, que cita o PDF».

---

## 6. O que o universitário realmente quer, olhando estes calendários

A pedido: pensando como aluno, contra estes onze arquivos. Em ordem de valor.

**1. «Qual é a minha próxima prova, e de que matéria?»**
Único item que, sozinho, justifica o produto. E é o item que o calendário oficial não consegue
responder (seção 3). Vale mais que todo o resto somado.

**2. «São dois dias. Qual é o meu?»**
21 e 22/08. 13 e 14/11. 14 e 28/11. O PDF hedge porque cobre turmas. O aluno precisa de uma
data. Sem o dado de turma, a resposta honesta é «depende da sua turma, confirme com a
coordenação» — nunca duas datas mostradas como se as duas fossem dele.

**3. As 48 horas, na hora da falta.**
Reativo, não calendário. Ver Princípio 5.

**4. «O que eu tenho que fazer que tem prazo e não é prova?»**
Os assassinos silenciosos, porque nenhuma aula lembra e nenhum professor menciona: Atividades
Complementares (07/12), relatórios de Prática Extensionista (23/11), inscrição em DP e
Adaptação (fecha 21/08), Bagagem (07/12), representante de classe (04 a 31/08). Cada calendário
tem 5 a 8 linhas de `prazo`, e são as que mais travam formatura.

As horas de extensão são o caso exemplar: o próprio calendário diz «verifique quantas horas
você ainda precisa cumprir, no App Grupo Anchieta». O aluno que chega em 07/12 devendo horas
tem problema real e nenhum aviso o alcançou na hora em que dava para resolver. **É aqui que a
trilha economiza dinheiro** — e, por ser a família mais fácil de parecer chata e sumir num
filtro, é a que precisa da proteção do Princípio 4.

**5. «Tem aula esta semana?»**
Sete feriados por calendário. Para quem só tem aula no sábado, feriado de segunda é ruído puro
— e recortar por `shift` e `schedule` aqui é objetivamente correto, não é curadoria. Com uma
ressalva que precisa estar no card: recesso muda a grade, então «sem aula» não é «sem entrega».
O AVA continua com prazo.

**6. «Meu material já está disponível?»**
`31/07 — Liberação, no AVA, do e-book da 1ª disciplina híbrida`. Para o aluno híbrido, é o
primeiro momento em que o AVA vira uma coisa concreta. Excelente gancho de onboarding, e está
no calendário de todos os híbridos.

**O que o aluno não quer, e o código já acerta:** entrega de relatório final de monitoria,
datas de lançamento de nota, «Ambientação Vida do Monitor». Todos já marcados `baixa`, todos já
geram zero push — `planFor` devolve lista vazia para relevância baixa. A decisão está tomada e
está correta; a trilha só precisa não desfazê-la.

---

## 7. A variável Δ — dias entre matrícula e início das aulas

Este é o ponto mais afiado da formulação original e o que mais muda o produto. A resposta
precisa de rigor, porque é aqui que ficam as duas tentações perigosas.

Definindo: **D** = data da matrícula, **S** = início das aulas do calendário do aluno,
**Δ = S − D** em dias.

Antes das faixas, o problema: **Δ não é calculável hoje.** `Student` tem
`journey.daysSinceEnrollment` (um número relativo a hoje) e `admissionSemester` (uma string),
mas **não tem a data da matrícula**. E `AcademicCalendar` não declara início de aulas — só dois
dos onze PDFs escrevem «Início das aulas»; os híbridos escrevem «Início, no AVA, da disciplina
digital» e o EAD «Início das Disciplinas Digitais Regulares». Deduzir isso por expressão
regular funcionaria na maioria e erraria em silêncio no resto, que é o pior modo de falha
possível. Ver seção 10.

### 7.1 As faixas

**Δ > 60 — matrícula muito antecipada. Inclui o caso 2027.**

O calendário do semestre dele **não existe ainda**. Isso é fato, não limitação a esconder.

O que se entrega: só a trilha, e só a metade sem data — como funciona a modalidade, quais são
os acessos, instalar o app, documentos pendentes, o que acontece na primeira semana. Mais uma
promessa honesta **com data**: «seu calendário de datas fica disponível aqui em janeiro de
2027».

Duas coisas que **não** se faz, e a segunda é a tentação séria:

- Não mostrar linha do tempo com datas de 2026 para quem começa em 2027.
- **Não projetar 2027 deslocando 2026 em 365 dias.** É o atalho mais tentador e o mais perigoso
  do projeto: produz datas plausíveis e erradas, com a nossa assinatura, num formato que parece
  oficial. Feriados mudam de dia da semana, o calendário acadêmico não é periódico, e uma prova
  na data errada é dano direto.

E uma observação de conteúdo: nesta faixa o risco do aluno **não é perder prazo**, é **esquecer
que se matriculou** — desistência antes de começar. Então o trabalho da trilha aqui é
manutenção de relação, não informação. Conteúdo diferente, cadência diferente.

**Δ 15 a 60 — a faixa confortável.**

Trilha completa, com datas onde há datas: prazo de documentos, contagem regressiva para o
início das aulas. Calendário pessoal mostrando **só o primeiro mês**. Em outubro, dezembro é
ruído — com a exceção do conjunto irrecuperável, que aparece sempre.

**Δ 3 a 14 — «semana que vem começa».**

Faixa de emergência, e é onde a compressão importa. A trilha reduz para as cinco coisas que têm
de acontecer antes do dia 1: acesso ao portal, app instalado, AVA aberto, horário e turma
reconhecidos, e o primeiro dia (onde, que hora, o que levar). O resto espera. O calendário
mostra duas semanas.

Com uma exceção que ilustra o Princípio 4: a inscrição em DP e Adaptação fecha em **21/08**.
Para quem se matricula em 10/08, isso é irrecuperável e vence em onze dias — então entra na
trilha comprimida, mesmo que «passo 9 de 12» seja o lugar natural dele. O conjunto
irrecuperável sobrepõe a regra de compressão. Sempre.

**Δ < 0 — matriculado depois do início das aulas.**

Faixa que não estava na formulação e que os dados dizem ser a **mais comum**. O rótulo das
linhas do site é literalmente «Ingressantes de janeiro à dezembro de 2026»: a entrada é
contínua. Aulas começaram em 04/08. Hoje é 10/09. **Quem se matricula hoje está em Δ = −37.**

O que muda: o aluno **já perdeu coisas**. A trilha precisa dizer o que passou, o que ainda é
recuperável e o que não é, e **não pode mostrar contagem regressiva para uma data no passado** —
que é o bug que qualquer implementação ingênua produz no primeiro dia. Provavelmente é a faixa
que mais gera contato no suporte, e hoje é a menos tratada.

### 7.2 A tabela

| Δ | Trilha | Calendário pessoal | Risco dominante |
|---|---|---|---|
| **> 60** | só a parte sem data + promessa com data | **não existe** — dizer isso | esquecer que se matriculou |
| **15 a 60** | completa, com contagem regressiva | primeiro mês | perder documentação |
| **3 a 14** | 5 passos, comprimida | duas semanas | não conseguir entrar no dia 1 |
| **< 0** | o que passou, o que dá para recuperar | de hoje em diante, sem regressiva | já perdeu prazo e não sabe |

Em todas as quatro, o conjunto irrecuperável aparece integralmente.

---

## 8. Onde isto mora no sistema

### 8.1 Aba nova, não dentro do Onboarding 90 dias

Recomendação: **aba própria, logo abaixo de Gestão de PUSH na barra lateral.**

O motivo não é espaço, é verbo. `OnboardingView` é uma **fila de trabalho**: lista quais
calouros precisam de contato, recorta por janela de 0-30 / 31-60 / 61-90 dias, e serve a equipe
de acolhimento. A aba nova é um **gerador**: recebe um RA e produz um artefato para aquele
aluno. Usuário diferente, gesto diferente. Misturar engorda a fila dos 90 dias, que é
justamente o oposto do que se pediu.

Adjacência com PUSH, por outro lado, é significativa: as duas nascem do mesmo calendário e
terminam no mesmo celular. **PUSH é a metade que fala, Trilha é a metade que responde.** Ler as
duas juntas na navegação é ler a coisa certa.

Sobre a unificação: a ligação não é a aba, são os **atalhos**. Da linha do aluno no Onboarding
90 dias e do dossiê 360°, um botão «Ver a trilha deste aluno» abre a aba já carregada. Um
gerador, alcançável de onde o aluno estiver. Rota `#/trilha` e `#/trilha/:ra`, para que a
coordenação possa mandar por link — mesmo padrão que `#/push/:calendarId` já usa.

Nome: **«Trilha do Aluno»**. Descreve as duas metades sem prometer completude.

### 8.2 Estrutura da aba — simples, como pedido

Duas sub-abas. Não três.

**`Trilha` — o gerador**

- **Um campo: RA.** Aceitando nome também, com `searchKey` de `lib/format`, como
  `StudentPushPanel` já faz. Um campo, não um formulário.
- **Cinco perfis de demonstração**, em `data/trilhaPreview.ts`, acima do campo: híbrido
  ingressante (quinzenal de ingressantes), híbrido veterano (quinzenal de veteranos),
  presencial ingressante, presencial veterano **com duas disciplinas dispensadas** e Direito
  híbrido (sextas e sábados). Não são alunos da base e não entram nela; o **calendário de cada
  um é o PDF real** que o curso e a coorte resolveriam, e só a grade nominal é ilustrativa. São
  atalho, nunca estado: o perfil aberto aparece marcado na fileira e o cabeçalho carrega um
  **«Trocar de aluno»** que esvazia a seleção e devolve o cursor ao campo de RA.
- **Exemplos da base**, quando não há aluno aberto: alunos reais, um por calendário
  publicado, e só quem resolve `exata` **com grade cadastrada**. Curso sem documento, coorte
  resolvida pela vizinha e oferta encerrada (a híbrida de Gestão de RH) ficam de fora do
  atalho — continuam resolvidos ao digitar o RA e contados na Configuração, mas a tela não os
  empurra para quem só quer ver a trilha funcionando.
- **Cabeçalho resolvido**, que é onde a confiança se ganha ou se perde: curso, modalidade,
  turno, coorte, calendário aplicável com link para o PDF, e **Δ em dias, escrito**
  («matriculado 37 dias depois do início das aulas»). Se `calendarForStudent` devolver
  `undefined` — 24% da base hoje — a tela diz isso na cara, com o motivo. Não gera artefato em
  cima de um vazio.
- **A prévia, no iPhone.**
- **Ao lado, a prévia impressa** da trilha, que é o outro artefato.
- **Ações:** copiar link do aluno, abrir versão de impressão.

**`Configuração` — a curadoria**

Quatro blocos, e a lupa de curso vive aqui — é aqui que ela faz sentido, porque no gerador
existe um aluno só e no config se mantém regra por curso (23 cursos, 33 combinações):

1. **Conjunto irrecuperável** — a lista do Princípio 4, com o número de eventos capturados ao
   vivo. O artefato de governança.
2. **Classificação de consequência** — ajuste de `relevance` por evento. Já existe:
   `CalendarEventOverride.relevance`. Reaproveitar, não reconstruir.
3. **Passos da trilha** — lista ordenada. Cada passo com título, o que o aluno faz, onde
   (portal / app / AVA / secretaria), **em que faixa de Δ aparece**, e se é bloqueante. Ponto
   de atenção: os `onboardingSteps` de hoje são seis rótulos **idênticos para todos os 54
   alunos** — uma única combinação na base inteira. O primeiro passo de um aluno de EAD não é o
   primeiro passo de um presencial, então esta lista precisa nascer por modalidade.
4. **Exceções por curso** — a lupa. 23 cursos.

Uma coisa a mais, que o sistema já tem instinto de fazer com `Metric` em todo lugar: **cada
alteração de configuração mostra quantos alunos ela afeta.** Mudar uma classificação em
silêncio é o modo de falha desta aba.

Filtros: modalidade e coorte. Nada além. O pedido de «poucos filtros, só os necessários» está
certo, e a razão é que esta aba tem um aluno por vez — filtro é do gerente de PUSH, não daqui.

### 8.3 A simulação do app — a boa notícia

Já está construída, e bem.

`src/components/device/IPhone.tsx` é um iPhone 16 Pro com as medidas publicadas do fabricante
em pontos: tela 402×874, moldura 12, raio 55, ilha 125×36, safe area 62, home indicator 140×5.
Exporta a constante `IOS`, tem `IosStatusBar`, brilho que responde a dado, e encolhe por
`transform: scale` em vez de refluir — o comentário do arquivo explica por que refluir
produziria um iPhone que não existe.

E `PulsePhoneApp.tsx` é o precedente completo de «a tela é a aplicação», com as três convenções
já documentadas: cores literais em vez de tokens porque a tela de um aparelho é fonte de luz
própria e não inverte com o tema; chassi `aria-hidden` porque é cenografia; sem maçã e sem
etiqueta de modelo, porque marca de terceiro na primeira dobra de sistema institucional é ruído
jurídico antes de ser visual.

Então a recomendação é curta: **`TrilhaPhoneApp` como irmão de `PulsePhoneApp`, dentro do mesmo
`IPhone`, seguindo as mesmas três regras.** A parte difícil está pronta e as convenções estão
escritas.

E, mantendo a direção visual do resto do sistema: vidro sobre o gráfico, azul institucional nos
cards, tudo resolvido **dentro da aba** — o padrão de `DrillPanel`, que abre detalhe sem jogar
ninguém para outra rota.

### 8.4 Uma peça de arquitetura que economiza a metade do trabalho

O artefato deve ser **modelado como dado**, não escrito como markup: uma lista de itens
tipados — data, título traduzido, disciplina resolvida, consequência, citação do PDF, faixa de
Δ. A partir dessa lista, **três renderizações**: a tela do celular, a página imprimível, e a
régua de push.

Isto não é elegância gratuita, é o princípio que o motor de push já segue e declara: «a régua é
DERIVADA do calendário, nunca escrita à mão. Se alguém corrigir a data de uma prova na tela, os
avisos daquela prova se movem junto». A trilha entra como uma quarta derivação da mesma fonte.
Escrever o HTML e a tela do celular separados garante que eles vão divergir — e o dia em que
divergirem é o dia em que a citação do PDF deixa de valer.

---

## 9. Cadência ao longo do semestre

Da densidade medida (seção 2.2), quatro fases:

| Fase | Quando | Push | O que a trilha faz |
|---|---|---|---|
| Pré-início | Δ > 0 | 2 ou 3, total | carrega tudo; é a superfície principal |
| Primeiras 2 semanas | 04/08 a 18/08 | diário, curto | trilha em primeira dobra |
| Rotina | set a nov | 2 a 3 por semana | consulta; push só o irrecuperável |
| Pico | semana de 30/11 | **teto de 3** | desenha a colisão; é o valor máximo do ano |

O teto na semana do pico é a recomendação prática mais importante daqui. Hoje o motor gera 7 a
9 disparos naquela semana. Nove notificações em sete dias treina o aluno a silenciar o app — e o
app é o único canal que chega sem depender de ele abrir alguma coisa. Perder esse canal em
dezembro custa mais que qualquer aviso individual daquela semana.

Com a linha do tempo existindo, o corte é seguro: os avisos que saem do teto não desaparecem,
viram um único push que aponta para a tela onde as seis datas estão desenhadas juntas.

---

## 10. Pré-requisitos de dados

Quatro lacunas. As três primeiras são pequenas e destravam tudo; a quarta é a maior e é
gradual.

**1. `Student.enrolledAt: string` (ISO).** Sem a data da matrícula, Δ não existe e a seção 7
inteira não roda. `daysSinceEnrollment` não substitui: é relativo a hoje e não diz quando foi.

**2. `AcademicCalendar.classesStart: string` (ISO), declarado.** Onze calendários, onze valores
escritos à mão e conferidos contra o PDF. Não inferir por expressão regular: só dois arquivos
escrevem «Início das aulas», e os outros nove usam formulações diferentes.

**3. `Student.turma`.** É o que resolve «21 ou 22/08». Enquanto não existir, a trilha diz que
não sabe — nunca escolhe.

**4. `academic.disciplines` populado.** Hoje 28% (15 de 54). É o insumo da tradução, que é o
valor principal. A degradação é graciosa: sem disciplina, o card mostra o texto oficial e uma
linha honesta. Mas o produto vale proporcionalmente a essa cobertura.

**E um conserto que independe deste projeto:** o buraco de 24% em `entryForStudent`. O bloco
`hibrido` precisa de uma entrada `catchAll`, ou de uma resposta explícita para curso híbrido sem
linha própria no site. Hoje esses alunos não recebem push nem calendário, e ninguém na tela é
avisado disso.

---

## 11. O que não fazer na v1

- **Projeção de 2027.** Ver 7.1. É o atalho que produz datas erradas com a nossa assinatura.
- **PDF gerado no servidor por aluno.** O HTML imprimível cobre o caso com uma fonte só.
- **Preferências de interesse para o aluno.** Configurar interesse antes de saber o que as
  opções significam é escolher no escuro. Padrão: mostrar. Aprender pelo comportamento depois.
- **Fazer da trilha o único lugar onde uma data existe.** Ela é uma vista, nunca a fonte.
- **Notificação nova.** A régua já existe e já tem 49 a 90 disparos. A v1 adiciona a superfície
  de consulta e **corta** push, não adiciona.

---

## 12. Riscos

| Risco | Por que acontece | O que segura |
|---|---|---|
| Aluno para de ler o oficial | a trilha é melhor | contador «8 de 61», citação por item, recibo, redação sem completude |
| Nossa data divergir do PDF | 13 divergências já existem | texto oficial literal em cada card; PDF ganha sempre |
| Turma errada numa prova | dois dias por linha, sem `turma` | dizer «depende da sua turma»; nunca escolher |
| Trilha vira entulho | ícone permanente sem função | aposentadoria visível com tela de conclusão |
| Config esconde o irrecuperável | boa intenção de enxugar | lista nomeada e auditável com contagem ao vivo |
| 24% sem calendário | `catchAll` ausente no bloco híbrido | consertar antes; e a tela dizer quando não sabe |

---

## 13. Faseamento

**Fase 0 — dados.** `enrolledAt`, `classesStart` nos onze calendários, `catchAll` do bloco
híbrido. Nada de tela. Sem isto, o resto adivinha.

**Fase 1 — a aba.** Rota `#/trilha/:ra`, campo de RA, cabeçalho resolvido com Δ escrito,
`TrilhaPhoneApp` dentro do `IPhone`, prévia impressa. Configuração com os quatro blocos.
Atalhos do Onboarding 90 dias e do 360°.

**Fase 2 — o link do aluno.** Página HTML por aluno, fora do login, imprimível, com selo de
atualização e a frase sobre o documento oficial. É o que a matrícula manda por WhatsApp.

**Fase 3 — dentro do app.** «Minhas datas» permanente com a próxima data no ícone, «Comece por
aqui» temporário com progresso. O contador «N de M» e a citação do PDF nascem aqui e não são
opcionais.

**Fase 4 — o reativo.** O push das 48 horas disparado pela falta. Maior valor unitário do
sistema, e o único item desta lista que não é calendário.

---

## Uma linha, se for para levar só uma

O produto não é o filtro. É a tradução — dizer «Prova 1 de Teoria Geral do Processo, sábado
22/08, 19h30» onde o PDF diz «Terceiro encontro presencial da 1ª disciplina híbrida – P1 do
primeiro bimestre».

E o que protege a instituição não é mostrar menos com cuidado. É mostrar traduzido, citar o
oficial embaixo, contar em voz alta quantas datas ficaram de fora, e guardar o recibo de
entrega.
