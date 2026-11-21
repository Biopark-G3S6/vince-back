## ADDED Requirements

### Requirement: Integrantes ativos na consulta de equipe

A equipe devolvida pela listagem do evento e pela consulta por identificador SHALL trazer
`activeMemberCount`, a quantidade de integrantes ativos, para que o aluno conheça as vagas antes de
ingressar (`RF-EQP-002`). A contagem SHALL ser obtida na mesma consulta da equipe.

#### Scenario: Contagem acompanha a composição

- **WHEN** um aluno ingressa na equipe e depois outro integrante é removido
- **THEN** `activeMemberCount` reflete, a cada consulta, os integrantes ativos naquele momento
