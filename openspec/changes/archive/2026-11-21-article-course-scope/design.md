## Decisions

- **Cursos coordenados por `CourseFacade.coordinatedBy`** (`ADR-0005`), já usado por `cohort`.
- **Alcance somado, não exclusivo:** quem coordena um curso e orienta evento de outro alcança os dois.
- **Uma consulta por página** (`ADR-0011` §9): o filtro ganha `courseId in (...)` no mesmo `OR`.
