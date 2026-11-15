## Why

`RF-TUR-002` permite designar e revogar professores da turma, mas não há como consultar quem está
designado: a revogação exige saber o identificador. O convite de turma (`RF-TUR-004`) é listado sem
validade, situação nem contagem de usos, que a tela de turmas precisa para mostrar e revogar convites.
Ambas as lacunas impedem a integração da tela de turmas.

## What Changes

- Nova rota `GET /api/v1/cohorts/:cohortId/professors`, paginada, que devolve os professores
  designados à turma.
- `GET /api/v1/cohorts/:cohortId/invitations` passa a devolver, em cada item, `expiresAt`, `state`
  e `useCount`. A mudança apenas acrescenta campos e não quebra o contrato (`ADR-0017`).

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `cohort-management`: acrescenta a consulta dos professores designados e os dados do convite na
  listagem.

## Impact

- `src/modules/cohort`:
  - controlador de professores;
  - caso de uso de listagem;
  - DTO do convite, preenchido via `AccessFacade.listInvitations`, que já devolve esses campos.
- OpenAPI: uma operação nova e campos novos em uma resposta.
