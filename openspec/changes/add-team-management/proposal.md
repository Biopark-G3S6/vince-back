## Why

Sem equipes, os alunos elegíveis não conseguem se organizar no evento e não existe unidade para
associar o artigo e a responsabilidade de orientação. A mudança implementa `RF-EQP-001` a
`RF-EQP-006`, incluindo ingresso voluntário, designação e convite.

## What Changes

- Introduz criação de equipe no evento, criando simultaneamente o artigo em estado `STARTED`.
- Introduz ingresso voluntário, designação, remoção e convite de alunos, com revalidação de elegibilidade
  e limite no momento efetivo do ingresso.
- Introduz designação e revogação do orientador responsável, sem retirar o alcance dos demais
  orientadores do evento.
- Introduz consulta de alunos elegíveis que ainda não integram equipe.
- Garante no máximo uma equipe por aluno em cada evento, limite de equipes e tamanho máximo definidos
  pelo evento.
- Publica endpoints HTTP documentados em OpenAPI, com operações idempotentes onde a URS exigir.

## Capabilities

### New Capabilities

- `team-management`: formação de equipes, integrantes, convites, responsável e alunos sem equipe
  (`RF-EQP-001` a `RF-EQP-006`).

### Modified Capabilities

Nenhuma.

## Impact

- Novo módulo de negócio candidato `team`, proprietário das equipes, integrantes e convites de equipe.
- Dependências contratuais de `event`, `cohort`, `course` e `access`; a criação do artigo será feita
  pelo contrato apropriado, sem escrita direta em tabela de outro módulo.
- Novas permissões `TEAM:*` e códigos de limite, elegibilidade, duplicidade e convite já previstos na
  URS precisam ser conferidos no catálogo.
- A criação do módulo exige ADR próprio, conforme `ADR-0003 §12`, antes da implementação.
