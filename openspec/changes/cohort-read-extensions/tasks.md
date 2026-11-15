## 1. Professores da turma

- [ ] 1.1 Consulta de repositório e caso de uso da listagem de professores ativos, com checagem de escopo da turma; verificar com testes unitário e de integração
- [ ] 1.2 Rota `GET /cohorts/:cohortId/professors` com `COHORT:READ` e OpenAPI; verificar com teste HTTP dos dois cenários

## 2. Convites

- [ ] 2.1 Acrescentar `expiresAt`, `state` e `useCount` ao DTO e ao mapeamento a partir dos convites de acesso, numa única consulta por página; verificar com teste HTTP do convite revogado

## 3. Verificação

- [ ] 3.1 `pnpm run verify` verde e `openspec validate cohort-read-extensions --strict` sem erros
