## Why

O catálogo de papéis da URS (§2.3.1) dá `COHORT:READ` a `PROFESSOR` e a `STUDENT`. O escopo de leitura
da turma, porém, só aceita o coordenador do curso: o professor designado recebe `403` ao listar ou
consultar a própria turma. Sem isso, ele não chega à turma em que deve matricular alunos e emitir
convites (`RF-TUR-003`, `RF-TUR-004`). O defeito apareceu ao integrar a tela de turmas.

## What Changes

- `GET /courses/:courseId/cohorts`:
  - para o coordenador do curso, devolve todas as turmas, como hoje;
  - para os demais, devolve apenas as turmas em que o ator é professor designado ou aluno com
    matrícula ativa.
- `GET /cohorts/:cohortId` e `GET /cohorts/:cohortId/professors` aceitam também o professor designado e
  o aluno com matrícula ativa.
- A escrita sobre a turma não muda: continua restrita ao coordenador.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `cohort-management`: acrescenta o alcance de leitura de professores e alunos da turma.

## Impact

- `src/modules/cohort`: função de escopo de leitura, consulta de listagem por membro e casos de uso
  de listar, consultar e listar professores.
