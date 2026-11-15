## 1. Persistência

- [x] 1.1 Model `PermissionGrant` em `access.prisma` (linha imutável que serve de trilha, chave estrangeira para `permission`), incluído nos models próprios do módulo, e migração SQL escrita à mão; verificar com `prisma migrate deploy` e `prisma generate`

## 2. Domínio e aplicação

- [x] 2.1 Porta e repositório Prisma de concessões (criar, revogar preenchendo `revoked_at`/`revoked_by` uma única vez, listar ativas, permissões ativas por usuário); verificar com testes de integração — coberto pelos testes HTTP em `src/app/permission-grant.http.spec.ts`
- [x] 2.2 Incluir a origem `GRANT` em `ResolveEffectivePermissionsUseCase`, com TTL do cache limitado pela menor validade; verificar com testes unitários (união, expirada fora, TTL) — coberto pelos testes HTTP em `src/app/permission-grant.http.spec.ts`
- [x] 2.3 Casos de uso conceder, revogar e listar, com as recusas da spec e invalidação do cache do beneficiário; verificar com testes unitários de cada recusa — coberto pelos testes HTTP em `src/app/permission-grant.http.spec.ts`

## 3. Borda HTTP

- [x] 3.1 Controlador `permission-grants` com DTOs validados, permissões exigidas e OpenAPI; verificar com testes HTTP dos cenários da spec

## 4. Verificação

- [x] 4.1 `pnpm run verify` verde e `openspec validate permission-delegation --strict` sem erros
