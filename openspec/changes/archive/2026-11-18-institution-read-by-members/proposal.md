## Why

A tela "Meu acesso" mostra a instituição vinculada à sessão (`RF-ACS-005`). Só o `SYSTEM_ADMIN` tem
`INSTITUTION:READ`, então qualquer outro usuário recebe `PERMISSION_DENIED` ao ler a própria
instituição e a tela exibe "Vinculada" no lugar do nome.

Conceder a permissão sem escopo quebraria o isolamento (`RF-INS-001` RN1, `ADR-0028`): a consulta
e a listagem não restringem por ator, e um aluno passaria a ver todas as instituições.

## What Changes

- `INSTITUTION:READ` passa a compor `INSTITUTION_ADMIN`, `COORDINATOR`, `PROFESSOR` e `STUDENT`
  (URS §2.3.1, alterada em vince-docs; pendente de ratificação).
- Nova regra `RF-INS-001` RN4: o usuário vinculado consulta apenas a própria instituição; a
  listagem devolve só ela; instituição alheia responde `RESOURCE_NOT_FOUND`.
- O `SYSTEM_ADMIN`, sem instituição, continua lendo todas.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `institution-management`: consulta e listagem restritas à instituição do ator vinculado.
- `role-and-permission-catalog`: composição dos papéis com `INSTITUTION:READ`.

## Impact

- `src/modules/access/domain/role-catalog.ts`; a carga inicial (`pnpm run db:seed`) aplica os
  vínculos novos.
- `src/modules/institution`: casos de uso de consulta e listagem passam a receber o ator e a
  resolver o vínculo pela fachada de `access` (`ADR-0028` §16).
- `docs/` (vince-docs): URS §2.3.1 e `RF-INS-001` RN4.
