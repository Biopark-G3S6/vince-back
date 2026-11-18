## Why

O administrador de sistema convida o administrador institucional (`RF-ACS-009`, cadeia
`SYSTEM_ADMIN` → `INSTITUTION_ADMIN`). Aceito o convite, a conta nasce com o papel
`INSTITUTION_ADMIN`, mas **sem o vínculo com a instituição**: o fato `InvitationAccepted` só é
publicado para convites com escopo (turma), e o módulo `institution` não o consome.

`RF-INS-002` diz que a designação atribui o papel **e cria o vínculo**, e que o escopo do papel
decorre do vínculo (RN2). Sem ele, a revogação pela tela conclui sem efeito (RN3 não encontra
vínculo para remover) e o administrador convidado permanece.

## What Changes

- O `access` publica `InvitationAccepted` em todo aceite de convite, com ou sem escopo.
- O `institution` consome o fato: convite aceito com papel `INSTITUTION_ADMIN` cria o vínculo de
  administração com a instituição do convite, de forma idempotente.
- O consumidor de turma continua ignorando o que não tem escopo de turma.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `institution-management`: o convite de administrador institucional aceito vincula o administrador.

## Impact

- `src/modules/access`: publicação do fato no aceite (barramento e outbox).
- `src/modules/institution`: consumidor do fato e vínculo idempotente.
- Contas já aceitas antes desta mudança ficam sem vínculo; a nova designação pela tela o cria.
