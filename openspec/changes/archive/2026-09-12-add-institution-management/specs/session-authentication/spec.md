## MODIFIED Requirements

### Requirement: Estabelecimento de sessão por e-mail e senha

O sistema SHALL estabelecer sessão autenticada mediante e-mail e senha válidos de conta ativa cuja
instituição esteja ativa (RF-ACS-001). Credencial inválida, conta inexistente e conta desativada SHALL
produzir `AUTHENTICATION_FAILED`, sem distinção entre os casos (RF-ACS-001 E1, E2). Credencial válida
de conta cuja instituição esteja desativada SHALL produzir `INSTITUTION_INACTIVE` (RF-ACS-001 E3,
RF-INS-001 RN2); a distinção SHALL ocorrer somente depois de a credencial ter sido verificada com
sucesso. O identificador de sessão SHALL ser regenerado na autenticação bem-sucedida (`ADR-0013` §12).

#### Scenario: Credencial válida

- **WHEN** e-mail e senha corretos de conta ativa, de instituição ativa, são submetidos
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

#### Scenario: Instituição desativada

- **WHEN** a credencial correta de conta ativa, cuja instituição está desativada, é submetida
- **THEN** a resposta é `INSTITUTION_INACTIVE` e nenhuma sessão é estabelecida

#### Scenario: Instituição desativada com credencial incorreta

- **WHEN** a credencial incorreta de conta de instituição desativada é submetida
- **THEN** a resposta é `AUTHENTICATION_FAILED`, e não `INSTITUTION_INACTIVE`

#### Scenario: Conta sem vínculo institucional

- **WHEN** a credencial correta de conta sem vínculo institucional é submetida
- **THEN** a sessão é estabelecida, sem verificação de instituição

#### Scenario: Identificador regenerado

- **WHEN** uma autenticação bem-sucedida ocorre em requisição que já portava identificador de sessão
- **THEN** o identificador anterior deixa de ser aceito e um novo é emitido
