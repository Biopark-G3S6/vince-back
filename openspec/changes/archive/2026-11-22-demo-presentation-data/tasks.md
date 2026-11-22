## 1. Carga de demonstração

- [x] 1.1 Cliente mínimo da API (sessão por cookie, CSRF, envelope) em `src/app/bootstrap/demo/api-client.ts`
- [x] 1.2 Conteúdo da carga em `demo-dataset.ts`: as instituições de Toledo-PR e as pessoas, eventos e artigos fictícios
- [x] 1.3 Executor `load-demo.ts`: carga inicial, senha do administrador, cenário e lista de acessos
- [x] 1.4 Script `db:demo` e documentação (`src/app/bootstrap/demo/README.md` e `README.md`)

## 2. Verificação

- [x] 2.1 Carga completa num banco novo, migrado com `prisma migrate deploy`
- [x] 2.2 Segunda execução no mesmo banco reconhece a carga e não duplica dados
- [x] 2.3 Telas conferidas com as contas da carga
- [x] 2.4 `pnpm run verify`
