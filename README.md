# Centro de Sucesso ao Aluno · UniAnchieta

Cockpit operacional de **retenção e acolhimento humanizado** do Centro Universitário Padre
Anchieta. Não é um CRM de vendas, não é sistema de cobrança e não é o portal do aluno — é a
central de trabalho diário dos Especialistas de Sucesso ao Aluno e das coordenações de curso.

> A tecnologia encontra o sinal. A IA ajuda a interpretar. O sistema prioriza.
> **O especialista humano atua.** O resultado é registrado.

---

## O que o sistema faz

```
DADOS → RADARES → HEALTH SCORE → CLASSIFICAÇÃO → PRIORIZAÇÃO
      → ESPECIALISTA → AÇÃO HUMANIZADA → REGISTRO → FOLLOW-UP
      → RESULTADO → os dados voltam e recalibram os radares
```

Três perguntas precisam ser respondidas em segundos:

1. **Quem precisa de mim agora?** → Cockpit e Fila de Atendimento, ordenadas por SLA.
2. **Por que este aluno apareceu?** → sinais, evidências e composição do Health Score.
3. **O que devo fazer?** → diretriz do radar, playbook e Copiloto de Abordagem.

---

## Decisões de arquitetura que importam

### Health Score derivado, nunca armazenado
O score é recalculado pelo motor (`src/lib/healthScore.ts`) no boot e após **toda** mutação.
Registrar uma interação move o número de verdade. Cada ponto é atribuído a uma dimensão com
uma justificativa em linguagem natural, porque o score é *indicador para orientar a equipe —
nunca uma sentença sobre o aluno*.

### Pesos parametrizados por modalidade
Contar a presença física de um aluno híbrido do mesmo jeito que a de um presencial está errado.
Os perfis são explícitos e editáveis em **Governança**, e editá-los reclassifica a base na hora:

| Dimensão | Presencial | Híbrido | EaD 100% |
|---|---:|---:|---:|
| Desempenho acadêmico | 30% | 28% | 28% |
| Presença | **25%** | 15% | 5% |
| Engajamento no AVA | 15% | **27%** | **37%** |
| Situação financeira | 20% | 20% | 20% |
| Relacionamento | 10% | 10% | 10% |

### Cockpit é do atendente; Dashboard é da gestão
São públicos com horizontes diferentes. O atendente abre o Cockpit para saber o
que fazer nos próximos dez minutos — quatro números do turno, duas pizzas e a
fila, tudo acima da dobra. A coordenação abre o **Dashboard** para saber se o mês
está funcionando, e lá o scroll é bem-vindo porque quem entra veio analisar.
Empilhar os dois na mesma tela foi tentado e deixou a fila abaixo da dobra
justamente para quem tem menos tempo.

### Um caso, um lugar
A fila abre o caso em **tela cheia**. Não existe mais um painel estreito ao lado
da lista *e* um dossiê 360° em outra rota mostrando a mesma identidade, os mesmos
sinais, o mesmo score e a mesma linha do tempo: o atendente lia tudo duas vezes e
não sabia qual dos dois estava atualizado. O que o dossiê tinha a mais virou aba
dentro do caso, e a lista ganhou a largura inteira — o que era um cartão de duas
linhas hoje é uma tabela com aluno, caso, prioridade, score, SLA e responsável.

### A equipe é uma matriz, não uma lista
Cada especialidade existe em Presencial **e** em Híbrido, mais a camada
transversal de Retenção, Onboarding e Experiência. Uma queda de nota no
presencial se resolve com monitoria e coordenação de curso; a mesma queda no
híbrido quase sempre é ritmo perdido entre dois encontros, e se resolve no AVA.
Por isso `src/lib/routing.ts` exige especialidade **e** modalidade para dizer que
um caso é seu, e por isso o seletor de função na sidebar troca a operação inteira
— fila, pool sem dono e números do turno — e não apenas um rótulo.

### Uma tabela de censo, não uma constante por componente
Os agregados institucionais vivem em `src/data/institution.ts`, como uma tabela de **células**
— curso × modalidade × período acadêmico × coorte — e não como totais soltos por tela. O motivo é
o requisito mais fácil de quebrar num painel: qualquer combinação de filtro tem de **fechar**.
Como todo agregado é a soma de inteiros de células, filtrar é somar um subconjunto, e a conta
nunca derrapa no arredondamento. Só seis números são escritos à mão (monitorados, ingressantes,
em atenção, alto risco, retenção e a pendência da régua); tudo o mais é derivado deles pelo
método do maior resto, com difusão de erro onde os totais são pequenos.

Nada usa `Math.random`. A mesma célula produz o mesmo valor em todo render, em toda sessão — o
que também é o que permite comparar período com período sem inventar o passado duas vezes.
`src/data/population.ts` virou uma fachada de duas dimensões sobre essa tabela, então Cockpit,
Jornada, Onboarding e Base de Alunos não conseguem mais discordar entre si.

### O ponto de hoje é o censo, não uma aproximação dele
As séries históricas (`src/lib/cockpit.ts`) são funções determinísticas do escopo e da data, e
toda curva **termina exatamente** no número que o indicador ao lado mostra. Um gráfico cujo
último ponto discorda do KPI vizinho destrói a confiança na tela inteira, e é o erro mais comum
em painel mockado.

### Regra dos 90 dias
Calouro em adaptação e aluno em evasão não são o mesmo problema. Alunos dentro da janela de
onboarding ficam **fora do Radar de Evasão** e são acompanhados por uma régua própria com marcos
de ambientação, para não roubar SLA de quem está em risco real nem diluir a taxa de retenção.

### SLA em horas úteis
Um caso crítico aberto às 21h40 de uma sexta vence na manhã de segunda, não à 01h40 do sábado.
`src/lib/sla.ts` conta apenas dentro da janela de atendimento (configurável), e todos os
contadores da fila usam um único tick de 30 s compartilhado.

### Máquina de estados estrita do caso
```
Pendente ──▶ Em Contato ──▶ Aguardando Retorno
   │            ├──▶ Acordo Firmado      (terminal · +pontos)
   │            ├──▶ Evasão Inevitável   (terminal · aprendizado)
   │            └──▶ Encaminhado
   └──▶ Cancelado
```
A UI só renderiza transições que a máquina permite (`src/lib/caseFlow.ts`). Não existe botão
que possa falhar ou surpreender.

### Freio Concorrente
Ao assumir um caso, as réguas automáticas concorrentes são suspensas — o aluno não recebe
e-mail de cobrança no meio de uma conversa de retenção. É um objeto real com réguas suspensas
nomeadas e contagem de disparos bloqueados, não um selo.

### Copiloto de Abordagem
Três ângulos deliberadamente diferentes — **Pedagógica/Empática**, **Financeira/Negocial** e
**Carreira/Futuro** — ordenados por aderência aos sinais reais do aluno, com os fatos na mesa,
hipóteses de causa-raiz e uma lista de **o que não fazer**. Geração determinística e auditável
(`src/lib/copilot.ts`); a decisão e o registro permanecem humanos.

---

## Telas

| Rota | Tela | Para quê |
|---|---|---|
| `#/cockpit` | Cockpit | O turno do atendente, sem rolar a página: 4 números seus, duas pizzas e quem precisa de você agora |
| `#/dashboard` | Dashboard (Gestão) | Índices executivos, evolução por nível de atenção, quatro pizzas, jornada, operação e automação × humano |
| `#/fila` | Fila de Atendimento | Lista em largura cheia; clicar abre o caso em tela cheia com anterior/próximo |
| `#/alunos` | Base de Alunos | Diretório com ordenação, filtros compostos, paginação e export |
| `#/alunos/:id` | Dossiê 360° | Identidade, score explicável, alertas, linha do tempo (aberto pela Base) |
| `#/radares/:radar` | Radares | Definição, gatilhos, diretriz e precisão medida de cada radar |
| `#/onboarding` | Onboarding 90 dias | Régua de acolhimento com funil de marcos |
| `#/jornada` | Jornada por Modalidade | Funis e perfis de peso de Presencial / Híbrido / EaD |
| `#/indicadores` | Indicadores | Tabelas executivas e as exportações em CSV / relatório |
| `#/equipe` | Equipe | Estrutura matricial, carga real e roteamento por fila |
| `#/playbook` | Playbook | Protocolos por radar com roteiro e "não fazer" |
| `#/governanca` | Governança | Pesos, SLAs, janela de onboarding, freio, LGPD |

Roteamento por hash: o botão **voltar** do navegador funciona e qualquer tela é compartilhável.

---

## Relatórios

Exportações em CSV com separador `;` e BOM UTF-8 — abrem direto no Excel em português sem
quebrar acentuação. Disponíveis em **Indicadores**: base de alunos, casos e SLA, intervenções e
o relatório executivo de **motivos de evasão por curso e campus**, alimentado pela taxonomia
fixa preenchida no encerramento de cada caso. `Imprimir / PDF` gera a versão executiva.

---

## Stack

- **React 19** + **TypeScript** em `strict` (0 erros, `noUnusedLocals`, `noUnusedParameters`)
- **Vite 6** com chunks separados para react / motion / icons
- **Tailwind CSS 4** sobre uma camada de tokens semânticos (`src/index.css`) — claro e escuro
  são a mesma folha de estilo com os tokens trocados
- **Motion** para as microinterações (spring em layout, ease-out em entradas, saídas sempre
  mais rápidas que entradas)
- **lucide-react** para ícones
- Estado local persistido com versionamento de schema (`csa.v4.*`), sem back-end

Nenhuma dependência de rede em tempo de execução. Todo o estado vive no navegador.

---

## Rodando

```bash
npm install
npm run dev       # http://localhost:3000
npm run lint      # tsc --noEmit, strict
npm run build     # typecheck + bundle de produção
npm run preview   # serve o build
```

---

## Estrutura

```
src/
  types.ts                  contrato de domínio
  lib/
    healthScore.ts          motor de score explicável e parametrizado
    cockpit.ts              séries, intervenções, desfechos e comparação de período
    routing.ts              especialidade × modalidade → de quem é o caso
    radars.ts               os 5 radares: propósito, gatilhos e detecção real
    sla.ts                  SLA em horas úteis + clock compartilhado
    caseFlow.ts             máquina de estados do caso
    copilot.ts              geração dos 3 ângulos de abordagem
    exporters.ts            CSV/relatórios executivos
    router.ts               roteador por hash
    storage.ts              persistência versionada
    format.ts               formatação pt-BR
  data/
    catalog.ts              cursos, campi, modalidades
    institution.ts          censo por célula — única fonte dos agregados
    population.ts           fachada modalidade × coorte sobre o censo
    seed.ts                 base fictícia de 54 alunos e 17 casos
  state/AppContext.tsx      store único; toda mutação é transacional
  components/
    ui/                     primitivos do design system (inclui Plot: linha,
                            coluna empilhada e barra ranqueada)
    cockpit/                os painéis das cinco linhas do Cockpit
    domain/                 SLA, composição de score, timeline, workflow
    layout/                 sidebar, header, command palette, seletor de função
    modals/                 interação, copiloto, encerramento, etc.
    brand/                  wordmark Grupo Anchieta
  views/                    as 12 telas
```

---

## Aviso

**Toda a base é fictícia** e existe para validar o modelo operacional. Nenhum número deste
ambiente deve ser apresentado como resultado de produção. O tratamento de dados reais exige a
declaração de finalidade, controle de acesso e revisão humana descritos em **Governança**.
