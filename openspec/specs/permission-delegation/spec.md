# permission-delegation Specification

## Purpose

Permitir que um usuário delegue a outro, da mesma instituição, uma permissão que possui, com prazo
opcional, revogação imediata e consulta das concessões ativas, conforme `RF-ACS-006` a `RF-ACS-008` e
`ADR-0014` §15–§21.

## Requirements

### Requirement: Conceder permissão

O sistema SHALL expor `POST /api/v1/permission-grants`.

- **Permissão exigida:** `PERMISSION_GRANT:CREATE`.
- **Corpo:**
  - `beneficiaryId`: UUID;
  - `permission`: código do catálogo;
  - `validUntil`: instante opcional, que MUST estar no futuro.
- **Resposta de sucesso:** `201`, com a concessão: identificador, beneficiário, concedente,
  permissão, instante da concessão e validade.
- **Recusas:**
  - permissão fora das permissões efetivas do concedente → `GRANT_NOT_HELD_BY_GRANTER`;
  - concedente igual ao beneficiário → `SELF_GRANT_NOT_ALLOWED`;
  - beneficiário inexistente, inativo ou de outra instituição → `RESOURCE_NOT_FOUND`;
  - permissão fora do catálogo ou validade no passado → `VALIDATION_FAILED`.

Toda concessão MUST ser registrada na trilha imutável, com concedente, beneficiário, permissão e
instante.

#### Scenario: Concessão de permissão possuída

- **WHEN** um professor com `ARTICLE:GRADE` concede `ARTICLE:GRADE` a outro professor ativo da
  instituição
- **THEN** a resposta é `201` com a concessão
- **AND** a apuração seguinte das permissões efetivas do beneficiário contém `ARTICLE:GRADE`

#### Scenario: Permissão não possuída

- **WHEN** o concedente tenta conceder uma permissão que não está nas suas permissões efetivas
- **THEN** a resposta é `422` com `GRANT_NOT_HELD_BY_GRANTER`

#### Scenario: Concessão a si mesmo

- **WHEN** o beneficiário informado é o próprio concedente
- **THEN** a resposta é `422` com `SELF_GRANT_NOT_ALLOWED`

### Requirement: Validade da concessão

Uma concessão com `validUntil` vencido MUST deixar de compor as permissões efetivas do beneficiário a
partir desse instante, sem ação adicional. A revogação ou a perda da permissão pelo concedente MUST
NOT revogar as concessões que ele realizou.

#### Scenario: Concessão expirada

- **WHEN** o instante `validUntil` de uma concessão é ultrapassado
- **THEN** a permissão concedida deixa de compor as permissões efetivas do beneficiário

### Requirement: Revogar concessão

O sistema SHALL expor `DELETE /api/v1/permission-grants/:grantId`.

- **Permissão exigida:** `PERMISSION_GRANT:REVOKE`.
- **Resposta de sucesso:** `204`.
- **Quem pode revogar:** qualquer portador da permissão na mesma instituição, mesmo sem ser o
  concedente.
- **Efeito:** imediato sobre as permissões efetivas do beneficiário.
- **Trilha:** a revogação MUST ser registrada na trilha imutável.
- **Recusa:** concessão inexistente, já revogada, expirada ou de outra instituição →
  `RESOURCE_NOT_FOUND`.

#### Scenario: Revogação por quem não concedeu

- **WHEN** um portador de `PERMISSION_GRANT:REVOKE` revoga uma concessão ativa feita por outro usuário
- **THEN** a resposta é `204`
- **AND** a requisição seguinte do beneficiário que dependa da permissão é recusada com
  `PERMISSION_DENIED`

#### Scenario: Concessão já encerrada

- **WHEN** a concessão informada já foi revogada
- **THEN** a resposta é `404` com `RESOURCE_NOT_FOUND`

### Requirement: Consultar concessões ativas

O sistema SHALL expor `GET /api/v1/permission-grants`.

- **Permissão exigida:** `PERMISSION_GRANT:READ`.
- **Paginação:** segue o contrato de resposta.
- **Filtros opcionais:** `beneficiaryId` e `granterId`.
- **Escopo:** apenas concessões ativas da instituição do ator.
- **Cada item:** permissão, beneficiário, concedente, instante da concessão e validade.
- **Exclusões:** concessões expiradas ou revogadas MUST NOT constar.

#### Scenario: Lista sem expiradas

- **WHEN** o ator consulta as concessões de um beneficiário que tem uma concessão ativa e uma
  expirada
- **THEN** a resposta contém somente a ativa, com o concedente e a data da concessão
