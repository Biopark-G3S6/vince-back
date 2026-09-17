## Context

Consulte `proposal.md` para a motivação. Equipes dependem do evento e da elegibilidade de turma, e sua
criação deve produzir um artigo. Como os dois conceitos terão proprietários distintos, a integração
precisa usar fachadas ou eventos, nunca tabelas compartilhadas.

## Goals / Non-Goals

**Goals:**

- Isolar equipe, integrantes, convites de equipe e responsabilidade direta no módulo `team` candidato.
- Fazer criação de equipe e fato de artigo inicial convergirem sem transação entre módulos.
- Proteger unicidade de integrante por evento e limites sob concorrência.

**Non-Goals:**

- Implementar edição, revisão, notas ou conteúdo do artigo.
- Criar orientação fora de eventos existentes.
- Permitir que o professor não designado contorne a elegibilidade.

## Decisions

### D1 — Propriedade e criação do artigo

O schema `team` possuirá equipe, membro, convite de equipe e vínculo de orientador responsável. O módulo
`article` será dono do artigo; ao criar equipe, `team` publicará `TeamCreated` em sua outbox e o módulo
`article` criará o artigo `STARTED` idempotentemente. A resposta da criação apresentará o vínculo quando
o consumidor confirmar; isso evita transação distribuída e segue `ADR-0005`.

### D2 — Rotas

As rotas serão `POST/GET /events/:eventId/teams`, `POST/DELETE
/events/:eventId/teams/:teamId/membership`, `POST/DELETE /teams/:teamId/members/:userId`, `POST/GET
/teams/:teamId/invitations` com aceite próprio, `POST/DELETE /teams/:teamId/advisor` e
`GET /events/:eventId/eligible-students`. Os endpoints exigirão as permissões do catálogo e validarão
titularidade no caso de uso.

### D3 — Integridade concorrente

O banco e o caso de uso cooperarão: índice único `(eventId, studentId)` para participação ativa,
escrita condicional para limites e estado do evento, e transação local com timeout. Convites reavaliarão
todas as regras no aceite, não apenas na emissão.

### D4 — Comunicação com dependências

`team` chamará `event`/`cohort` por fachadas somente quando precisar de resposta imediata e publicará
fatos para `article`. Nenhum módulo consumidor será necessário para concluir a transação de `team`; falha
de projeção será retentada e enviada à DLQ conforme `ADR-0012` e `ADR-0021`.

## Risks / Trade-offs

- **Artigo pode ficar temporariamente ausente após equipe criada** → outbox na mesma transação,
  consumidor idempotente e estado de jornada observável.
- **Contagem de equipes e integrantes sob concorrência** → atualização condicional e testes com operações
  concorrentes; nunca confiar apenas em leitura prévia.
- **Convite de equipe pode ser confundido com convite de conta** → entidade/contexto distinto e rotas
  explicitamente vinculadas ao evento e à equipe.

## Migration Plan

1. Registrar ADR de `team` e alinhar contrato de criação do artigo com a proposta de `article`.
2. Criar schema/migração `team`, outbox e consumidores necessários.
3. Publicar criação e ingresso, depois convites, responsabilidade e consulta de pendentes.
4. Testar jornada completa com limites, duplicidade, expiração e evento cancelado.
5. Rollback: desabilitar novas formações sem apagar equipes, integrantes ou artigos já projetados.
