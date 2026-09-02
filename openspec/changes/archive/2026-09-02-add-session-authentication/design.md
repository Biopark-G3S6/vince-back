## Context

As duas verticais anteriores não publicaram rota alguma: `src/shared/` ainda é um esqueleto de
diretórios vazios e `src/main.ts` configura CORS e prefixo de versão sobre uma aplicação sem
controllers. Esta mudança é, ao mesmo tempo, a vertical de autenticação e a primeira ocupação real do
kernel transversal — e o que ela fixar em envelope, correlação e tratamento de erro passa a valer
para todo endpoint que o sistema vier a ter.

Restrições que moldam o desenho: `ADR-0013` inteiro (sessão opaca, cookie, prazos, CSRF, localização
em `shared/`), `ADR-0014` §9 a §14 e §22 e §23 (verificação na borda, titularidade no caso de uso,
mecanismo transversal), `ADR-0009` §4 a §6 (o que pode viver em `shared/` e que ele nunca importa de
`modules/`), `ADR-0025` inteiro, `ADR-0022` §1 a §15, `ADR-0017` §1 a §13 e `ADR-0026` §13 a §17
(a API não devolve texto de exibição).

Para a motivação, ver `proposal.md` — Why. Para o contrato, ver os quatro arquivos em `specs/`.

## Goals / Non-Goals

**Goals:**

- Tornar o sistema utilizável de ponta a ponta pela primeira vez: entrar, ver quem se é, sair.
- Fixar o envelope, os códigos e a correlação de modo que endpoint nenhum precise redecidi-los.
- Deixar a guarda de borda declarativa, para que a rota que a esquecer não seja servida.

**Non-Goals:**

- Envio de mensagem por correio eletrônico, registro agregado de erros em tabela, fila e outbox.
- Elevação de privilégio e a regeneração de sessão que ela exige (`ADR-0013` §12, segunda hipótese):
  não existe operação de elevação no sistema.
- Paginação. `ADR-0025` §21 a §25 a exige em listagem, e esta vertical não publica listagem alguma;
  a capacidade `api-response-contract` a receberá quando a primeira listagem existir.

## Decisions

### D1 — A sessão vive em `shared/`, e o que ela precisa saber do usuário chega por port abstrato

`ADR-0013` §17 põe a autenticação em `shared/`; `ADR-0009` §6 proíbe `shared/` de importar de
`modules/`; e verificar uma senha exige ler a credencial, que é dado do módulo `access`. A saída é
`shared/` declarar duas `abstract class` — a verificação de credencial e a resolução de permissões
efetivas — e o composition root ligá-las às implementações que o módulo `access` fornece por sua
fachada.

_Por quê:_ é a única composição que satisfaz os três ADRs ao mesmo tempo. `app` pode importar
`shared` e `contracts` (a configuração do ESLint já é assim), e a dependência continua apontando para
dentro.

_Alternativas consideradas:_ pôr a autenticação no módulo `access` — contraria `ADR-0013` §17 e §18
diretamente; pôr a credencial em `shared/` — contraria `ADR-0009` §5, que proíbe dado de módulo ali.

### D2 — Derivação de senha com Argon2id

Parâmetros declarados em configuração, com os valores iniciais fixados no código e ajustáveis por
ambiente.

_Por quê:_ nenhum ADR fixa o algoritmo, o que torna isto decisão desta mudança. Argon2id é a
recomendação corrente para senha nova, e o parâmetro de memória é o que mantém o custo do atacante
alto. A alternativa usual, `bcrypt`, tem limite de 72 bytes de entrada — o que obrigaria a
pré-processar a senha antes de derivar, e é exatamente o tipo de detalhe que se esquece.

_Trade-off aceito:_ Argon2id consome memória por verificação, o que faz do endpoint de autenticação o
mais caro do sistema. O parâmetro precisa ser calibrado contra a máquina real, não adivinhado.

### D3 — A política de senha é comprimento mínimo, sem regra de composição

Valores iniciais: mínimo de 12 caracteres, máximo de 128, sem exigência de maiúscula, dígito ou
símbolo. Declarados em ponto único, como a spec exige.

_Por quê:_ a URS não define a política — RF-ACS-004 E1 apenas a pressupõe. Regras de composição
empurram o usuário para padrões previsíveis sem aumentar a entropia real, e o comprimento é o fator
que de fato importa. O máximo existe para limitar o custo da derivação, não a segurança.

_A confirmar com as partes interessadas._ É decisão de produto tomada por ausência; se a instituição
tiver política própria, ela prevalece e vira alteração de um ponto.

### D4 — Guarda global com declaração obrigatória por rota

A guarda é registrada globalmente e recusa servir rota que não declare a permissão exigida nem se
marque explicitamente como pública. A declaração é metadado da rota, verificado na inicialização.

_Por quê:_ a falha típica de guarda por rota é a rota nova que esquece de declarar — e ela falha
aberta, sem erro. Exigir declaração explícita, inclusive para o caso público, faz o esquecimento
falhar fechado e na inicialização, não em produção. `ADR-0014` §11 exige a verificação na borda; não
exige que ela seja fácil de esquecer.

_Alternativa considerada:_ guarda aplicada por decorador em cada controller — mais explícita na
leitura, mas o esquecimento continua invisível.

### D5 — A tradução do código de resposta é do cliente; o backend só emite código

Nenhuma resposta desta vertical carrega texto redigido para exibição. `status.message` fica reservado
ao texto de reserva de `ADR-0025` §10, e os valores a interpolar viajam em `errors[].meta`.

_Por quê:_ `ADR-0026` §13 a §17 e `PAD-NOM-006` são explícitos. A consequência prática é que cada
código emitido aqui — `AUTHENTICATION_FAILED`, `VALIDATION_FAILED`, `PERMISSION_DENIED`,
`INVITATION_EXPIRED`, `RESOURCE_NOT_FOUND`, `LANGUAGE_NOT_SUPPORTED` — precisa de chave correspondente
no catálogo de tradução do frontend (`PAD-NOM-008`), o que é trabalho do outro repositório e deve ser
comunicado.

### D6 — Indistinguibilidade tratada como requisito de tempo, não só de conteúdo

Os três casos que a spec manda tornar indistinguíveis — credencial inválida, conta inexistente e
conta sem senha; e-mail cadastrado e não cadastrado na recuperação — exigem que o caminho caro seja
percorrido também no caso negativo.

_Por quê:_ responder o mesmo texto em tempos diferentes revela a mesma informação. Na autenticação,
isso significa derivar contra um hash de referência quando a conta não existe; na recuperação,
significa não encurtar o caminho.

_Trade-off aceito:_ trabalho gasto deliberadamente em requisição que vai falhar, e um endpoint de
recuperação que precisa de limitação de taxa para não virar meio de exaustão. A limitação de taxa não
está em ADR algum e fica registrada como questão em aberto.

### D7 — O meio de redefinição é registro no banco, com o valor guardado derivado

O valor entregue ao usuário é aleatório e não é persistido; persiste-se sua derivação, junto de conta,
prazo e instante de uso.

_Por quê:_ o meio de redefinição é equivalente a uma senha temporária — vazamento da tabela não pode
entregar acesso. Guardá-lo no banco, e não no Redis, o mantém auditável e sobrevive a reinício do
cache; e o volume é desprezível.

_A tabela é `invitation`, e não uma tabela própria._ Apurado na implementação: `ADR-0027` §6 proíbe
tabela não enumerada em §5, e `password_reset_token` não está lá. A URS confirma o parentesco em vez
de apenas tolerar a acomodação — §2.4 dá a RF-ACS-003 e a RF-ACS-004 o **mesmo** `INVITATION_EXPIRED`
que dá ao convite de criação de conta de RF-TUR-005. `purpose` distingue os usos, como enumeração de
negócio em texto (`ADR-0018` §19): `PASSWORD_RESET` agora, `ACCOUNT_CREATION` quando RF-TUR-005
existir. Não altera comportamento observável, e por isso não altera spec alguma.

_A derivação guardada é SHA-256, e não Argon2id._ Argon2id existe para encarecer o ataque a segredo
de baixa entropia — uma senha escolhida por alguém. Aqui o segredo tem 256 bits de aleatoriedade:
força bruta não o alcança, e a derivação lenta usa sal por linha, o que impediria procurar pelo valor
derivado e obrigaria a percorrer a tabela a cada tentativa de uso.

## Risks / Trade-offs

- **RF-ACS-003 fica entregue sem o envio da mensagem.** → Consequência aceita e nomeada na proposta. O
  efeito prático é que a recuperação de acesso não funciona para o usuário final até a vertical de
  notificação existir, e que o `SYSTEM_ADMIN` da carga inicial continua sem via de entrada. Para
  desbloquear a operação enquanto isso, a vertical de notificação deve vir logo depois desta, ou a
  carga inicial deve ganhar uma forma explícita de definir a primeira senha.

- **Esta é a maior das três verticais e acumula duas coisas distintas.** → A divisão em fundação HTTP
  e autenticação não altera as specs; se a execução mostrar que o pull request ficou grande demais
  para revisão, dividir é seguro e não exige repropor.

- **Argon2id é dependência nativa.** → Precisa compilar ou ter binário pronto para a plataforma, o
  que afeta o workflow do GitHub Actions e a máquina de cada pessoa. Verificar na primeira tarefa,
  não no fim.

- **A guarda global recusando rota sem declaração pode bloquear rota de infraestrutura** — saúde e
  métricas, que `ADR-0025` §2 já exclui do envelope. → Elas precisam da marcação explícita de acesso
  público; é o próprio mecanismo, funcionando.

- **`INSTITUTION_INACTIVE` continua sem verificação na autenticação.** → Dívida herdada. Enquanto o
  módulo de instituição não existir, RF-ACS-001 E3 não é satisfeito, e a vertical de instituição
  precisa fechá-lo alterando o caso de uso de autenticação — o que é acoplamento a declarar agora, e
  não a descobrir depois.

## Open Questions

Ambas ficaram **registradas como pendências rastreáveis** ao fim da implementação, em
`docs/ADR/README.md` — "Decisões pendentes" —, que é onde o repositório as procura. Ambas têm efeito
observável no cliente, e o comportamento esperado da interface diante de cada uma está declarado em
`docs/front-end-implementations.md`.

- **Limitação de taxa** na autenticação e na solicitação de recuperação. Nenhum ADR a trata e nenhum
  requisito a pede; sem ela, os dois endpoints são meio de enumeração e de exaustão — agravado pela
  decisão D6, que gasta de propósito o custo de uma derivação Argon2id por requisição em ambos. Não
  altera as specs desta mudança — é acréscimo na borda —, mas deve virar decisão registrada antes de
  o sistema ser exposto. Enquanto não existir, a interface não deve repetir automaticamente, e
  precisa recair em `status.message` diante de código não reconhecido, para que a limitação entre em
  produção sem quebrá-la.
- **Chave de assinatura do token anti-CSRF**: origem e rotação. Não altera comportamento observável
  em regime; entra na configuração. A rotação, porém, invalida o token de **todas** as sessões vivas
  de uma vez, sem desautenticá-las: requisições de alteração passam a responder `403` enquanto as de
  leitura seguem. A interface reconsulta o endpoint de identidade — que reemite o cookie do token — e
  repete a requisição **uma** vez.
