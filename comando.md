# 🎓 PROMPT MESTRE DE ARQUITETURA & DESIGN SYSTEM — SISTEMA SUCESSO DO ALUNO UNIANCHIETA
> **Destinatário:** Claude Code (Opus 5)  
> **Objetivo:** Assumir o desenvolvimento completo, refinamento de pontas soltas, evolução de UX/UI para nível classe mundial (estilo Apple/Linear/Vercel) e implementação ponta a ponta da esteira operacional dos Especialistas de Retenção & Acolhimento da UniAnchieta.

---

## 📌 1. CONTEXTO E PROPÓSITO DO SISTEMA

O **Sistema Sucesso do Aluno UniAnchieta** é uma plataforma de **Inteligência Preditiva de Retenção e Cockpit Operacional de Acolhimento Humanizado** do Centro Universitário Padre Anchieta (UniAnchieta).

### 🎯 Princípio Fundamental (O que o sistema É e o que NÃO É)
* **NÃO É** um CRM de vendas nem um sistema de cobrança agressiva.
* **NÃO É** o ambiente do aluno (não é portal do aluno nem AVA).
* **É** a central de inteligência e trabalho diário dos **Especialistas de Sucesso do Aluno e Coordenadores de Curso**, focada em:
  1. Identificar sinais silenciosos de evasão antes que o aluno decida trancar a matrícula.
  2. Intervir com acolhimento humano personalizado (escuta ativa, apoio pedagógico, mediação financeira preventiva).
  3. Proteger o aluno em risco contra bombardeio de mensagens automatizadas (mecanismo de **Freio Concorrente**).

---

## 🔍 2. DIAGNÓSTICO DO ESTADO ATUAL & PONTAS SOLTAS IDENTIFICADAS

Ao analisar o código e os requisitos acadêmicos, foram mapeadas as seguintes **lacunas que o Claude Code deve resolver prioritariamente**:

### ⚠️ Pontas Soltas Críticas
1. **Regra dos 90 Dias (Onboarding / Calouros vs. Veteranos):**
   * *Problema:* Alunos nos primeiros 90 dias de matrícula (fase de onboarding/adaptação) pertencem a uma régua de acolhimento inicial e **não** devem poluir o cálculo de evasão e as filas do Sucesso do Aluno geral.
   * *Ação necessária:* Criar filtro e regra de negócio explícita segregando `Veteranos (Monitoramento Contínuo)` de `Calouros em Onboarding (<90d)`.
2. **Especificidades dos Cursos Híbridos & EaD:**
   * *Problema:* No Híbrido, a frequência presencial quinzenal/mensal não pode ser calculada como falta contínua; o peso deve migrar para a taxa de login e entrega no AVA (Canvas/Moodle/Blackboard).
   * *Ação necessária:* Parametrização dinâmica da fórmula do *Health Score* conforme a modalidade (`Presencial`, `Híbrido`, `EaD 100%`).
3. **Fluxo Completo de Atendimento do Atendente (End-to-End):**
   * *Problema:* Os modais de atendimento registram dados, mas precisam refletir imediatamente na linha do tempo, atualizar o Health Score em tempo real e mudar o status do caso com transição de estado estrita (`Pendente` → `Em Contato` → `Aguardando Retorno Aluno` → `Acordo Fechado / Retido` → `Evasão Inevitável`).
4. **Exportação e Relatórios Executivos:**
   * *Problema:* Falta uma ferramenta de extração de relatórios para os Diretores e Reitoria (PDF/CSV dos motivos de evasão por curso/campus).
5. **Integração do Assistente IA (Gemini Copilot):**
   * *Problema:* O gerador de scripts precisa sugerir 3 abordagens distintas: *Pedagógica/Empática*, *Financeira/Negocial* e *Carreira/Futuro*.

---

## 🎨 3. DIRETRIZES DE DESIGN SYSTEM & ELEVAÇÃO VISUAL (WORLD-CLASS)

O design deve seguir a filosofia **Apple Human Interface + Linear / Vercel Workspace**:
- **Zero "AI Slop":** Nada de gradientes roxo-azul genéricos, bordas excessivamente grossas, sombras difusas sem propósito ou cards aninhados desnecessariamente.
- **Identidade UniAnchieta:** Azul Royal Oficial (`#003A70`), Azul Oceano (`#00509d`), Ciano de Destaque (`#00A3E0`), base em Cinzas Neutros Esculpidos (`#09090b` dark, `#f8fafc` light) e Branco Puro.
- **Contraste Estratégico:** Uso cirúrgico do fundo Azul Royal em **Key Performance Indicators** e **Headers de Casos Críticos**, mantendo as áreas de dados densas limpas e legíveis.
- **Microinterações Fluidas:** Framer Motion (`motion/react`) com física elástica (`spring`) em tabs, transições de status e preenchimento de gráficos.

### 🖼️ Links de Referência Visual & Inspiração (Pinterest & Dribbble)
Para alimentar seu motor de geração de UI e manter o nível estético altíssimo:
* **Dashboards & Cockpits de Suporte/CRM Ultra-Clean:**
  * [Pinterest: Minimalist SaaS Dashboard Design](https://www.pinterest.com/search/pins/?q=minimalist%20saas%20dashboard%20clean%20ui)
  * [Pinterest: Dark & Light High Contrast Analytics](https://www.pinterest.com/search/pins/?q=linear%20app%20ui%20dashboard%20design)
  * [Pinterest: Customer Support Ticket & Timeline UI](https://www.pinterest.com/search/pins/?q=crm%20customer%20timeline%20ui%20design)
* **Visualização de Dados & Donut Charts:**
  * [Pinterest: Modern Donut Chart & Metric Cards](https://www.pinterest.com/search/pins/?q=modern%20data%20visualization%20ui%20kpi%20card)
* **Design de Modais & AI Assist Cockpit:**
  * [Pinterest: AI Copilot Sidebar & Modal Interface](https://www.pinterest.com/search/pins/?q=ai%20chat%20copilot%20dashboard%20ui)

---

## ⚙️ 4. A JORNADA DO ATENDENTE (STEP-BY-STEP OPERACIONAL)

O sistema deve guiar o atendente (Especialista em Retenção) com fluidez absoluta:

```
[1. ENTRADA NA FILA]
   │
   ├── Filtra por "Meus Pendentes" ou "Radar de Evasão Prioritário"
   ├── Visualiza SLA regressivo (ex: "SLA: 2h 15m restantes")
   │
[2. ANÁLISE DO DOSSIÊ 360°]
   │
   ├── Abre o dossiê do aluno com 1 clique (sem recarregar página)
   ├── Observa Composição do Health Score (Notas, Frequência, AVA, Mensalidades)
   ├── Lê a Linha do Tempo Unificada (WhatsApp anteriores, notas de coordenação, chamados no portal)
   │
[3. DISPARO DO FREIO CONCORRENTE]
   │
   ├── Sistema bloqueia automaticamente e-mails automáticos de cobrança e SMS promocionais
   ├── Garante que o contato será 100% humano e não contraditório
   │
[4. PREPARAÇÃO COM O COPILOT IA]
   │
   ├── Clica em "Gerar Script de Abordagem"
   ├── IA cruza o histórico do aluno e gera mensagem personalizada para WhatsApp ou Roteiro Telefônico
   │
[5. EXECUÇÃO DO CONTATO & NEGOCIAÇÃO]
   │
   ├── Botão direto de WhatsApp Web / Disparador com texto pronto
   ├── Registro simultâneo de notas e propostas de acolhimento (ex: plano de estudo, parcelamento)
   │
[6. FECHAMENTO & ATUALIZAÇÃO DO HEALTH SCORE]
   │
   ├── Atendente seleciona desfecho:
   │    ├── "Acordo de Permanência Firmado" (+15 pts no Health Score)
   │    ├── "Encaminhado para Coordenação / Monitoria"
   │    ├── "Aguardando Confirmação do Aluno (Follow-up agendado)"
   │    └── "Solicitação de Trancamento Inevitável"
   └── Caso sai da fila de pendentes e entra no histórico resolvido.
```

---

## 📊 5. OS 5 RADARES DE INTELIGÊNCIA ACADÊMICA

O Claude Code deve garantir que os 5 radares possuam gatilhos e pesos claros no código:

1. **Radar de Evasão (Sinais Combinados):**
   * *Gatilho:* Queda de frequência >30% + Mensalidade atrasada >15 dias + Visita à página de trancamento no portal.
   * *SLA:* **4 horas úteis**.
2. **Radar Acadêmico (Notas & Faltas):**
   * *Gatilho:* Média P1 < 5.0 em duas ou mais matérias OU 3 faltas consecutivas na mesma disciplina.
   * *SLA:* **24 horas**.
3. **Radar de Engajamento AVA (Híbrido & EaD):**
   * *Gatilho:* >7 dias sem login na plataforma virtual OU queda de 50% nas interações com fóruns/vídeos.
   * *SLA:* **48 horas**.
4. **Radar Financeiro Preventivo:**
   * *Gatilho:* 1ª mensalidade em aberto (D+5 ao D+20) antes de ir para órgãos de cobrança externa.
   * *SLA:* **24 horas**.
5. **Radar de Atendimento & Satisfação (NPS/Secretaria):**
   * *Gatilho:* Nota <6 em pesquisa de disciplina OU protocolo aberto há mais de 5 dias sem resposta na secretaria.
   * *SLA:* **12 horas**.

---

## 🚀 6. INSTRUÇÃO DE EXECUÇÃO PARA O CLAUDE CODE

```bash
# Instruções diretas para o Claude Code:
1. Revise a arquitetura de estado em /src/context/AppContext.tsx e garanta persistência e tipagens sólidas em /src/types.ts.
2. Refine as telas em /src/views/ (DashboardView, Student360View, ActionsCenterView, RadarsView, HelpView).
3. Mantenha os componentes modulares em /src/components/ (Header, Sidebar, Modals, Badges).
4. Assegure que as animações do Donut Chart e contadores com Framer Motion funcionem com fluidez extrema.
5. Valide que 'npm run build' e 'npm run lint' compilem com 0 erros.
```
