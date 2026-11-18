## Why

`RF-EQP-002` diz que o aluno "consulta as equipes do evento e as suas vagas" antes de ingressar. A
listagem de equipes não informa quantos integrantes cada uma tem, e o aluno só lê o artigo (com a
lista de integrantes) da própria equipe: a tela não tem como mostrar as vagas das demais.

## What Changes

- Cada equipe devolvida por `GET /events/:eventId/teams` e `GET /teams/:teamId` passa a trazer
  `activeMemberCount`, a quantidade de integrantes ativos. O cliente calcula as vagas pelo
  tamanho máximo do evento.
- Contrato compatível: só acrescenta campo.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `team-management`: quantidade de integrantes ativos na equipe.

## Impact

- `src/modules/team`: consulta de equipe e DTO de resposta.
- `vince-front`: vagas na lista de equipes.
