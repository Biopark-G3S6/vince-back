## Why

`RF-ACS-006` a `RF-ACS-008` e o `ADR-0014` §15–§21 pedem que um usuário conceda a outro uma
permissão que ele próprio possui, com prazo opcional, revogação e consulta das concessões ativas.
O catálogo já declara `PERMISSION_GRANT:CREATE/REVOKE/READ` e os códigos
`GRANT_NOT_HELD_BY_GRANTER` e `SELF_GRANT_NOT_ALLOWED`. A apuração das permissões efetivas já nasceu
como união de origens, mas a origem "concessão" nunca foi implementada. A tela de concessões do
frontend existe e hoje funciona só com dados locais.

## What Changes

- Nova tabela `access.permission_grant`, já prevista no `ADR-0027` §5. A linha nunca é removida: ela
  própria é a trilha imutável de concessão e revogação exigida pelo `ADR-0014` §18.
- `POST /api/v1/permission-grants`: concede uma permissão.
- `DELETE /api/v1/permission-grants/:grantId`: revoga a concessão.
- `GET /api/v1/permission-grants`: lista as concessões ativas, com filtro por beneficiário ou
  concedente.
- As permissões efetivas passam a unir os papéis e as concessões diretas ativas. O cache é invalidado
  na concessão e na revogação, e não sobrevive à expiração.

## Capabilities

### New Capabilities

- `permission-delegation`: concessão, revogação e consulta de concessões diretas
  (`RF-ACS-006` a `RF-ACS-008`).

### Modified Capabilities

Nenhuma. A spec `permission-enforcement` já fala em "permissões efetivas"; esta mudança só acrescenta
uma origem a elas.

## Impact

- Em `src/modules/access`:
  - modelo Prisma e migração SQL escrita à mão;
  - repositório, casos de uso, controlador;
  - `resolve-effective-permissions.use-case.ts` e `effective-permissions.ts`.
- OpenAPI: três operações novas.
