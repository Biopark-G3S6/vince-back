## Why

A tela de equipes mostra o papel de cada integrante (líder, autor ou coautor) e o define na
designação. O contrato não guarda papel algum.

> **Fora da URS.** Este campo não decorre de requisito da URS v0.4: foi pedido na integração com o frontend (decisão do usuário em 2026-11-15, registrada em `INTEGRACAO-FRONTEND.md`). Fica pendente de ratificação em `vince-docs`.

## What Changes

- O integrante passa a ter `role`:
  - valores `LEADER`, `AUTHOR` ou `COAUTHOR`;
  - quem ingressa nasce como `COAUTHOR`;
  - devolvido na listagem de integrantes.
- Nova rota `PATCH /api/v1/teams/:teamId/members/:userId`, com `{ "role": ... }` e a mesma
  permissão e o mesmo alcance da designação de integrante (`TEAM:ASSIGN_MEMBER`).
- O papel é rótulo de organização da equipe e não muda permissão nem acesso ao artigo.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `team-management`: acrescenta o papel do integrante.

## Impact

- `src/modules/team`: coluna `role` em `team_member`, migração SQL, caso de uso, rota e DTO.
