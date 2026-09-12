## Why

A URS descreve uma cadeia de designação — `SYSTEM_ADMIN` designa o administrador institucional
(RF-INS-002), que designa o coordenador (RF-CUR-002), que designa o professor (RF-TUR-002) — e todas
as três pressupõem "usuário beneficiário ativo". Nenhum requisito diz como esse usuário passa a
existir. A URS §3, item 2 reconhece a lacuna: "a cadeia de criação de usuários (...) deriva da
definição de produto, não de solicitação direta".

Sem fechá-la, o sistema tem exatamente um usuário — o `SYSTEM_ADMIN` da carga inicial — e nenhuma
forma de ter o segundo. Esta mudança fecha a lacuna com convite, que é o mecanismo que a própria URS
já usa para alunos em RF-TUR-004 e RF-TUR-005, generalizado para os demais papéis.

## What Changes

- Acrescenta ao módulo `access` a tabela `invitation` e o mecanismo de convite, em **duas formas na
  mesma entidade**:
  - **dirigido**: destinado a um e-mail, de uso único;
  - **aberto**: sem destinatário, de uso múltiplo, com limite de usos opcional.
    Ambas com prazo de validade obrigatório e revogáveis a qualquer momento.
- Publica, no módulo `institution`, a emissão de convite no escopo de uma instituição — quem emite é o
  módulo dono do escopo, conforme a regra fixada em `add-institution-management`, decisão D1.
- Publica, no módulo `access`, as rotas públicas de consulta do convite pelo seu endereço e de
  aceitação, que cria a conta com nome e senha e atribui o papel declarado no convite.
- Publica a consulta e a revogação de convites emitidos.
- Impõe a regra de não escalonamento: o convite só concede papel que o convidante possa conceder,
  segundo a cadeia de designação da URS — `SYSTEM_ADMIN` convida `INSTITUTION_ADMIN`;
  `INSTITUTION_ADMIN` convida `COORDINATOR` e `PROFESSOR`; `COORDINATOR` convida `PROFESSOR`;
  `PROFESSOR` convida `STUDENT`.
- Registra em trilha de auditoria a emissão, a revogação e cada aceitação.
- **Fecha o bloqueio do primeiro acesso**: a carga inicial passa a emitir, para a conta inicial de
  `SYSTEM_ADMIN`, um meio de redefinição de senha de uso único, apresentado na saída do comando. Sem
  isso, ninguém entra no sistema e a cadeia inteira fica inacessível.

**Não entra nesta mudança**, deliberadamente:

- **O envio do convite por e-mail.** A emissão devolve o endereço de ingresso, como RF-TUR-004 já
  prevê no passo 3 do seu fluxo principal, e o convidante o repassa. Consequência: **esta vertical é
  utilizável sem a infraestrutura de notificação que falta**, ao contrário de RF-ACS-003. Quando a
  vertical de notificação existir, o envio automático é acréscimo, não redesenho.
- **O convite de turma de RF-TUR-004 e RF-TUR-005.** Depende de curso e turma, que não existem. A
  entidade nasce com a forma que ele exigirá — aberto, de uso múltiplo, com prazo e revogável —, e a
  vertical de turma acrescentará o vínculo com a turma e a matrícula.
- **A designação a escopo específico.** O convite concede papel e vínculo institucional; a designação
  a um curso ou a uma turma continua sendo operação própria, das verticais correspondentes.

## Capabilities

### New Capabilities

- `user-invitation`: o convite como forma de criar conta — suas duas formas, seu ciclo de vida, quem
  pode emitir com qual papel, e a criação de conta que a aceitação produz.

### Modified Capabilities

- `password-credential`: acrescenta o primeiro acesso do administrador inicial, hoje sem via de
  entrada por a conta nascer sem senha e não haver envio de mensagem.

## Impact

- **Documentação (`vince-docs`), pré-requisito bloqueante.** Esta é a única das cinco mudanças que
  cria comportamento sem requisito de origem, e por isso exige alteração da URS antes de ser
  aplicada:
  - RF novo no grupo `ACS` — "Convidar usuário" —, declarando ator, fluxos, regras de negócio,
    exceções e as permissões que origina (`PAD-REQ-008`).
  - §2.3: acrescentar o RF novo como origem de `INVITATION:CREATE`, `INVITATION:READ` e
    `INVITATION:REVOKE`, que hoje têm origem apenas em RF-TUR-004.
  - §2.3.1: acrescentar `INVITATION:CREATE/READ/REVOKE` à composição de `SYSTEM_ADMIN`,
    `INSTITUTION_ADMIN` e `COORDINATOR` — hoje apenas `PROFESSOR` as possui, o que impede a cadeia.
  - §2.4: acrescentar o código de limite de usos atingido, que o catálogo não possui.
- **Carga inicial:** a composição dos papéis muda, e o teste de correspondência de
  `add-role-and-permission-catalog` reprova até que a carga acompanhe a URS. É o mecanismo
  funcionando, não defeito.
- **Código:** `src/modules/access/` ganha a entidade, os casos de uso e as rotas públicas;
  `src/modules/institution/` ganha a rota de emissão; `src/app/bootstrap/` ganha a apresentação do
  meio de redefinição inicial.
- **API:** rotas públicas novas — consulta e aceitação de convite. São as primeiras rotas públicas que
  criam registro, e portanto as primeiras a precisar de limitação de taxa, questão que
  `add-session-authentication` já deixou em aberto.
