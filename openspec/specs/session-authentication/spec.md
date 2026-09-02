# session-authentication Specification

## Purpose

Descreve como um usuário estabelece, mantém e encerra sua presença autenticada: a sessão opaca do
servidor, o cookie que a transporta, seus prazos, sua revogação e a proteção contra requisições
forjadas a partir de outro sítio.

## Requirements

### Requirement: Estabelecimento de sessão por e-mail e senha

O sistema SHALL estabelecer sessão autenticada mediante e-mail e senha válidos de conta ativa
(RF-ACS-001). Credencial inválida, conta inexistente e conta desativada SHALL produzir
`AUTHENTICATION_FAILED`, sem distinção entre os casos (RF-ACS-001 E1, E2). O identificador de sessão
SHALL ser regenerado na autenticação bem-sucedida (`ADR-0013` §12).

#### Scenario: Credencial válida

- **WHEN** e-mail e senha corretos de conta ativa são submetidos
- **THEN** a sessão é estabelecida e a resposta devolve a identidade do usuário e suas permissões
  efetivas

#### Scenario: Senha incorreta

- **WHEN** a senha submetida não corresponde à da conta
- **THEN** a resposta é `AUTHENTICATION_FAILED` com status HTTP `401`

#### Scenario: Conta inexistente

- **WHEN** o e-mail submetido não corresponde a conta alguma
- **THEN** a resposta é `AUTHENTICATION_FAILED`, indistinguível da de senha incorreta

#### Scenario: Conta desativada

- **WHEN** a credencial correta de conta desativada é submetida
- **THEN** a resposta é `AUTHENTICATION_FAILED` e nenhuma sessão é estabelecida

#### Scenario: Identificador regenerado

- **WHEN** uma autenticação bem-sucedida ocorre em requisição que já portava identificador de sessão
- **THEN** o identificador anterior deixa de ser aceito e um novo é emitido

### Requirement: Identificador de sessão opaco

O identificador de sessão SHALL ser gerado por fonte criptograficamente segura, com no mínimo 128
bits de entropia, e NÃO DEVE codificar informação alguma sobre o usuário ou sobre a sessão. O estado
da sessão SHALL residir no servidor e conter o identificador do usuário, o instante de criação, o
instante da última atividade e metadados de origem.

#### Scenario: Identificador sem semântica

- **WHEN** um identificador de sessão emitido é inspecionado
- **THEN** dele não se extrai identificador de usuário, papel, permissão nem instante

#### Scenario: Identificadores distintos entre sessões

- **WHEN** a mesma conta estabelece duas sessões
- **THEN** os identificadores são distintos e nenhum é derivável do outro

### Requirement: Transporte da credencial em cookie

A credencial de sessão SHALL ser transportada em cookie com os atributos `HttpOnly`, `Secure`,
`SameSite` e `Path` restrito. A credencial NÃO DEVE trafegar em URL, em corpo de requisição, em
cabeçalho customizado nem em armazenamento acessível a script.

#### Scenario: Atributos do cookie

- **WHEN** uma autenticação bem-sucedida devolve o cookie de sessão
- **THEN** o cookie tem `HttpOnly`, `Secure`, `SameSite` e `Path` restrito

#### Scenario: Credencial ausente do corpo e da URL

- **WHEN** a resposta da autenticação é inspecionada
- **THEN** o identificador de sessão não aparece no corpo nem em cabeçalho diverso do de cookie

### Requirement: Expiração por inatividade e por prazo absoluto

A sessão SHALL expirar por inatividade em 8 horas e por prazo absoluto em 7 dias. A janela de
inatividade SHALL ser renovada a cada requisição autenticada; o prazo absoluto NÃO DEVE ser renovado
(`ADR-0013` §6, §7).

#### Scenario: Renovação por atividade

- **WHEN** uma requisição autenticada ocorre dentro da janela de inatividade
- **THEN** a janela é renovada a partir daquele instante

#### Scenario: Expiração por inatividade

- **WHEN** uma requisição é feita após a janela de inatividade sem atividade intermediária
- **THEN** a credencial é recusada com status HTTP `401`

#### Scenario: Expiração por prazo absoluto

- **WHEN** uma sessão continuamente ativa atinge o prazo absoluto
- **THEN** a credencial é recusada, ainda que a última atividade seja recente

### Requirement: Encerramento e revogação de sessão

O encerramento de sessão SHALL remover imediatamente o registro correspondente e descartar a
credencial no cliente (RF-ACS-002). O encerramento SHALL afetar apenas a sessão corrente
(RF-ACS-002 RN1) e SHALL ser idempotente (RF-ACS-002 E1). SHALL ser possível revogar, em uma
operação, todas as sessões ativas de um usuário (`ADR-0013` §11).

#### Scenario: Encerramento

- **WHEN** o usuário autenticado solicita o encerramento
- **THEN** a requisição seguinte com a credencial anterior é recusada com status HTTP `401`

#### Scenario: Encerramento de sessão já expirada

- **WHEN** o encerramento é solicitado com credencial já expirada
- **THEN** a operação conclui com sucesso

#### Scenario: Outras sessões preservadas

- **WHEN** uma das duas sessões de um usuário é encerrada
- **THEN** a outra permanece válida

#### Scenario: Revogação de todas as sessões

- **WHEN** todas as sessões de um usuário são revogadas em uma operação
- **THEN** nenhuma das credenciais anteriores é aceita na requisição seguinte

### Requirement: Resolução da sessão sem consulta ao banco relacional

A resolução da sessão em requisição autenticada NÃO DEVE exigir consulta ao banco relacional. A
indisponibilidade do repositório de sessões SHALL resultar em negativa de autenticação; NÃO DEVE
existir modo degradado que aceite requisição sem verificação (`ADR-0013` §15, §16).

#### Scenario: Requisição autenticada comum

- **WHEN** uma requisição autenticada é processada
- **THEN** a resolução da sessão não produz consulta ao banco relacional

#### Scenario: Repositório de sessões indisponível

- **WHEN** o repositório de sessões está indisponível e uma requisição autenticada chega
- **THEN** a requisição é recusada
- **AND** nenhuma requisição é aceita sem verificação da sessão

### Requirement: Proteção contra falsificação de requisição entre sítios

Toda requisição que altere estado SHALL ser protegida contra falsificação de requisição entre sítios,
combinando o atributo `SameSite` do cookie e, quando a origem do cliente for de sítio distinto, token
anti-CSRF por sessão (`ADR-0013` §13, §14).

#### Scenario: Requisição de alteração com token válido

- **WHEN** uma requisição que altera estado chega com o token anti-CSRF da sessão
- **THEN** é processada normalmente

#### Scenario: Requisição de alteração sem token

- **WHEN** uma requisição que altera estado chega sem o token anti-CSRF exigido
- **THEN** é recusada e nenhum estado é alterado

#### Scenario: Requisição de alteração com token de outra sessão

- **WHEN** uma requisição que altera estado chega com token pertencente a outra sessão
- **THEN** é recusada

#### Scenario: Requisição de leitura

- **WHEN** uma requisição que não altera estado chega sem token anti-CSRF
- **THEN** é processada normalmente
