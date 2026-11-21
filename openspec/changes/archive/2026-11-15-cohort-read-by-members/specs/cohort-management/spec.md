## ADDED Requirements

### Requirement: Leitura da turma por professores e alunos

O professor designado e o aluno com matrícula ativa SHALL poder consultar a turma e a lista de
professores dela.

- **Listagem por curso:** para quem não coordena o curso, a listagem SHALL conter apenas as turmas
  em que o ator é professor designado ou aluno matriculado.
- **Turma de outro vínculo:** consultá-la MUST resultar em `403` com `PERMISSION_DENIED`, como antes.
- **Escrita:** alteração, desativação e designação de professor MUST continuar restritas ao
  coordenador do curso.

#### Scenario: Professor lista as próprias turmas

- **WHEN** um professor designado a uma turma lista as turmas do curso
- **THEN** a resposta contém essa turma e nenhuma turma em que ele não está designado

#### Scenario: Aluno consulta a turma em que está matriculado

- **WHEN** um aluno com matrícula ativa consulta a turma
- **THEN** a resposta é `200` com a turma

#### Scenario: Professor sem vínculo

- **WHEN** um professor não designado consulta a turma
- **THEN** a resposta é `403` com `PERMISSION_DENIED`
