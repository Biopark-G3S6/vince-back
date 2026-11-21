## ADDED Requirements

### Requirement: Artigos do integrante com acompanhamento

O sistema SHALL expor `GET /api/v1/my/articles`, autenticada e paginada, que devolve os artigos das
equipes de que o ator é integrante ativo, com a situação, a etapa corrente, a quantidade de
apontamentos pendentes e o instante da última edição. Nenhum artigo de equipe alheia SHALL constar.

#### Scenario: Aluno lista os seus artigos

- **WHEN** um aluno integrante de uma equipe consulta os seus artigos
- **THEN** a resposta contém o artigo da sua equipe, com os indicadores de acompanhamento
- **AND** não contém artigos de outras equipes
