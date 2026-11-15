## ADDED Requirements

### Requirement: Papel do integrante

Cada integrante SHALL ter um papel: `LEADER`, `AUTHOR` ou `COAUTHOR`.

- **Valor inicial:** quem ingressa, é designado ou aceita convite nasce como `COAUTHOR`.
- **Leitura:** a listagem de integrantes SHALL devolver o papel.
- **Alteração:** `PATCH /api/v1/teams/:teamId/members/:userId` exige `TEAM:ASSIGN_MEMBER` e o mesmo
  alcance da designação de integrante.
- **Recusas:**
  - papel fora da lista → `VALIDATION_FAILED`;
  - usuário que não é integrante ativo → `RESOURCE_NOT_FOUND`.
- **Efeito:** o papel MUST NOT alterar permissões nem o acesso ao artigo.

#### Scenario: Integrante passa a líder

- **WHEN** o orientador do evento define `role` `LEADER` para um integrante ativo
- **THEN** a listagem de integrantes devolve o integrante com `role` `LEADER`

#### Scenario: Não integrante

- **WHEN** o papel é definido para um usuário que não integra a equipe
- **THEN** a resposta é `404` com `RESOURCE_NOT_FOUND`
