## Why

`RF-ART-001` pede que o ator selecione a equipe e veja o artigo, o estado e a etapa corrente; o
painel de artigos do frontend lista os artigos alcançados pelo usuário. Hoje só existe
`GET /articles/:articleId` — não há como descobrir o identificador do artigo de uma equipe nem
listar os artigos visíveis, o que impede integrar a tela de artigos.

## What Changes

- Nova rota `GET /api/v1/articles`, paginada, com filtros `eventId`, `teamId`, `courseId` e `status`,
  devolvendo o resumo do artigo (sem o conteúdo).
- A listagem e a consulta individual passam a alcançar, para o orientador do evento, os artigos de
  todas as equipes do evento (`RF-ART-001` RN3), além do que já alcançam hoje.
- Nova consulta na fachada de `event` que devolve os eventos em que um usuário é orientador.

## Capabilities

### New Capabilities

- `article-listing`: consulta dos artigos alcançados pelos vínculos do ator, com a situação e a etapa
  corrente (`RF-ART-001`).

### Modified Capabilities

Nenhuma.

## Impact

- `src/modules/article`: controlador, caso de uso, regra de alcance em `ArticleScope`, consulta de
  repositório.
- `src/modules/event`: novo método de leitura na fachada (`advisedEventIdsOf`).
- OpenAPI: nova operação; o frontend regenera `schema.ts`.
