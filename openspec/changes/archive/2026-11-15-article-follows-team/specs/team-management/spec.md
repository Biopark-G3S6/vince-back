## ADDED Requirements

### Requirement: Artigo acompanha a equipe

O artigo de uma equipe SHALL refletir a composição ativa e o orientador responsável corrente da
equipe. Ingresso, designação, remoção de integrante e designação ou revogação do orientador
responsável MUST passar a valer para o acesso ao artigo sem ação adicional. Integrantes ativos SHALL
ler e editar o artigo; o orientador responsável corrente SHALL ser quem avalia o artigo e os
integrantes. A criação do artigo MUST ser idempotente: o reprocessamento do mesmo fato de criação de
equipe não cria um segundo artigo.

#### Scenario: Equipe criada gera artigo uma única vez

- **WHEN** uma equipe é criada e o fato de criação é processado mais de uma vez
- **THEN** existe exatamente um artigo associado à equipe, em estado `STARTED`

#### Scenario: Integrante que ingressa passa a acessar o artigo

- **WHEN** um aluno ingressa na equipe ou é designado a ela
- **THEN** o aluno consegue consultar o artigo da equipe

#### Scenario: Integrante removido perde o acesso de edição

- **WHEN** um integrante é removido da equipe
- **THEN** a edição do artigo por esse usuário é recusada

#### Scenario: Orientador responsável designado passa a avaliar

- **WHEN** um orientador do evento é designado responsável pela equipe
- **THEN** a avaliação do artigo por esse orientador é aceita

#### Scenario: Orientador responsável revogado deixa de avaliar

- **WHEN** a designação do orientador responsável é revogada
- **THEN** a avaliação do artigo por esse orientador é recusada com `PERMISSION_DENIED`
