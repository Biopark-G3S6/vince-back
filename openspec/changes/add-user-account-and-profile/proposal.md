## Why

`add-role-and-permission-catalog` deixa o sistema sabendo quais permissões existem e como os cinco
papéis as agrupam, mas não existe ninguém a quem atribuí-las. Sem a conta de usuário não há
`SYSTEM_ADMIN` inicial (URS §1.4.1, item 1), não há a quem autenticar e não há como resolver as
permissões efetivas que `ADR-0014` §9 exige a cada requisição.

Esta mudança cria a conta, o vínculo com papel e a resolução das permissões efetivas — o que a
autenticação vai consumir na vertical seguinte.

## What Changes

- Acrescenta ao módulo `access` as tabelas `user` e `user_role`, com o e-mail como identificador
  único global (RF-ACS-001 RN1, RF-TUR-003 RN2).
- Registra no perfil o nome, a área de atuação ou pesquisa e a preferência de idioma
  (RF-ACS-005, RF-INT-001, `PAD-NOM-012`).
- Registra o vínculo institucional do usuário como identificador simples, sem chave estrangeira,
  porque o módulo proprietário de instituição ainda não existe (`ADR-0006` §4, `ADR-0018` §13, §14).
- Implementa, como casos de uso expostos pela fachada do módulo: consulta e atualização do perfil
  próprio, criação de conta pelos fluxos internos, ativação e desativação, atribuição e revogação de
  papel, e resolução das permissões efetivas.
- Resolve as permissões efetivas com cache, invalidado imediatamente a cada alteração de papel
  (`ADR-0014` §9, §10).
- Estende a carga inicial para criar o primeiro usuário `SYSTEM_ADMIN` (URS §1.4.1, item 1), sem
  credencial — a senha nasce na vertical de autenticação.
- Registra em trilha de auditoria imutável toda atribuição e revogação de papel (`ADR-0014` §18).

**Não entra nesta mudança**, deliberadamente:

- **Nenhuma rota HTTP.** Todo endpoint que esta vertical publicaria — a começar pelo perfil próprio de
  RF-ACS-005 — tem "sessão ativa" como pré-condição, e a sessão só existe em
  `add-session-authentication`. Os casos de uso ficam prontos e integralmente testados pela fachada,
  que é a fronteira de teste fixada por `ADR-0024` §2; a vertical seguinte acrescenta os controllers
  sobre eles.
- **CRUD administrativo de usuário.** Não existe requisito funcional de origem: a URS não tem RF
  "Manter usuário" e o catálogo §2.3 não declara nenhuma permissão `USER:*`. Criar essas permissões
  aqui violaria `ADR-0014` §7 e `PAD-SEG-008`. A criação de conta acontece pelos fluxos que a URS já
  especifica — carga inicial, RF-TUR-003 e RF-TUR-005 —, e a fachada oferece a operação que esses
  fluxos vão consumir quando suas verticais chegarem.
- **Concessão direta de permissão** (`PermissionGrant`, RF-ACS-006 a RF-ACS-008). É vertical própria;
  até lá, as permissões efetivas são as dos papéis.
- **Verificação de que a instituição existe e está ativa.** Depende do módulo de instituição, que
  ainda não existe. Ver Impacto.

## Capabilities

### New Capabilities

- `user-account`: a conta de usuário — identidade por e-mail, estado ativo ou inativo, vínculo
  institucional, perfil próprio e sua manutenção pelo titular.
- `role-assignment`: o vínculo entre usuário e papel, sua trilha de auditoria e a resolução das
  permissões efetivas de um usuário.

### Modified Capabilities

<!-- Nenhuma. `role-and-permission-catalog` é consumida sem alteração de seus requisitos. -->

## Impact

- **Documentação (`vince-docs`):** acrescentar ao glossário §3.9.1 o termo da **área de atuação ou
  pesquisa** de RF-ACS-005 RN2, ainda sem correspondência em inglês registrada (`PAD-NOM-015`).
- **Código:** `src/modules/access/access.prisma` (dois models novos), `prisma/migrations/` (migração),
  `src/modules/access/contracts/` (fachada cresce), `domain/`, `application/`, `infrastructure/`, e o
  bootstrap de carga inicial de `src/app/bootstrap/`.
- **API:** nenhuma rota publicada. O contrato OpenAPI de `ADR-0017` §1 permanece vazio até a vertical
  seguinte.
- **Redis:** primeira ocupação, para o cache das permissões efetivas.
- **Dependências:** nenhuma nova. `ioredis` já está no `package.json`.
- **Dívida declarada:** o vínculo institucional fica sem validação de existência e sem a regra
  `INSTITUTION_INACTIVE` de RF-INS-001 RN2 até que o módulo de instituição exista. A vertical de
  instituição terá de fechá-la.
- **Verticais dependentes:** `add-session-authentication` consome a conta, a resolução de permissões
  efetivas e o `SYSTEM_ADMIN` carregado.
