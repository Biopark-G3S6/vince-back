## Purpose

Descreve como um papel se liga a uma conta e como o sistema apura, a partir desses vínculos, o
conjunto de permissões que um usuário efetivamente possui — a apuração que toda decisão de
autorização consulta.

## ADDED Requirements

### Requirement: Atribuição de papel a um usuário

O sistema SHALL disponibilizar, a um consumidor interno, a atribuição de um dos cinco papéis
declarados a uma conta. A atribuição SHALL ser idempotente: atribuir papel que a conta já possui
SHALL concluir com sucesso sem criar segundo vínculo (RF-INS-002 E1, RF-TUR-002 E1). Uma conta PODE
possuir mais de um papel.

#### Scenario: Atribuição nova

- **WHEN** um papel é atribuído a uma conta que ainda não o possui
- **THEN** a conta passa a possuir o papel

#### Scenario: Atribuição repetida

- **WHEN** o mesmo papel é atribuído novamente à mesma conta
- **THEN** a operação conclui com sucesso
- **AND** continua existindo um único vínculo entre a conta e o papel

#### Scenario: Papel desconhecido

- **WHEN** a atribuição informa papel fora dos cinco declarados
- **THEN** a operação falha com `RESOURCE_NOT_FOUND`

#### Scenario: Conta inexistente

- **WHEN** a atribuição informa conta que não existe
- **THEN** a operação falha com `RESOURCE_NOT_FOUND`

#### Scenario: Conta inativa

- **WHEN** a atribuição informa conta desativada
- **THEN** a operação falha com `RESOURCE_NOT_FOUND`

### Requirement: Revogação de papel de um usuário

O sistema SHALL disponibilizar, a um consumidor interno, a revogação de um papel de uma conta. A
revogação SHALL ser idempotente: revogar papel que a conta não possui SHALL concluir com sucesso. A
revogação SHALL surtir efeito imediato sobre as permissões efetivas da conta.

#### Scenario: Revogação de papel possuído

- **WHEN** um papel possuído por uma conta é revogado
- **THEN** a conta deixa de possuir o papel

#### Scenario: Revogação de papel não possuído

- **WHEN** um papel não possuído é revogado
- **THEN** a operação conclui com sucesso e nada é alterado

#### Scenario: Efeito imediato

- **WHEN** um papel é revogado
- **THEN** a apuração seguinte das permissões efetivas da conta já não contém as permissões que só
  aquele papel concedia

### Requirement: Trilha de auditoria de atribuição e revogação

Toda atribuição e toda revogação de papel SHALL ser registrada em trilha de auditoria imutável,
contendo o ator que executou a operação, a conta afetada, o papel e o instante (`ADR-0014` §18). O
registro NÃO DEVE ser alterado nem removido após gravado, e SHALL ser gravado na mesma transação da
operação que o originou.

#### Scenario: Atribuição registrada

- **WHEN** um papel é atribuído
- **THEN** existe registro de auditoria com ator, conta afetada, papel, operação e instante

#### Scenario: Revogação registrada

- **WHEN** um papel é revogado
- **THEN** existe registro de auditoria correspondente

#### Scenario: Falha não deixa rastro parcial

- **WHEN** a atribuição falha após a gravação ter começado
- **THEN** não existe nem vínculo nem registro de auditoria da operação

#### Scenario: Trilha preservada após revogação

- **WHEN** um papel atribuído é posteriormente revogado
- **THEN** o registro da atribuição original permanece na trilha

### Requirement: Resolução das permissões efetivas

O sistema SHALL apurar as permissões efetivas de uma conta como a união das permissões dos papéis que
ela possui, sem repetição (RF-ACS-001 RN2). As permissões efetivas NÃO DEVEM ser transportadas na
credencial de sessão nem derivadas dela; SHALL ser resolvidas no servidor a cada requisição
(`ADR-0014` §9). Conta inativa SHALL ter conjunto vazio de permissões efetivas.

#### Scenario: Conta com um papel

- **WHEN** as permissões efetivas de uma conta de papel `STUDENT` são apuradas
- **THEN** o resultado é exatamente o conjunto de permissões declarado para `STUDENT`

#### Scenario: Conta com papéis múltiplos

- **WHEN** as permissões efetivas de uma conta com dois papéis são apuradas
- **THEN** o resultado é a união das permissões dos dois papéis, cada permissão uma única vez

#### Scenario: Conta sem papel

- **WHEN** as permissões efetivas de uma conta sem papel algum são apuradas
- **THEN** o resultado é o conjunto vazio

#### Scenario: Conta inativa

- **WHEN** as permissões efetivas de uma conta desativada são apuradas
- **THEN** o resultado é o conjunto vazio, independentemente dos papéis que ela possua

#### Scenario: Conta inexistente

- **WHEN** as permissões efetivas são apuradas para conta que não existe
- **THEN** o resultado é o conjunto vazio, e a apuração não falha

### Requirement: Cache das permissões efetivas

A resolução das permissões efetivas SHALL usar cache, e o cache SHALL ser invalidado imediatamente a
cada alteração de papel da conta (`ADR-0014` §10). O sistema NÃO DEVE servir permissão revogada a
partir do cache em requisição posterior à revogação. A indisponibilidade do cache SHALL resultar em
falha da apuração; NÃO DEVE existir modo degradado que conceda permissão sem cache íntegro.

#### Scenario: Apuração repetida

- **WHEN** as permissões efetivas da mesma conta são apuradas duas vezes seguidas, sem alteração de
  papel entre elas
- **THEN** o resultado é idêntico
- **AND** a segunda apuração não consulta o banco de dados

#### Scenario: Invalidação por revogação

- **WHEN** um papel é revogado de uma conta cujas permissões estavam em cache
- **THEN** a apuração seguinte reflete a revogação

#### Scenario: Invalidação por atribuição

- **WHEN** um papel é atribuído a uma conta cujas permissões estavam em cache
- **THEN** a apuração seguinte reflete a atribuição

#### Scenario: Invalidação por desativação

- **WHEN** uma conta cujas permissões estavam em cache é desativada
- **THEN** a apuração seguinte devolve conjunto vazio

#### Scenario: Cache indisponível

- **WHEN** o cache está indisponível e as permissões efetivas são apuradas
- **THEN** a apuração falha
- **AND** nenhuma permissão é concedida a partir de estado residual
