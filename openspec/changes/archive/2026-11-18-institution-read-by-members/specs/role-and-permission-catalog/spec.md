## MODIFIED Requirements

### Requirement: Papéis pré-criados com composição fixa

O sistema SHALL reconhecer exatamente cinco papéis — `SYSTEM_ADMIN`, `INSTITUTION_ADMIN`,
`COORDINATOR`, `PROFESSOR` e `STUDENT` —, todos globais, criados pela carga inicial. As permissões de
cada papel SHALL corresponder exatamente à composição declarada na URS §2.3.1, enumeradas uma a uma,
sem curinga e sem abreviação. Nenhum papel SHALL ser escopado a instituição, curso, turma ou evento.

#### Scenario: Papéis carregados

- **WHEN** a carga inicial é executada
- **THEN** existem exatamente os cinco papéis declarados na URS §1.4, cada um com as permissões
  declaradas na URS §2.3.1

#### Scenario: Composição divergente do declarado

- **WHEN** um papel é carregado com permissão a mais ou a menos em relação à composição declarada
- **THEN** a verificação automatizada do repositório reprova, identificando o papel e a diferença

#### Scenario: Papel fora dos cinco declarados

- **WHEN** a carga inicial declara um papel fora dos cinco da URS §1.4
- **THEN** a carga falha e o sistema não entra em operação

#### Scenario: Papel referencia permissão inexistente

- **WHEN** a composição de um papel referencia permissão ausente do catálogo
- **THEN** a carga falha, identificando o papel e a permissão

#### Scenario: Usuário vinculado lê a própria instituição

- **WHEN** a carga inicial é executada
- **THEN** `INSTITUTION_ADMIN`, `COORDINATOR`, `PROFESSOR` e `STUDENT` possuem `INSTITUTION:READ`
