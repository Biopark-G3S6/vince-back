## Decisions

- **Cópia local por sincronização** (`ADR-0006`): o `article` não lê tabela de `team`; relê o estado
  pela fachada, como já faz com integrantes e responsável.
- **Sem retroativo por migração:** copiar da tabela de `team` cruzaria schemas (`ADR-0018` §13).
