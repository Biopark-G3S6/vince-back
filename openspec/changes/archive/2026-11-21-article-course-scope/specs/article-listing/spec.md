## ADDED Requirements

### Requirement: Alcance do coordenador restrito ao curso

O coordenador SHALL alcançar, na listagem e na consulta por identificador, os artigos dos cursos que
coordena, além dos que alcança como integrante ou orientador (`RF-ART-001` RN3). Artigo de outro
curso SHALL responder `RESOURCE_NOT_FOUND`. O administrador institucional SHALL continuar alcançando
os artigos de toda a sua instituição.

#### Scenario: Coordenador de outro curso

- **WHEN** o coordenador de um curso consulta o artigo de uma equipe de outro curso
- **THEN** a resposta é `RESOURCE_NOT_FOUND` e a listagem não o contém

#### Scenario: Coordenador do curso

- **WHEN** o coordenador consulta o artigo de uma equipe de evento do seu curso
- **THEN** recebe o artigo
