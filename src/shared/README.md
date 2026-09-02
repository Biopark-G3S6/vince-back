# Shared

Kernel de infraestrutura transversal. Deve permanecer **pequeno e estável**: crescimento contínuo
é indicador de erosão da fronteira e motiva revisão (`ADR-0009`, implicação 3).

## O que pode viver aqui

Registro de log e correlação, tratamento de erros, tipos utilitários de base, autenticação e
autorização de borda, e carregamento de configuração (`ADR-0009 §4`).

## O que não pode

Regra de negócio, entidade de domínio, DTO de módulo, evento de módulo ou acesso a dados de
módulo (`ADR-0009 §5`). E `shared/` **nunca** importa de `modules/` (`ADR-0009 §7`) — a
dependência só aponta para dentro.

## O critério de admissão

Um símbolo só entra aqui se satisfizer **as duas** condições (`ADR-0009 §7`):

1. uso efetivo por dois ou mais módulos; **e**
2. ausência de semântica de negócio.

Semelhança sintática não basta: a extração precisa ser justificada por identidade de
responsabilidade (`ADR-0009 §8`). E se um símbolo daqui passar a variar por módulo, ele deve ser
removido e duplicado nos módulos que o usam (`ADR-0009 §9`).

Duplicação entre módulos é preferível a acoplamento (`ADR-0009 §2`). Não traga nada para cá só
para evitar repetição.

---

## O que de fato vive aqui

| Diretório      | Responde por                                                                  |
| :------------- | :---------------------------------------------------------------------------- |
| `config/`      | A leitura da configuração de ambiente, em ponto único                         |
| `correlation/` | O identificador de correlação da requisição e a sua propagação                |
| `logging/`     | O log estruturado e a lista de permissão dos campos de contexto               |
| `http/`        | O envelope de resposta, o catálogo de códigos, a declaração de acesso da rota |
| `errors/`      | A falha esperada e o tratador global de exceções                              |
| `auth/`        | A sessão opaca, a guarda de borda, o CSRF e as rotas de sessão e identidade   |

Nada aqui é opcional por rota, e é essa a razão de estar aqui em vez de em cada módulo: **o que se
pode esquecer de aplicar, um dia se esquece.**

### `config/` — a aplicação recusa subir sem configuração

`loadAuthConfig()` lê tudo de uma vez e falha **nomeando a variável que falta**. Toda variável
declarada é obrigatória: configuração ausente que assume um padrão silencioso é o modo de falha que
só aparece em produção, e o segredo do token anti-CSRF é exatamente o caso em que um padrão embutido
seria pior que a parada.

### `correlation/` — a correlação nasce antes do roteador

O middleware é aplicado com `app.use`, e não declarado por módulo, para alcançar **também** a
requisição que não casa com rota alguma: `ADR-0025 §30` quer `X-Correlation-Id` em toda resposta, e
o `404` de rota inexistente é uma delas.

O identificador viaja por `AsyncLocalStorage`, e não por parâmetro. `ADR-0022 §9` o quer nos casos de
uso, nas consultas e nas mensagens publicadas; propagá-lo à mão significaria acrescentá-lo à
assinatura de tudo, inclusive de código que não o usa.

O formato declarado é o **UUID canônico**. Declarar um formato é o que dá sentido a `ADR-0022 §8`:
sem ele não existe "não obedece ao formato", e o valor do cliente entraria cru no log.

### `logging/` — lista de permissão, nunca de bloqueio

`log-fields.ts` declara, em ponto único, os campos que podem compor o contexto de um registro
(`ADR-0022 §4`). Campo fora da lista **não é registrado** — não é filtrado, não é mascarado: não
entra.

A diferença para uma lista de bloqueio (§5) não é de estilo. A lista de bloqueio protege contra os
campos que alguém lembrou de enumerar, e o campo sensível que aparecer amanhã passa por ela sem que
ninguém perceba. Aqui, acrescentar um campo é acrescentar uma linha — deliberadamente, e é o momento
em que se pergunta se ele é dado pessoal.

**Dívida declarada:** `errorMessage` está na lista, e é o único campo que pode carregar valor
submetido. `ADR-0022 §22` exige normalizar identificador, número e endereço de correio antes de usar
a mensagem, e a normalização nasce com o registro agregado de erros (§16 a §25), que é mudança
própria. Sem ela, uma falha de `500` em produção seria indiagnosticável.

### `http/` — o envelope e o catálogo

`response-code.ts` é a cópia executável da **URS §2.4**: o código, a severidade de `ADR-0025 §9` e o
status HTTP de §29, em um lugar só. Ter dois lugares decidindo o status do mesmo código é como a
resposta passa a contradizer o corpo (§14).

`pagination` **não existe** no tipo do envelope, e a ausência é deliberada: `ADR-0025 §21` a exige em
listagem, e o sistema ainda não publica listagem alguma. Declarar o campo agora seria descrever um
comportamento que ninguém implementou.

`route-access.ts` declara os três decoradores de acesso. São **três**, e não dois, porque a URS tem
três casos:

| Decorador                | Quando                        | Origem                                                       |
| :----------------------- | :---------------------------- | :----------------------------------------------------------- |
| `@PublicRoute()`         | Sem sessão                    | RF cuja permissão gerada é "— (acesso público)"              |
| `@AuthenticatedRoute()`  | Sessão, **nenhuma** permissão | RF cuja permissão gerada é "— (próprio perfil/conta/sessão)" |
| `@RequiresPermission(P)` | Sessão e a permissão `P`      | O caso comum                                                 |

Sem `@AuthenticatedRoute()`, a rota do perfil próprio exigiria inventar `USER:READ_SELF` — permissão
sem requisito que a origine, contra `ADR-0014 §7`, e titularidade modelada como permissão, contra
§13.

**A declaração é obrigatória, e o esquecimento falha na inicialização.**
`assertEveryRouteDeclaresAccess` percorre os controllers antes de a aplicação servir e recusa subir
nomeando o controlador e o método. É o mecanismo inteiro da decisão D4 de
`add-session-authentication`: a falha típica da guarda por rota não é a regra errada, é a rota nova
que não declara nada — e essa falha é aberta e silenciosa.

### `errors/` — esperada e inesperada

O tratador global classifica (`ADR-0022 §12`), e a diferença é o que vaza:

- **esperada** — o código do catálogo, o status correspondente e, na validação, um item por campo;
- **inesperada** — `500`, `data` nulo, nenhum `errors` e **nenhum detalhe interno** (§14, §15). Nem
  mensagem de exceção, nem rastro de pilha, nem nome de componente. O que se sabe do erro fica no
  log, do lado de cá.

`ADR-0022 §16 a §25` — o registro agregado por assinatura — **não** está aqui: exige fila dedicada,
consumidor próprio e o módulo de observabilidade, e é mudança própria.

### `auth/` — a sessão opaca

O estado vive em Redis, sob `session:<id>`, com um conjunto `session:user:<id>` que existe só para a
revogação em uma operação (`ADR-0013 §11`).

**As duas expirações são impostas de formas diferentes, de propósito.** A inatividade é o TTL da
chave, renovado a cada requisição. O prazo absoluto é verificado na leitura **e** limita o TTL
escrito: `min(inatividade, o que resta do absoluto)`. Confiar só na verificação deixaria a chave viva
depois do prazo; confiar só no TTL faria a renovação empurrar o absoluto para a frente, que é o que
`ADR-0013 §7` proíbe.

**Falha fechada.** A indisponibilidade do Redis não devolve valor de reserva: o erro sobe, e a guarda
o converte em negativa de autenticação (§16). Não existe modo degradado que aceite requisição sem
verificação — e a implicação 1 do ADR é explícita: o Redis passa a ser condição de disponibilidade do
sistema.

**O token anti-CSRF é a assinatura do identificador de sessão**, e não um segundo segredo guardado ao
lado dele. A consequência é a que interessa: o token de uma sessão não vale em outra, e a verificação
não custa leitura alguma. Ele viaja em cookie legível por script — deliberadamente, e sem contrariar
§9, que proíbe o **identificador de sessão** em armazenamento acessível a script: o token sozinho não
autentica ninguém.

### Os dois ports que `shared/` declara e não implementa

`ADR-0013 §17` põe a autenticação aqui; `ADR-0009 §6` proíbe `shared/` de importar de `modules/`; e
verificar uma senha exige ler a credencial, que é dado do módulo `access`. As três regras só se
satisfazem ao mesmo tempo assim:

| Port                 | Declarado em                  | Ligado em                       |
| :------------------- | :---------------------------- | :------------------------------ |
| `CredentialVerifier` | `auth/credential-verifier.ts` | `app/auth/access-auth-ports.ts` |
| `IdentityResolver`   | `auth/identity.ts`            | `app/auth/access-auth-ports.ts` |

O composition root é o único que pode conhecer os dois lados, e a configuração do ESLint já o
permitia. A dependência continua apontando para dentro.

## O que a borda NÃO decide

A **titularidade do registro** (`ADR-0014 §12`, §13). Possuir `ARTICLE:UPDATE` autoriza a ação, não o
registro; quem decide de quem ele é é o caso de uso do módulo dono dele. Regra de titularidade não
vira permissão, e nenhuma entra no catálogo.
