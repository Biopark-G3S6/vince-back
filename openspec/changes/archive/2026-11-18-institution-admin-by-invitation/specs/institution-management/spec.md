## ADDED Requirements

### Requirement: Administrador institucional por convite

Aceito o convite de administrador institucional emitido para uma instituição, o sistema SHALL
vincular a nova conta àquela instituição como administradora (`RF-INS-002`), da mesma forma que a
designação direta. O vínculo SHALL ser criado uma única vez, ainda que o aceite seja processado mais
de uma vez.

#### Scenario: Convite aceito vira administrador vinculado

- **WHEN** a pessoa aceita o convite de `INSTITUTION_ADMIN` emitido pelo administrador de sistema
- **THEN** a instituição passa a listá-la entre os seus administradores
- **AND** a revogação do vínculo remove também o papel `INSTITUTION_ADMIN`
