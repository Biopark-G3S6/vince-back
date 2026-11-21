## Why

- **Orientador responsável:** `RF-EQP-005` designa o orientador responsável pela equipe, mas a
  consulta da equipe não informa quem ele é. A tela não consegue exibir nem revogar a designação.
- **Convites recebidos:** `RF-EQP-004` prevê que o aluno convidado aceite ou recuse o convite, mas a
  listagem de convites existe só para quem convida (`GET /teams/:teamId/invitations`). O aluno não
  tem como descobrir os convites que recebeu.

## What Changes

- `GET /teams/:teamId` e `GET /events/:eventId/teams` passam a incluir `responsibleAdvisorId`
  (nulo quando não há designação). A mudança só acrescenta um campo.
- Nova rota `GET /api/v1/team-invitations`, exigindo `TEAM:JOIN`, paginada, que devolve os convites
  pendentes e não expirados endereçados ao próprio ator.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `team-management`: acrescenta o orientador responsável na consulta da equipe e a consulta dos
  convites recebidos.

## Impact

- `src/modules/team`: DTO e consultas da equipe, novo caso de uso e rota de convites recebidos.
- OpenAPI: um campo novo e uma operação nova.
