## Why

`RF-ART-004` tem como ator o **orientador do evento** e o aluno integrante; o backend restringe o
registro, a alteração e a remoção da publicação ao integrante e ao orientador **responsável**. A
consulta tem a mesma restrição, e o coordenador — que tem `PUBLICATION:READ` e recebe a
consolidação de publicações no relatório do curso (RN3) — recebe `RESOURCE_NOT_FOUND`.

## What Changes

- Consulta das publicações: quem lê o artigo.
- Registro, alteração e remoção: integrante, orientador responsável e qualquer orientador do evento.
- As permissões continuam as da URS §2.3.1 (o aluno não remove).

## Capabilities

### New Capabilities

- `article-publication`: quem consulta e quem mantém o registro de publicação externa.

### Modified Capabilities

Nenhuma.

## Impact

- `src/modules/article/application/assessment-publication.use-cases.ts`, `article-scope.ts`.
