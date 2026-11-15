## Why

O frontend exibe o título do artigo na lista de artigos e na equipe, e pede esse título quando o
orientador cria a equipe. Hoje o título existe só dentro do conteúdo. A tela de avaliação também
registra um parecer textual junto da nota do artigo, e o contrato guarda apenas a nota
(`RF-ART-002`).

> **Fora da URS.** Este campo não decorre de requisito da URS v0.4: foi pedido na integração com o frontend (decisão do usuário em 2026-11-15, registrada em `INTEGRACAO-FRONTEND.md`). Fica pendente de ratificação em `vince-docs`.

## What Changes

- O artigo passa a ter `title`, opcional:
  - devolvido na consulta e na listagem;
  - informado opcionalmente na criação da equipe (`articleTitle`), que o leva no fato
    `TeamCreated`;
  - alterável pelos integrantes em `PATCH /api/v1/articles/:articleId`, com `ARTICLE:EDIT`.
- A nota do artigo (`POST /articles/:id/assessments`) aceita `feedback` opcional, devolvido na
  consulta das avaliações. A nota individual não tem parecer.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `article-listing`: o resumo passa a trazer o título. É capacidade criada por `article-listing`
  nesta mesma rodada; a delta é `ADDED` e não altera o requisito dela.

## Impact

- `src/modules/article`: colunas `title` e `feedback`, migração SQL, rota `PATCH`, DTOs e
  consumidor de `TeamCreated`.
- `src/modules/team`: `articleTitle` opcional na criação da equipe e no fato `TeamCreated`.
