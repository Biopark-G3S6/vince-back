## Why

O sistema não tem autorização alguma: `src/modules/` está vazio e nenhuma tabela de papel ou de
permissão existe. Toda vertical funcional da URS depende disso — `ADR-0014` §11 exige verificação de
permissão na borda antes do caso de uso, e a URS §1.4 declara que os cinco papéis são **globais e
pré-criados por carga inicial**, não gerenciáveis em tempo de execução.

Esta mudança estabelece o vocabulário de autorização — o catálogo de permissões e os cinco papéis com
sua composição fixa — como dado carregado e verificável. É a base de que as verticais de conta de
usuário e de autenticação dependem, e é a única das três que pode ser construída sem nenhuma das
outras.

## What Changes

- Cria o módulo de negócio `access`, com schema próprio `access` no PostgreSQL, primeira ocupação de
  `src/modules/`. **Depende de ADR próprio** declarando a capacidade e as tabelas sob sua
  propriedade (`ADR-0003` §12) — ver Impacto.
- Cria as tabelas `role`, `permission` e `role_permission`, sob propriedade exclusiva do módulo
  `access` (`ADR-0006` §1).
- Cria a carga inicial reproduzível (`ADR-0023` §5) que popula as 98 permissões do catálogo da URS
  §2.3 e os cinco papéis com a composição de §2.3.1.
- Expõe a fachada `AccessFacade` em `contracts/`, com a consulta das permissões de um conjunto de
  papéis — única superfície pública do módulo (`ADR-0004` §1, §4).
- Estabelece o cliente Prisma escopado por módulo (`ADR-0010` §4) e registra `AccessModule` no
  composition root (`ADR-0003` §10).
- Acrescenta ao comando de verificação testes que confrontam o estado carregado com o catálogo
  declarado no repositório: permissão malformada, papel fora dos cinco declarados ou composição
  divergente reprovam o build.
- Acrescenta um comando deliberado de conferência entre o catálogo do repositório e a URS §2.3/§2.3.1
  (`ADR-0014` §7, `PAD-SEG-008`). Fica **fora** de `pnpm run verify` porque o workflow de CI não busca
  o submódulo `docs/` por decisão registrada em `.github/workflows/verify.yml` — ver `design.md`.

**Não entra nesta mudança**, deliberadamente:

- Nenhum endpoint HTTP. Papel e permissão não são recursos administráveis: a URS §1.4 os declara
  pré-criados, e nenhum requisito funcional pede CRUD de papel. Criar endpoint aqui produziria
  permissão sem RF de origem, o que `ADR-0014` §7 proíbe.
- A guarda de borda e a resolução das permissões efetivas, que precisam de um ator autenticado —
  ficam em `add-session-authentication` e em `add-user-account-and-profile`.
- A concessão direta (`PermissionGrant`, RF-ACS-006 a RF-ACS-008), que exige a entidade `User` e é
  vertical própria.

## Capabilities

### New Capabilities

- `role-and-permission-catalog`: o conjunto de permissões reconhecidas pelo sistema e os papéis
  pré-criados que as agrupam — sua forma, sua imutabilidade em tempo de execução e a consulta das
  permissões de um papel.

### Modified Capabilities

<!-- Nenhuma: é a primeira mudança do repositório e não existem specs vigentes. -->

## Impact

- **Documentação (`vince-docs`), pré-requisito bloqueante:**
  - ADR novo declarando o módulo `access`, sua capacidade de negócio e as tabelas sob sua
    propriedade (`ADR-0003` §12). Sem ele a mudança não pode ser aplicada; consta como decisão
    pendente ("decomposição em módulos") em `docs/ADR/README.md`.
  - Glossário `PAD-NOM-015` (Padrões §3.9.1): acrescentar o termo correspondente a **conta/usuário**
    (`User`) antes de ele aparecer em código.
- **Código:** `src/modules/access/` (novo), `src/modules/_datasource.prisma` (acrescenta o schema
  `access`), `src/app/app.module.ts` (uma linha de registro), `prisma/migrations/` (migração de
  criação do schema e das três tabelas), `prisma/seed.ts` (novo, referenciado por
  `pnpm run db:seed`).
- **API:** nenhuma. Esta mudança não publica rota.
- **Dependências:** nenhuma nova. `uuid` já está no `package.json` para o UUIDv7 exigido por
  `ADR-0018` §9.
- **Verticais dependentes:** `add-user-account-and-profile` e `add-session-authentication` pressupõem
  o módulo `access` e o catálogo carregado.
