## Purpose

Quem consulta e quem mantém o registro de publicação externa do artigo (`RF-ART-004`).

## ADDED Requirements

### Requirement: Consulta e manutenção das publicações externas

O sistema SHALL permitir a consulta das publicações a quem lê o artigo. O registro, a alteração e a
remoção SHALL ser permitidos ao integrante ativo, ao orientador responsável pela equipe e a qualquer
orientador do evento, observadas as permissões de cada papel. Os demais SHALL receber
`RESOURCE_NOT_FOUND`.

#### Scenario: Orientador do evento registra publicação

- **WHEN** um orientador do evento, que não é o responsável pela equipe, registra uma publicação
- **THEN** a publicação é registrada no artigo

#### Scenario: Coordenador consulta as publicações

- **WHEN** o coordenador do curso consulta as publicações de um artigo do curso
- **THEN** recebe a lista
