## 1. Catálogo

- [x] 1.1 `INSTITUTION:READ` em `INSTITUTION_ADMIN`, `COORDINATOR`, `PROFESSOR` e `STUDENT`, em correspondência com a URS §2.3.1 alterada

## 2. Escopo

- [x] 2.1 Consulta e listagem recebem o ator; vinculado lê só a própria instituição, alheia é `RESOURCE_NOT_FOUND`
- [x] 2.2 Controlador informa o ator da sessão

## 3. Verificação

- [x] 3.1 Testes HTTP: aluno lê a própria instituição, não lê a alheia, lista só a própria; administrador de sistema continua listando todas
- [x] 3.2 `pnpm run verify` verde e `openspec validate institution-read-by-members --strict`
