# Central de Atendimento UniAnchieta — protótipo

Protótipo frontend estático de um **novo produto** de atendimento: arquitetura de
produto inspirada na Intercom Inbox, identidade visual e motion vindos do
`DESIGN_SYSTEM.md` deste repositório.

Isolado: **nada fora desta pasta foi criado ou alterado.**

## Como abrir

Abra `index.html` no navegador — duplo clique já funciona, não há build, servidor,
dependência nem backend. Os scripts são clássicos (sem ES modules) justamente para
funcionar via `file://`.

Se preferir servir por HTTP:

```bash
npx serve prototype-atendimento-intercom
```

Otimizado para desktop: 1366×768 até 1920×1080.

## Visão do atendente

Esta versão mostra só o que o atendente usa no turno:

- **Inbox enxuto** — Minha caixa, Encerrados e as **pastas** do próprio atendente
  (criar, renomear, excluir, arrastar conversas para dentro). Filas da equipe,
  menções, favoritos e visões salvas saíram: voltam quando o canal crescer.
- **Fixar** conversas no topo (hover na linha, menu `…` ou tecla `P`).
- **Transferir para fila**, nunca para uma pessoa. O motivo vira nota interna e o
  aluno pode ser avisado na hora. Não há "adiar".
- **Atender próximo** puxa a conversa mais crítica da fila e já abre com ela.
- **Painel direito em três abas** — Aluno · Copilot · Histórico — com as **notas
  internas ancoradas no rodapé**: rolagem própria, nunca saem do lugar quando o
  painel rola. A nota amarela continua aparecendo dentro da conversa.
- **Copilot** abre com o resumo do caso (o que o aluno precisa, sentimento,
  contexto, checklist, ponto de atenção), responde perguntas livres e redige
  resposta, retorno formal de ouvidoria e nota interna.
- **Ouvidoria** — quatro manifestações simuladas (reclamação, acessibilidade,
  TCC, elogio) com protocolo, etapa, prazo em dias úteis e linha do tempo
  cronológica que junta contatos anteriores, triagem e retorno do setor.
- **Equipe** no rodapé da coluna: só a palavra; o clique abre a lista com o
  status de cada pessoa.
- **Desempenho** — os números do atendente ao lado do agregado da equipe (total
  e média por atendente, sem nomes), com filtro Hoje · Ontem · 7 · 30 dias ou
  período personalizado.
- **Fotos de perfil** dos alunos (randomuser.me). Sem internet, o avatar volta
  sozinho para as iniciais.

## Aparência

O botão de sol/lua no rail abre o seletor com quatro temas. A troca é revelada
num círculo que nasce do botão — o mesmo efeito do Sucesso ao Aluno (View
Transitions API; sem ela, ou com movimento reduzido, a troca é seca).

| Tema | Para quê |
|---|---|
| Claro | o padrão, inalterado |
| Névoa | claro azul-acinzentado, de baixo brilho, para turnos longos |
| Grafite | escuro neutro, preto acinzentado — substitui o escuro antigo |
| Marinho | escuro com o azul da UniAnchieta |

Os escuros seguem regras medidas: nada de preto ou branco puros, elevação por
claridade (cada camada um degrau mais clara), azul da marca só onde a marca
aparece, botão primário ≥ 4,5:1 com texto branco e metadado (`ink-4`) ≈ 4,5:1
sobre a placa — o escuro antigo deixava o metadado em 3,2:1. A escolha fica
salva por navegador (`atendimento.v1.theme`); o valor antigo `dark` vira Grafite.

## Arquivos

| Arquivo | O que tem |
|---|---|
| `index.html` | shell, fontes Geist, pré-pintura do tema |
| `styles.css` | tokens do Design System (§3), camada base (§7), primitivos (§10), telas, responsivo |
| `app.js` | estado, rotas, render, interações, overlays, gráficos SVG |
| `data.js` | operação simulada: 30 alunos, 24 conversas (4 de ouvidoria), 15 conversas históricas, 9 pessoas na equipe, resumos do Copilot, números de desempenho |
| `icons.js` | path data do lucide inline (mesmo alfabeto de ícones do sistema) |
| `brand.js` | wordmark UniAnchieta em vetor, extraído de `src/components/brand/AnchietaLogo.tsx` |

## Rotas

```
#/inbox            #/inbox/c01        #/dashboard
#/contatos         #/contatos/e09
```

## Colunas ajustáveis

As três colunas laterais são arrastáveis pela borda. Duplo clique na borda
restaura o padrão; com a alça focada, as setas ajustam de 16 em 16. A escolha
fica salva por navegador (`atendimento.v1.widths`). Pastas e fixados também
(`atendimento.v2.org`).

## Motion

Portado do `src/lib/motion.ts` do projeto principal:

- **pílula ativa deslizante** — o `layoutId="sidebar-active"` do `Sidebar.tsx`
  escrito em CSS: um único nó que se move entre os itens, no rail e na coluna
  de views;
- **transição de rota** — `pageVariants` com `AnimatePresence mode="wait"`: a
  tela sai em 130ms e só então a nova entra em 260ms;
- **stagger de lista** — `staggerContainer`/`staggerItem`, 35ms entre filhos;
- **pastilha do segmented e sublinhado de aba** com `layoutId`;
- grupos e acordeões colapsam **sem re-render**, para a transição de altura
  realmente rodar.

## Atalhos

`Ctrl/Cmd K` busca e comandos · `?` lista de atalhos · `G I` / `G D` / `G C` navegação ·
`J` / `K` andar na fila · `A` assumir da fila · `F` transferir para fila · `E` encerrar ·
`P` fixar · `M` mover para pasta · `T` marcadores · `R` responder · `N` nota interna ·
`Enter` enviar · `#` template · `Esc` fechar.

## Arquivo único

`node build-single.cjs` (dentro desta pasta) gera `atendimento-unianchieta.html`,
com CSS e scripts embutidos — para mandar por e-mail ou Teams.
