## Why

A lista de artigos mostra o nome da equipe de cada um. O artigo só guarda `teamId`, e o cliente faz
uma requisição de equipes por evento para resolver os nomes — um N+1 entre cliente e servidor.

## What Changes

- O artigo passa a trazer `teamIdentification`, copiado da equipe pela sincronização que já mantém
  integrantes e responsável (`article-follows-team`).
- Artigos sincronizados antes desta mudança recebem o nome no próximo fato da equipe; até lá, o
  campo é `null`.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `article-listing`: nome da equipe no artigo.

## Impact

- `src/modules/team`: `TeamStateDto` traz a identificação.
- `src/modules/article`: coluna `team_identification` (migração escrita à mão), sincronização e DTO.
