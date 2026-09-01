## 1. Pré-requisitos

- [ ] 1.1 Concluir e arquivar `add-session-authentication` (e, por consequência, as duas anteriores).
      Verificação: `pnpm exec openspec list` não as mostra ativas e as capacidades
      `session-authentication` e `user-account` existem em `openspec/specs/` — sem elas, os deltas
      `MODIFIED` desta mudança não têm requisito de destino.
- [ ] 1.2 Escrever e aceitar, em `vince-docs`, o ADR que cria o módulo `institution`, declarando sua
      capacidade e as tabelas `institution` e `institution_admin` (`ADR-0003` §12). O mesmo ADR, ou o
      do módulo `access`, DEVE registrar a regra da decisão D1: `access` é módulo folha e a dependência
      síncrona entre módulos aponta sempre para ele. Verificação: o ADR consta em `docs/ADR/README.md`
      como `Aceito` e a regra está escrita, não apenas neste `design.md`.
- [ ] 1.3 Decidir com a parte interessada quais campos compõem os "dados de identificação" da
      instituição (questão em aberto do `design.md`). Verificação: a lista está registrada antes de a
      migração ser gerada.

## 2. Módulo e persistência

- [ ] 2.1 Declarar o schema `institution` em `src/modules/_datasource.prisma` e criar
      `src/modules/institution/institution.prisma` com os models de instituição e de vínculo de
      administrador — UUIDv7 pela aplicação, estado da instituição, `user_id` sem chave estrangeira e
      com índice (`ADR-0018` §13, §14), colunas de criação e atualização. Verificação:
      `pnpm run db:migrate` gera a migração e ela aplica em base limpa.
- [ ] 2.2 Prover o cliente Prisma escopado do módulo e registrar `InstitutionModule` no composition
      root, em uma linha. Verificação: a aplicação sobe com `MODULES=access,institution` e a remoção
      da linha não quebra a compilação dos demais módulos (`ADR-0003` §11).
- [ ] 2.3 Estender `test-setup.ts` para criar e truncar também o schema do módulo novo. Verificação:
      `pnpm run test` executa em paralelo sem interferência.

## 3. Manutenção de instituição

- [ ] 3.1 Implementar o cadastro de instituição. Verificação: cenários "Cadastro aceito", "Nome
      ausente" e "Ator sem a permissão".
- [ ] 3.2 Implementar a consulta por identificador e a listagem paginada conforme `ADR-0025` §21 a
      §25, com `hasNext` obtido pela busca de um registro além da página e sem consulta de contagem.
      Verificação: cenários "Consulta por identificador", "Instituição inexistente", "Listagem
      paginada", "Total solicitado explicitamente" e "Página acima do limite".
- [ ] 3.3 Garantir contagem de consultas invariante na listagem (`ADR-0011` §9, §10). Verificação:
      cenário "Contagem de consultas invariante", integrando o comando de verificação.
- [ ] 3.4 Implementar a alteração, sem permitir mudança de estado por ela. Verificação: cenários
      "Alteração aceita", "Alteração de instituição inexistente" e "Tentativa de mudar o estado pela
      alteração".
- [ ] 3.5 Implementar desativação e reativação, idempotentes e sem remoção de registros. Verificação:
      cenários "Desativação com cursos ativos", "Desativação é idempotente", "Reativação" e "Registros
      preservados".

## 4. Administrador institucional

- [ ] 4.1 Implementar a designação, atribuindo o papel pela fachada do `access` antes de gravar o
      vínculo, ambas as etapas idempotentes (decisão D2). Verificação: cenários "Designação aceita",
      "Designação repetida", "Segundo administrador", "Instituição inativa", "Usuário inexistente" e
      "Retomada após falha parcial".
- [ ] 4.2 Implementar a revogação, removendo o papel apenas quando não restar vínculo que o justifique
      (RF-INS-002 RN3). Verificação: cenários "Revogação do único vínculo", "Revogação com outro
      vínculo remanescente", "Revogação de vínculo inexistente" e "Efeito imediato sobre as
      permissões".
- [ ] 4.3 Confirmar que `institution` não lê nem escreve tabela do `access` e que `access` não importa
      nada de `institution` (decisão D1, `ADR-0006` §2, `ADR-0005` §6). Verificação: `pnpm run lint`
      passa e uma busca por importações cruzadas não encontra ocorrência.

## 5. Fechamento das dívidas herdadas

- [ ] 5.1 Expor na fachada do `institution` a consulta de existência e estado, individual e em lote.
      Verificação: cenários "Consulta de instituição ativa", "Consulta de instituição inexistente" e
      "Consulta em lote".
- [ ] 5.2 Implementar no composition root o adaptador que compõe permissões efetivas e estado da
      instituição, ligado ao port de `shared/` (decisão D5). Verificação: `pnpm run lint` passa e
      `shared/` continua sem importar de `modules/`.
- [ ] 5.3 Fazer a autenticação distinguir `INSTITUTION_INACTIVE` somente após verificar a credencial
      (decisão D4). Verificação: cenários do delta `MODIFIED` de `session-authentication` —
      "Instituição desativada", "Instituição desativada com credencial incorreta" e "Conta sem vínculo
      institucional" — além dos que já passavam.
- [ ] 5.4 Fazer a instituição inativa zerar as permissões efetivas, com invalidação de cache na
      desativação e na reativação, sem iterar usuário a usuário (decisão D3, `ADR-0011` §13).
      Verificação: cenários "Sessões existentes após a desativação" e "Permissões restauradas na
      reativação".
- [ ] 5.5 Fazer a criação de conta recusar identificador de instituição vindo do cliente. Verificação:
      cenários do delta `MODIFIED` de `user-account` — "Conta com vínculo" e "Instituição não é aceita
      do cliente".

## 6. Encerramento

- [ ] 6.1 Escrever o README de `src/modules/institution/` e atualizar o de `src/modules/access/` com a
      regra de módulo folha. Verificação: os dois arquivos declaram a direção da dependência.
- [ ] 6.2 Executar `pnpm run verify` inteiro. Verificação: tipos, lint, formatação e testes passam,
      com o Compose ativo.
