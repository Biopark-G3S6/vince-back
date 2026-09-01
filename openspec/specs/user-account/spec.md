# user-account Specification

## Purpose

Descreve quem o sistema reconhece como pessoa: a conta identificada por e-mail, seu estado, seu
vínculo institucional e o perfil que o próprio titular mantém. É a identidade sobre a qual a
autorização e a autenticação operam.

## Requirements

### Requirement: E-mail como identificador único global

O e-mail SHALL identificar unicamente uma conta em todo o sistema, sem consideração de instituição
(RF-ACS-001 RN1, RF-TUR-003 RN2). O sistema SHALL normalizar o e-mail antes de compará-lo, removendo
espaços nas extremidades e desconsiderando a diferença entre maiúsculas e minúsculas. A tentativa de
criar conta com e-mail já registrado SHALL falhar com `EMAIL_ALREADY_REGISTERED`.

#### Scenario: E-mail livre

- **WHEN** uma conta é criada com e-mail ainda não registrado
- **THEN** a conta passa a existir com aquele e-mail

#### Scenario: E-mail já registrado

- **WHEN** uma conta é criada com e-mail já pertencente a outra conta
- **THEN** a operação falha com `EMAIL_ALREADY_REGISTERED`
- **AND** nenhuma conta é criada

#### Scenario: E-mail já registrado com outra caixa

- **WHEN** uma conta é criada com e-mail que difere de um já registrado apenas por maiúsculas,
  minúsculas ou espaços nas extremidades
- **THEN** a operação falha com `EMAIL_ALREADY_REGISTERED`

#### Scenario: E-mail malformado

- **WHEN** uma conta é criada com texto que não é um endereço de correio eletrônico
- **THEN** a operação falha com `VALIDATION_FAILED`, apontando o campo do e-mail

### Requirement: Criação de conta pelos fluxos internos

O sistema SHALL disponibilizar, a um consumidor interno, a criação de conta com nome, e-mail, papel
inicial e vínculo institucional. A conta SHALL nascer ativa e sem credencial de acesso definida
(RF-TUR-003 RN3). O sistema NÃO DEVE expor criação de conta como operação administrativa: enquanto
nenhum requisito funcional a originar, não existe permissão que a autorize.

#### Scenario: Conta criada por fluxo interno

- **WHEN** um fluxo interno cria conta com nome, e-mail, papel e vínculo institucional
- **THEN** a conta existe em estado ativo, com o papel atribuído e sem credencial definida

#### Scenario: Dado obrigatório ausente

- **WHEN** a criação é solicitada sem nome ou sem e-mail
- **THEN** a operação falha com `VALIDATION_FAILED`, com um item por campo inválido

#### Scenario: Ausência de superfície administrativa

- **WHEN** a superfície pública do sistema é inspecionada
- **THEN** não existe rota que crie, liste ou remova conta de terceiro
- **AND** o catálogo de permissões não contém permissão sobre o recurso de usuário

### Requirement: Estado da conta

Uma conta SHALL estar em exatamente um de dois estados: ativa ou inativa. O sistema SHALL
disponibilizar, a um consumidor interno, a desativação e a reativação de uma conta. A desativação NÃO
DEVE remover a conta nem seus vínculos de papel, e NÃO DEVE liberar o e-mail para nova conta.

#### Scenario: Conta nasce ativa

- **WHEN** uma conta é criada
- **THEN** seu estado é ativo

#### Scenario: Desativação

- **WHEN** uma conta ativa é desativada
- **THEN** seu estado passa a inativo
- **AND** seus vínculos de papel permanecem registrados

#### Scenario: E-mail permanece ocupado após desativação

- **WHEN** uma conta é criada com o e-mail de uma conta desativada
- **THEN** a operação falha com `EMAIL_ALREADY_REGISTERED`

#### Scenario: Conta inexistente

- **WHEN** a desativação é solicitada para identificador que não corresponde a conta alguma
- **THEN** a operação falha com `RESOURCE_NOT_FOUND`

### Requirement: Vínculo institucional da conta

Uma conta SHALL registrar a instituição a que pertence, exceto a conta de papel `SYSTEM_ADMIN`, que
atua sobre todas as instituições e SHALL poder existir sem vínculo (URS §1.4, §1.4.1 item 3). O
vínculo SHALL ser registrado por identificador, sem integridade referencial declarada no banco, por
pertencer a outro módulo.

#### Scenario: Conta com vínculo

- **WHEN** uma conta é criada informando a instituição
- **THEN** o vínculo é registrado e devolvido nas consultas da conta

#### Scenario: Conta de administrador de sistema sem vínculo

- **WHEN** uma conta de papel `SYSTEM_ADMIN` é criada sem informar instituição
- **THEN** a conta é criada sem vínculo institucional

#### Scenario: Conta de outro papel sem vínculo

- **WHEN** uma conta de papel diverso de `SYSTEM_ADMIN` é criada sem informar instituição
- **THEN** a operação falha com `VALIDATION_FAILED`

### Requirement: Consulta do perfil próprio

O sistema SHALL disponibilizar ao titular a consulta do próprio perfil, devolvendo nome, e-mail, área
de atuação ou pesquisa, preferência de idioma, estado da conta, papéis e vínculo institucional
(RF-ACS-005).

#### Scenario: Titular consulta o próprio perfil

- **WHEN** o titular consulta o próprio perfil
- **THEN** recebe nome, e-mail, área de atuação ou pesquisa, preferência de idioma, estado, papéis e
  vínculo institucional

#### Scenario: Perfil sem área e sem preferência de idioma

- **WHEN** o titular nunca informou área de atuação nem preferência de idioma
- **THEN** os dois campos são devolvidos ausentes, e não como texto vazio

### Requirement: Atualização do perfil próprio

O sistema SHALL permitir ao titular alterar o próprio nome, a própria área de atuação ou pesquisa e a
própria preferência de idioma (RF-ACS-005, RF-INT-001). O sistema NÃO DEVE permitir ao titular alterar
o próprio e-mail, os próprios papéis ou os próprios vínculos; a tentativa SHALL falhar com
`PERMISSION_DENIED` (RF-ACS-005 E2, RN1).

#### Scenario: Alteração aceita

- **WHEN** o titular altera nome e área de atuação com valores válidos
- **THEN** a alteração persiste e é refletida na consulta seguinte do perfil

#### Scenario: Tentativa de alterar o próprio e-mail

- **WHEN** o titular submete alteração que inclua o e-mail
- **THEN** a operação falha com `PERMISSION_DENIED`
- **AND** nenhum campo do perfil é alterado

#### Scenario: Tentativa de alterar os próprios papéis ou vínculos

- **WHEN** o titular submete alteração que inclua papel ou vínculo institucional
- **THEN** a operação falha com `PERMISSION_DENIED`

#### Scenario: Dado inválido

- **WHEN** o titular submete nome vazio ou fora do tamanho admitido
- **THEN** a operação falha com `VALIDATION_FAILED`, com um item por campo inválido
- **AND** o detalhamento por campo não contém o valor submetido

#### Scenario: Alteração sobre conta de terceiro

- **WHEN** a alteração de perfil é solicitada para conta diversa da do ator
- **THEN** a operação falha com `PERMISSION_DENIED`

### Requirement: Preferência de idioma

A preferência de idioma SHALL ser persistida no perfil do usuário e SHALL admitir apenas idioma
suportado pelo sistema; idioma não suportado SHALL falhar com `LANGUAGE_NOT_SUPPORTED`
(RF-INT-001 E1, `PAD-NOM-012`). A ausência de preferência SHALL ser um estado válido, e NÃO DEVE ser
substituída por valor padrão gravado no perfil.

#### Scenario: Preferência suportada

- **WHEN** o titular seleciona `pt-BR`
- **THEN** a preferência é persistida e devolvida na consulta seguinte do perfil

#### Scenario: Idioma não suportado

- **WHEN** o titular seleciona idioma fora dos suportados
- **THEN** a operação falha com `LANGUAGE_NOT_SUPPORTED`
- **AND** a preferência anterior permanece inalterada

#### Scenario: Remoção da preferência

- **WHEN** o titular remove a própria preferência de idioma
- **THEN** o perfil volta a não ter preferência registrada

### Requirement: Conta inicial de administrador de sistema

A carga inicial SHALL criar uma conta de papel `SYSTEM_ADMIN`, sem vínculo institucional e sem
credencial definida (URS §1.4.1, item 1). A carga SHALL ser idempotente quanto a essa conta: a
reexecução NÃO DEVE criar segunda conta nem alterar a existente. O sistema NÃO DEVE oferecer
autocadastro para `SYSTEM_ADMIN` nem para qualquer papel administrativo.

#### Scenario: Primeira carga

- **WHEN** a carga inicial é executada sobre base sem usuário algum
- **THEN** passa a existir uma conta ativa com o papel `SYSTEM_ADMIN` e sem credencial

#### Scenario: Reexecução da carga

- **WHEN** a carga inicial é executada novamente
- **THEN** continua existindo exatamente uma conta inicial de `SYSTEM_ADMIN`, com o mesmo
  identificador

#### Scenario: Ausência de autocadastro

- **WHEN** a superfície pública do sistema é inspecionada
- **THEN** não existe operação de autocadastro que atribua papel administrativo
