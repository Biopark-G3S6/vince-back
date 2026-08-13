# Prisma

O arquivo de schema de cada módulo reside **dentro do módulo** (`ADR-0010 §3`):

```
src/modules/<modulo>/<modulo>.prisma
```

O Prisma descobre os arquivos recursivamente a partir da pasta configurada em
`prisma.config.ts`. A configuração de gerador e fonte de dados fica em
`src/modules/_datasource.prisma`.

Este diretório contém apenas as **migrações geradas**, que são únicas para a aplicação
(`ADR-0010 §10`, `ADR-0006 §9`). A propriedade da migração pelo módulo é expressa pela
residência do arquivo de schema, e preservada por revisão de código (`ADR-0010 §13`).

## Regras

| Regra                                                                                    | Origem            |
| :--------------------------------------------------------------------------------------- | :---------------- |
| Cada módulo tem schema próprio no PostgreSQL; toda tabela reside no schema do seu módulo | ADR-0018 §1, §2   |
| Não existem tabelas de negócio em `public`, nem schema compartilhado                     | ADR-0018 §3, §4   |
| Chave primária é UUID v7, **gerado pela aplicação**, não pelo banco                      | ADR-0018 §9, §10  |
| Referência dentro do módulo declara chave estrangeira                                    | ADR-0018 §12      |
| Referência a outro módulo é coluna de identificador **indexada**, sem chave estrangeira  | ADR-0018 §13, §14 |
| Data e hora usam `timestamptz`; toda tabela registra criação e atualização               | ADR-0018 §15, §17 |
| `ENUM` nativo é proibido — use texto com restrição de verificação ou tabela de domínio   | ADR-0018 §19      |
| Exclusão lógica não é padrão; só onde a retenção for exigida, e declarada                | ADR-0018 §18      |
| Cada módulo tem sua tabela de outbox, no próprio schema                                  | ADR-0021 §1       |
| Migração que altere tabela de outro módulo é rejeitada em revisão                        | ADR-0010 §13      |

## Ao criar um módulo com dados próprios

1. Criar `src/modules/<modulo>/<modulo>.prisma` com os models.
2. Acrescentar o schema à lista `schemas` em `src/modules/_datasource.prisma`.
3. Gerar a migração com `pnpm run db:migrate`.
