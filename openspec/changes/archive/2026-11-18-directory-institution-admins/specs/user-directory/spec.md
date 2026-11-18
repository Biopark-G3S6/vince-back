## MODIFIED Requirements

### Requirement: Busca de usuários para designação

O sistema SHALL expor `GET /api/v1/users`, que exige sessão autenticada e é paginada conforme o
contrato de resposta.

- **Filtros opcionais:** `search` (trecho do nome ou do e-mail, sem distinção de caixa), `role`
  (código de papel) e `active`.
- **Autorização:** a busca sem `ids` MUST exigir que o ator possua ao menos uma destas permissões:
  - `INSTITUTION:ASSIGN_ADMIN`
  - `COURSE:ASSIGN_COORDINATOR`
  - `COHORT:ASSIGN_PROFESSOR`
  - `ENROLLMENT:READ`
  - `EVENT:ASSIGN_ADVISOR`
  - `TEAM:ASSIGN_MEMBER`
  - `TEAM:INVITE_MEMBER`
  - `TEAM:ASSIGN_ADVISOR`
  - `PERMISSION_GRANT:CREATE`
  - `PERMISSION_GRANT:READ`

  Caso contrário, a resposta é `403` com `PERMISSION_DENIED`.

- **Itens:** identificador, nome, e-mail, papéis, situação e `institutionId`, apenas da instituição
  do ator.
- **Administrador de sistema:** como não tem instituição, precisa de `INSTITUTION:ASSIGN_ADMIN` e
  MUST informar `institutionId`, exceto quando filtra `role=INSTITUTION_ADMIN`: nesse caso, sem
  `institutionId`, a resposta lista os administradores institucionais de todas as instituições.
  Sem `institutionId` e com outro papel, ou sem papel, a resposta é `400` com `VALIDATION_FAILED`.

#### Scenario: Coordenador busca professor por nome

- **WHEN** um coordenador busca com `search` e `role=PROFESSOR`
- **THEN** a resposta lista os professores da sua instituição cujo nome ou e-mail contém o trecho
- **AND** nenhum usuário de outra instituição consta

#### Scenario: Aluno sem permissão de designação

- **WHEN** um aluno busca usuários sem informar `ids`
- **THEN** a resposta é `403` com `PERMISSION_DENIED`

#### Scenario: Administrador de sistema busca na instituição alvo

- **WHEN** o administrador de sistema busca com `institutionId` de uma instituição existente
- **THEN** a resposta lista os usuários daquela instituição

#### Scenario: Administrador de sistema lista os administradores de todas as instituições

- **WHEN** o administrador de sistema busca com `role=INSTITUTION_ADMIN` e sem `institutionId`
- **THEN** a resposta lista os administradores institucionais de todas as instituições
- **AND** cada item traz o `institutionId` da sua instituição
- **AND** nenhum usuário com outro papel consta

#### Scenario: Administrador de sistema sem instituição e com outro papel

- **WHEN** o administrador de sistema busca com `role=PROFESSOR` e sem `institutionId`
- **THEN** a resposta é `400` com `VALIDATION_FAILED`
