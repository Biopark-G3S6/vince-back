## Purpose

Fixa a forma de toda resposta que a API devolve: o envelope, o código de status estável que o cliente
usa para decidir, o detalhamento de erro por campo e o identificador de correlação. É o contrato de
que qualquer consumidor da API depende, independentemente do endpoint.

## ADDED Requirements

### Requirement: Envelope único de resposta

Toda resposta JSON de negócio SHALL usar um envelope contendo `data` e `status`, com chaves em
`camelCase`. `pagination` e `errors` SHALL estar ausentes quando não aplicáveis, e NÃO DEVEM ser
enviados como nulos. O envelope NÃO DEVE ser aplicado a respostas sem corpo, a transferência de
arquivo, nem aos endpoints de verificação de saúde e de métricas.

#### Scenario: Consulta por identificador

- **WHEN** um endpoint devolve um recurso solicitado por identificador
- **THEN** o corpo contém `data` com o objeto e `status`
- **AND** não contém `pagination` nem `errors`

#### Scenario: Resposta sem corpo

- **WHEN** um endpoint conclui sem conteúdo a devolver
- **THEN** a resposta tem status HTTP `204` e corpo vazio, sem envelope

#### Scenario: Endpoint de saúde

- **WHEN** o endpoint de verificação de saúde é consultado
- **THEN** a resposta não usa o envelope

### Requirement: Código de status estável e independente de idioma

`status.code` SHALL ser um identificador estável, em maiúsculas, sem acento e independente de idioma,
pertencente ao catálogo da URS §2.4. `status.severity` SHALL ser um de `success`, `warning` ou
`error`. A API NÃO DEVE retornar texto destinado à exibição; `status.message` é texto de reserva e
PODE ser omitido quando não houver mensagem a exibir. A semântica de um código publicado NÃO DEVE ser
alterada.

#### Scenario: Sucesso

- **WHEN** uma operação conclui com sucesso
- **THEN** `status.severity` é `success` e `status.code` pertence ao catálogo

#### Scenario: Falha esperada

- **WHEN** uma regra de negócio é violada
- **THEN** `status.severity` é `error` e `status.code` é o código do catálogo correspondente à
  violação

#### Scenario: Ausência de texto exibível

- **WHEN** qualquer resposta da API é inspecionada
- **THEN** nenhum campo carrega texto redigido para exibição ao usuário final além de
  `status.message`

### Requirement: Detalhamento de erro por campo

Falha originada na validação de campos SHALL incluir `errors`, com um item por campo inválido. Cada
item SHALL conter `field` e `code`, e PODE conter `meta` com dados que qualifiquem a violação.
`errors` NÃO DEVE conter o valor submetido pelo usuário. Falha inesperada NÃO DEVE incluir `errors`
nem qualquer detalhe interno.

#### Scenario: Dois campos inválidos

- **WHEN** uma requisição é submetida com dois campos inválidos
- **THEN** `errors` contém dois itens, cada um com `field` e `code`
- **AND** `data` é nulo

#### Scenario: Valor submetido não é ecoado

- **WHEN** a validação recusa um campo que continha dado pessoal
- **THEN** o valor submetido não aparece em parte alguma da resposta

#### Scenario: Falha inesperada

- **WHEN** uma exceção não prevista ocorre no processamento
- **THEN** a resposta tem status HTTP `500`, `data` nulo e nenhum `errors`
- **AND** não contém mensagem de exceção, rastro de pilha nem identificação de componente interno

### Requirement: Semântica dos códigos HTTP

As respostas SHALL observar: `200` em leitura e em mutação que devolva o recurso; `201` com o recurso
criado em `data` e o cabeçalho `Location`; `204` sem corpo; `400` para requisição malformada; `401`
para não autenticado; `403` para não autorizado; `404` para recurso inexistente; `409` para conflito
de estado; `422` para violação de regra de negócio; `500` para falha inesperada. O corpo NÃO DEVE
contradizer o status HTTP, e falha NÃO DEVE ser devolvida sob status HTTP de sucesso. O código HTTP
NÃO DEVE ser replicado no corpo.

#### Scenario: Recurso inexistente

- **WHEN** um recurso é solicitado por identificador que não existe
- **THEN** a resposta tem status HTTP `404` e `status.code` igual a `RESOURCE_NOT_FOUND`

#### Scenario: Violação de regra de negócio

- **WHEN** uma operação é recusada por regra de negócio
- **THEN** a resposta tem status HTTP `422`

#### Scenario: Falha nunca sob status de sucesso

- **WHEN** qualquer resposta de falha é inspecionada
- **THEN** seu status HTTP está fora da faixa `2xx`
- **AND** o corpo não contém campo que repita o código HTTP

### Requirement: Identificador de correlação

Toda requisição SHALL receber um identificador de correlação na borda, e ele SHALL ser devolvido no
cabeçalho `X-Correlation-Id` em toda resposta, inclusive nas sem corpo e nas de falha. Identificador
recebido do cliente PODE ser reaproveitado, e SHALL ser descartado quando não obedecer ao formato
declarado. O identificador SHALL ser propagado aos casos de uso e aos registros de log da requisição.

#### Scenario: Requisição sem identificador

- **WHEN** uma requisição chega sem o cabeçalho de correlação
- **THEN** o sistema gera um identificador e o devolve em `X-Correlation-Id`

#### Scenario: Requisição com identificador válido

- **WHEN** uma requisição chega com identificador no formato declarado
- **THEN** o mesmo identificador é devolvido na resposta e consta dos registros de log da requisição

#### Scenario: Requisição com identificador malformado

- **WHEN** uma requisição chega com identificador fora do formato declarado
- **THEN** o valor recebido é descartado e um identificador novo é gerado

#### Scenario: Resposta de falha

- **WHEN** uma requisição termina em falha inesperada
- **THEN** a resposta contém `X-Correlation-Id`

### Requirement: Origens aceitas e credenciais

O sistema SHALL restringir as origens aceitas a uma lista explícita e NÃO DEVE aceitar origem
curinga. Requisição de origem não listada SHALL ser recusada.

#### Scenario: Origem listada

- **WHEN** uma requisição com credenciais chega de origem constante da lista
- **THEN** é aceita e a resposta autoriza o compartilhamento com credenciais

#### Scenario: Origem não listada

- **WHEN** uma requisição chega de origem fora da lista
- **THEN** a resposta não autoriza o compartilhamento com aquela origem

### Requirement: Especificação publicada a partir do código

O sistema SHALL publicar a especificação OpenAPI dos endpoints, gerada a partir do próprio código, de
modo que o cliente derive dela seus tipos. Endpoint publicado sem descrição na especificação SHALL
ser tratado como contrato incompleto.

#### Scenario: Especificação disponível

- **WHEN** a especificação é solicitada
- **THEN** descreve todos os endpoints publicados, com o envelope de resposta e os códigos de status
  possíveis

#### Scenario: Endpoint novo

- **WHEN** um endpoint é acrescentado ao sistema
- **THEN** passa a constar da especificação sem edição manual de documento
