## ADDED Requirements

### Requirement: Listagem das turmas legíveis pelo ator

O sistema SHALL expor `GET /api/v1/cohorts`, paginada conforme o contrato de resposta e exigindo
`COHORT:READ`, que devolve numa única consulta as turmas que o ator pode ler: as dos cursos que
coordena, aquelas em que é professor designado e aquela em que tem matrícula ativa. Nenhuma outra
turma SHALL constar.

#### Scenario: Professor lista as suas turmas

- **WHEN** um professor designado a uma turma lista as turmas
- **THEN** a resposta contém essa turma
- **AND** não contém turma do mesmo curso a que não foi designado

#### Scenario: Coordenador lista as turmas do curso

- **WHEN** o coordenador de um curso lista as turmas
- **THEN** a resposta contém todas as turmas desse curso

#### Scenario: Aluno lista a turma em que está matriculado

- **WHEN** um aluno com matrícula ativa lista as turmas
- **THEN** a resposta contém apenas a turma da matrícula
