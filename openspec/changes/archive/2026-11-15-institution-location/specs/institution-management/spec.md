## ADDED Requirements

### Requirement: Cidade e UF da instituição

A criação e a alteração de instituição SHALL aceitar `city` e `state`, ambos opcionais. A consulta e
a listagem SHALL devolvê-los, com `null` quando ausentes.

- `city` MUST ter entre 1 e 120 caracteres após aparar os espaços.
- `state` MUST ter exatamente duas letras maiúsculas.
- Valor fora dessas regras resulta em `VALIDATION_FAILED`, com o campo indicado.

#### Scenario: Instituição com cidade e UF

- **WHEN** o administrador de sistema cria uma instituição com `city` "Toledo" e `state` "PR"
- **THEN** a consulta da instituição devolve `city` "Toledo" e `state` "PR"

#### Scenario: UF inválida

- **WHEN** a instituição é alterada com `state` "Paraná"
- **THEN** a resposta é `400` com `VALIDATION_FAILED` no campo `state`
