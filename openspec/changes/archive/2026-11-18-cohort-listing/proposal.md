## Why

A tela de turmas lista as turmas pedindo `GET /courses/:id/cohorts` **para cada curso** visível ao
ator. O professor enxerga todos os cursos da instituição (`COURSE:READ`), então abre uma
requisição por curso para descobrir as poucas turmas em que está designado — o N+1 entre cliente e
servidor que `ADR-0011` proíbe.

## What Changes

- Nova rota `GET /api/v1/cohorts`, paginada, com `COHORT:READ`: devolve, numa consulta, as turmas que
  o ator pode ler — as dos cursos que coordena, aquelas em que é professor designado e aquela em que
  tem matrícula ativa (mesmo alcance de `cohort-read-by-members`).
- A rota por curso continua existindo, sem alteração.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `cohort-management`: listagem das turmas legíveis pelo ator.

## Impact

- `src/modules/cohort`: caso de uso, consulta de repositório e rota.
- `vince-front`: a tela de turmas passa a fazer uma única requisição.
