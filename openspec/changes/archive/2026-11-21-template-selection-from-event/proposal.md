## Why

`RF-TPL-002`: o criador do evento seleciona o template, o evento congela a versão corrente e **cada
artigo criado no evento nasce com o conteúdo dessa versão**. Dois defeitos impedem o fluxo:

- `POST /article-template-selections` confere a restrição de curso do template contra o `courseId`
  enviado pelo cliente. A tela envia apenas `eventId` e `templateId`, e todo template restrito a curso
  é recusado com `RESOURCE_NOT_FOUND`. A seleção também não confere se o evento existe nem se o ator é
  o dono do seu escopo (`RF-TPL-002`, pré-condição; `RE-01`).
- O artigo criado junto com a equipe (`article-follows-team`) nasce vazio, sem consultar a seleção do
  evento.

## What Changes

- A seleção lê a instituição e o curso **do evento** (`EventFacade.stateOf`), recusa evento inexistente
  (`RESOURCE_NOT_FOUND`) e ator que não é dono do escopo (`PERMISSION_DENIED`). Os campos
  `institutionId` e `courseId` do corpo deixam de ser usados.
- Template restrito a outro curso que não o do evento: `RESOURCE_NOT_FOUND` (E1). Segunda seleção:
  `TEMPLATE_ALREADY_FIXED` (E2), como já era.
- O artigo criado com a equipe nasce com o conteúdo e a referência da versão congelada pelo evento; sem
  seleção, ou com "em branco", nasce vazio (RN2).

## Capabilities

### New Capabilities

- `article-template`: seleção do template pelo evento e conteúdo inicial do artigo.

### Modified Capabilities

Nenhuma.

## Impact

- `src/modules/article`: caso de uso de seleção, consulta da seleção por evento, sincronização com a
  equipe.
