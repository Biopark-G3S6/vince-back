## ADDED Requirements

### Requirement: Primeiro acesso do administrador inicial

A carga inicial SHALL emitir, para a conta inicial de `SYSTEM_ADMIN`, um meio de redefinição de senha
de uso único e com prazo, e SHALL apresentá-lo na saída do comando que a executa. A emissão SHALL
ocorrer apenas enquanto a conta não possuir senha definida. A carga NÃO DEVE gravar senha alguma nem
receber senha por configuração.

#### Scenario: Primeira carga

- **WHEN** a carga inicial é executada e a conta inicial não possui senha definida
- **THEN** a saída do comando apresenta um endereço de definição de senha de uso único

#### Scenario: Carga após a senha definida

- **WHEN** a carga inicial é reexecutada depois de a senha inicial ter sido definida
- **THEN** nenhum meio de redefinição novo é emitido
- **AND** a saída do comando não apresenta endereço algum

#### Scenario: Meio inicial é de uso único

- **WHEN** o meio de redefinição apresentado pela carga é usado uma segunda vez
- **THEN** a operação falha com `INVITATION_EXPIRED`

#### Scenario: Senha não vem de configuração

- **WHEN** a configuração do ambiente é inspecionada
- **THEN** não existe variável que carregue a senha inicial do administrador
