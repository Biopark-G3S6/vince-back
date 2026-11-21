## Why

A tela de instituições registra a cidade e a UF da instituição como parte dos seus dados de
identificação (`ADR-0028` §1). O contrato atual não os guarda.

> **Fora da URS.** Este campo não decorre de requisito da URS v0.4: foi pedido na integração com o frontend (decisão do usuário em 2026-11-15, registrada em `INTEGRACAO-FRONTEND.md`). Fica pendente de ratificação em `vince-docs`.

## What Changes

- A instituição passa a ter `city` (texto, opcional) e `state` (UF, duas letras maiúsculas,
  opcional).
- Ambos são aceitos na criação e na alteração, e devolvidos na consulta e na listagem.
- Mudança aditiva no contrato.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `institution-management`: acrescenta cidade e UF aos dados de identificação.

## Impact

- `src/modules/institution`: coluna, DTO, validação e migração SQL escrita à mão.
