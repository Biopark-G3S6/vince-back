## ADDED Requirements

### Requirement: Consulta de professores da turma

O sistema SHALL expor `GET /api/v1/cohorts/:cohortId/professors`, exigindo `COHORT:READ`, paginado
conforme o contrato de resposta, devolvendo para cada designação ativa o identificador da turma e o do
professor. Turma inexistente ou de outra instituição MUST resultar em `RESOURCE_NOT_FOUND`.
Professor revogado MUST NOT constar.

#### Scenario: Professores designados

- **WHEN** um coordenador consulta os professores de uma turma com dois professores designados e um
  revogado
- **THEN** a resposta contém os dois professores ativos

#### Scenario: Turma de outra instituição

- **WHEN** o ator consulta os professores de uma turma de outra instituição
- **THEN** a resposta é `404` com `RESOURCE_NOT_FOUND`

### Requirement: Situação do convite na listagem

Cada item de `GET /api/v1/cohorts/:cohortId/invitations` SHALL conter, além dos campos atuais,
`expiresAt`, `state` (`ACTIVE`, `EXPIRED`, `EXHAUSTED` ou `REVOKED`, conforme o convite de acesso) e
`useCount`.

#### Scenario: Convite revogado na listagem

- **WHEN** um convite de turma é revogado e a listagem é consultada
- **THEN** o item do convite apresenta `state` `REVOKED`, a validade e a contagem de usos
