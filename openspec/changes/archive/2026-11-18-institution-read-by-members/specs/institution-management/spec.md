## MODIFIED Requirements

### Requirement: Consulta e listagem de instituições

O sistema SHALL permitir a quem possua `INSTITUTION:READ` consultar uma instituição por identificador
e listar as instituições. A listagem SHALL ser paginada, SHALL informar `page`, `pageSize` e
`hasNext`, e SHALL truncar ao limite máximo declarado a requisição que peça página maior. `totalItems`
e `totalPages` SHALL ser devolvidos apenas quando solicitados explicitamente. A listagem SHALL incluir
instituições ativas e inativas, distinguindo-as pelo estado.

O ator vinculado a uma instituição SHALL consultar apenas a própria instituição (`RF-INS-001` RN4):
a listagem SHALL conter só ela, e a consulta de instituição alheia SHALL responder
`RESOURCE_NOT_FOUND`. O ator sem instituição (`SYSTEM_ADMIN`) SHALL consultar e listar todas.

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

#### Scenario: Aluno consulta a própria instituição

- **WHEN** um aluno consulta a instituição a que está vinculado
- **THEN** recebe seus dados e seu estado

#### Scenario: Usuário vinculado consulta instituição alheia

- **WHEN** um professor consulta uma instituição à qual não está vinculado
- **THEN** a resposta é `RESOURCE_NOT_FOUND` com status HTTP `404`

#### Scenario: Usuário vinculado lista instituições

- **WHEN** um coordenador solicita a listagem
- **THEN** a resposta contém apenas a instituição a que está vinculado
