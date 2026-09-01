## Context

`add-institution-management` fixou que `access` é módulo folha e que a dependência síncrona aponta
sempre para ele. Esta mudança é o primeiro teste dessa regra: o convite precisa, ao mesmo tempo, de
escopo institucional — que é do `institution` — e do mecanismo de criação de conta e atribuição de
papel — que é do `access`.

É também a única das cinco mudanças que cria comportamento sem requisito de origem na URS. As demais
implementam o que já estava especificado; esta preenche uma lacuna que a própria URS §3, item 2
reconhece em aberto. Isso muda o que o `design.md` precisa registrar: não só como construir, mas o que
foi assumido na ausência de decisão da parte interessada.

Para a motivação, ver `proposal.md` — Why. Para o contrato, ver `specs/user-invitation/spec.md` e
`specs/password-credential/spec.md`.

## Goals / Non-Goals

**Goals:**

- Destravar a cadeia de designação sem depender da infraestrutura de notificação, que não existe.
- Nascer com a forma que RF-TUR-004 exigirá, para que o convite de turma seja acréscimo e não
  redesenho.
- Deixar explícito, e revisável, tudo o que foi assumido sem requisito.

**Non-Goals:**

- Envio por e-mail, convite de turma, matrícula, e designação a curso ou turma.
- Limitação de taxa nas rotas públicas — necessária, e ainda sem decisão registrada. Ver Riscos.

## Decisions

### D1 — Uma entidade, duas formas, discriminadas pela presença do destinatário

`invitation` com `target_email` opcional: preenchido, o convite é dirigido e de uso único; ausente, é
aberto e de uso múltiplo, com limite opcional. Prazo obrigatório e revogação valem para as duas.

_Por quê:_ as duas formas têm o mesmo ciclo de vida — emitido, aceito, expirado, revogado — e as
mesmas regras de escopo e de papel. Duas entidades duplicariam tudo isso para diferir em um campo e
uma contagem. E RF-TUR-004 descreve exatamente a forma aberta, com prazo obrigatório e revogável, o
que confirma que ela não é invenção desta mudança.

_Alternativa considerada:_ só o convite dirigido agora, e o aberto quando a turma chegar — foi a
opção inicialmente recomendada e descartada por decisão explícita, para não redesenhar depois.

### D2 — Emissão pelo módulo dono do escopo, mecanismo no `access`

A rota de emissão vive no `institution` e valida o que é do seu domínio: a instituição existe, está
ativa, e o ator atua nela. Em seguida chama a fachada do `access`, que valida o que é do seu domínio:
o papel pedido cabe na cadeia de quem convida. A rota pública de aceitação vive no `access`.

_Por quê:_ é a regra de `add-institution-management`, decisão D1, aplicada. Ela também reparte a
validação onde cada dado mora: `institution` não conhece papéis, `access` não conhece instituições.

_Consequência prevista:_ quando a turma existir, RF-TUR-004 acrescenta uma rota de emissão no módulo
de turma, sobre o mesmo mecanismo. Nenhuma alteração no `access`, exceto o campo de vínculo com a
turma.

### D3 — O endereço do convite não é persistido; persiste-se sua derivação

Mesmo tratamento do meio de redefinição de senha (`add-session-authentication`, decisão D7): valor
aleatório entregue uma vez, derivação guardada, comparação por derivação.

_Por quê:_ um convite ativo é credencial — quem tem o endereço cria conta com o papel declarado.
Vazamento da tabela não pode entregar isso.

### D4 — A identificação da instituição viaja no convite como retrato, não como réplica

A consulta pública do convite precisa dizer para onde a pessoa está sendo convidada. Como `access` não
pode chamar `institution` (D2), a identificação é copiada para o convite no momento da emissão, por
quem emite.

_Por quê:_ é o menor mecanismo que resolve. Não é réplica no sentido de `ADR-0006` §6 a §8 — não é
mantida por eventos e não pretende refletir o estado atual; é um retrato do instante da emissão,
usado só para exibição.

_Trade-off aceito:_ instituição renomeada depois da emissão aparece com o nome antigo nos convites
pendentes. Dado o prazo curto de um convite, é irrelevante.

### D5 — A cadeia de não escalonamento é declarada em ponto único e é derivada, não elicitada

`SYSTEM_ADMIN → INSTITUTION_ADMIN → {COORDINATOR, PROFESSOR} → PROFESSOR → STUDENT`, declarada como
dado no `access`.

_Por quê:_ a cadeia não foi inventada — é a leitura das designações da URS: RF-INS-002 (administrador
de sistema designa administrador institucional), RF-CUR-002 (administrador institucional designa
coordenador), RF-TUR-002 (coordenador designa professor), RF-TUR-003 e RF-TUR-004 (professor cadastra
e convida aluno). O que não está na URS é o _convite_ como forma de fazê-lo, e é isso que o RF novo
precisa registrar.

_Nenhum papel concede `SYSTEM_ADMIN`_, por decisão explícita: a URS §1.4.1, item 1 diz que o primeiro
administrador de sistema vem da carga inicial e que não existe autocadastro para papel administrativo.
Admitir convite para esse papel contradiria a premissa.

_A ratificar._ Se a parte interessada quiser que o coordenador convide outro coordenador, ou que o
administrador institucional convide diretamente alunos, é alteração de uma linha na declaração — e do
RF.

### D6 — A aceitação não estabelece sessão

_Por quê:_ `ADR-0013` §18 proíbe módulo de criar sessão, e a rota de aceitação é do `access`. A
alternativa seria mover a aceitação para `shared/`, o que poria criação de conta — regra de negócio —
no kernel, contra `ADR-0009` §5. O usuário conclui o cadastro e autentica-se pelo fluxo comum.

### D7 — O uso do convite é decidido por escrita condicional, não por leitura seguida de escrita

O consumo do convite dirigido e o incremento do contador do convite aberto ocorrem por atualização
condicionada ao estado atual, dentro da transação que cria a conta.

_Por quê:_ ler "ainda está ativo" e depois gravar deixa janela para duas aceitações simultâneas do
mesmo convite dirigido criarem duas contas. A spec exige que exatamente uma vença, e só a escrita
condicional garante isso sem serializar a operação inteira.

### D8 — O primeiro acesso do administrador inicial sai na saída da carga, não da configuração

_Por quê:_ é o menor mecanismo que desbloqueia o sistema sem infraestrutura de e-mail e sem colocar
segredo em variável de ambiente, onde ele fica registrado em histórico de shell, em arquivo `.env` e
em log de processo. Um meio de uso único, apresentado uma vez a quem executou a carga, expira sozinho
se não for usado.

## Risks / Trade-offs

- **Convite aberto concedendo `PROFESSOR` é credencial de pé enquanto durar.** Quem obtiver o endereço
  vira professor da instituição. → Mitigado por prazo obrigatório, limite de usos opcional, revogação
  imediata e trilha de auditoria de cada aceitação. A recomendação operacional — não elicitada, e por
  isso não spec — é reservar a forma aberta ao papel `STUDENT` e usar a dirigida para os demais.
  Vale registrar isso no RF novo, se a parte interessada concordar.

- **Esta mudança exige alterar a URS antes de ser aplicada,** e a alteração muda a composição dos
  papéis em §2.3.1. → O teste de correspondência de `add-role-and-permission-catalog` vai reprovar até
  que a carga inicial acompanhe a URS. É o mecanismo funcionando: a ordem correta é URS, depois carga,
  depois código.

- **Rotas públicas que criam registro, sem limitação de taxa.** → A consulta do convite permite
  sondar endereços, e a aceitação cria contas. A entropia de 128 bits torna a adivinhação
  impraticável, mas a limitação de taxa continua necessária, e a questão já estava aberta desde
  `add-session-authentication`. Não bloqueia esta mudança; bloqueia a exposição do sistema.

- **A validação de escopo fica no `institution` e a de papel no `access`,** o que reparte uma decisão
  única em dois módulos. → É consequência direta da regra de módulo folha. O risco é uma das metades
  ser esquecida em uma rota futura de emissão; o teste de cada emissor é onde isso se pega, e a
  vertical de turma deve repeti-lo.

- **A conta criada pela aceitação recebe papel sem passar pela designação.** RF-INS-002, RF-CUR-002 e
  RF-TUR-002 designam a um escopo específico — curso, turma —, e o convite não faz isso. → O convite
  concede papel e vínculo institucional; o escopo fino continua sendo designação. Um coordenador
  convidado ainda precisa ser designado a um curso para agir. É coerente com `ADR-0014` §12, mas
  significa que o convite sozinho não completa o cadastro de ninguém acima de `STUDENT`.
