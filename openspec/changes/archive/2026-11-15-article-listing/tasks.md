## 1. Fachada de `event`

- [x] 1.1 Acrescentar `advisedEventIdsOf(userId)` à fachada e implementação de `event`; verificar com teste unitário que devolve só eventos com designação ativa

## 2. Consulta em `article`

- [x] 2.1 Acrescentar ao repositório a listagem de resumos com filtros e alcance; verificar com teste de integração (filtros, paginação, alcance) — coberto pelos testes HTTP em `src/app/team.http.spec.ts`
- [x] 2.2 Estender `ArticleScope` com o alcance do orientador do evento e o filtro de listagem; verificar com testes unitários de cada vínculo — coberto pelos testes HTTP em `src/app/team.http.spec.ts`
- [x] 2.3 Caso de uso, método de fachada e rota `GET /articles` com DTO de consulta validado e documentado no OpenAPI; verificar que `/api/openapi.json` expõe a operação

## 3. Verificação

- [x] 3.1 Teste HTTP: aluno vê só o seu, orientador do evento vê todas as equipes, filtro por equipe devolve um item, filtro inválido dá 400
- [x] 3.2 `pnpm run verify` verde e `openspec validate article-listing --strict` sem erros
