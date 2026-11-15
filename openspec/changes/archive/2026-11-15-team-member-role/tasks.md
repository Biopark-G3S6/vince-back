## 1. Implementação

- [x] 1.1 Coluna `team_member.role` com padrão `COAUTHOR`, migração SQL escrita à mão; verificar com `prisma migrate deploy`
- [x] 1.2 Papel no domínio e no DTO de integrante, caso de uso e rota `PATCH`; verificar com teste HTTP dos dois cenários

## 2. Verificação

- [x] 2.1 `pnpm run verify` verde e `openspec validate team-member-role --strict` sem erros
