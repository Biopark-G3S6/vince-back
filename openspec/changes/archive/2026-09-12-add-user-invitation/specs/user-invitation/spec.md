## Purpose

Descreve o convite como a forma de uma pessoa passar a existir no sistema: quem pode convidar com qual
papel, as duas formas de convite — dirigido a um e-mail e aberto a quem tiver o endereço —, seu ciclo
de vida e a conta que a aceitação cria.

## ADDED Requirements

### Requirement: Emissão de convite dirigido

O sistema SHALL permitir a quem possua `INVITATION:CREATE` emitir convite destinado a um e-mail,
declarando o papel a conceder, a instituição de vínculo e o prazo de validade. O convite dirigido
SHALL ser de uso único. O e-mail destinatário NÃO DEVE pertencer a conta já existente; nesse caso a
emissão SHALL falhar com `EMAIL_ALREADY_REGISTERED`. A emissão SHALL devolver o endereço de ingresso.

#### Scenario: Emissão aceita

- **WHEN** um ator com `INVITATION:CREATE` emite convite para e-mail livre, com papel, instituição e
  prazo válidos
- **THEN** o convite passa a existir em estado ativo
- **AND** a resposta contém o endereço de ingresso

#### Scenario: E-mail já pertence a uma conta

- **WHEN** a emissão informa e-mail de conta já existente
- **THEN** a operação falha com `EMAIL_ALREADY_REGISTERED`
- **AND** nenhum convite é criado

#### Scenario: Prazo ausente ou no passado

- **WHEN** a emissão é submetida sem prazo de validade, ou com prazo já vencido
- **THEN** a operação falha com `VALIDATION_FAILED`

#### Scenario: Instituição desativada

- **WHEN** a emissão informa instituição desativada
- **THEN** a operação falha com `INSTITUTION_INACTIVE`

#### Scenario: Ator sem a permissão

- **WHEN** um ator sem `INVITATION:CREATE` submete a emissão
- **THEN** a operação é recusada com status HTTP `403`

### Requirement: Emissão de convite aberto

O sistema SHALL permitir a quem possua `INVITATION:CREATE` emitir convite sem destinatário, de uso
múltiplo, declarando o papel a conceder, a instituição de vínculo, o prazo de validade obrigatório e,
opcionalmente, o limite de usos. Atingido o limite, o convite SHALL deixar de ser aceito.

#### Scenario: Emissão aceita

- **WHEN** um ator com `INVITATION:CREATE` emite convite aberto com papel, instituição e prazo válidos
- **THEN** o convite passa a existir em estado ativo, sem destinatário
- **AND** a resposta contém o endereço de ingresso

#### Scenario: Aceitações múltiplas

- **WHEN** três pessoas distintas aceitam o mesmo convite aberto sem limite de usos
- **THEN** as três contas são criadas
- **AND** o convite permanece ativo

#### Scenario: Limite de usos atingido

- **WHEN** um convite aberto com limite de dois usos recebe uma terceira aceitação
- **THEN** a operação falha com o código de limite de usos atingido
- **AND** nenhuma conta é criada

#### Scenario: Limite ausente

- **WHEN** um convite aberto é emitido sem limite de usos
- **THEN** só o prazo de validade e a revogação o encerram

### Requirement: Não escalonamento pelo convite

Um convite SHALL conceder somente papel que o convidante possa conceder, segundo a cadeia de
designação declarada na URS: `SYSTEM_ADMIN` pode conceder `INSTITUTION_ADMIN`; `INSTITUTION_ADMIN`
pode conceder `COORDINATOR` e `PROFESSOR`; `COORDINATOR` pode conceder `PROFESSOR`; `PROFESSOR` pode
conceder `STUDENT`. Convite que conceda papel fora do que o convidante pode conceder SHALL falhar com
`PERMISSION_DENIED`. Um convidante NÃO DEVE conceder o próprio papel a menos que a cadeia o preveja.

#### Scenario: Papel dentro da cadeia

- **WHEN** um `INSTITUTION_ADMIN` emite convite concedendo `COORDINATOR`
- **THEN** a emissão é aceita

#### Scenario: Papel acima da cadeia

- **WHEN** um `COORDINATOR` emite convite concedendo `INSTITUTION_ADMIN`
- **THEN** a operação falha com `PERMISSION_DENIED`

#### Scenario: Papel de administrador de sistema

- **WHEN** qualquer ator emite convite concedendo `SYSTEM_ADMIN`
- **THEN** a operação falha com `PERMISSION_DENIED`

#### Scenario: Convidante com papéis múltiplos

- **WHEN** um ator que possui `COORDINATOR` e `PROFESSOR` emite convite concedendo `PROFESSOR`
- **THEN** a emissão é aceita

### Requirement: Escopo institucional do convite

O convite SHALL declarar a instituição de vínculo da conta que criar. O convidante NÃO DEVE emitir
convite para instituição diversa daquela em que atua; a tentativa SHALL falhar com
`PERMISSION_DENIED`. O ator de papel `SYSTEM_ADMIN`, que não possui vínculo institucional, PODE emitir
para qualquer instituição ativa.

#### Scenario: Convidante na própria instituição

- **WHEN** um `INSTITUTION_ADMIN` emite convite para a instituição que administra
- **THEN** a emissão é aceita

#### Scenario: Convidante em instituição alheia

- **WHEN** um `INSTITUTION_ADMIN` emite convite para instituição que não administra
- **THEN** a operação falha com `PERMISSION_DENIED`

#### Scenario: Administrador de sistema

- **WHEN** um `SYSTEM_ADMIN` emite convite para uma instituição ativa qualquer
- **THEN** a emissão é aceita

### Requirement: Consulta do convite pelo seu endereço

O sistema SHALL permitir, sem autenticação, consultar um convite pelo seu endereço, devolvendo o papel
concedido, a identificação da instituição e, quando dirigido, o e-mail destinatário. A consulta NÃO
DEVE revelar quem emitiu o convite nem qualquer outro dado de terceiros. Convite expirado, revogado,
esgotado ou desconhecido SHALL produzir resposta que não permita distinguir esses casos entre si.

#### Scenario: Convite ativo

- **WHEN** um convite ativo é consultado pelo seu endereço
- **THEN** a resposta informa o papel concedido e a identificação da instituição

#### Scenario: Convite dirigido

- **WHEN** um convite dirigido ativo é consultado
- **THEN** a resposta informa também o e-mail destinatário

#### Scenario: Convite indisponível

- **WHEN** um convite expirado, revogado, esgotado ou inexistente é consultado
- **THEN** a resposta é a mesma nos quatro casos

#### Scenario: Emissor não é revelado

- **WHEN** qualquer convite é consultado
- **THEN** a resposta não contém identificação do convidante

### Requirement: Aceitação do convite

O sistema SHALL permitir, sem autenticação, aceitar um convite ativo informando nome e senha, criando
a conta com o papel e o vínculo institucional declarados no convite. Em convite dirigido, o e-mail
SHALL ser o do convite e NÃO DEVE ser informado pelo solicitante; em convite aberto, o e-mail SHALL
ser informado e NÃO DEVE pertencer a conta existente. A aceitação NÃO DEVE permitir escolher papel,
instituição ou qualquer outro atributo além de nome, senha e, no convite aberto, e-mail. A aceitação
NÃO DEVE estabelecer sessão.

#### Scenario: Aceitação de convite dirigido

- **WHEN** nome e senha conformes são informados para convite dirigido ativo
- **THEN** a conta é criada com o e-mail, o papel e a instituição do convite
- **AND** o convite passa a esgotado

#### Scenario: Aceitação de convite aberto

- **WHEN** nome, e-mail livre e senha conformes são informados para convite aberto ativo
- **THEN** a conta é criada com o e-mail informado e com o papel e a instituição do convite

#### Scenario: Papel submetido é desconsiderado

- **WHEN** a aceitação inclui papel ou instituição em seu corpo
- **THEN** os valores são desconsiderados e prevalecem os do convite

#### Scenario: E-mail já registrado

- **WHEN** a aceitação de convite aberto informa e-mail de conta existente
- **THEN** a operação falha com `EMAIL_ALREADY_REGISTERED` e nenhuma conta é criada

#### Scenario: Senha fora da política

- **WHEN** a aceitação informa senha que não satisfaz a política
- **THEN** a operação falha com `VALIDATION_FAILED` e nenhuma conta é criada

#### Scenario: Convite expirado

- **WHEN** a aceitação ocorre após o prazo de validade
- **THEN** a operação falha com `INVITATION_EXPIRED`

#### Scenario: Convite revogado

- **WHEN** a aceitação ocorre sobre convite revogado
- **THEN** a operação falha com `INVITATION_REVOKED`

#### Scenario: Sessão não é estabelecida

- **WHEN** uma aceitação conclui com sucesso
- **THEN** nenhuma sessão é estabelecida, e o usuário autentica-se pelo fluxo comum

#### Scenario: Duas aceitações simultâneas do mesmo convite dirigido

- **WHEN** duas aceitações do mesmo convite dirigido são processadas concorrentemente
- **THEN** exatamente uma cria conta, e a outra falha

### Requirement: Consulta e revogação de convites emitidos

O sistema SHALL permitir a quem possua `INVITATION:READ` listar os convites de uma instituição, de
forma paginada, com o papel concedido, a forma, o estado e o prazo. O sistema SHALL permitir a quem
possua `INVITATION:REVOKE` revogar um convite a qualquer momento, com efeito imediato. A revogação
SHALL ser idempotente e NÃO DEVE afetar as contas já criadas por aquele convite.

#### Scenario: Listagem

- **WHEN** um ator com `INVITATION:READ` lista os convites de sua instituição
- **THEN** recebe os convites daquela instituição, paginados, com estado e prazo

#### Scenario: Listagem não alcança outra instituição

- **WHEN** um ator lista convites de instituição em que não atua
- **THEN** a operação falha com `PERMISSION_DENIED`

#### Scenario: Revogação

- **WHEN** um convite ativo é revogado
- **THEN** a aceitação seguinte daquele convite falha com `INVITATION_REVOKED`

#### Scenario: Revogação repetida

- **WHEN** um convite já revogado é revogado novamente
- **THEN** a operação conclui com sucesso

#### Scenario: Contas criadas permanecem

- **WHEN** um convite aberto que já produziu duas contas é revogado
- **THEN** as duas contas permanecem ativas e com seus papéis

### Requirement: Trilha de auditoria do convite

A emissão, a revogação e cada aceitação de convite SHALL ser registrada em trilha de auditoria
imutável, contendo o ator, o convite, o papel concedido, a instituição e o instante. Na aceitação, o
registro SHALL conter também a conta criada. O registro NÃO DEVE conter a senha submetida.

#### Scenario: Emissão registrada

- **WHEN** um convite é emitido
- **THEN** existe registro com convidante, papel, instituição e instante

#### Scenario: Aceitação registrada

- **WHEN** um convite é aceito
- **THEN** existe registro identificando o convite e a conta criada

#### Scenario: Senha ausente da trilha

- **WHEN** os registros de uma aceitação são inspecionados
- **THEN** a senha submetida não aparece em nenhum deles

### Requirement: Endereço do convite não é adivinhável

O endereço do convite SHALL ser gerado por fonte criptograficamente segura, com no mínimo 128 bits de
entropia, e NÃO DEVE codificar informação sobre a instituição, o papel, o destinatário ou o
convidante. O valor entregue NÃO DEVE ser recuperável a partir do que o sistema persiste.

#### Scenario: Endereço opaco

- **WHEN** um endereço de convite emitido é inspecionado
- **THEN** dele não se extrai papel, instituição, destinatário nem convidante

#### Scenario: Valor não recuperável do armazenamento

- **WHEN** o registro persistido do convite é inspecionado
- **THEN** o valor entregue ao convidante não pode ser reconstruído a partir dele
