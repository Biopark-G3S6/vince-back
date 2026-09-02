## Why

Depois das duas verticais anteriores o sistema sabe quem existe e o que cada papel autoriza, mas
ninguém entra: não há credencial, não há sessão e não há uma única rota publicada. O `SYSTEM_ADMIN`
da carga inicial existe e não consegue autenticar-se.

Esta é a vertical que torna o sistema utilizável: a senha, a sessão opaca de `ADR-0013`, a guarda de
borda de `ADR-0014` §11 e a primeira camada HTTP — que fixa, para todo o resto do sistema, o envelope
de resposta de `ADR-0025` e a correlação de `ADR-0022`.

## What Changes

- **Credencial.** Acrescenta ao módulo `access` a credencial de senha da conta, com política declarada
  em ponto único, e os casos de uso de definição e alteração (RF-ACS-004).
- **Sessão.** Implementa em `shared/` a sessão opaca mantida em Redis: identificador sem semântica com
  no mínimo 128 bits, cookie `HttpOnly`/`Secure`/`SameSite`/`Path` restrito, expiração por inatividade
  em 8 horas e absoluta em 7 dias, regeneração na autenticação, encerramento imediato e revogação de
  todas as sessões de um usuário (`ADR-0013` §1 a §12, §17).
- **Autenticação.** Publica a autenticação por e-mail e senha (RF-ACS-001) e o encerramento de sessão
  (RF-ACS-002), com resposta indistinguível entre credencial inválida e conta inexistente.
- **Redefinição.** Implementa o meio de redefinição de uso único e com prazo (RF-ACS-003, RF-ACS-004),
  com resposta idêntica para e-mail cadastrado e não cadastrado. **O envio da mensagem fica de fora** —
  ver Impacto.
- **Guarda de borda.** Implementa a verificação de permissão antes da execução do caso de uso, com
  negativa registrada em log (`ADR-0014` §11, §14), consumindo a apuração de permissões efetivas da
  vertical anterior.
- **Identidade.** Publica o endpoint de identidade do usuário autenticado, devolvendo identificação,
  papéis e permissões efetivas para composição de interface (`ADR-0013` §20).
- **CSRF.** Protege as requisições que alteram estado, combinando `SameSite` e token anti-CSRF por
  sessão (`ADR-0013` §13, §14).
- **Camada HTTP, primeira vez.** Envelope único de resposta, catálogo de códigos, semântica de status,
  cabeçalho de correlação, tratador global de exceções com classificação de falhas, log estruturado e
  publicação da especificação OpenAPI (`ADR-0025`, `ADR-0022` §1 a §15, `ADR-0017` §1).
- **Perfil.** Publica as rotas do perfil próprio (RF-ACS-005, RF-INT-001) sobre os casos de uso que a
  vertical anterior deixou prontos.

**Não entra nesta mudança**, deliberadamente:

- **O envio da mensagem de redefinição de senha.** Depende de capacidade de notificação por correio
  eletrônico, que exige outbox e relay (`ADR-0021`), fila (`ADR-0020`), catálogo de mensagens do
  backend (`ADR-0026` §18 a §20) e adaptador de envio — nada disso existe. RF-ACS-003 fica entregue
  **exceto pelo envio**: o meio de redefinição é criado, consumido e expirado corretamente, mas não
  chega ao destinatário. É lacuna nomeada, não esquecimento.
- **O registro de erros em tabela** (`ADR-0022` §16 a §25). Exige fila dedicada, consumidor próprio e o
  módulo `observabilidade`, cujo schema existe sem migração. O tratador global e o log estruturado
  entram; a persistência agregada por assinatura é mudança própria.
- **A verificação `INSTITUTION_INACTIVE` na autenticação** (RF-ACS-001 E3, RF-INS-001 RN2). Depende do
  módulo de instituição, inexistente. Dívida herdada da vertical anterior.

## Capabilities

### New Capabilities

- `api-response-contract`: a forma de toda resposta da API — envelope, código de status estável,
  detalhamento de erro por campo, correlação e semântica dos códigos HTTP.
- `password-credential`: a senha da conta — política, definição, alteração e o meio de redefinição de
  uso único.
- `session-authentication`: a sessão opaca — estabelecimento, transporte, renovação, expiração,
  encerramento, revogação e proteção contra falsificação de requisição entre sítios.
- `permission-enforcement`: a verificação de permissão na borda e a identidade devolvida ao cliente
  autenticado.

### Modified Capabilities

<!-- Nenhuma. `user-account` e `role-assignment` são consumidas sem alteração de seus requisitos:
     esta mudança publica rotas sobre casos de uso já especificados, sem redefinir seu comportamento. -->

## Impact

- **Código:** `src/shared/` ganha sessão, guarda, envelope, filtro de exceções, correlação e log —
  primeira ocupação real do kernel; `src/modules/access/` ganha credencial e `presentation/`;
  `src/main.ts` ganha cookie, CSRF, filtro global e OpenAPI.
- **API, primeiras rotas publicadas:** autenticação, encerramento de sessão, identidade do usuário
  autenticado, definição e alteração de senha, solicitação de redefinição, e o perfil próprio. Todas
  sob o prefixo de versão já configurado em `src/main.ts`.
- **Dependências novas:** biblioteca de derivação de senha e leitor de cookie; `ADR-0025` e `ADR-0017`
  exigem ainda a geração de OpenAPI. Nenhuma delas colide com as restrições da seção 4 dos Padrões.
- **Configuração:** `.env.example` já declara `SESSION_COOKIE_NAME`, `SESSION_IDLE_TTL_SECONDS` e
  `SESSION_ABSOLUTE_TTL_SECONDS`; falta o segredo do token anti-CSRF e os parâmetros da derivação de
  senha.
- **Redis passa a ser condição de disponibilidade do sistema** (`ADR-0013`, implicação 1): sem ele não
  há sessão, e a negativa é deliberada.
- **Tamanho.** Esta é, de longe, a maior das três verticais, porque acumula a autenticação e a
  fundação HTTP que nenhuma anterior precisou. Ela pode ser dividida em duas mudanças — fundação HTTP
  e autenticação — sem alterar nenhuma das specs abaixo; a divisão é decisão de execução.
