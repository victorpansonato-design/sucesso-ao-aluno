# Comando para o Claude Code - Trilha e Calendário Pessoal

## Objetivo

Implemente no projeto existente as funcionalidades **Minhas datas** e **Comece por aqui**, utilizando as imagens deste pacote como referência de UX/UI.

Antes de alterar qualquer arquivo:

1. Leia este documento até o fim.
2. Leia `documentacao/PLANEJAMENTO_ORIGINAL.md`.
3. Inspecione a arquitetura, rotas, componentes, tipos, dados e tokens visuais já existentes.
4. Identifique o que já está implementado e reutilize componentes existentes.
5. Apresente um plano curto de arquivos que serão criados ou alterados.

Não reconstrua o aplicativo do zero. Não remova funções existentes. Não troque bibliotecas, arquitetura ou identidade visual sem necessidade comprovada.

---

## Regra funcional obrigatória sobre provas P1 e P2

### As datas específicas presentes nas imagens são apenas ilustração visual

Algumas referências mostram exemplos como:

- `Prova 1 - Economia das Decisões Empresariais`;
- `Sábado, 19 de setembro`;
- horário, sala, professor e contagem regressiva para essa prova.

Essas informações foram usadas apenas para demonstrar visualmente a hierarquia da interface. **Não implemente esse nível de precisão para provas de disciplinas.**

Na operação real, o sistema possui somente os **períodos institucionais de avaliações P1 e P2 definidos nos calendários acadêmicos**. Ele não possui nem calcula o dia exato da avaliação de cada disciplina.

A data específica de cada prova é variável e normalmente é informada pelo professor durante a aula. Essa informação não está computada no sistema e não deve ser inferida, fabricada, projetada ou associada automaticamente a uma disciplina.

### Como deve aparecer na implementação real

Em vez de:

> Prova 1 de Economia das Decisões Empresariais - 19/09 às 19:10

Mostrar:

> Período de avaliações P1  
> De DD/MM a DD/MM  
> A data de cada disciplina será informada pelo professor durante a aula.

Para P2, aplicar exatamente a mesma regra:

> Período de avaliações P2  
> De DD/MM a DD/MM  
> Consulte as orientações do professor da disciplina.

### Restrições técnicas

- Não criar evento individual de prova por disciplina.
- Não adicionar campos de data de prova individual ao modelo apenas para reproduzir o mockup.
- Não associar automaticamente disciplina, professor, sala ou horário a uma avaliação P1/P2.
- Não calcular uma data provável dentro do período.
- Não usar IA para adivinhar a data.
- Não permitir lembrete com uma data individual inexistente.
- O botão `Criar lembrete` pode criar lembretes para o início e/ou encerramento do **período de avaliações**, nunca para uma prova individual que não esteja registrada.
- Datas exatas de outros eventos podem ser exibidas quando existirem no calendário oficial: prazos, início das aulas, feriados, entregas institucionais e outros eventos documentados.
- Se um dado não existir, apresentar uma mensagem honesta. Nunca preencher lacunas com valores fictícios.

Essa regra prevalece sobre qualquer texto ou conteúdo apresentado nas imagens.

---

## Fonte de verdade e princípio do produto

O calendário acadêmico oficial continua sendo a fonte de verdade. O calendário pessoal deve:

- traduzir a informação para uma linguagem simples;
- organizar os eventos mais próximos;
- indicar o que se aplica ao perfil do aluno quando essa relação for segura;
- manter acesso ao texto e documento oficial;
- nunca criar informações que não estejam disponíveis;
- nunca se apresentar como substituto integral do calendário oficial.

Manter a frase e o contador:

> Você está vendo N de M datas. Ver calendário completo.

Quando houver divergência entre uma interpretação do sistema e o documento oficial, o documento oficial prevalece.

---

## Mapa das imagens

### Referências de identidade

#### `referencias/01-app-real-home.png`

Tela real do aplicativo Grupo Anchieta. É a principal fonte de verdade para:

- azul institucional;
- fundo preto;
- cartões grafite;
- tipografia;
- cabeçalho;
- barra inferior;
- botão flutuante de atendimento;
- densidade e arredondamento dos componentes.

#### `referencias/02-esboco-home-botoes.png`

Esboço conceitual mostrando as entradas `Minhas datas` e `Comece por aqui`. Use apenas para compreender a posição e finalidade dessas funções. Não copie as setas azuis nem as proporções improvisadas do esboço.

---

## Fluxo 1 - Minhas datas

### `interfaces/minhas-datas/01-minhas-datas-inicial.png`

Tela inicial da funcionalidade.

Implementar:

- visão `Próximas` como padrão;
- visão `Mês` como alternativa;
- filtros `Tudo`, `Provas`, `Prazos` e `Aulas`;
- linha do tempo cronológica;
- contador `N de M datas`;
- acesso ao calendário completo.

Na versão real, substitua qualquer prova específica mostrada na imagem por um card de **Período de avaliações P1 ou P2**, com data inicial e final vindas do calendário oficial.

### `interfaces/minhas-datas/02-detalhes-da-data.png`

Referência para o detalhe de um evento.

Reutilizar o layout para eventos que realmente possuam data exata. Para P1/P2, adaptar o conteúdo para:

- tipo `Período de avaliações`;
- intervalo inicial e final;
- explicação de que a data de cada disciplina é informada pelo professor;
- lembrete do início ou encerramento do período;
- acesso ao texto e fonte oficial.

Professor, sala, disciplina e horário apresentados na imagem são placeholders visuais e não devem ser cadastrados automaticamente.

Ações previstas:

- `Criar lembrete`;
- `Adicionar ao calendário`, somente quando houver evento ou período válido;
- `Ver texto e fonte oficial`;
- `Compartilhar`;
- `Preciso de ajuda`, enviando o contexto do evento ao atendimento.

### `interfaces/minhas-datas/03-visao-mensal.png`

Visão do mês. O calendário compacto serve para seleção de data; a lista abaixo continua sendo a principal forma de leitura.

Requisitos:

- marcar no calendário apenas datas ou inícios/finais de períodos existentes;
- ao tocar em um dia, atualizar a lista;
- não gerar pontos para provas individuais não registradas;
- manter estados de carregamento, vazio e erro;
- manter acessibilidade para navegação entre meses.

### `interfaces/minhas-datas/04-calendario-completo.png`

Visão completa e institucional.

Implementar:

- identificação do calendário aplicável;
- modalidade, curso e semestre;
- busca por texto;
- filtro por mês;
- lista completa de eventos;
- link para abrir o PDF oficial;
- data da última atualização;
- fonte institucional claramente visível.

---

## Fluxo 2 - Comece por aqui

### `interfaces/comece-por-aqui/01-comece-por-aqui-inicial.png`

Tela inicial da trilha. Deve responder somente: **qual é o próximo passo do aluno?**

Implementar:

- progresso geral;
- quantidade de etapas concluídas;
- próximo passo em destaque;
- botão principal dinâmico;
- prévia compacta da jornada;
- acesso à trilha completa.

O card da home é temporário. Ao concluir os passos obrigatórios, ele deixa de ocupar destaque, mas a trilha continua acessível no menu `Mais`.

### `interfaces/comece-por-aqui/02-instrucoes-acesso-ava.png`

Detalhe de uma etapa.

Cada etapa deve possuir, quando aplicável:

- título e posição na trilha;
- instruções curtas e numeradas;
- dado útil, como o RA;
- ação principal;
- ajuda contextual;
- opção `Fazer depois` apenas para etapas não bloqueantes;
- explicação de como a conclusão será reconhecida.

Sempre que possível, detectar a conclusão automaticamente. Evitar depender de um botão livre `Marcar como concluído`.

### `interfaces/comece-por-aqui/03-minha-trilha-completa.png`

Visão de todos os passos organizada em grupos recolhíveis.

Estados:

- verde: concluído;
- azul: em andamento;
- cinza: próximo ou ainda não iniciado.

Não renderizar doze cards grandes simultaneamente. Usar grupos expansíveis, mantendo o passo atual visível e com a ação `Continuar`.

### `interfaces/comece-por-aqui/04-trilha-concluida.png`

Estado final da jornada.

Implementar:

- confirmação de 100%;
- resumo do que o aluno já consegue utilizar;
- botão principal `Ver minhas datas`;
- botão secundário `Ir para o início`;
- link `Rever minha trilha`;
- aviso de que a trilha permanecerá no menu `Mais`.

A conclusão deve ser madura e institucional, sem confetes, medalhas ou gamificação infantil.

---

## Comportamento dos principais subbotões

### Minhas datas

- `Próximas`: lista cronológica a partir de hoje.
- `Mês`: calendário compacto com lista do mês abaixo.
- `Tudo`: todos os eventos aplicáveis.
- `Provas`: períodos P1/P2, substitutivas e recuperações somente conforme o calendário oficial.
- `Prazos`: entregas e datas-limite oficiais.
- `Aulas`: encontros e alterações que possuam dados oficiais.
- `Ver detalhes`: abre o detalhe do evento ou período.
- `Ver calendário completo`: abre a lista integral e o documento oficial.
- `Criar lembrete`: usa somente data ou intervalo oficialmente disponível.

### Comece por aqui

- `Abrir AVA`, `Abrir Portal`, `Ver horários` e similares: ação principal dinâmica conforme a etapa.
- `Como fazer`: instruções curtas e específicas.
- `Estou com dificuldade`: abre ajuda contextual.
- `Fazer depois`: somente em etapa não bloqueante.
- `Continuar`: retoma a etapa ativa.
- `Rever`: consulta uma etapa concluída sem alterar o progresso.
- `Ver todos os passos`: abre a trilha agrupada.

---

## Direção visual

As imagens são referências de composição, não arquivos para serem usados como telas estáticas.

- Recrie as interfaces com componentes reais.
- Use os componentes, tokens e ícones já existentes no projeto.
- Preserve o azul institucional, fundo preto, cartões grafite e navegação inferior do aplicativo.
- Mantenha uma única ação principal azul por tela.
- Use verde somente para sucesso ou conclusão.
- Use laranja somente para atenção e prazo.
- Evite roxo, neon, glassmorphism exagerado, ilustrações, efeitos 3D e aparência futurista.
- Garanta contraste, áreas de toque adequadas e responsividade.
- Não copie inconsistências ou textos de exemplo das imagens para os dados reais.

---

## Ordem recomendada de implementação

1. Corrigir e validar os dados necessários descritos no planejamento original.
2. Criar um modelo tipado único para eventos e períodos.
3. Criar componentes visuais compartilhados.
4. Implementar `Minhas datas` e suas subvisualizações.
5. Implementar `Comece por aqui` e os estados das etapas.
6. Integrar as entradas na home e no menu `Mais`.
7. Adicionar estados de carregamento, vazio, erro e dados incompletos.
8. Testar com diferentes modalidades, cursos, turnos e coortes.
9. Rodar lint, typecheck, testes e build de produção.

---

## Critérios de aceite

- O visual respeita o aplicativo existente.
- Nenhuma função anterior foi quebrada.
- As duas novas entradas funcionam em mobile e desktop/preview.
- Nenhuma prova individual recebe data inventada.
- P1 e P2 aparecem somente como períodos oficiais.
- A mensagem sobre a data específica ser informada pelo professor está presente.
- O documento oficial permanece acessível.
- Dados ausentes nunca são preenchidos por suposição.
- A trilha possui estados concluído, atual e futuro.
- O card temporário da trilha possui regra clara de encerramento.
- Lint, typecheck, testes e build finalizam sem erro.

Ao terminar, entregue um resumo dos arquivos alterados, decisões tomadas, limitações encontradas e resultados dos testes executados.
