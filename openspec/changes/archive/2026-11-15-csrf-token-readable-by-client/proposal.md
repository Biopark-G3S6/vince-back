## Why

O cookie do token anti-CSRF é emitido com `Path=/api/v1`, como o cookie de sessão. O navegador só
expõe a `document.cookie` os cookies cujo `Path` contém o caminho **da página**, e a aplicação roda em
`/admin/...`. Por isso o cliente nunca enxerga o token que precisa devolver em `X-CSRF-Token`, e toda
requisição que altera estado é recusada com `PERMISSION_DENIED`. O defeito apareceu ao integrar o
frontend: o `ADR-0013` §14 e o próprio comentário de `setCsrfCookie` exigem que o cliente leia o token.

## What Changes

- O cookie do token anti-CSRF passa a ter `Path=/`.
- O cookie de sessão continua `HttpOnly` e restrito a `Path=/api/v1`.
- O encerramento da sessão apaga cada cookie no `Path` em que ele foi gravado.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `session-authentication`: acrescenta o requisito de que o token anti-CSRF seja legível pela
  aplicação cliente em qualquer caminho do sítio.

## Impact

- `src/shared/auth/session-cookie.ts` e o teste de atributos de cookie em `src/app/api.http.spec.ts`.
- Nenhuma mudança de rota nem de corpo de resposta.
