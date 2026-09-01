# Módulo `access`

Identidade e autorização (`ADR-0027`). Responde quem é o ator, por que meio ele prova sê-lo e o
que ele está autorizado a fazer. **Não** responde onde ele atua: o escopo vem do vínculo, e a
titularidade do registro é verificada dentro do caso de uso do módulo dono daquele registro
(`ADR-0014 §12`).

É **módulo folha** na dependência síncrona (`ADR-0027 §9`): todo módulo pode chamar a fachada
dele, e ele não chama a de ninguém. É o que impede ciclo com um módulo para o qual todos apontam.

## O que ele possui

Schema `access` no PostgreSQL. Tabelas declaradas em `access.prisma`:

| Tabela            | Guarda                                              |
| :---------------- | :-------------------------------------------------- |
| `permission`      | o catálogo das permissões reconhecidas pelo sistema |
| `role`            | os cinco papéis globais, pré-criados                |
| `role_permission` | a composição de cada papel                          |

`ADR-0027 §5` enumera também as tabelas das verticais seguintes — `user`, `user_role`,
`password_credential`, `permission_grant`, `invitation`. Tabela fora dessa lista **não** nasce
aqui sem reescrever o ADR.

## O que a fachada expõe

`AccessFacade`, em `contracts/`, com uma operação: a consulta das permissões de um conjunto de
papéis, devolvendo a união sem repetição. Papel desconhecido não contribui e não faz a consulta
falhar.

Os códigos de papel e de permissão atravessam a fronteira como **texto opaco** (`ADR-0027 §14`).
O tipo estreito — `PermissionCode`, `RoleCode` — vive em `domain/` e não sai do módulo, porque
`contracts/` não pode importar `domain/` e `domain/` não pode importar `contracts/`.

A fachada **não** tem operação de escrita sobre papel, permissão ou composição, e não terá:
o catálogo é imutável em tempo de execução (`ADR-0027 §13`, `ADR-0014 §7`). Não há rota HTTP
neste módulo — papel e permissão não são recursos administráveis.

## O que a carga inicial garante

`pnpm run db:seed` executa `AccessModule.seed`, que reconcilia o estado gravado com a declaração
de `domain/`:

- as 98 permissões da URS §2.3 existem, cada uma no formato `RECURSO:ACAO`;
- os cinco papéis da URS §1.4 existem, com a composição de §2.3.1 enumerada permissão a
  permissão, sem curinga;
- reexecutar não duplica nada e **não altera identificador já gravado** — a chave da
  reconciliação é o `code`, e a chave primária é o UUIDv7 gerado pela aplicação;
- retirar uma permissão da composição de um papel a remove do papel na reexecução seguinte, e a
  permissão continua no catálogo;
- declaração inválida — curinga, minúscula, recurso no plural, papel fora dos cinco, permissão
  inexistente — reprova a carga **por inteiro**, antes de qualquer gravação.

A carga entra por método estático de `AccessModule`, e não por script fora de `src/`
(`ADR-0027 §21`): fora de `src/` a importação escaparia da análise de fronteiras do ESLint, o que
seria conformidade aparente, não real. O mesmo vale para `AccessModule.declaredCatalog()`, que é
como o comando de conferência alcança o catálogo sem que o composition root importe `domain/`.

## O catálogo é declarado uma vez

`domain/permission-catalog.ts` e `domain/role-catalog.ts` são a declaração única do repositório
(`ADR-0027 §17`). A carga grava a partir dela, os testes conferem contra ela e o código que
exigir uma permissão referencia o símbolo, nunca o literal.

A URS continua sendo a origem: nenhuma permissão existe sem requisito funcional que a produza
(`ADR-0014 §7`), e o requisito de origem de cada uma está no comentário ao lado dela. A
correspondência entre as duas cópias é conferida por `pnpm run docs:check-catalog`, que fica
fora de `pnpm run verify` porque depende do submódulo `docs/` (`ADR-0027 §19`). **Execute-o na
revisão de qualquer alteração do catálogo** — é a única proteção contra a divergência.

## Cliente Prisma

O módulo nunca recebe a instância não escopada. `AccessModule.forRoot` recebe do composition root
a instância única do processo (`ADR-0010 §7`) e a estende para os seus três models
(`infrastructure/access-prisma.ts`). A proteção é dupla porque uma metade não bastaria: o tipo
exposto é a projeção dos models próprios — `assinaturaErro`, do módulo `observabilidade`, não
existe nele — e o gancho de consulta recusa, em execução, operação sobre model alheio.

Consulta em SQL bruto não passa pelo gancho; `ADR-0010 §14` a submete à revisão de código.
