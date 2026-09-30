# Proposta — rota de leitura dos disparos

**Para:** Davi (TI) · **De:** front-end da ML de evasão · **Status:** proposta, a confirmar

## O pedido

A tela **"Alunos que receberam a mensagem"** precisa ler a tabela `ANC_ML_RISCO_DISPARO`.
Hoje a API só tem `POST disparos/enviar`, que envia (ou simula). Não queremos ler por essa rota:
é uma rota de envio, e um `confirmar: true` por engano dispara push + e-mail para alunos reais.

Proposta: uma rota **GET, só leitura**, no mesmo molde das outras (`setCors()`,
`apenasGet()`, `requireToken()`, erro `{"error": "..."}`).

```
GET disparos/listar
```

| Parâmetro | | Padrão |
|---|---|---|
| `data` | `DT_CORTE` (`AAAA-MM-DD`) | a fila mais recente com disparo |
| `faixa` | `CRITICA`, `ALTA`, `MEDIA` — uma ou mais, como em `alunos/listar` | todas |
| `status` | um ou mais valores de `STATUS` | todos |
| `pagina` / `limite` | como em `alunos/listar` (limite até 1000) | 1 / 100 |

## Resposta sugerida

Os nomes seguem o que o README já documenta. O que está marcado **(?)** é o que não sabemos
se existe na tabela — use o nome real da coluna, ou tire.

```json
{
  "dt_corte": "2026-09-27",
  "fila_atualizada": true,
  "total": 189,
  "pagina": 1,
  "limite": 100,
  "resumo": { "ENVIADO": 180, "FALHA": 6, "ENVIANDO": 3 },
  "disparos": [
    {
      "dt_corte": "2026-09-27",
      "aluno": "2640797",
      "chance_evasao": "CRITICA",
      "modalidade": "PRESENCIAL",
      "status": "ENVIADO",
      "external_id": "evasao-CRITICA-2026-09-27-0645-1",
      "enviado_em": "2026-09-28T06:45:12-03:00"
    }
  ]
}
```

- `status`: o README cita `ENVIANDO` e `FALHA`. **Qual é o valor gravado quando dá certo?**
  (Usamos `ENVIADO` no mock até saber.)
- `external_id`: o README documenta o formato `evasao-<faixa>-<dt_corte>-<hora>-<lote>`. **(?)**
  se ele fica gravado por aluno.
- `enviado_em` **(?)** — se a tabela guarda data/hora do envio.
- `resumo`: contagem por `STATUS` no filtro, sem paginação — é o que alimenta os números do topo
  da tela sem baixar a lista inteira.

## Perguntas em aberto

1. O `ras_teste` fica fora da tabela (README: "`ras_teste` não entra no controle") — confirma
   que a tela nunca vai ver os envios de teste?
2. Faz sentido expor também o **texto** que cada faixa recebeu (`DISPARO_MENSAGENS`), para a
   tela mostrar "o que foi enviado"?
3. A tabela serve todas as modalidades (`MODALIDADE`). A rota filtra `PRESENCIAL` fixo, como o
   resto desta API?

Enquanto a rota não existir, a tela roda com dados fictícios nesse formato e, ligada à API
real, avisa que aguarda esta rota. Trocar o mock pela rota é mudar um arquivo
(`src/api/disparos.ts`).
