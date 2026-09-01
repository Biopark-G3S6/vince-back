## 1. Pré-requisitos

- [x] 1.1 Concluir `add-role-and-permission-catalog`. Verificação: `pnpm exec openspec list` não a
      mostra como ativa, ou seu `tasks.md` está inteiramente marcado.
- [x] 1.2 Registrar no glossário §3.9.1 de `vince-docs` o termo em inglês da "área de atuação ou
      pesquisa" de RF-ACS-005 RN2, resolvendo a questão em aberto do `design.md` (`PAD-NOM-015`).
      Verificação: o termo consta da tabela §3.9.1 e `pnpm run docs:update` o traz para `docs/`.

## 2. Persistência

- [x] 2.1 Acrescentar a `src/modules/access/access.prisma` os models de conta e de vínculo com papel:
      chave primária UUIDv7 gerada pela aplicação, e-mail único com índice, estado da conta, coluna
      de vínculo institucional sem chave estrangeira e com índice (`ADR-0018` §13, §14), colunas de
      criação e atualização, `timestamptz` nos instantes. Verificação: `pnpm run db:migrate` gera a
      migração e ela aplica em base limpa.
- [x] 2.2 Acrescentar o model da trilha de auditoria de papel, no schema do próprio módulo
      (`ADR-0018` §6), sem operação de alteração ou remoção exposta pelo repositório (decisão D4).
      Verificação: teste que confirma a ausência de método de escrita destrutiva no repositório da
      trilha.
- [x] 2.3 Estender o cliente Prisma escopado do módulo com os models novos. Verificação:
      `pnpm run typecheck` e `pnpm run lint` passam.

## 3. Domínio e conta

- [x] 3.1 Modelar a entidade de conta em `domain/`, com a normalização do e-mail e as invariantes de
      estado, sem dependência de framework nem de tipo do Prisma (`ADR-0003` §4, `ADR-0010` §9).
      Verificação: testes de regra de domínio sem banco de dados (`ADR-0024` §6) cobrindo
      normalização e transição de estado.
- [x] 3.2 Implementar a criação de conta pelos fluxos internos. Verificação: cenários "Conta criada
      por fluxo interno", "E-mail livre", "E-mail já registrado", "E-mail já registrado com outra
      caixa", "E-mail malformado" e "Dado obrigatório ausente".
- [x] 3.3 Implementar a regra de vínculo institucional obrigatório fora de `SYSTEM_ADMIN`.
      Verificação: cenários "Conta com vínculo", "Conta de administrador de sistema sem vínculo" e
      "Conta de outro papel sem vínculo".
- [x] 3.4 Implementar desativação e reativação de conta. Verificação: cenários "Conta nasce ativa",
      "Desativação", "E-mail permanece ocupado após desativação" e "Conta inexistente".

## 4. Perfil próprio

- [x] 4.1 Implementar a consulta do perfil próprio, devolvendo também papéis e vínculo. Verificação:
      cenários "Titular consulta o próprio perfil" e "Perfil sem área e sem preferência de idioma".
- [x] 4.2 Implementar a atualização do perfil próprio com verificação de titularidade dentro do caso
      de uso (decisão D2). Verificação: cenários "Alteração aceita", "Tentativa de alterar o próprio
      e-mail", "Tentativa de alterar os próprios papéis ou vínculos", "Dado inválido" e "Alteração
      sobre conta de terceiro".
- [x] 4.3 Implementar a preferência de idioma, com a lista de idiomas suportados em ponto único.
      Verificação: cenários "Preferência suportada", "Idioma não suportado" e "Remoção da
      preferência".
- [x] 4.4 Garantir que o detalhamento por campo das falhas de validação não contenha o valor submetido
      (`ADR-0025` §18, `PAD-SEG-025`). Verificação: teste que submete e-mail inválido e confirma sua
      ausência no resultado da falha.

## 5. Papéis e permissões efetivas

- [x] 5.1 Implementar atribuição e revogação de papel, ambas idempotentes, com a trilha de auditoria
      gravada na mesma transação (decisão D4, `ADR-0019` §1). Verificação: cenários "Atribuição nova",
      "Atribuição repetida", "Papel desconhecido", "Conta inexistente", "Conta inativa", "Revogação de
      papel possuído", "Revogação de papel não possuído", "Atribuição registrada", "Revogação
      registrada", "Falha não deixa rastro parcial" e "Trilha preservada após revogação".
- [x] 5.2 Implementar a apuração das permissões efetivas como união de origens, com a origem de papel
      implementada (decisão D6). Verificação: cenários "Conta com um papel", "Conta com papéis
      múltiplos", "Conta sem papel", "Conta inativa" e "Conta inexistente".
- [x] 5.3 Implementar o cache em Redis, com chave por conta e invalidação em toda escrita que altere
      papel ou estado (decisão D3). Verificação: cenários "Apuração repetida", "Invalidação por
      revogação", "Invalidação por atribuição", "Invalidação por desativação" e "Cache indisponível".
- [x] 5.4 Garantir que a apuração não produza consulta por papel nem por permissão. Verificação:
      teste de invariância de contagem de consultas (`ADR-0011` §10, `ADR-0024` §23) sobre conta com
      papéis múltiplos.

## 6. Superfície pública e carga inicial

- [x] 6.1 Estender `AccessFacade` com as operações desta vertical e seus DTOs, mantendo o `exports`
      do módulo com apenas o token da fachada (`ADR-0004` §4, §9). Verificação: `pnpm run lint` passa
      e nenhum tipo do Prisma aparece em `contracts/`.
- [x] 6.2 Estender a carga inicial para criar a conta de `SYSTEM_ADMIN`, sem credencial e sem vínculo,
      de forma idempotente. Verificação: cenários "Primeira carga" e "Reexecução da carga"; a carga
      executada duas vezes deixa uma única conta inicial.
- [x] 6.3 Confirmar a ausência de superfície administrativa e de autocadastro. Verificação: cenários
      "Ausência de superfície administrativa" e "Ausência de autocadastro"; o catálogo de permissões
      continua sem entrada sobre o recurso de usuário.
- [x] 6.4 Atualizar o README de `src/modules/access/` com as tabelas e as operações novas.
      Verificação: o arquivo descreve a conta, o vínculo com papel, a trilha de auditoria e a dívida
      do vínculo institucional.
- [x] 6.5 Executar `pnpm run verify` inteiro. Verificação: tipos, lint, formatação e testes passam,
      com o Compose ativo.
