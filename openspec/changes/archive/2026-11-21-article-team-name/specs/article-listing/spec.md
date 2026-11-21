## ADDED Requirements

### Requirement: Nome da equipe no artigo

O artigo devolvido pela listagem e pela consulta por identificador SHALL trazer `teamIdentification`,
o nome da sua equipe, mantido pela sincronização com a equipe. Antes da primeira sincronização que o
grave, o campo SHALL ser `null`.

#### Scenario: Artigo criado com a equipe

- **WHEN** a equipe é criada no evento
- **THEN** o artigo listado traz `teamIdentification` igual ao nome da equipe
