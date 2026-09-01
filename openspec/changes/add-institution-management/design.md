## Context

Esta é a segunda ocupação de `src/modules/` e a primeira vez que dois módulos de negócio precisam
conversar. Até aqui a única fronteira exercitada foi `shared/` ↔ `access`, resolvida por porta
abstrata ligada no composition root. Agora entra a regra que governa o resto do sistema: quem pode
chamar quem.

Restrições que moldam o desenho: `ADR-0005` §1 a §7 (fachada, ausência de ciclo, ausência de
transação compartilhada), `ADR-0006` §1 a §6 (propriedade de tabela, referência sem chave
estrangeira), `ADR-0013` §15 e §18 (resolução de sessão sem banco relacional; módulo não invalida
sessão), `ADR-0014` §9 e §10 (permissões resolvidas por requisição, com cache invalidado),
`ADR-0011` §6, §7 e §9 (paginação obrigatória, limite de 100, contagem de consultas constante) e
`ADR-0025` §21 a §25 (forma da paginação).

Para a motivação, ver `proposal.md` — Why. Para o contrato, ver os três arquivos em `specs/`.

## Goals / Non-Goals

**Goals:**

- Fixar a direção da dependência entre módulos, de uma vez, antes de existirem cinco deles.
- Fechar as duas dívidas herdadas: `INSTITUTION_INACTIVE` na autenticação e a procedência do vínculo
  institucional da conta.
- Entregar a primeira listagem paginada com a forma que `ADR-0025` exige, para que as próximas a
  copiem.

**Non-Goals:**

- Consentimento de uso de IA, curso, turma e as designações seguintes da cadeia.
- Revogação imediata de sessão na desativação da instituição — ver Riscos, é gap declarado.

## Decisions

### D1 — `access` é módulo folha: a dependência síncrona aponta sempre para ele

`institution` chama `access` pela fachada, para atribuir e revogar o papel `INSTITUTION_ADMIN` e, na
vertical seguinte, para emitir convite. `access` NÃO chama `institution` nem nenhum outro módulo.

_Por quê:_ `ADR-0005` §6 proíbe ciclo de chamadas síncronas. O primeiro desenho desta vertical tinha
`institution → access` para atribuir papel e `access → institution` para validar o vínculo da conta —
ciclo exato. Como `access` é o módulo que todo outro vai precisar (todo módulo designa papel a
alguém), a inversão correta é tirar dele a necessidade de conhecer os demais: **o identificador de
instituição chega ao `access` já validado por quem o forneceu**, e não é validado por ele.

_Consequência de projeto, e não só desta mudança:_ toda designação e todo convite passam a ser
emitidos pelo módulo dono do escopo. Isso coincide com a URS: RF-INS-002 é do administrador de
sistema sobre a instituição, RF-CUR-002 do administrador institucional sobre o curso, RF-TUR-002 do
coordenador sobre a turma, RF-TUR-004 do professor sobre a turma. A regra não é imposição técnica —
é a cadeia de designação da URS, expressa em fronteiras.

_Alternativa considerada:_ réplica local da instituição dentro do `access`, projetada de eventos
(`ADR-0006` §6 a §8). É a solução que os ADRs preferem, e será a certa quando houver outbox e relay
(`ADR-0021`). Hoje essa infraestrutura não existe, e construí-la só para validar um identificador
seria desproporcional.

### D2 — A designação não é atômica entre os dois módulos, e é a idempotência que a fecha

`ADR-0005` §7 proíbe um módulo de participar da transação de outro. A designação atribui o papel pelo
`access` e grava o vínculo no `institution` — duas transações. A ordem é: **primeiro o papel, depois o
vínculo**; ambas as operações são idempotentes, e repetir a designação conclui o que ficou pela
metade.

_Por quê:_ das duas falhas parciais possíveis, esta é a inócua. Papel sem vínculo não autoriza nada,
porque `ADR-0014` §12 obriga a verificação de titularidade dentro do caso de uso — o usuário teria a
permissão e nenhum registro sobre o qual exercê-la. A ordem inversa produziria vínculo sem papel, que
aparenta designação concluída e não funciona.

_Alternativa considerada:_ saga com compensação — desproporcional para duas escritas cuja repetição
já converge.

### D3 — A instituição inativa zera as permissões efetivas, e não derruba a sessão

A resolução das permissões efetivas passa a considerar o estado da instituição do usuário: instituição
inativa produz conjunto vazio. O resultado combinado é o que vai ao cache de `ADR-0014` §10, e a
desativação da instituição invalida o cache dos usuários afetados.

_Por quê:_ `ADR-0013` §18 proíbe módulo de invalidar sessão, e §15 proíbe consulta ao banco relacional
na resolução da sessão. Um "derrubar as sessões da instituição" violaria o primeiro; um "verificar a
instituição a cada requisição" violaria o segundo. Zerar as permissões efetivas usa o mecanismo que
`ADR-0014` §9 e §10 já obrigam a existir, e produz o efeito prático: toda rota protegida passa a
responder `403`.

_Trade-off aceito:_ a sessão continua tecnicamente válida e o cliente não é levado à tela de
autenticação, porque `ADR-0017` §17 determina que `403` não encerre a sessão no cliente. O usuário de
instituição desativada fica numa aplicação em que nada funciona, em vez de ser deslogado. É feio, e é
o preço de não violar `ADR-0013` §18.

### D4 — `INSTITUTION_INACTIVE` só se distingue depois de a credencial ser verificada

A autenticação verifica a credencial primeiro; só depois consulta o estado da instituição. Credencial
incorreta em conta de instituição desativada devolve `AUTHENTICATION_FAILED`.

_Por quê:_ a ordem inversa transformaria o código de resposta em oráculo — bastaria tentar um e-mail
qualquer para descobrir se existe conta e a que instituição pertence. RF-ACS-001 E1 exige
indistinguibilidade para quem não tem a credencial; conceder a distinção a quem já a provou não
vaza nada.

### D5 — A verificação da instituição entra por composição no `app`, não por chamada entre módulos

O adaptador que compõe "permissões efetivas do `access`" com "estado da instituição do `institution`"
reside em `src/app/`, que é o único lugar que enxerga os dois `contracts/` e o port de `shared/`.

_Por quê:_ `shared/` não pode importar de `modules/` (`ADR-0009` §6) e `access` não pode chamar
`institution` (D1). Sobra o composition root, que a configuração do ESLint já autoriza a importar
`shared`, `module-root` e `contracts`.

_Tensão a registrar:_ `ADR-0003` §10 diz que o composition root conhece "apenas a lista de módulos".
Um adaptador de composição é mais do que uma lista. A alternativa seria um módulo de plataforma só
para essa costura, o que `ADR-0003` §15 desautoriza por ele não ter dados próprios. Ver Riscos.

## Risks / Trade-offs

- **A regra "`access` é folha" nasce aqui e vale para todo o sistema.** → Se ela se mostrar errada
  adiante — por exemplo, quando o `access` precisar de dado de outro módulo para uma decisão —, a
  saída prevista pelos ADRs é a réplica projetada de eventos, não abrir exceção ao ciclo. Vale
  registrar a regra no ADR do módulo `access` ao escrevê-lo, e não deixá-la só aqui.

- **O adaptador de composição no `app` estica `ADR-0003` §10.** → Se a costura crescer além de duas ou
  três composições, é sinal de que a fronteira está errada e o assunto vira ADR. Enquanto forem duas —
  verificação de credencial e estado da instituição —, o custo de um módulo de plataforma seria maior
  que o da tensão.

- **Sessão de usuário de instituição desativada sobrevive.** → Consequência de D3, declarada. O fecho
  correto é evento consumido pela camada de sessão, que depende de `ADR-0021`; até lá, o efeito é
  `403` em tudo, e não encerramento.

- **A desativação de instituição com muitos usuários invalida muitas chaves de cache.** → A operação é
  rara e administrativa. Ainda assim, a invalidação deve ser feita por padrão de chave ou por
  versionamento, e não iterando usuário a usuário com uma consulta por elemento, o que `ADR-0011` §13
  reprova em revisão.

- **A conta deixa de validar a instituição que recebe.** → É o que D1 compra. O risco concreto é conta
  com vínculo para instituição inexistente, se um módulo emissor de convite falhar em validar. A
  spec de `user-account` passa a declarar a procedência exigida, e o teste do emissor é onde isso se
  verifica.

## Open Questions

- **Quais campos compõem os "dados de identificação" da instituição** de RF-INS-001. A URS não os
  enumera. Não altera spec, desenho nem tarefas — altera colunas —, mas convém decidir com a parte
  interessada antes de gerar a migração, porque acrescentar campo obrigatório depois exige valor para
  as linhas existentes.
