## MODIFIED Requirements

### Requirement: Vínculo institucional da conta

Uma conta SHALL registrar a instituição a que pertence, exceto a conta de papel `SYSTEM_ADMIN`, que
atua sobre todas as instituições e SHALL poder existir sem vínculo (URS §1.4, §1.4.1 item 3). O
vínculo SHALL ser registrado por identificador, sem integridade referencial declarada no banco, por
pertencer a outro módulo. O identificador SHALL ter procedência declarada: SHALL provir de operação
já validada pelo módulo proprietário da instituição — a emissão de um convite ou a carga inicial — e
NÃO DEVE ser aceito como valor arbitrário submetido pelo cliente.

#### Scenario: Conta com vínculo

- **WHEN** uma conta é criada a partir de convite que já carrega a instituição validada
- **THEN** o vínculo é registrado e devolvido nas consultas da conta

#### Scenario: Conta de administrador de sistema sem vínculo

- **WHEN** uma conta de papel `SYSTEM_ADMIN` é criada sem informar instituição
- **THEN** a conta é criada sem vínculo institucional

#### Scenario: Conta de outro papel sem vínculo

- **WHEN** uma conta de papel diverso de `SYSTEM_ADMIN` é criada sem informar instituição
- **THEN** a operação falha com `VALIDATION_FAILED`

#### Scenario: Instituição não é aceita do cliente

- **WHEN** uma requisição de criação de conta traz um identificador de instituição em seu corpo
- **THEN** o valor é desconsiderado, e o vínculo é o que a operação de origem já validara
