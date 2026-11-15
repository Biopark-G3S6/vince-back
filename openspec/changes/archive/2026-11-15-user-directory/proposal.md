## Why

Várias designações da URS recebem o identificador de um usuário existente:

- administrador institucional (`RF-INS-002`);
- coordenador (`RF-CUR-002`);
- professor da turma (`RF-TUR-002`);
- orientador do evento (`RF-EVT-003`);
- integrante da equipe, convite e orientador responsável (`RF-EQP-003`, `RF-EQP-004`, `RF-EQP-005`);
- beneficiário de concessão (`RF-ACS-006`).

Não existe, porém, como o cliente descobrir esse identificador. As listagens dos outros módulos
(integrantes, orientadores, elegíveis, matrículas) devolvem apenas `userId`, sem nome para exibir.
Sem um diretório, as telas não conseguem nem oferecer a escolha da pessoa nem mostrar quem é quem.

## What Changes

- Nova rota `GET /api/v1/users`, autenticada e paginada.
  - **Busca:** `search` (nome ou e-mail), `role` (código de papel) e `active`, restrita a quem tem
    alguma permissão de designação ou de concessão.
  - **Resolução de nomes:** `ids` (até 100), aberta a qualquer usuário ativo da mesma instituição,
    devolvendo só identificador e nome.
  - `institutionId` é aceito apenas para o administrador de sistema, para designar o administrador
    institucional.
- Nenhuma permissão nova no catálogo: a consulta é de apoio aos requisitos de designação e herda as
  permissões deles.

## Capabilities

### New Capabilities

- `user-directory`: localizar usuários da instituição para designação e resolver nomes de
  identificadores.

### Modified Capabilities

Nenhuma.

## Impact

- `src/modules/access`: caso de uso, consulta de repositório, controlador.
- OpenAPI: uma operação nova.
