## Purpose

Permite acompanhar a evolução do artigo criado para uma equipe, registrar avaliações auditáveis e manter
o histórico de publicações externas vinculadas à produção acadêmica.

## ADDED Requirements

### Requirement: Situação e etapa corrente do artigo

O sistema SHALL permitir ao integrante da equipe, orientador do evento e coordenador do curso consultar
o artigo alcançado pelo seu vínculo, seu estado e a etapa corrente do cronograma. Os estados SHALL ser
`STARTED`, `IN_PROGRESS`, `IN_REVIEW` e `FINISHED`; o aluno SHALL consultar somente o artigo da própria
equipe.

#### Scenario: Integrante consulta artigo

- **WHEN** aluno integrante consulta sua equipe
- **THEN** recebe o artigo, seu estado e a etapa corrente

#### Scenario: Artigo fora do vínculo

- **WHEN** aluno consulta artigo de outra equipe
- **THEN** a operação falha com `RESOURCE_NOT_FOUND`

#### Scenario: Orientador consulta evento

- **WHEN** orientador do evento consulta um artigo de equipe do evento
- **THEN** a consulta é permitida independentemente de responsabilidade direta

### Requirement: Avaliação do artigo

O sistema SHALL permitir somente ao orientador responsável registrar e alterar uma nota única do artigo,
dentro da faixa admitida. Cada alteração SHALL preservar o valor anterior, o autor e o instante.

#### Scenario: Nota registrada

- **WHEN** orientador responsável informa nota válida
- **THEN** a nota do artigo é registrada e associada ao autor da avaliação

#### Scenario: Nota inválida

- **WHEN** a nota está fora da faixa admitida
- **THEN** a operação falha com `VALIDATION_FAILED`

#### Scenario: Alteração auditável

- **WHEN** orientador responsável altera nota já existente
- **THEN** o novo valor é apresentado
- **AND** o registro anterior permanece no histórico com autor e instante

### Requirement: Avaliação individual

O sistema SHALL permitir ao orientador responsável atribuir nota individual a cada integrante da equipe,
com valores independentes entre integrantes. A remoção posterior de integrante NÃO DEVE apagar sua nota
ou o histórico da participação.

#### Scenario: Notas distintas

- **WHEN** orientador responsável atribui notas diferentes a dois integrantes
- **THEN** ambas são registradas individualmente

#### Scenario: Alteração individual auditável

- **WHEN** orientador altera nota individual
- **THEN** o histórico anterior permanece com autor e instante

#### Scenario: Integrante removido

- **WHEN** integrante avaliado é removido da equipe
- **THEN** sua nota e o histórico da participação permanecem consultáveis

### Requirement: Publicação externa

O sistema SHALL permitir ao orientador do evento ou integrante autorizado cadastrar, consultar, alterar e
remover registro manual de publicação externa, contendo veículo, tipo, data e endereço. O sistema NÃO
DEVE manter catálogo externo nem considerar publicação interna como publicação externa.

#### Scenario: Publicação registrada

- **WHEN** ator alcançado pelo artigo informa veículo, tipo, data e endereço válido
- **THEN** o registro é associado ao artigo e fica disponível para consulta

#### Scenario: Endereço inválido

- **WHEN** o endereço informado não possui formato válido
- **THEN** a operação falha com `VALIDATION_FAILED`

#### Scenario: Artigo fora do vínculo

- **WHEN** ator tenta operar publicação de artigo não alcançado pelo seu vínculo
- **THEN** a operação falha com `RESOURCE_NOT_FOUND`

### Requirement: Contrato HTTP de artigo

Os endpoints SHALL exigir `ARTICLE:READ`, `ARTICLE:GRADE`, `ARTICLE:GRADE_MEMBER` ou `PUBLICATION:*`
conforme a operação, SHALL usar envelope e códigos estáveis e SHALL constar da especificação OpenAPI.
Listagens SHALL ser paginadas.

#### Scenario: Orientador não responsável avalia

- **WHEN** orientador do evento, mas não responsável pela equipe, tenta atribuir nota
- **THEN** a resposta tem status HTTP `403` e código `PERMISSION_DENIED`

#### Scenario: Consulta autorizada

- **WHEN** ator alcançado pelo vínculo consulta o artigo
- **THEN** recebe resposta `200` com envelope contendo artigo, estado e etapa
