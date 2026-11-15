## 1. Persistência

- [ ] 1.1 Modelos `PermissionGrant` e `PermissionGrantAudit` em `access.prisma` e migração SQL escrita à mão; verificar com `prisma migrate deploy` em banco limpo e `prisma generate`

## 2. Domínio e aplicação

- [ ] 2.1 Porta e repositório Prisma de concessões (criar com auditoria na mesma transação, revogar com auditoria, listar ativas, permissões ativas por usuário); verificar com testes de integração
- [ ] 2.2 Incluir a origem `GRANT` em `ResolveEffectivePermissionsUseCase`, com TTL do cache limitado pela menor validade; verificar com testes unitários (união, expirada fora, TTL)
- [ ] 2.3 Casos de uso conceder, revogar e listar, com as recusas da spec e invalidação do cache do beneficiário; verificar com testes unitários de cada recusa

## 3. Borda HTTP

- [ ] 3.1 Controlador `permission-grants` com DTOs validados, permissões exigidas e OpenAPI; verificar com testes HTTP dos cenários da spec

## 4. Verificação

- [ ] 4.1 `pnpm run verify` verde e `openspec validate permission-delegation --strict` sem erros
