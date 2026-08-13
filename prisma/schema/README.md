# Schema Prisma

Um arquivo `.prisma` por módulo, nomeado pelo módulo. `schema.prisma` contém apenas a
configuração do gerador e da fonte de dados.

## Regras

| Regra | Origem |
| :--- | :--- |
| Cada módulo tem schema próprio no PostgreSQL; toda tabela reside no schema do seu módulo | ADR-0018 §1, §2 |
| Não existem tabelas de negócio em `public`, nem schema compartilhado | ADR-0018 §3, §4 |
| Chave primária é UUID v7, **gerado pela aplicação**, não pelo banco | ADR-0018 §9, §10 |
| Referência dentro do módulo declara chave estrangeira | ADR-0018 §12 |
| Referência a outro módulo é coluna de identificador **indexada**, sem chave estrangeira | ADR-0018 §13, §14 |
| Data e hora usam `timestamptz`; toda tabela registra criação e atualização | ADR-0018 §15, §17 |
| `ENUM` nativo é proibido — use texto com restrição de verificação ou tabela de domínio | ADR-0018 §19 |
| Exclusão lógica não é padrão; só onde a retenção for exigida, e declarada | ADR-0018 §18 |
| Cada módulo tem sua tabela de outbox, no próprio schema | ADR-0021 §1 |

## Divergência conhecida

O `ADR-0010 §3` determina que o arquivo de schema de cada módulo resida **dentro do módulo**
(`src/modules/<modulo>/`). O recurso de schema multi-arquivo do Prisma exige que todos os
arquivos estejam sob uma única pasta de schema, o que impede essa colocação.

A pasta aqui é o compromisso adotado até que se confirme se o Prisma aceita apontar a pasta de
schema para dentro de `src/`. Se não aceitar, o `ADR-0010 §3` precisa ser reescrito para
refletir a realidade — não o contrário.
