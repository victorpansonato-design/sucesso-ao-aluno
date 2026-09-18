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

## Arquivos

| Arquivo | O que tem |
|---|---|
| `index.html` | shell, fontes Geist, pré-pintura do tema |
| `styles.css` | tokens do Design System (§3), camada base (§7), primitivos (§10), telas, responsivo |
| `app.js` | estado, rotas, render, interações, overlays, gráficos SVG |
| `data.js` | operação simulada: 26 alunos, 20 conversas, 10 conversas históricas, 8 atendentes |
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
fica salva por navegador (`atendimento.v1.widths`).

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
`J` / `K` andar na fila · `A` assumir · `E` encerrar · `S` adiar · `T` marcadores ·
`R` responder · `N` nota interna · `Enter` enviar · `#` template · `Esc` fechar.
