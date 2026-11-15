## 1. Orientador responsável na equipe

- [ ] 1.1 Incluir `responsibleAdvisorId` no DTO da equipe, carregado na mesma consulta da equipe e da listagem (sem N+1); verificar com testes HTTP dos dois cenários

## 2. Convites recebidos

- [ ] 2.1 Consulta de repositório e caso de uso dos convites pendentes do ator; verificar com teste de integração (pendente, recusado, expirado, de outro aluno)
- [ ] 2.2 Rota `GET /team-invitations` com `TEAM:JOIN` e OpenAPI; verificar com teste HTTP

## 3. Verificação

- [ ] 3.1 `pnpm run verify` verde e `openspec validate team-read-extensions --strict` sem erros
