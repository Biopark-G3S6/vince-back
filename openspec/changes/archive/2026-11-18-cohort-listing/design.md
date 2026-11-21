## Decisions

- **Mesmo alcance da leitura por identificador** (`readableCohort`): coordenador do curso, professor
  designado, aluno com matrícula ativa. Os cursos coordenados vêm de `CourseFacade.coordinatedBy`
  (`ADR-0005`); o resto é consulta do próprio módulo.
- **Uma consulta por página** (`ADR-0011` §9): um `OR` entre curso coordenado, professor e matrícula.
- **Ordenação** igual à da listagem por curso: início mais recente primeiro.
