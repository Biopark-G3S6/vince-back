## Context

`team` grava fatos na outbox dentro da transação e os publica no `DomainEventBus` em processo após o
commit (`team/application/publish-facts.ts`, `ADR-0021`). `event` já consome `TeamCreated` e
`TeamCompositionChanged` (`event/application/team-usage.consumer.ts`). `article` guarda
`member_ids` e `advisor_id` como cópia e os usa em `ArticleScope` para ler, editar e avaliar.
`CreateArticleUseCase` exige um ator, que um consumidor de fato não tem.

## Goals / Non-Goals

**Goals:** cumprir RF-EQP-001 RN1; manter a cópia de integrantes e orientador em dia.

**Non-Goals:** relay de outbox entre processos (pendência separada); rota de criação manual de artigo;
escolha de template na criação (o artigo nasce com conteúdo vazio, como hoje).

## Decisions

1. **Consumidor relê o estado pelas fachadas, em vez de confiar no payload.** Ao receber qualquer um
   dos três fatos, `article` consulta `TeamFacade.stateOf` (instituição, evento, orientador
   responsável) e `TeamFacade.activeMemberIdsOf`, e `EventFacade` para curso e etapa corrente. Isso
   torna o tratamento idempotente e tolerante a reordenação: o último processamento sempre converge
   para o estado atual. Alternativa rejeitada: aplicar o delta do payload (`JOINED`/`REMOVED`), que
   diverge se um fato se perder ou chegar fora de ordem.
2. **Caso de uso de sistema, sem ator.** Novo `SyncArticleWithTeamUseCase` em `article/application`,
   chamado apenas pelo consumidor, que faz "criar se não existe; senão atualizar integrantes e
   orientador". Alternativa rejeitada: reaproveitar `CreateArticleUseCase` com ator fictício, que
   contornaria a checagem de escopo.
3. **Novo fato `TeamAdvisorChanged`** gravado por `team` na mesma transação de designar/revogar o
   responsável, com `{teamId, eventId, advisorId|null}`. Sem ele, `article` não teria como saber da
   mudança sem consultar a cada leitura.
4. **Unicidade de `team_id` como guarda final.** Corrida entre dois processamentos de `TeamCreated` cai
   na violação de unicidade, tratada como "já existe" e seguida de atualização.

## Risks / Trade-offs

- [Barramento em processo: fato publicado com o processo caindo após o commit não é entregue] →
  a linha permanece na outbox para o relay (`ADR-0021`), ainda não implementado; registrado como
  pendência existente, fora do escopo.
- [Consulta extra às fachadas por fato] → volume baixo (formação de equipe), sem impacto nas metas do
  `ADR-0011`.
