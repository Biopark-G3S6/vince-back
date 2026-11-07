## Why

Depois da formação de equipes, ainda falta acompanhar o estado do artigo, registrar a nota do trabalho,
avaliar cada integrante e manter o registro de publicação externa. A mudança implementa `RF-ART-001` a
`RF-ART-004` sem antecipar edição, revisão ou assistência automatizada.

## What Changes

- Introduz consulta do artigo, seu estado e a etapa corrente do cronograma, limitada aos vínculos do
  ator.
- Introduz nota única do artigo e notas individuais dos integrantes, preservando histórico, autor e
  instante de cada alteração.
- Introduz cadastro, consulta, alteração e remoção de publicação externa, sem catálogo ou validação de
  eventos e periódicos externos.
- Publica endpoints HTTP documentados em OpenAPI, com autorização do orientador responsável para
  avaliações e sem expor texto de interface na API.
- Mantém os estados `STARTED`, `IN_PROGRESS`, `IN_REVIEW` e `FINISHED` e a distinção entre nota do
  artigo e notas individuais.

## Capabilities

### New Capabilities

- `article-assessment-and-status`: situação, avaliação do artigo, avaliação individual e publicação
  externa (`RF-ART-001` a `RF-ART-004`).

### Modified Capabilities

Nenhuma.

## Impact

- Novo módulo de negócio candidato `article`, proprietário do artigo, avaliações, histórico de notas e
  publicações externas.
- Dependências contratuais de `team`, `event`, `cohort`, `course` e `access`; referências entre
  módulos serão identificadores opacos e não haverá junções entre schemas.
- Novas permissões `ARTICLE:*` e `PUBLICATION:*`, além dos códigos de validação e autorização da URS.
- A criação do módulo exige ADR próprio, conforme `ADR-0003 §12`, antes da implementação.
