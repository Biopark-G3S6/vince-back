## Why

A spec vigente `team-management` exige que a criação da equipe crie o seu artigo em `STARTED`
(`RF-EQP-001` RN1, RE-05), mas nada no sistema o faz: `ArticleFacade.createArticle` só é chamado
por testes e nenhum consumidor de `TeamCreated` existe em `article`. Sem artigo, nenhuma tela de
artigo funciona contra o backend real — é a pendência bloqueante de `INTEGRACAO-FRONTEND.md`. Além
disso, o artigo guarda cópia dos integrantes e do orientador responsável, usada na autorização de
leitura, edição e avaliação; essa cópia precisa acompanhar a equipe.

## What Changes

- O módulo `article` passa a consumir `TeamCreated` e cria o artigo da equipe, de forma idempotente.
- O módulo `article` passa a consumir `TeamCompositionChanged` e atualiza os integrantes do artigo.
- O módulo `team` passa a gravar na outbox o fato `TeamAdvisorChanged` ao designar ou revogar o
  orientador responsável; `article` o consome e atualiza o orientador do artigo.
- Nenhuma rota nova.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `team-management`: acrescenta o requisito de que o artigo da equipe acompanha a composição e o
  orientador responsável (a criação do artigo já está especificada e passa a ser cumprida).

## Impact

- `src/modules/article`: novo consumidor de fatos de equipe, caso de uso de sincronização, métodos de
  repositório para localizar e atualizar o artigo pela equipe.
- `src/modules/team`: gravação do fato `TeamAdvisorChanged` na mesma transação da designação/revogação.
- Dependência síncrona de `article` sobre as fachadas de `team` e `event` (permitida por `ADR-0005`).
- Sem migração: `article.team_id` já é único.
