## Purpose

Descreve a senha como credencial da conta: como ela é definida na primeira entrada, como é alterada
depois, que política precisa satisfazer e como o meio de redefinição permite recuperá-la sem revelar
quem tem conta no sistema.

## ADDED Requirements

### Requirement: Política de senha declarada em ponto único

O sistema SHALL declarar a política de senha em um único ponto e aplicá-la em toda definição e
alteração. Senha que não a satisfaça SHALL ser recusada com `VALIDATION_FAILED` (RF-ACS-004 E1). A
senha NÃO DEVE ser registrada em texto puro em lugar algum, nem persistida, nem registrada em log,
nem devolvida em resposta.

#### Scenario: Senha conforme

- **WHEN** uma senha que satisfaz a política é submetida
- **THEN** a operação é aceita

#### Scenario: Senha abaixo do comprimento mínimo

- **WHEN** uma senha menor que o comprimento mínimo declarado é submetida
- **THEN** a operação falha com `VALIDATION_FAILED`, apontando o campo da senha
- **AND** o detalhamento não contém o valor submetido

#### Scenario: Senha acima do comprimento máximo

- **WHEN** uma senha maior que o comprimento máximo declarado é submetida
- **THEN** a operação falha com `VALIDATION_FAILED`

#### Scenario: Ausência de texto puro

- **WHEN** o registro persistido e os registros de log da operação são inspecionados após uma
  definição de senha
- **THEN** a senha submetida não aparece em nenhum deles

### Requirement: Alteração de senha por usuário autenticado

O sistema SHALL permitir ao usuário autenticado alterar a própria senha, exigindo a senha atual
(RF-ACS-004 RN1). Alteração sem a senha atual, ou com senha atual incorreta, SHALL falhar com
`VALIDATION_FAILED` (RF-ACS-004 E2). Concluída a alteração, o sistema SHALL encerrar as demais sessões
do usuário, preservando a sessão que originou a operação (RF-ACS-004 RN2).

#### Scenario: Alteração aceita

- **WHEN** o usuário autenticado informa a senha atual correta e uma senha nova conforme a política
- **THEN** a senha é alterada e passa a ser exigida na autenticação seguinte

#### Scenario: Senha atual ausente

- **WHEN** o usuário autenticado submete a alteração sem informar a senha atual
- **THEN** a operação falha com `VALIDATION_FAILED` e a senha não é alterada

#### Scenario: Senha atual incorreta

- **WHEN** o usuário autenticado informa senha atual incorreta
- **THEN** a operação falha com `VALIDATION_FAILED` e a senha não é alterada

#### Scenario: Demais sessões encerradas

- **WHEN** a senha é alterada por usuário com três sessões ativas
- **THEN** a sessão que originou a operação permanece válida
- **AND** as outras duas deixam de ser aceitas na requisição seguinte

### Requirement: Meio de redefinição de uso único e com prazo

O sistema SHALL emitir, a pedido, um meio de redefinição de senha vinculado a uma conta, de uso único
e com prazo de validade (RF-ACS-003 RN1). O meio SHALL ser gerado por fonte criptograficamente segura
e NÃO DEVE codificar informação sobre a conta. Meio expirado, já utilizado ou desconhecido SHALL
falhar com `INVITATION_EXPIRED` (RF-ACS-003 E2, RF-ACS-004 E3).

#### Scenario: Redefinição com meio válido

- **WHEN** uma senha nova é submetida com meio de redefinição válido
- **THEN** a senha é definida sem exigir a senha atual (RF-ACS-004 RN1)

#### Scenario: Reuso do meio

- **WHEN** o mesmo meio de redefinição é usado uma segunda vez
- **THEN** a operação falha com `INVITATION_EXPIRED`

#### Scenario: Meio expirado

- **WHEN** um meio de redefinição é usado após o prazo de validade
- **THEN** a operação falha com `INVITATION_EXPIRED`

#### Scenario: Meio desconhecido

- **WHEN** um valor que não corresponde a meio algum é submetido
- **THEN** a operação falha com `INVITATION_EXPIRED`, sem distinguir do caso expirado

#### Scenario: Todas as sessões encerradas

- **WHEN** a senha é definida por meio de redefinição
- **THEN** todas as sessões ativas daquela conta deixam de ser aceitas

### Requirement: Solicitação de recuperação não revela a existência da conta

A solicitação de recuperação de acesso SHALL responder de forma idêntica para e-mail cadastrado e não
cadastrado, no conteúdo e no status HTTP (RF-ACS-003 E1, RN2). A diferença de tempo de resposta entre
os dois casos NÃO DEVE permitir distinguir um do outro.

#### Scenario: E-mail cadastrado

- **WHEN** a recuperação é solicitada para e-mail de conta existente
- **THEN** a resposta indica que a solicitação foi recebida
- **AND** um meio de redefinição passa a existir para aquela conta

#### Scenario: E-mail não cadastrado

- **WHEN** a recuperação é solicitada para e-mail sem conta
- **THEN** a resposta é indistinguível da do caso anterior
- **AND** nenhum meio de redefinição é criado

#### Scenario: Conta desativada

- **WHEN** a recuperação é solicitada para conta desativada
- **THEN** a resposta é indistinguível das anteriores

### Requirement: Conta sem senha definida

Uma conta criada por fluxo interno SHALL existir sem senha definida (RF-TUR-003 RN3). A tentativa de
autenticação em conta sem senha definida SHALL conduzir ao fluxo de definição de senha, e NÃO DEVE
revelar-se como distinta de credencial inválida a um solicitante não autenticado.

#### Scenario: Conta sem senha

- **WHEN** a autenticação é tentada em conta ativa sem senha definida
- **THEN** a sessão não é estabelecida
- **AND** a resposta é indistinguível da de credencial inválida

#### Scenario: Definição da primeira senha

- **WHEN** a conta sem senha define a senha por meio de redefinição válido
- **THEN** a conta passa a autenticar com essa senha
