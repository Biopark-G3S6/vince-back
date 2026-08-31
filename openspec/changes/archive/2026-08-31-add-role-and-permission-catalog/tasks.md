## 1. Pré-requisitos em `vince-docs` — bloqueiam a escrita de código

- [x] 1.1 Escrever e aceitar, em `vince-docs`, o ADR que cria o módulo `access`, declarando sua
      capacidade de negócio e as tabelas sob sua propriedade — `role`, `permission`,
      `role_permission` agora, e `user`, `user_role`, credencial, `invitation` e `permission_grant`
      nas verticais seguintes (`ADR-0003` §12). O mesmo ADR DEVE registrar a regra de que `access` é
      **módulo folha**: a dependência síncrona entre módulos aponta sempre para ele, e ele não chama
      nenhum outro (`ADR-0005` §6). Verificação: o ADR consta em `docs/ADR/README.md` com status
      `Aceito`, a regra está escrita nele, e a decisão sai da lista de pendências.
- [x] 1.2 Acrescentar ao glossário de nomeação (Padrões §3.9.1) os termos de domínio que esta e as
      próximas verticais introduzem: `User` e o nome do próprio módulo (`PAD-NOM-015`). Verificação:
      os termos constam da tabela §3.9.1 com o motivo da escolha.
- [x] 1.3 Atualizar o submódulo no backend (`pnpm run docs:update`) e confirmar que o ADR e o
      glossário atualizados estão visíveis em `docs/`. Verificação: `git -C docs log -1` aponta para
      o commit que contém o ADR.

## 2. Fundação de persistência e de teste

- [x] 2.1 Declarar o schema `access` em `src/modules/_datasource.prisma`, ao lado do já existente.
      Verificação: `pnpm run db:generate` conclui sem erro.
- [x] 2.2 Criar `src/modules/access/access.prisma` com os models `Role`, `Permission` e
      `RolePermission` — chave primária UUID gerada pela aplicação, `code` único em `Role` e em
      `Permission`, chave primária composta em `RolePermission`, `timestamptz` nas colunas de
      instante, colunas de criação e atualização em todas as tabelas, índices nas colunas de
      referência (`ADR-0018` §9 a §17, §20). Verificação: `pnpm run db:migrate` gera a migração e ela
      aplica em base limpa.
- [x] 2.3 Prover a instância única de `PrismaClient` no composition root e a extensão escopada
      entregue ao módulo `access`, expondo exclusivamente os três models (`ADR-0010` §4, §5, §7).
      Verificação: teste que confirma a ausência dos models de `observabilidade` no cliente escopado,
      em tempo de compilação e em execução.
- [x] 2.4 Implementar o `TODO` de `test-setup.ts`: criar os schemas do processo, aplicar as migrações,
      truncar as tabelas entre testes e remover os schemas ao final (`ADR-0024` §11, §12).
      Verificação: `pnpm run test` executa em paralelo com dois processos sem interferência entre
      eles, com o Compose ativo.

## 3. O catálogo declarado

- [x] 3.1 Declarar em `src/modules/access/domain/` o catálogo das 98 permissões da URS §2.3, cada uma
      como símbolo tipado, com o RF de origem em comentário (decisão D3 do `design.md`). Verificação:
      teste que confirma 98 entradas distintas e que toda entrada satisfaz o formato `RECURSO:ACAO`.
- [x] 3.2 Declarar os cinco papéis da URS §1.4 e a composição de cada um conforme §2.3.1, enumerada
      permissão a permissão, sem abreviação. Verificação: teste que confirma que toda permissão
      citada em uma composição existe no catálogo de 3.1.
- [x] 3.3 Implementar a validação da forma da permissão, recusando curinga, minúscula, ausência de
      `:` e recurso no plural. Verificação: testes dos três cenários de recusa da spec —
      "Permissão com curinga é recusada", "Permissão fora do formato é recusada" e "Papel referencia
      permissão inexistente".

## 4. Carga inicial

- [x] 4.1 Implementar a carga do catálogo no módulo `access`, reconciliando por `code`: insere o que
      falta, remove vínculo de `role_permission` ausente da declaração, preserva identificadores
      existentes (decisão D6). Verificação: testes dos cenários "Primeira execução", "Reexecução
      sobre base já carregada" e "Permissão removida da composição de um papel".
- [x] 4.2 Criar o bootstrap de carga em `src/app/bootstrap/`, acionando a carga por método estático de
      `AccessModule`, e apontar `pnpm run db:seed` para ele (decisão D5). Verificação: a carga
      executada duas vezes seguidas em base limpa deixa o mesmo estado, e `pnpm run lint` passa sem
      exceção de fronteira.
- [x] 4.3 Fazer a carga falhar por inteiro, sem gravação parcial, diante de declaração inválida.
      Verificação: teste que confirma base inalterada após carga com permissão malformada.

## 5. Superfície pública

- [x] 5.1 Declarar `AccessFacade` como `abstract class` em `src/modules/access/contracts/`, com a
      consulta das permissões de um conjunto de papéis, e os DTOs correspondentes — sem tipo do
      Prisma e sem entidade de domínio (`ADR-0004` §2, §8, §9). Verificação: `pnpm run lint` passa e
      o `exports` de `AccessModule` contém apenas o token da fachada.
- [x] 5.2 Implementar o caso de uso da consulta, com um método público de execução (`ADR-0003` §8), e
      registrar a fachada na forma `{ provide, useClass }` (`ADR-0004` §6). Verificação: testes dos
      cenários "Consulta de um papel", "Consulta de papéis múltiplos", "Consulta com papel
      desconhecido" e "Consulta sem papel", exercitados pela fachada (`ADR-0024` §2).
- [x] 5.3 Garantir que a consulta de vários papéis não produza consulta por papel. Verificação: teste
      de invariância de contagem de consultas, conforme `ADR-0011` §10 e `ADR-0024` §23, cobrindo o
      cenário "Consulta com número de papéis maior que um".
- [x] 5.4 Registrar `AccessModule` no composition root, em uma linha (`ADR-0003` §10). Verificação: a
      aplicação sobe com `ROLE=api` e com `MODULES=access`, e a remoção da linha não quebra a
      compilação (`ADR-0003` §11).

## 6. Conferência com a URS e fechamento

- [x] 6.1 Implementar o comando de conferência entre o catálogo declarado e a URS §2.3 e §2.3.1,
      relatando diferenças nos dois sentidos e falhando quando o submódulo não estiver inicializado
      (decisão D4). Verificação: cenários "Catálogo em correspondência", "Permissão sem requisito de
      origem", "Permissão do catálogo ausente" e "Conferência sem a documentação disponível".
- [x] 6.2 Executar a conferência e anexar o resultado à revisão desta mudança. Verificação: o comando
      relata correspondência integral das 98 permissões e das cinco composições.
- [x] 6.3 Escrever o README de `src/modules/access/`, no padrão dos demais diretórios: o que o módulo
      possui, o que sua fachada expõe e o que a carga inicial garante. Verificação: o arquivo existe
      e é citado pelo README de `src/modules/`.
- [x] 6.4 Executar `pnpm run verify` inteiro. Verificação: tipos, lint, formatação e testes passam,
      com o Compose ativo.

---

## Estado da execução — 2026-08-31

Com o Compose ativo (PostgreSQL 17.2 em `localhost:5432`), **todas as tarefas de 2 a 6 foram
executadas e conferidas nesta máquina**.

| Tarefa    | Como foi conferida                                                                                      |
| :-------- | :------------------------------------------------------------------------------------------------------ |
| 2.2       | Migração aplicada sobre base limpa; estrutura conferida coluna a coluna contra `ADR-0018` §9 a §17, §20 |
| 2.4       | Suíte executada três vezes, 6 processos paralelos, uma base por processo, sem interferência             |
| 3.1 a 3.3 | 24 testes de domínio                                                                                    |
| 4.1, 4.3  | Cenários de carga, reexecução, remoção de vínculo e declaração inválida                                 |
| 4.2       | Duas cargas seguidas em base limpa: 98/5/158 e depois tudo em zero                                      |
| 5.2, 5.3  | Quatro cenários de consulta pela fachada e a invariância de contagem                                    |
| 5.4       | Aplicação sobe com `ROLE=api MODULES=access`                                                            |
| 6.2       | `pnpm run docs:check-catalog`: correspondência integral com a URS §2.3 e §2.3.1                         |
| 6.4       | `pnpm run verify` inteiro: tipos, lint, formatação e **46 testes**                                      |

A migração foi aplicada com `pnpm run db:deploy`, e não com `pnpm run db:migrate`. O motivo não é
esta mudança: `prisma migrate dev` compara o datamodel inteiro com o histórico e tentaria gerar
migração para `observabilidade.assinatura_erro`, que consta de `observabilidade.prisma` e nunca teve
migração. É deriva **anterior** a esta mudança, deixada para tratamento futuro por decisão da
equipe. `prisma migrate status` relata `Database schema is up to date`, e `migrate deploy` é o
caminho que o CI e a produção usam.

**Pendente fora deste repositório:**

- 1.1, 1.2 e 1.3 estão commitados em `vince-docs`, na ramificação `adr-0027-modulo-access`
  (`6895f5c`), a partir de `origin/main`. `git -C docs log -1` aponta para o commit que contém o
  `ADR-0027` e o glossário, que é a verificação pedida. Falta **publicar e integrar por pull
  request** (`ADR-0023 §16`); só depois disso o ponteiro do submódulo é utilizável por outra
  máquina. `pnpm run docs:update` não foi executado de propósito: ele busca o remoto e
  descartaria o commit local enquanto ele não estiver publicado.

## Defeitos encontrados e corrigidos ao executar contra o banco

- `pnpm run db:seed` **falhava por inteiro** com `Cannot read properties of undefined (reading
'reconcile')`. O script rodava por `tsx`, que transpila com esbuild e **não emite
  `emitDecoratorMetadata`**; sem `design:paramtypes` o contêiner do Nest injetava `undefined` no
  construtor do caso de uso. O script passou a executar o arquivo compilado
  (`pnpm run build && node dist/app/bootstrap/seed-catalog.js`), que é o mesmo caminho da
  aplicação. O motivo está registrado no cabeçalho de `seed-catalog.ts` para que ninguém o
  reverta. `docs:check-catalog` segue em `tsx` legitimamente: não sobe contêiner de injeção.
- A ausência de banco escondia isso: sem PostgreSQL a carga falharia de qualquer forma, e a falha
  seria atribuída à conexão. Na prática `DATABASE_URL` nunca faltou — o `@prisma/client` carrega
  `.env` ao ser importado.

## Correções feitas na revisão do que ficou sem execução

- `test-setup.ts`, `splitStatements`: o filtro descartava todo comando que começasse com a linha
  de comentário que o Prisma gera (`-- CreateTable`), o que produzia **zero** comandos e faria a
  base de teste nascer vazia. Passou a remover as linhas de comentário de dentro do comando.
  Conferido contra a migração real: 9 comandos.
- `test-setup.ts`, cliente administrativo: a URL era recalculada depois de `DATABASE_URL` já ter
  sido reapontada para a base do processo, de modo que a criação da base tentava conectar-se à
  base que ainda não existia. A URL configurada passou a ser capturada uma vez, no carregamento.
- `test-setup.ts`: os schemas passam a ser removidos também antes de aplicar a migração, para que
  execução anterior interrompida não faça `CREATE TABLE` falhar.

As três correções acima foram confirmadas em execução: sem elas a suíte não passaria.
