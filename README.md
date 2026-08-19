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
| `#/cockpit` | Cockpit | Quem precisa de atenção agora, saúde da base, matriz de radares |
| `#/fila` | Fila de Atendimento | Workspace do especialista: lista + workflow completo do caso |
| `#/alunos` | Base de Alunos | Diretório com ordenação, filtros compostos, paginação e export |
| `#/alunos/:id` | Dossiê 360° | Identidade, score explicável, alertas, linha do tempo unificada |
| `#/radares/:radar` | Radares | Definição, gatilhos, diretriz e precisão medida de cada radar |
| `#/onboarding` | Onboarding 90 dias | Régua de acolhimento com funil de marcos |
| `#/jornada` | Jornada por Modalidade | Funis e perfis de peso de Presencial / Híbrido / EaD |
| `#/indicadores` | Indicadores | Base, operação, intervenção, retenção, precisão + exportações |
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
- Estado local persistido com versionamento de schema (`csa.v3.*`), sem back-end

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
    seed.ts                 base fictícia de 54 alunos e 17 casos
  state/AppContext.tsx      store único; toda mutação é transacional
  components/
    ui/                     primitivos do design system
    domain/                 SLA, composição de score, timeline, workflow
    layout/                 sidebar, header, command palette, toaster
    modals/                 interação, copiloto, encerramento, etc.
    brand/                  wordmark Grupo Anchieta
  views/                    as 11 telas
```

---

## Aviso

**Toda a base é fictícia** e existe para validar o modelo operacional. Nenhum número deste
ambiente deve ser apresentado como resultado de produção. O tratamento de dados reais exige a
declaração de finalidade, controle de acesso e revisão humana descritos em **Governança**.
