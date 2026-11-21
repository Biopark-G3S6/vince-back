## Purpose

Permitir que o cliente localize usuários da instituição para as operações de designação e de
concessão, e resolva identificadores em nomes para exibição, expondo o mínimo de dado pessoal.

## ADDED Requirements

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

- **Itens:** identificador, nome, e-mail, papéis e situação, apenas da instituição do ator.
- **Administrador de sistema:** como não tem instituição, MUST informar `institutionId` e precisa de
  `INSTITUTION:ASSIGN_ADMIN`. Sem `institutionId`, a resposta é `400` com `VALIDATION_FAILED`.

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

### Requirement: Resolução de nomes por identificador

Com o filtro `ids` (lista de até 100 UUIDs separados por vírgula), qualquer usuário ativo SHALL obter
o identificador e o nome dos usuários informados que pertencem à sua instituição.

- Identificadores de outra instituição ou inexistentes MUST ser omitidos, sem erro.
- O e-mail MUST NOT constar quando o ator não possuir as permissões de busca.
- Mais de 100 identificadores, ou identificador inválido, resultam em `400` com `VALIDATION_FAILED`.

#### Scenario: Aluno resolve nomes dos colegas de equipe

- **WHEN** um aluno consulta `ids` com os identificadores dos integrantes da sua equipe
- **THEN** a resposta contém o nome de cada um, sem o e-mail

#### Scenario: Identificador de outra instituição

- **WHEN** a lista `ids` contém um usuário de outra instituição
- **THEN** esse usuário não consta da resposta
