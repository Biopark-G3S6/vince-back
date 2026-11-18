## Context

`SearchUserDirectoryUseCase` resolve a instituição do ator; o administrador de sistema não tem
instituição e, por isso, informa `institutionId`. A lista de instituições precisa dos
administradores de todas as linhas de uma vez.

## Goals / Non-Goals

**Goals:** uma consulta para os administradores de todas as instituições; manter o isolamento dos
demais usuários.

**Non-Goals:** embutir administradores no recurso de instituição — o dado de conta é do módulo
`access` (`ADR-0006`), e a instituição não o lê.

## Decisions

- **Sem `institutionId`, só com `role=INSTITUTION_ADMIN`.** É exatamente o conjunto que o
  administrador de sistema já gerencia (`RF-INS-002`); liberar qualquer papel exporia dado pessoal
  de todas as instituições sem requisito que o peça (`PAD-SEG-015`).
- **`institutionId` no item da busca**, não na resolução de nomes: quem só resolve nomes continua
  recebendo apenas `id` e `name`.
- **Uma consulta por página** (`ADR-0011` §9): o filtro de instituição apenas deixa de ser aplicado;
  a paginação continua a do contrato (`ADR-0025`).

Alternativa rejeitada: aceitar uma lista de `institutionIds`. Exige que o cliente conheça a página
de instituições e limite o tamanho da lista, sem ganho sobre o filtro por papel.

## Risks / Trade-offs

- Com muitas instituições, a resposta é paginada; o cliente percorre as páginas (o `http.all` do
  front já o faz).
