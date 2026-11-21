## 1. Diretório

- [x] 1.1 Filtro de instituição opcional no repositório e `institutionId` no item; caso de uso aceita a omissão para o administrador de sistema só com `role=INSTITUTION_ADMIN`
- [x] 1.2 DTO de resposta e OpenAPI com `institutionId`

## 2. Verificação

- [x] 2.1 Testes HTTP: administrador de sistema lista administradores de várias instituições; sem `institutionId` e com outro papel continua `400`; `institutionId` presente nos itens da busca e ausente na resolução de nomes
- [x] 2.2 `pnpm run verify` verde e `openspec validate directory-institution-admins --strict` sem erros
