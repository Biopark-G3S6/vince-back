## Why

Os eventos são a unidade que organiza tema, cronograma e orientação dos artigos, mas ainda não há como
criar essa unidade nem controlar seu alcance por instituição, curso ou turma. A mudança implementa
`RF-EVT-001` a `RF-EVT-004` com acesso restrito aos vínculos do usuário.

## What Changes

- Introduz criação, consulta, alteração e cancelamento de eventos com escopo de instituição, curso ou
  turma.
- Introduz manutenção do cronograma de etapas, com datas estritamente crescentes e proteção de etapas
  já iniciadas.
- Introduz designação e revogação de orientadores elegíveis ao evento.
- Introduz consulta de eventos agrupada por escopo, respeitando os vínculos do ator.
- Aplica os limites de equipes e tamanho de equipe definidos por evento e impede reduzir limites abaixo
  do uso atual.
- Publica endpoints HTTP documentados em OpenAPI, com paginação quando houver listagem.

## Capabilities

### New Capabilities

- `event-management`: ciclo de vida, escopo, cronograma, orientadores e consulta de eventos
  (`RF-EVT-001` a `RF-EVT-004`).

### Modified Capabilities

Nenhuma.

## Impact

- Novo módulo de negócio candidato `event`, com schema próprio para eventos, etapas e designações de
  orientador.
- Dependências contratuais de `access`, `course` e `cohort` para autorização e validação do escopo,
  sem junções entre schemas.
- Novas permissões `EVENT:*` e `MILESTONE:*`, além dos códigos de escopo e conflito já declarados ou
  a conferir na URS.
- A criação do módulo exige ADR próprio, conforme `ADR-0003 §12`, antes da implementação.
