## ADDED Requirements

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
