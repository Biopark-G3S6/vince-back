## 1. Implementação

- [x] 1.1 Emitir e apagar o cookie anti-CSRF com `Path=/`, mantendo o de sessão em `/api/v1`; verificar com o teste HTTP de atributos de cookie estendido aos dois cenários

## 2. Verificação

- [x] 2.1 `pnpm run verify` verde e `openspec validate csrf-token-readable-by-client --strict` sem erros
