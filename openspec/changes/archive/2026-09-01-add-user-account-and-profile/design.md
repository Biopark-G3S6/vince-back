## Context

`add-role-and-permission-catalog` já terá deixado o módulo `access` registrado, com schema próprio,
cliente Prisma escopado, carga inicial acionada pelo composition root e a infraestrutura de teste
contra PostgreSQL real. Esta mudança acrescenta duas tabelas e um punhado de casos de uso àquilo,
sem redecidir nenhuma dessas escolhas — o que ela decide de novo é a apuração das permissões
efetivas, seu cache e a trilha de auditoria.

Restrições que moldam o desenho: `ADR-0014` §9 a §13 e §18 (resolução por requisição, cache
invalidado, titularidade fora do catálogo de permissões, auditoria imutável), `ADR-0006` §4 e
`ADR-0018` §13 e §14 (referência a outro módulo sem chave estrangeira, com índice), `ADR-0019`
(transação e outbox), `ADR-0018` §18 (exclusão lógica só com declaração explícita) e `ADR-0024` §2
(fronteira do teste unitário na fachada).

Para a motivação, ver `proposal.md` — Why. Para o contrato, ver `specs/user-account/spec.md` e
`specs/role-assignment/spec.md`.

## Goals / Non-Goals

**Goals:**

- Deixar a apuração das permissões efetivas pronta e sob teste, porque é o caminho crítico de toda
  requisição autenticada da vertical seguinte.
- Deixar a conta pronta para receber credencial sem alteração de schema na vertical seguinte.
- Deixar a trilha de auditoria com forma definida, já que as verticais de instituição, curso e turma
  vão gravar nela pelos mesmos casos de uso.

**Non-Goals:**

- Rota HTTP, envelope de resposta, tratador global de exceções e identificador de correlação. Não há
  requisição a atender nesta vertical; tudo isso nasce em `add-session-authentication`.
- Concessão direta de permissão. A apuração é escrita de modo a receber a segunda origem depois, mas
  esta mudança não a implementa.
- Validação de existência e de atividade da instituição, que depende de módulo inexistente.

## Decisions

### D1 — Os códigos de resposta nascem como resultado do caso de uso, não como exceção HTTP

`VALIDATION_FAILED`, `PERMISSION_DENIED`, `EMAIL_ALREADY_REGISTERED`, `RESOURCE_NOT_FOUND` e
`LANGUAGE_NOT_SUPPORTED` são produzidos pela camada de aplicação como falha classificada, com o código
do catálogo da URS §2.4 e, quando houver, o detalhamento por campo.

_Por quê:_ não há HTTP nesta vertical, e a spec exige os códigos mesmo assim. `ADR-0022` §12 e §13
classificam falha esperada independentemente do transporte; `ADR-0025` §7 exige código estável e
independente de idioma. Deixar a classificação na aplicação faz o controller da vertical seguinte ser
tradução de código para status HTTP, e nada mais.

_Alternativa considerada:_ lançar exceção do NestJS (`ForbiddenException` e afins) direto do caso de
uso — acopla a aplicação ao framework HTTP, contra `ADR-0003` §4, que veda dependência de framework
em `domain/` e detalhe de transporte em `application/`.

### D2 — Titularidade verificada dentro do caso de uso, nunca como permissão

O perfil próprio não gera permissão alguma: RF-ACS-005 declara "— (próprio perfil)". O caso de uso
recebe o identificador do ator e o do alvo, e recusa com `PERMISSION_DENIED` quando diferem.

_Por quê:_ `ADR-0014` §12 e §13 são explícitos — a permissão autoriza a ação, a titularidade autoriza
o registro, e regra de titularidade não vira permissão. Modelar `USER:UPDATE_SELF` produziria
permissão sem RF de origem, contra `ADR-0014` §7.

### D3 — Cache das permissões efetivas por conta, em Redis, invalidado por escrita

Chave derivada do identificador da conta; a apuração grava, e toda operação que altere papel ou
estado da conta apaga a chave dentro da mesma transação lógica. A apuração falha quando o Redis está
indisponível.

_Por quê:_ `ADR-0014` §10 exige invalidação imediata, o que descarta expiração por tempo como
mecanismo principal. Falhar fechado segue `ADR-0013` §16 e a implicação 3 de `ADR-0014`, que declara
a indisponibilidade do cache equivalente à do sistema; e é academicamente indiferente na prática,
porque a sessão de `ADR-0013` §15 vive no mesmo Redis e a requisição já teria sido recusada antes.

_Alternativas consideradas:_ cache em memória do processo — incompatível com a replicação de
`ADR-0008` §9, pois cada réplica invalidaria só a própria cópia; expiração curta sem invalidação —
deixa janela em que permissão revogada continua valendo, contra `ADR-0014` §10 e `PAD-SEG-009`.

### D4 — A trilha de auditoria é tabela do próprio módulo, gravada na transação da operação

`ADR-0018` §6 já a localiza no schema do módulo que a produz. A gravação ocorre na mesma transação da
atribuição ou revogação (`ADR-0019` §1), e a tabela não recebe operação de alteração nem de remoção.

_Por quê:_ a spec exige que falha não deixe rastro parcial, o que só a transação única garante.

_Alternativa considerada:_ gravar por evento, via outbox — daria desacoplamento, ao custo de a trilha
ficar eventualmente consistente com o vínculo que ela documenta; para auditoria, isso troca a
garantia pelo desacoplamento na direção errada.

### D5 — A conta não usa exclusão lógica; "inativa" é estado de negócio

`ADR-0018` §18 desaconselha exclusão lógica por padrão. A coluna de estado da conta não é exclusão
lógica: RF-ACS-001 E2 lhe dá significado de negócio — conta desativada não autentica — e nenhuma
consulta do sistema deve filtrá-la implicitamente.

_Por quê:_ a diferença importa na revisão. Se a coluna fosse exclusão lógica, toda consulta teria de
filtrá-la, e a omissão exporia registro excluído; como é estado de negócio, cada consulta decide
explicitamente se ele importa.

### D6 — A apuração das permissões efetivas já nasce com a forma de união de origens

A apuração é escrita como união de conjuntos de origens, com uma única origem implementada agora —
os papéis. `PermissionGrant` entra depois como segunda origem, sem alterar a assinatura da consulta.

_Por quê:_ RF-ACS-001 RN2 e `ADR-0014` §5 definem as permissões efetivas como união de papéis e
concessões diretas. Modelar agora só a origem de papel, com a forma da união já pronta, evita que a
vertical de delegação altere a superfície que a autenticação já estará consumindo — o que
`ADR-0004` §11 trataria como quebra de contrato.

## Risks / Trade-offs

- **A vertical não publica rota, e portanto não produz efeito visível ao usuário final.** → É
  consequência da ordem escolhida: a única rota que ela publicaria exige sessão. A verificação se dá
  por teste na fachada, que é a fronteira que `ADR-0024` §2 fixa, e não por exercício manual. Quem
  revisar deve esperar isso, e não procurar endpoint.

- **`user.institution_id` fica sem validação e sem a regra `INSTITUTION_INACTIVE`.** → Registrado como
  dívida na proposta. O risco concreto é uma conta apontar para instituição inexistente; até a
  vertical de instituição, o único produtor de contas é a carga inicial, que não informa vínculo.

- **A conta inicial de `SYSTEM_ADMIN` nasce sem credencial e, portanto, inutilizável até a vertical
  seguinte.** → Deliberado: a credencial é dado de autenticação. O efeito prático é que, entre esta
  mudança e a próxima, o sistema tem um administrador que não entra. A alternativa — semear senha por
  variável de ambiente — poria segredo no caminho da carga inicial sem necessidade.

- **O e-mail é dado pessoal e vai aparecer em log de erro se nada o impedir.** → `ADR-0022` §4 exige
  lista de permissão de campos declarada em ponto único, e `ADR-0025` §18 proíbe ecoar o valor
  submetido no detalhamento por campo. A spec já cobre o segundo ponto; o primeiro depende do
  registro de log, que só nasce na vertical seguinte. Até lá, nenhum caso de uso desta vertical deve
  registrar e-mail em log.

- **A cardinalidade papel-usuário admite mais de um papel, e a URS não diz se isso ocorre.** →
  `ADR-0014` §5 admite; `RF-TUR-002` RN1 e `RF-INS-002` RN1 descrevem designações independentes que
  produziriam a combinação. Modelar como associação muitos-para-muitos é o que não fecha porta; a
  restrição, se vier, é regra de caso de uso, não de schema.

## Open Questions

- O identificador em inglês da "área de atuação ou pesquisa" de RF-ACS-005 RN2 ainda não está no
  glossário §3.9.1. A escolha não altera spec, desenho nem tarefas — altera um nome de coluna —, mas
  `PAD-REQ-002` a torna imutável depois de publicada, então deve ser registrada no glossário antes de
  a migração ser gerada.
