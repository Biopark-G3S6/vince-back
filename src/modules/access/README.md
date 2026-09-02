# Módulo `access`

Identidade e autorização (`ADR-0027`). Responde quem é o ator, por que meio ele prova sê-lo e o
que ele está autorizado a fazer. **Não** responde onde ele atua: o escopo vem do vínculo, e a
titularidade do registro é verificada dentro do caso de uso do módulo dono daquele registro
(`ADR-0014 §12`).

É **módulo folha** na dependência síncrona (`ADR-0027 §9`): todo módulo pode chamar a fachada
dele, e ele não chama a de ninguém. É o que impede ciclo com um módulo para o qual todos apontam.

## O que ele possui

Schema `access` no PostgreSQL. Tabelas declaradas em `access.prisma`:

| Tabela                  | Guarda                                               |
| :---------------------- | :--------------------------------------------------- |
| `permission`            | o catálogo das permissões reconhecidas pelo sistema  |
| `role`                  | os cinco papéis globais, pré-criados                 |
| `role_permission`       | a composição de cada papel                           |
| `user`                  | a conta de usuário e seu perfil                      |
| `user_role`             | a atribuição de papel a uma conta                    |
| `role_assignment_audit` | a trilha imutável de atribuição e revogação de papel |
| `password_credential`   | a credencial de senha da conta                       |
| `invitation`            | a via de uso único e com prazo por onde alguém entra |

`ADR-0027 §5` enumera ainda `permission_grant`, da vertical de delegação. Tabela fora dessa lista
**não** nasce aqui sem reescrever o ADR (`§6`).

### A credencial e o convite

`password_credential` tem a conta como chave primária: uma conta tem no máximo uma senha, e isso é
regra do banco, não convenção. **Não existe coluna que admita texto puro** — `hash` guarda a
derivação Argon2id, que já embute algoritmo, parâmetros e sal na própria cadeia. Por isso não há
coluna de sal nem de parâmetros: recalibrar o custo não exige migração, e a linha antiga continua
verificável com os parâmetros com que nasceu.

**A ausência de linha é estado válido e significativo:** conta criada por fluxo interno nasce sem
senha definida (`RF-TUR-003 RN3`, `RF-ACS-001 E4`).

**O meio de redefinição de senha vive em `invitation`**, e não em tabela própria. Não é acomodação:
`ADR-0027 §6` proíbe tabela não enumerada em §5, e a URS §2.4 dá a `RF-ACS-003` e a `RF-ACS-004` o
mesmo `INVITATION_EXPIRED` que dá ao convite de criação de conta — o parentesco está declarado lá.
`purpose` distingue os usos: `PASSWORD_RESET` hoje, `ACCOUNT_CREATION` com `RF-TUR-005`.

O valor entregue ao usuário **não é persistido**: persiste-se a sua derivação. Vazamento da tabela
não entrega acesso a ninguém. A derivação é SHA-256, e não Argon2id — o segredo tem 256 bits de
aleatoriedade, que nenhuma força bruta alcança, e a derivação lenta usaria sal por linha, o que
impediria procurar pelo valor derivado e obrigaria a percorrer a tabela a cada tentativa de uso.

`used_at` nulo é "ainda não usado", e é o que o consumo verifica **na mesma instrução em que grava**:
é assim que o uso único sobrevive a duas requisições simultâneas.

### A conta

O e-mail é o identificador único global (`RF-ACS-001 RN1`), gravado **já normalizado** — sem
espaços nas extremidades e em minúsculas. É por isso que o índice único basta como regra: não há
duas grafias do mesmo endereço no índice, e nenhuma consulta precisa lembrar de normalizar.

`active` **não é exclusão lógica** (`ADR-0018 §18`). `RF-ACS-001 E2` lhe dá significado de
negócio — conta desativada não autentica — e por isso **nenhuma consulta o filtra
implicitamente**: cada uma decide, explicitamente, se ele importa. A desativação não remove a
conta, não remove os vínculos de papel e **não libera o e-mail**.

`institution_id` é coluna de identificador indexada, **sem chave estrangeira**, porque a
instituição pertence a outro módulo (`ADR-0027 §8`, `ADR-0018 §13`, `§14`). É nulo apenas para o
papel `SYSTEM_ADMIN`, que atua sobre todas as instituições — regra de caso de uso, não de schema.

**Dívida declarada:** o vínculo institucional fica **sem validação de existência** e sem a regra
`INSTITUTION_INACTIVE` de `RF-INS-001 RN2` até que o módulo de instituição exista. Até lá, o
único produtor de contas é a carga inicial, que não informa vínculo. **A vertical de instituição
tem de fechá-la.**

### A trilha de auditoria

`role_assignment_audit` é **imutável** (`ADR-0014 §18`): não existe, no módulo, operação que
altere ou remova um registro gravado. `RoleAssignmentAuditRepository` só lê; o acréscimo acontece
dentro da transação de `RoleAssignmentRepository`, que é o único ponto que escreve nela. A
gravação é **na mesma transação** da atribuição ou da revogação (`ADR-0019 §1`) — é o que garante
que a falha não deixe rastro parcial.

Não há chave estrangeira para `user` nem para `role`: a trilha precisa sobreviver ao que
documenta, e `ON DELETE CASCADE` a apagaria junto. Ela guarda também o código textual do papel,
para permanecer legível se o catálogo mudar.

## O que a fachada expõe

`AccessFacade`, em `contracts/`:

| Operação                              | Faz                                                            |
| :------------------------------------ | :------------------------------------------------------------- |
| `permissionsOfRoles`                  | a união das permissões de um conjunto de papéis, sem repetição |
| `createUser`                          | cria conta pelos fluxos internos; nasce ativa e sem credencial |
| `findOwnProfile` / `updateOwnProfile` | o perfil do **titular**, com papéis e vínculo (`RF-ACS-005`)   |
| `deactivateUser` / `activateUser`     | leva a conta ao estado, preservando vínculos e e-mail          |
| `assignRole` / `revokeRole`           | atribui e revoga papel, **idempotentes**, com trilha           |
| `effectivePermissions`                | apura as permissões efetivas da conta, com cache               |
| `verifyCredential`                    | confere e-mail e senha; devolve a conta, ou `null`             |
| `changeOwnPassword`                   | altera a senha do titular, exigindo a atual                    |
| `requestPasswordReset`                | emite o meio de redefinição, ou `null` se não houver a quem    |
| `resetPassword`                       | define a senha por meio de redefinição, sem exigir a atual     |

Os códigos de papel, de permissão e de falha atravessam a fronteira como **texto opaco**
(`ADR-0027 §14`). O tipo estreito — `PermissionCode`, `RoleCode`, `FailureCode` — vive em
`domain/` e não sai do módulo, porque `contracts/` não pode importar `domain/` e `domain/` não
pode importar `contracts/`.

A falha volta como `AccessResult`, com o código do catálogo da **URS §2.4** e, na validação, um
item por campo — **sem o valor submetido** (`ADR-0025 §18`, `PAD-SEG-025`). Não é exceção do
NestJS: não há HTTP nesta vertical, e a classificação na aplicação faz do controller da vertical
seguinte uma tradução de código para status, e nada mais.

A fachada **não** tem operação de escrita sobre papel, permissão ou composição, e não terá:
o catálogo é imutável em tempo de execução (`ADR-0027 §13`, `ADR-0014 §7`). Também **não** tem
CRUD administrativo de usuário: não existe requisito funcional que o origine, e o catálogo §2.3
não declara permissão alguma sobre o recurso de usuário — criá-la violaria `ADR-0014 §7` e
`PAD-SEG-008`. `createUser` é operação de **consumidor interno**, para os fluxos que a URS já
especifica: a carga inicial, `RF-TUR-003` e `RF-TUR-005`.

### A senha e o tempo

`verifyCredential` devolve `null` para conta inexistente, senha incorreta, conta desativada e conta
sem senha definida — **os quatro casos, sem distinção** (`RF-ACS-001 E1`, `E2`). E o custo dos quatro
é o mesmo: o caso de uso deriva **exatamente uma vez** em todos os caminhos, contra a derivação de
referência quando não há hash contra que conferir.

Responder depressa é responder. Sair do caminho antes de gastar o tempo entregaria, pelo relógio, a
existência da conta — que é a informação que o texto da resposta se esforça por esconder. O mesmo
vale para `requestPasswordReset`, que gasta o custo de uma derivação antes de qualquer decisão.

A verificação disso não é por relógio — `ADR-0024 §24` proíbe teste por limiar de tempo no comando de
verificação, e ele seria intermitente. O que o teste conta é a **causa**: uma derivação por caminho.
Um retorno antecipado derruba a contagem a zero e reprova.

## As rotas deste módulo

| Rota                      | Acesso  | Requisito                  |
| :------------------------ | :------ | :------------------------- |
| `GET /profile`            | sessão  | `RF-ACS-005`               |
| `PATCH /profile`          | sessão  | `RF-ACS-005`, `RF-INT-001` |
| `PUT /password`           | sessão  | `RF-ACS-004`               |
| `POST /password/recovery` | público | `RF-ACS-003`               |
| `POST /password/reset`    | público | `RF-ACS-004`               |

**Nenhuma exige permissão**, e isso é a regra e não a falta dela: os requisitos de origem declaram
"Permissões geradas: —". A titularidade é verificada dentro do caso de uso (`ADR-0014 §12`) e não é
modelada como permissão (§13); inventar `USER:READ_SELF` produziria permissão sem requisito que a
origine (§7).

**A revogação de sessões acontece na apresentação, não no caso de uso.** Sessão é mecanismo
transversal de `shared/`, e `ADR-0013 §18` proíbe módulo de criá-la, lê-la ou invalidá-la por conta
própria. O módulo altera a credencial; a borda, que conhece o mecanismo, encerra o que a alteração
invalidou — e sempre nessa ordem: inverter derrubaria as sessões de quem, no fim, não conseguiu
trocar a senha.

O que cada uma derruba: `PUT /password` encerra as **demais** sessões e preserva a corrente
(`RF-ACS-004 RN2`); `POST /password/reset` encerra **todas**.

**Dívida declarada:** `POST /password/recovery` cria o meio de redefinição e ele **não chega ao
destinatário**. O envio depende de correio eletrônico, que depende de outbox (`ADR-0021`), fila
(`ADR-0020`) e catálogo de mensagens (`ADR-0026 §18`) — nada disso existe. `RF-ACS-003` fica entregue
**exceto pelo envio**. O valor emitido volta pela fachada para que a vertical de notificação o
entregue, e **não** é devolvido em resposta HTTP nem escrito em log.

## Titularidade não é permissão

O perfil próprio não gera permissão alguma: `RF-ACS-005` declara "— (próprio perfil)". O caso de
uso recebe o identificador do ator e o do alvo e recusa com `PERMISSION_DENIED` quando diferem
(`ADR-0014 §12`, `§13`). Modelar `USER:UPDATE_SELF` produziria permissão sem requisito de origem.

Alterar o próprio e-mail, os próprios papéis ou os próprios vínculos recusa a operação
**inteira** com `PERMISSION_DENIED`, e não com `VALIDATION_FAILED`: o campo existe e o valor pode
até ser válido — o que falta é autoridade.

## Permissões efetivas e seu cache

A apuração é **união de origens** (`RF-ACS-001 RN2`, `ADR-0014 §5`), com uma origem implementada:
os papéis. `PermissionGrant` entra depois como segunda origem, **sem alterar a assinatura da
consulta** — a autenticação já estará consumindo esta superfície, e mudá-la seria quebra de
contrato (`ADR-0004 §11`).

Conta inativa e conta inexistente devolvem o **conjunto vazio**, e a apuração não falha: quem
pergunta é a borda de autorização, e um conjunto vazio já nega tudo que houver a negar.

O cache vive em Redis, sob a chave `access:permissions:<id>` (`ADR-0020 §6`), e é invalidado a
cada escrita que altere papel ou estado — **não por expiração** (`ADR-0014 §10`): uma janela de
validade é exatamente o intervalo em que permissão revogada continuaria valendo. O prazo de uma
hora é rede de segurança, não mecanismo.

**A indisponibilidade do cache faz a apuração falhar** (`ADR-0013 §16`, `ADR-0014`, implicação 3).
Não há modo degradado. Devolver conjunto vazio pareceria seguro e não seria: negaria acesso
legítimo em massa e esconderia a queda.

## O que a carga inicial garante

`pnpm run db:seed` executa `AccessModule.seed`, que carrega o catálogo e **depois** a conta
inicial — nesta ordem, porque a conta se vincula a um papel que precisa existir.

Do catálogo, reconciliando o estado gravado com a declaração de `domain/`:

- as 98 permissões da URS §2.3 existem, cada uma no formato `RECURSO:ACAO`;
- os cinco papéis da URS §1.4 existem, com a composição de §2.3.1 enumerada permissão a
  permissão, sem curinga;
- reexecutar não duplica nada e **não altera identificador já gravado** — a chave da
  reconciliação é o `code`, e a chave primária é o UUIDv7 gerado pela aplicação;
- retirar uma permissão da composição de um papel a remove do papel na reexecução seguinte, e a
  permissão continua no catálogo;
- declaração inválida — curinga, minúscula, recurso no plural, papel fora dos cinco, permissão
  inexistente — reprova a carga **por inteiro**, antes de qualquer gravação.

Da conta inicial (`URS §1.4.1`, item 1):

- existe uma conta de papel `SYSTEM_ADMIN`, **ativa, sem vínculo institucional e sem credencial
  definida** — a senha é dado de autenticação e nasce na vertical seguinte;
- a reexecução **reencontra pelo e-mail** e preserva o identificador já gravado, em vez de criar
  a segunda conta;
- a atribuição do papel entra na trilha de auditoria **sem ator**: a carga não tem quem a execute.

Entre esta vertical e a próxima, o sistema tem um administrador que **não entra**. É deliberado:
semear senha por variável de ambiente poria segredo no caminho da carga inicial sem necessidade.
Não há autocadastro que produza papel administrativo, aqui nem em lugar algum.

A carga entra por método estático de `AccessModule`, e não por script fora de `src/`
(`ADR-0027 §21`): fora de `src/` a importação escaparia da análise de fronteiras do ESLint, o que
seria conformidade aparente, não real. O mesmo vale para `AccessModule.declaredCatalog()`, que é
como o comando de conferência alcança o catálogo sem que o composition root importe `domain/`.

## O catálogo é declarado uma vez

`domain/permission-catalog.ts` e `domain/role-catalog.ts` são a declaração única do repositório
(`ADR-0027 §17`). A carga grava a partir dela, os testes conferem contra ela e o código que
exigir uma permissão referencia o símbolo, nunca o literal.

A URS continua sendo a origem: nenhuma permissão existe sem requisito funcional que a produza
(`ADR-0014 §7`), e o requisito de origem de cada uma está no comentário ao lado dela. A
correspondência entre as duas cópias é conferida por `pnpm run docs:check-catalog` — que confere
também o catálogo de códigos de resposta de `shared/` contra a URS §2.4 —, e que fica
fora de `pnpm run verify` porque depende do submódulo `docs/` (`ADR-0027 §19`). **Execute-o na
revisão de qualquer alteração do catálogo** — é a única proteção contra a divergência.

## Cliente Prisma

O módulo nunca recebe a instância não escopada. `AccessModule.forRoot` recebe do composition root
a instância única do processo (`ADR-0010 §7`) — e a conexão única de Redis (`ADR-0020 §4`) — e
estende o cliente para os seus models (`infrastructure/access-prisma.ts`). A proteção é dupla porque uma metade não bastaria: o tipo
exposto é a projeção dos models próprios — `assinaturaErro`, do módulo `observabilidade`, não
existe nele — e o gancho de consulta recusa, em execução, operação sobre model alheio.

Consulta em SQL bruto não passa pelo gancho; `ADR-0010 §14` a submete à revisão de código.
