## 1. Implementação

- [x] 1.1 Consulta de repositório das turmas legíveis por um usuário (cursos coordenados, professor, matrícula ativa)
- [x] 1.2 Caso de uso e rota `GET /cohorts` com `COHORT:READ`

## 2. Verificação

- [x] 2.1 Teste HTTP: coordenador, professor e aluno recebem só as turmas que leem
- [x] 2.2 `pnpm run verify` verde e `openspec validate cohort-listing --strict`
