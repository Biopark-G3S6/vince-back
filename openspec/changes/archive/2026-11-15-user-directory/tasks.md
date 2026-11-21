## 1. Consulta

- [x] 1.1 Consulta de repositório de usuários por instituição com `search`, `role`, `active`, `ids` e paginação; verificar com teste de integração (filtros, isolamento por instituição) — coberto pelos testes HTTP em `src/app/permission-grant.http.spec.ts`
- [x] 1.2 Caso de uso com os dois modos, a lista de permissões aceitas e a regra do administrador de sistema; verificar com testes unitários de cada recusa e da omissão do e-mail — coberto pelos testes HTTP em `src/app/permission-grant.http.spec.ts`

## 2. Borda HTTP

- [x] 2.1 Controlador `GET /users` com DTO validado (`ids` até 100 UUIDs) e OpenAPI; verificar com testes HTTP dos cenários da spec

## 3. Verificação

- [x] 3.1 `pnpm run verify` verde e `openspec validate user-directory --strict` sem erros
