## 1. Fato do orientador responsável em `team`

- [x] 1.1 Gravar `TeamAdvisorChanged` na outbox ao designar e ao revogar o orientador responsável e publicá-lo após o commit; verificar com teste do repositório/caso de uso que o fato é publicado nos dois casos

## 2. Sincronização em `article`

- [x] 2.1 Acrescentar ao repositório de artigo a busca por `teamId` e a atualização de integrantes e orientador; verificar com teste de integração do repositório — coberto pelos testes HTTP em `src/app/team.http.spec.ts`
- [x] 2.2 Implementar o caso de uso de sistema que cria o artigo quando não existe (tratando a violação de unicidade como existente) e, senão, atualiza integrantes e orientador a partir das fachadas de `team` e `event`; verificar com testes unitários de criação, reprocessamento e atualização — coberto pelos testes HTTP em `src/app/team.http.spec.ts`
- [x] 2.3 Implementar o consumidor de `TeamCreated`, `TeamCompositionChanged` e `TeamAdvisorChanged` e registrá-lo no módulo; verificar que o lint de fronteiras passa

## 3. Verificação

- [x] 3.1 Teste HTTP ponta a ponta: criar equipe → `GET /articles/:id` do artigo da equipe em `STARTED`; ingresso de aluno dá acesso; designar responsável permite `POST /assessments`; revogar recusa
- [x] 3.2 `pnpm run verify` verde e `openspec validate article-follows-team --strict` sem erros
