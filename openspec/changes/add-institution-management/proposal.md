## Why

A instituição é a fronteira de isolamento de todo o sistema: RF-INS-001 RN1 declara que curso, turma,
evento, equipe, artigo e usuário pertencem a exatamente uma instituição. Sem ela, a conta criada em
`add-user-account-and-profile` aponta para um identificador que não corresponde a nada, e a
autenticação não consegue aplicar `INSTITUTION_INACTIVE` (RF-ACS-001 E3) — dívida declarada nas duas
verticais anteriores.

É também o primeiro elo da cadeia de designação da URS: `SYSTEM_ADMIN` cria a instituição e designa o
`INSTITUTION_ADMIN`, que designa o coordenador, que designa o professor. Sem o primeiro elo, nenhum
dos seguintes existe.

## What Changes

- Cria o módulo de negócio `institution`, com schema próprio no PostgreSQL. **Depende de ADR próprio**
  (`ADR-0003` §12) — ver Impacto.
- Cria as tabelas `institution` e `institution_admin`, sob propriedade exclusiva do módulo.
- Publica a manutenção de instituição — cadastro, consulta, listagem paginada, alteração e desativação
  (RF-INS-001), com as permissões `INSTITUTION:CREATE`, `INSTITUTION:READ`, `INSTITUTION:UPDATE` e
  `INSTITUTION:DEACTIVATE`.
- Publica a designação e a revogação de administrador institucional (RF-INS-002), com
  `INSTITUTION:ASSIGN_ADMIN` e `INSTITUTION:REVOKE_ADMIN`, atribuindo o papel `INSTITUTION_ADMIN` pela
  fachada do módulo `access` — nunca por escrita direta em tabela alheia (`ADR-0006` §2).
- Expõe a fachada `InstitutionFacade` em `contracts/`, com a consulta de existência e de estado de uma
  instituição.
- Fecha a dívida de `INSTITUTION_INACTIVE`: usuário de instituição desativada deixa de autenticar
  (RF-INS-001 RN2, RF-ACS-001 E3). A verificação entra pelo mesmo mecanismo de porta abstrata em
  `shared/` que `add-session-authentication` já estabeleceu, ligada no composition root — não é
  chamada de módulo para módulo.
- Traz a **primeira listagem paginada** do sistema, e com ela a parte do envelope que `ADR-0025` §21 a
  §25 exige e que nenhuma vertical anterior precisou.

**Não entra nesta mudança**, deliberadamente:

- `INSTITUTION:CONSENT_AI` (RF-IAA-005). O consentimento de uso de IA é da vertical de assistência
  automatizada, e a URS §3 item 12 registra que seu teor e sua base legal não estão definidos.
- Curso, turma e as designações seguintes da cadeia. São verticais próprias.

## Capabilities

### New Capabilities

- `institution-management`: a instituição como fronteira de isolamento — seu cadastro, seu estado
  ativo ou inativo, e quem a administra.

### Modified Capabilities

- `session-authentication`: a autenticação passa a recusar usuário de instituição desativada com
  `INSTITUTION_INACTIVE`, o que `add-session-authentication` deixou declarado como dívida por
  inexistência do módulo.
- `user-account`: o vínculo institucional da conta passa a ter origem declarada — chega já validado
  pelo módulo que emitiu o convite ou pela carga inicial —, em vez de ser identificador arbitrário
  aceito sem procedência.

## Impact

- **Documentação (`vince-docs`), pré-requisito bloqueante:** ADR novo declarando o módulo
  `institution`, sua capacidade e as tabelas sob sua propriedade (`ADR-0003` §12). Ver `tasks.md`.
- **Código:** `src/modules/institution/` (novo), `src/modules/_datasource.prisma` (mais um schema),
  `src/app/app.module.ts` (uma linha), `prisma/migrations/`. Em `src/modules/access/`: o caso de uso
  de criação de conta e o de autenticação ganham a consulta ao módulo proprietário.
- **API:** rotas de instituição e de designação de administrador. Primeira listagem paginada do
  sistema.
- **Fronteira entre módulos:** a dependência síncrona é de mão única — `institution` chama `access`
  pela fachada; `access` NÃO chama `institution`. `ADR-0005` §6 proíbe ciclo de chamadas síncronas, e
  a regra que esta mudança estabelece para todo o sistema é que `access` é módulo folha. Ver
  `design.md`, decisão D1.
- **Consequência para `add-user-invitation`:** o convite passa a ser **emitido** pelo módulo dono do
  escopo e **executado** pelo mecanismo do `access`. Isso não é acidente desta vertical: é o mesmo
  arranjo que RF-TUR-004 exigirá quando o convite de turma existir.
- **Verticais dependentes:** `add-user-invitation` precisa da instituição para vincular a conta que
  cria.
