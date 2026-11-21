## 1. Implementação

- [x] 1.1 `access` publica `InvitationAccepted` em todo aceite (barramento e outbox)
- [x] 1.2 Consumidor em `institution` cria o vínculo para convite aceito com `INSTITUTION_ADMIN`

## 2. Verificação

- [x] 2.1 Teste HTTP: convite aceito vira administrador vinculado; a revogação remove vínculo e papel
- [x] 2.2 `pnpm run verify` verde e `openspec validate institution-admin-by-invitation --strict`
