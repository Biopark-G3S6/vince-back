## Why

A lista de instituições (`RF-INS-001`) mostra, em cada linha, os administradores institucionais
(`RF-INS-002`). Para o administrador de sistema, o diretório (`GET /api/v1/users`) exige
`institutionId`, então o cliente precisa de **uma requisição por instituição** para preencher a
lista: um N+1 entre cliente e servidor (`ADR-0011`, `PAD-ESC-*`). Com 39 instituições, a tela fez
40 requisições.

## What Changes

- O administrador de sistema PODE omitir `institutionId` quando filtra `role=INSTITUTION_ADMIN`: a
  resposta traz os administradores institucionais de todas as instituições, paginada.
- Sem `institutionId` e com outro papel (ou sem papel), continua `400` com `VALIDATION_FAILED`: o
  administrador de sistema não lê os demais usuários das instituições.
- Na busca (quem designa), cada item passa a trazer `institutionId`, para o cliente agrupar.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `user-directory`: busca do administrador de sistema sem `institutionId` restrita ao papel de
  administrador institucional; `institutionId` nos itens da busca.

## Impact

- `src/modules/access`: caso de uso do diretório, filtro do repositório, DTO de resposta.
- OpenAPI: campo novo na resposta de `GET /users`; contrato compatível (só acrescenta).
- `vince-front`: a lista de instituições passa a fazer uma única consulta de administradores.
