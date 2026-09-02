# permission-enforcement Specification

## Purpose

Descreve onde e como o sistema decide se uma requisição pode prosseguir: a verificação de permissão
antes do caso de uso, a separação entre permissão e titularidade do registro, e a identidade que o
cliente autenticado recebe para compor a interface.

## Requirements

### Requirement: Verificação de permissão na borda

A verificação de permissão SHALL ocorrer na borda, antes da execução do caso de uso (`ADR-0014` §11).
Rota protegida SHALL declarar a permissão que exige, e a declaração SHALL ser obrigatória: rota sem
declaração de permissão e sem marcação explícita de acesso público NÃO DEVE ser servida. A permissão
exigida SHALL ser confrontada com as permissões efetivas resolvidas no servidor a cada requisição,
nunca com permissões transportadas pelo cliente.

#### Scenario: Usuário com a permissão

- **WHEN** um usuário autenticado com a permissão exigida requisita a rota
- **THEN** o caso de uso é executado

#### Scenario: Usuário sem a permissão

- **WHEN** um usuário autenticado sem a permissão exigida requisita a rota
- **THEN** a resposta é `PERMISSION_DENIED` com status HTTP `403`
- **AND** o caso de uso não é executado

#### Scenario: Requisição não autenticada

- **WHEN** uma rota protegida é requisitada sem sessão
- **THEN** a resposta tem status HTTP `401`

#### Scenario: Rota sem declaração

- **WHEN** uma rota é registrada sem declarar permissão exigida nem acesso público
- **THEN** a aplicação recusa servi-la

#### Scenario: Permissão enviada pelo cliente é ignorada

- **WHEN** uma requisição inclui, em corpo ou cabeçalho, uma lista de permissões
- **THEN** a decisão desconsidera integralmente esse conteúdo

### Requirement: Titularidade verificada dentro do caso de uso

A verificação de permissão NÃO DEVE ser suficiente para autorizar operação sobre registro específico:
a titularidade do registro SHALL ser verificada dentro do caso de uso (`ADR-0014` §12). Regras de
titularidade NÃO DEVEM ser modeladas como permissões (`ADR-0014` §13).

#### Scenario: Permissão presente, registro de terceiro

- **WHEN** um usuário com a permissão exigida opera sobre registro de que não é titular
- **THEN** a operação é recusada pelo caso de uso, e não pela borda

#### Scenario: Catálogo sem permissão de titularidade

- **WHEN** o catálogo de permissões é inspecionado
- **THEN** não contém permissão cujo significado seja "sobre os próprios registros"

### Requirement: Registro da negativa de autorização

Toda negativa de autorização SHALL ser registrada em log estruturado, contendo o identificador de
correlação, o usuário, a permissão exigida e a rota (`ADR-0014` §14). O registro SHALL observar a
lista de permissão de campos declarada em ponto único, e NÃO DEVE conter dado pessoal fora dela.

#### Scenario: Negativa registrada

- **WHEN** uma requisição é recusada por falta de permissão
- **THEN** existe registro de log com correlação, usuário, permissão exigida e rota

#### Scenario: Campo não declarado

- **WHEN** um campo sensível não declarado é acrescentado ao contexto da negativa
- **THEN** ele não aparece no registro emitido

### Requirement: Identidade do usuário autenticado

O sistema SHALL publicar um endpoint que devolva, ao usuário autenticado, sua identificação, seus
papéis e suas permissões efetivas (`ADR-0013` §20). As permissões devolvidas destinam-se
exclusivamente à composição da interface e NÃO DEVEM ser consideradas em decisão de autorização; a
ausência de uma permissão nessa resposta NÃO DEVE ser o único obstáculo à ação correspondente.

#### Scenario: Identidade devolvida

- **WHEN** o usuário autenticado consulta o endpoint de identidade
- **THEN** recebe sua identificação, seus papéis e suas permissões efetivas

#### Scenario: Sem sessão

- **WHEN** o endpoint de identidade é consultado sem sessão
- **THEN** a resposta tem status HTTP `401`

#### Scenario: Permissões refletem revogação

- **WHEN** um papel é revogado e o endpoint de identidade é consultado em seguida
- **THEN** as permissões devolvidas já não contêm as que só aquele papel concedia

#### Scenario: Ação oculta na interface continua protegida

- **WHEN** a API é requisitada diretamente para ação cuja permissão não consta da resposta de
  identidade
- **THEN** a requisição é recusada com status HTTP `403`
