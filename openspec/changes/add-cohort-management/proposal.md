## Why

Sem turmas, o coordenador não consegue delimitar o período letivo nem formar a população de alunos e
professores que participará dos eventos. A mudança implementa `RF-TUR-001` a `RF-TUR-005`, incluindo
os dois caminhos de matrícula previstos pela URS.

## What Changes

- Introduz o cadastro, consulta, alteração e desativação de turmas vinculadas a um curso.
- Introduz a designação e a revogação de professores em uma turma.
- Introduz cadastro direto de aluno com criação de conta sem senha e matrícula ativa.
- Introduz convites de ingresso em turma, com consulta, revogação e aceitação pública que cria a conta
  e a matrícula.
- Garante unicidade da turma no curso e período letivo, validade do intervalo de datas e matrícula
  como entidade própria.
- Publica endpoints HTTP documentados em OpenAPI, usando paginação, envelope e códigos da API.

## Capabilities

### New Capabilities

- `cohort-management`: manutenção, designações, matrículas e convites de turma (`RF-TUR-001` a
  `RF-TUR-005`).

### Modified Capabilities

- `user-invitation`: a aceitação de convite de turma passa a criar também a matrícula na turma
  declarada, sem permitir que o solicitante escolha o escopo.

## Impact

- Novo módulo de negócio candidato `cohort`, com schema próprio para turma, matrícula e convite de
  ingresso, além de fachada, casos de uso, repositórios e controllers.
- Dependência do módulo `course` para validar curso e coordenador, e de `access` para contas, papéis e
  política de senha; nenhuma tabela de outro módulo será lida diretamente.
- O mecanismo de convite de `access` deverá receber o vínculo de turma como dado validado pelo módulo
  emissor, preservando o escopo institucional já existente.
- A criação do módulo exige ADR próprio, conforme `ADR-0003 §12`, e a evolução da capacidade de
  convite deve respeitar o contrato vigente durante a migração.
