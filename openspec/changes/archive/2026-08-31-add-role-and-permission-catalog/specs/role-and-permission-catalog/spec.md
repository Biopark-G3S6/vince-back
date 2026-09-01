## Purpose

Estabelece o vocabulário de autorização do sistema: o conjunto fechado de permissões que o sistema
reconhece e os cinco papéis pré-criados que as agrupam. É o dado de que toda decisão de autorização
depende, carregado por carga inicial e imutável em tempo de execução.

## ADDED Requirements

### Requirement: Forma da permissão

Uma permissão SHALL ser identificada por um texto no formato `RECURSO:ACAO`, com recurso no singular,
inteiramente em maiúsculas, sem acento e sem curinga. O sistema SHALL recusar permissão que não
observe essa forma, e a recusa SHALL ocorrer na carga do catálogo, e não na primeira verificação de
acesso.

#### Scenario: Permissão em forma válida é aceita

- **WHEN** a carga do catálogo declara a permissão `COURSE:CREATE`
- **THEN** a permissão passa a constar do catálogo reconhecido pelo sistema

#### Scenario: Permissão com curinga é recusada

- **WHEN** a carga do catálogo declara uma permissão contendo `*` em qualquer posição
- **THEN** a carga falha, identificando a permissão malformada
- **AND** nenhuma permissão do lote é registrada

#### Scenario: Permissão fora do formato é recusada

- **WHEN** a carga do catálogo declara uma permissão sem o separador `:`, com recurso no plural ou
  com caractere minúsculo
- **THEN** a carga falha, identificando a permissão malformada
- **AND** nenhuma permissão do lote é registrada

### Requirement: Correspondência com o catálogo da URS

O conjunto de permissões reconhecidas pelo sistema SHALL corresponder exatamente ao catálogo
declarado na URS §2.3: nenhuma permissão SHALL existir sem requisito funcional de origem, e nenhuma
permissão do catálogo da URS SHALL estar ausente. SHALL existir um comando que confronte o catálogo
do sistema com o da URS e relate as diferenças em ambos os sentidos.

#### Scenario: Catálogo em correspondência

- **WHEN** o comando de conferência confronta as permissões do sistema com o catálogo da URS §2.3
- **THEN** relata correspondência integral e conclui com sucesso

#### Scenario: Permissão sem requisito de origem

- **WHEN** o catálogo do sistema contém permissão ausente da URS §2.3
- **THEN** o comando de conferência falha, identificando a permissão excedente

#### Scenario: Permissão do catálogo ausente

- **WHEN** uma permissão declarada na URS §2.3 não consta do catálogo do sistema
- **THEN** o comando de conferência falha, identificando a permissão ausente

#### Scenario: Conferência sem a documentação disponível

- **WHEN** o comando de conferência é executado sem que a documentação de requisitos esteja
  disponível localmente
- **THEN** o comando falha indicando a indisponibilidade, e não relata correspondência

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

### Requirement: Imutabilidade dos papéis em tempo de execução

O sistema NÃO DEVE expor superfície alguma — rota HTTP, mensagem de fila ou operação de fachada — que
crie, altere, renomeie ou remova papel ou permissão, nem que altere a composição de um papel. A
alteração do catálogo SHALL ocorrer exclusivamente por alteração da carga inicial, acompanhada da
alteração correspondente na URS.

#### Scenario: Ausência de superfície de escrita

- **WHEN** a superfície pública do sistema é inspecionada
- **THEN** não existe operação que crie, altere ou remova papel, permissão ou composição de papel

#### Scenario: Acréscimo de permissão originada por requisito novo

- **WHEN** um requisito funcional novo origina uma permissão
- **THEN** a permissão é acrescentada à URS §2.3 e à carga inicial
- **AND** passa a existir no sistema na execução seguinte da carga

### Requirement: Carga inicial reproduzível e idempotente

A carga inicial SHALL poder ser executada repetidamente sobre a mesma base, produzindo sempre o mesmo
estado final do catálogo e dos papéis. A reexecução NÃO DEVE duplicar permissão, papel ou vínculo, e
NÃO DEVE alterar o identificador de um papel ou de uma permissão já registrados.

#### Scenario: Primeira execução

- **WHEN** a carga inicial é executada sobre base vazia
- **THEN** as permissões e os cinco papéis passam a existir, com a composição declarada

#### Scenario: Reexecução sobre base já carregada

- **WHEN** a carga inicial é executada novamente sobre a mesma base
- **THEN** o estado final é idêntico ao da execução anterior
- **AND** os identificadores dos papéis e das permissões permanecem os mesmos

#### Scenario: Permissão removida da composição de um papel

- **WHEN** uma permissão é retirada da composição declarada de um papel e a carga é reexecutada
- **THEN** o papel deixa de possuir aquela permissão
- **AND** a permissão continua existindo no catálogo

### Requirement: Consulta das permissões de um conjunto de papéis

O sistema SHALL disponibilizar, a um consumidor interno, a consulta das permissões associadas a um
conjunto de papéis, devolvendo a união das permissões dos papéis informados, sem repetição. Papel
desconhecido informado na consulta NÃO DEVE contribuir com permissão alguma e NÃO DEVE fazer a
consulta falhar.

#### Scenario: Consulta de um papel

- **WHEN** a consulta recebe `STUDENT`
- **THEN** devolve exatamente as permissões declaradas para `STUDENT` na URS §2.3.1

#### Scenario: Consulta de papéis múltiplos

- **WHEN** a consulta recebe `PROFESSOR` e `COORDINATOR`
- **THEN** devolve a união das permissões dos dois papéis, cada permissão uma única vez

#### Scenario: Consulta com papel desconhecido

- **WHEN** a consulta recebe `PROFESSOR` e um identificador de papel inexistente
- **THEN** devolve apenas as permissões de `PROFESSOR`, sem erro

#### Scenario: Consulta sem papel

- **WHEN** a consulta recebe conjunto vazio de papéis
- **THEN** devolve conjunto vazio de permissões

#### Scenario: Consulta com número de papéis maior que um

- **WHEN** a consulta recebe vários papéis de uma só vez
- **THEN** a resolução ocorre em número de consultas ao banco independente da quantidade de papéis
  informados
