# article-listing Specification

## Purpose

Permitir que cada ator consulte os artigos alcançados pelos seus vínculos, com a situação no ciclo de
produção e a etapa corrente do cronograma, a partir da equipe ou do evento (`RF-ART-001`).

## Requirements

### Requirement: Listagem de artigos por vínculo

O sistema SHALL expor `GET /api/v1/articles`, exigindo `ARTICLE:READ`, paginado conforme o contrato de
resposta, com filtros opcionais `eventId`, `teamId`, `courseId` e `status`
(`STARTED`, `IN_PROGRESS`, `IN_REVIEW`, `FINISHED`). Cada item SHALL conter o identificador do
artigo, da equipe, do evento e do curso, o orientador responsável, os integrantes ativos, a situação e
a etapa corrente com ordem e prazo; o conteúdo do artigo MUST NOT ser incluído. O resultado MUST conter
apenas artigos da instituição do ator e alcançados pelos seus vínculos: o aluno, o artigo das equipes
que integra; o orientador do evento, os artigos de todas as equipes do evento; o orientador
responsável, os das suas equipes; o coordenador e o administrador institucional, os da instituição.

#### Scenario: Aluno vê apenas o artigo da sua equipe

- **WHEN** um aluno integrante de uma equipe lista os artigos do evento
- **THEN** a resposta contém somente o artigo da sua equipe

#### Scenario: Orientador do evento vê todas as equipes do evento

- **WHEN** um professor designado orientador do evento lista os artigos com `eventId`
- **THEN** a resposta contém o artigo de cada equipe do evento

#### Scenario: Artigo da equipe localizado pelo filtro de equipe

- **WHEN** um ator alcançado lista com `teamId` de uma equipe existente
- **THEN** a resposta contém exatamente um item, com o estado e a etapa corrente do artigo

#### Scenario: Filtro inválido

- **WHEN** `status` não pertence aos estados do artigo ou um identificador não é UUID
- **THEN** a resposta é `400` com `VALIDATION_FAILED`

### Requirement: Alcance do orientador do evento na consulta individual

`GET /api/v1/articles/:articleId` SHALL também aceitar o professor designado orientador do evento do
artigo, mesmo que não seja o orientador responsável da equipe. Artigo fora dos vínculos do ator MUST
continuar resultando em `RESOURCE_NOT_FOUND`.

#### Scenario: Orientador do evento consulta artigo de outra equipe do evento

- **WHEN** um orientador do evento consulta o artigo de uma equipe da qual não é responsável
- **THEN** a resposta é `200` com o artigo

#### Scenario: Professor sem vínculo com o evento

- **WHEN** um professor que não é orientador do evento consulta o artigo
- **THEN** a resposta é `404` com `RESOURCE_NOT_FOUND`

### Requirement: Título do artigo

O artigo SHALL ter um título opcional, de 1 a 300 caracteres após aparar os espaços.

- **Leitura:** a consulta e a listagem SHALL devolver o título, com `null` quando ausente.
- **Na criação da equipe:** o título MAY ser informado em `articleTitle`, e o artigo da equipe nasce
  com ele.
- **Alteração:** `PATCH /api/v1/articles/:articleId`, com `{ "title": ... }`, exige `ARTICLE:EDIT` e
  SHALL ser aceito apenas para integrante ativo, com o artigo editável. As recusas são as mesmas da
  edição de conteúdo.

#### Scenario: Título informado na criação da equipe

- **WHEN** o orientador cria a equipe com `articleTitle` "Mobilidade urbana"
- **THEN** a listagem de artigos com `teamId` devolve o título "Mobilidade urbana"

#### Scenario: Integrante altera o título

- **WHEN** um integrante ativo altera o título
- **THEN** a consulta do artigo devolve o novo título

### Requirement: Parecer na avaliação do artigo

A nota do artigo SHALL aceitar `feedback` opcional, de até 4000 caracteres. A consulta das avaliações
SHALL devolver o parecer de cada registro, com `null` quando ausente. A nota individual de integrante
MUST NOT aceitar `feedback`, sob pena de `VALIDATION_FAILED`.

#### Scenario: Nota com parecer

- **WHEN** o orientador responsável registra nota 9 com parecer
- **THEN** a consulta das avaliações devolve a nota e o parecer
