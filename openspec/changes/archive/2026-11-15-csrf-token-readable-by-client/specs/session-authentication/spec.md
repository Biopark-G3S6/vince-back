## ADDED Requirements

### Requirement: Token anti-CSRF legível pela aplicação cliente

O cookie que transporta o token anti-CSRF SHALL ser legível por script e emitido com `Path=/`, para
que a aplicação o leia em qualquer caminho do sítio e o devolva no cabeçalho `X-CSRF-Token`. O cookie
de sessão MUST permanecer `HttpOnly` e com `Path` restrito ao prefixo da API. O encerramento da
sessão SHALL remover os dois cookies.

#### Scenario: Atributos dos cookies na autenticação

- **WHEN** a autenticação é bem-sucedida
- **THEN** o cookie do token anti-CSRF tem `Path=/` e não tem `HttpOnly`
- **AND** o cookie de sessão tem `HttpOnly` e `Path=/api/v1`

#### Scenario: Encerramento remove o token

- **WHEN** a sessão é encerrada
- **THEN** a resposta expira o cookie do token anti-CSRF com `Path=/`
