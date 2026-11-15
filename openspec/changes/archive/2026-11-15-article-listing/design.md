## Context

`ArticleScope.readableArticle` alcança hoje integrante, orientador responsável, coordenador e
administrador institucional (estes dois em toda a instituição). Não alcança o orientador do evento que
não é responsável, que `RF-ART-001` RN3 exige. `prisma-article.repository.ts` já tem `listProgress`,
voltado à projeção de acompanhamento, com agregados pesados (submissões, versões, avaliações).

## Goals / Non-Goals

**Goals:** listar resumos com filtros e alcance coerentes com a consulta individual.

**Non-Goals:** restringir o coordenador ao seu curso. O código atual o deixa ver a instituição
inteira; corrigir isso muda comportamento existente e fica para mudança própria (anotado em
`INTEGRACAO-FRONTEND.md`).

## Decisions

1. **Consulta nova e enxuta, sem reaproveitar `listProgress`.** Ela seleciona só as colunas do
   resumo, numa única consulta com `where` composto. Isso evita o N+1 e o custo dos agregados
   (`ADR-0011`, `PAD-ESC-*`).
2. **Alcance traduzido para `where`.** Coordenador e administrador institucional filtram por
   `institutionId`. Os demais usam
   `OR [memberIds has actor, advisorId = actor, eventId in advisedEventIds]`, onde `advisedEventIds`
   vem de `EventFacade.advisedEventIdsOf(actorId)`, uma chamada síncrona via fachada permitida pelo
   `ADR-0005`.
3. **Ordenação estável** por `createdAt, id`. Paginação no formato do `ADR-0025`, com `withTotal`
   opcional.

## Risks / Trade-offs

- [`advisedEventIdsOf` cresce com o número de eventos do professor] → é limitado pelos eventos em
  que ele orienta, que são poucos por período.
