## Why

A integração das telas de edição, revisão e acompanhamento (branch `Integração`, de 2026-11-16) acrescentou
ao módulo `article` leituras de que essas telas precisam, sem mudança OpenSpec. Esta mudança registra o
comportamento que entrou, para que o contrato construído e a spec voltem a coincidir.

## What Changes

- `GET /api/v1/my/articles`: os artigos das equipes de que o ator é integrante, com a situação, a etapa
  corrente, os apontamentos pendentes e a última edição (escopo `member` do acompanhamento).
- A consulta de template devolve o histórico de versões.
- As respostas de artigo, referência, entrega e apontamento trazem campos que já existiam no modelo:
  versão do template, datas de criação e alteração, dados bibliográficos completos, conteúdo e revogação
  da entrega, autoria e decisão do apontamento.
- A criação de artigo com template resolve a **versão** informada pelo identificador e recusa versão de
  outra instituição ou de curso diferente (`RESOURCE_NOT_FOUND`); antes procurava só entre as versões
  correntes.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `article-listing`: artigos do integrante, com o acompanhamento.

## Impact

- `src/modules/article`: rota, DTOs de resposta e consulta de versão de template.
- Contrato compatível: só acrescenta rota e campos.
