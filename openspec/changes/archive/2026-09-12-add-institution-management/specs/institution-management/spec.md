## Purpose

Descreve a instituição como fronteira de isolamento do sistema: seu cadastro, seu estado ativo ou
inativo, o efeito da desativação sobre o acesso de seus usuários, e quem a administra.

## ADDED Requirements

### Requirement: Cadastro de instituição

O sistema SHALL permitir a quem possua `INSTITUTION:CREATE` cadastrar uma instituição com nome e os
dados de identificação declarados em ponto único (RF-INS-001). A instituição SHALL nascer em estado
ativo. Dado obrigatório ausente ou inválido SHALL falhar com `VALIDATION_FAILED` (RF-INS-001 E1).

#### Scenario: Cadastro aceito

- **WHEN** um ator com `INSTITUTION:CREATE` informa nome e dados de identificação válidos
- **THEN** a instituição passa a existir em estado ativo
- **AND** a resposta tem status HTTP `201`, com o recurso criado e o cabeçalho `Location`

#### Scenario: Nome ausente

- **WHEN** o cadastro é submetido sem nome
- **THEN** a operação falha com `VALIDATION_FAILED`, apontando o campo

#### Scenario: Ator sem a permissão

- **WHEN** um ator sem `INSTITUTION:CREATE` submete o cadastro
- **THEN** a operação é recusada com status HTTP `403`

### Requirement: Consulta e listagem de instituições

O sistema SHALL permitir a quem possua `INSTITUTION:READ` consultar uma instituição por identificador
e listar as instituições. A listagem SHALL ser paginada, SHALL informar `page`, `pageSize` e
`hasNext`, e SHALL truncar ao limite máximo declarado a requisição que peça página maior. `totalItems`
e `totalPages` SHALL ser devolvidos apenas quando solicitados explicitamente. A listagem SHALL incluir
instituições ativas e inativas, distinguindo-as pelo estado.

#### Scenario: Consulta por identificador

- **WHEN** um ator com `INSTITUTION:READ` consulta uma instituição existente
- **THEN** recebe seus dados e seu estado

#### Scenario: Instituição inexistente

- **WHEN** a consulta informa identificador que não corresponde a instituição alguma
- **THEN** a resposta é `RESOURCE_NOT_FOUND` com status HTTP `404`

#### Scenario: Listagem paginada

- **WHEN** a listagem é solicitada
- **THEN** a resposta contém `pagination` com `page`, `pageSize` e `hasNext`
- **AND** não contém `totalItems` nem `totalPages`

#### Scenario: Total solicitado explicitamente

- **WHEN** a listagem é solicitada pedindo o total
- **THEN** a resposta contém também `totalItems` e `totalPages`

#### Scenario: Página acima do limite

- **WHEN** a listagem é solicitada com tamanho de página acima do limite máximo declarado
- **THEN** o tamanho é truncado ao limite e a resposta informa o `pageSize` efetivo

#### Scenario: Contagem de consultas invariante

- **WHEN** a listagem devolve um registro e depois dez registros
- **THEN** a quantidade de consultas ao banco é a mesma nas duas execuções

### Requirement: Alteração de instituição

O sistema SHALL permitir a quem possua `INSTITUTION:UPDATE` alterar o nome e os dados de identificação
de uma instituição. A alteração NÃO DEVE poder mudar o estado da instituição: ativar e desativar são
operações próprias.

#### Scenario: Alteração aceita

- **WHEN** um ator com `INSTITUTION:UPDATE` altera o nome de uma instituição existente
- **THEN** a alteração persiste e é refletida na consulta seguinte

#### Scenario: Alteração de instituição inexistente

- **WHEN** a alteração informa identificador inexistente
- **THEN** a operação falha com `RESOURCE_NOT_FOUND`

#### Scenario: Tentativa de mudar o estado pela alteração

- **WHEN** a alteração submete o campo de estado
- **THEN** o estado permanece inalterado

### Requirement: Desativação e reativação de instituição

O sistema SHALL permitir a quem possua `INSTITUTION:DEACTIVATE` desativar e reativar uma instituição.
A desativação SHALL ser aceita ainda que a instituição possua cursos ativos (RF-INS-001 E2), e SHALL
propagar-se ao acesso de seus usuários. A desativação NÃO DEVE remover a instituição nem seus
registros associados.

#### Scenario: Desativação com cursos ativos

- **WHEN** uma instituição com cursos ativos é desativada
- **THEN** a operação é aceita e a instituição passa ao estado inativo

#### Scenario: Desativação é idempotente

- **WHEN** uma instituição já inativa é desativada
- **THEN** a operação conclui com sucesso e nada muda

#### Scenario: Reativação

- **WHEN** uma instituição inativa é reativada
- **THEN** volta ao estado ativo e seus usuários voltam a autenticar

#### Scenario: Registros preservados

- **WHEN** uma instituição é desativada
- **THEN** seus administradores designados e seus dados permanecem registrados

### Requirement: Usuário de instituição desativada não autentica

Usuário vinculado a instituição desativada NÃO DEVE estabelecer sessão; a tentativa SHALL falhar com
`INSTITUTION_INACTIVE` (RF-INS-001 RN2, RF-ACS-001 E3). A recusa SHALL ser distinta de
`AUTHENTICATION_FAILED` e SHALL ocorrer somente após a credencial ter sido verificada com sucesso, de
modo a não revelar a existência da conta a quem não possua a credencial.

#### Scenario: Credencial correta, instituição desativada

- **WHEN** um usuário de instituição desativada submete credencial correta
- **THEN** a resposta é `INSTITUTION_INACTIVE` e nenhuma sessão é estabelecida

#### Scenario: Credencial incorreta, instituição desativada

- **WHEN** um usuário de instituição desativada submete credencial incorreta
- **THEN** a resposta é `AUTHENTICATION_FAILED`, indistinguível da de qualquer conta inexistente

#### Scenario: Administrador de sistema não é afetado

- **WHEN** um usuário de papel `SYSTEM_ADMIN`, sem vínculo institucional, autentica
- **THEN** a sessão é estabelecida normalmente

#### Scenario: Sessões existentes após a desativação

- **WHEN** uma instituição é desativada enquanto usuários seus possuem sessão ativa
- **THEN** as permissões efetivas desses usuários passam a ser o conjunto vazio
- **AND** a requisição seguinte deles a qualquer rota protegida é recusada com status HTTP `403`

#### Scenario: Permissões restauradas na reativação

- **WHEN** a instituição é reativada
- **THEN** as permissões efetivas de seus usuários voltam a ser as de seus papéis, sem exigir nova
  autenticação

### Requirement: Designação de administrador institucional

O sistema SHALL permitir a quem possua `INSTITUTION:ASSIGN_ADMIN` designar um usuário como
administrador de uma instituição, atribuindo-lhe o papel `INSTITUTION_ADMIN` e registrando o vínculo
com a instituição (RF-INS-002). A operação SHALL ser idempotente (RF-INS-002 E1). Uma instituição
SHALL admitir mais de um administrador ativo (RF-INS-002 RN1). Instituição inativa SHALL falhar com
`INSTITUTION_INACTIVE` (E2); usuário inexistente, com `RESOURCE_NOT_FOUND` (E3).

#### Scenario: Designação aceita

- **WHEN** um ator com `INSTITUTION:ASSIGN_ADMIN` designa um usuário ativo a uma instituição ativa
- **THEN** o vínculo passa a existir
- **AND** o usuário passa a possuir o papel `INSTITUTION_ADMIN`

#### Scenario: Designação repetida

- **WHEN** o mesmo usuário é designado novamente à mesma instituição
- **THEN** a operação conclui com sucesso e continua existindo um único vínculo

#### Scenario: Segundo administrador

- **WHEN** um segundo usuário é designado à mesma instituição
- **THEN** ambos passam a constar como administradores ativos dela

#### Scenario: Instituição inativa

- **WHEN** a designação informa instituição desativada
- **THEN** a operação falha com `INSTITUTION_INACTIVE`

#### Scenario: Usuário inexistente

- **WHEN** a designação informa usuário que não existe
- **THEN** a operação falha com `RESOURCE_NOT_FOUND`

#### Scenario: Retomada após falha parcial

- **WHEN** uma designação falha depois de o papel ter sido atribuído e antes de o vínculo ser gravado
- **THEN** a repetição da mesma designação conclui a operação
- **AND** o estado final é idêntico ao de uma designação bem-sucedida em uma única tentativa

### Requirement: Revogação de administrador institucional

O sistema SHALL permitir a quem possua `INSTITUTION:REVOKE_ADMIN` revogar o vínculo de administrador
de uma instituição. A revogação SHALL remover o papel `INSTITUTION_ADMIN` do usuário quando não
houver outro vínculo que o justifique, e SHALL preservá-lo quando houver (RF-INS-002 RN3). A revogação
SHALL ser idempotente.

#### Scenario: Revogação do único vínculo

- **WHEN** o vínculo de um usuário que administra uma única instituição é revogado
- **THEN** o vínculo deixa de existir
- **AND** o usuário deixa de possuir o papel `INSTITUTION_ADMIN`

#### Scenario: Revogação com outro vínculo remanescente

- **WHEN** o vínculo de um usuário que administra duas instituições é revogado em uma delas
- **THEN** apenas aquele vínculo deixa de existir
- **AND** o usuário conserva o papel `INSTITUTION_ADMIN`

#### Scenario: Revogação de vínculo inexistente

- **WHEN** a revogação informa vínculo que não existe
- **THEN** a operação conclui com sucesso e nada é alterado

#### Scenario: Efeito imediato sobre as permissões

- **WHEN** o papel é removido pela revogação
- **THEN** a requisição seguinte do usuário que dependa daquele papel é recusada

### Requirement: Consulta de existência e estado por outro módulo

O sistema SHALL disponibilizar, a um consumidor interno, a consulta da existência e do estado de uma
instituição por identificador, e a consulta em lote para um conjunto de identificadores. A consulta em
lote SHALL executar em número de consultas ao banco independente da quantidade de identificadores
informados.

#### Scenario: Consulta de instituição ativa

- **WHEN** a consulta informa o identificador de uma instituição ativa
- **THEN** devolve que ela existe e está ativa

#### Scenario: Consulta de instituição inexistente

- **WHEN** a consulta informa identificador que não corresponde a instituição alguma
- **THEN** devolve que ela não existe, sem falhar

#### Scenario: Consulta em lote

- **WHEN** a consulta informa dez identificadores
- **THEN** devolve o estado de cada um em número de consultas independente da quantidade informada
