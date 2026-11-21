# Integração frontend ↔ backend — funcionalidades pendentes

Levantamento de 2026-11-15, feito contra a `main` (`3151e82`), comparando os 71 requisitos da
[URS](docs/Requisitos/URS.md) com as rotas e o código existentes.

## Intenção

Vamos integrar o frontend (`vince-front`) ao backend. Para cada funcionalidade abaixo, que ainda
**não está implementada ou está incompleta no backend**:

1. **Procurar a tela correspondente no frontend.**
2. **Se a tela existir:** implementamos o que falta no backend e integramos a tela a ele.
3. **Se a tela não existir:** a funcionalidade fica registrada aqui como **adiada** e não é feita
   agora.

O backend continua seguindo o ciclo normal do repositório: uma mudança OpenSpec por
funcionalidade (`/opsx:propose` → `/opsx:apply` → `/opsx:archive`) e os ADRs e padrões vigentes.
A integração não justifica atalho no contrato da API (`ADR-0017`, `ADR-0025`).

Além disso, as telas **já integráveis** (funcionalidades completas no backend) também serão
conferidas e integradas no mesmo processo. Esta lista cobre só o que ainda depende de trabalho no
backend.

## Pendências

A coluna **Tela no front** começa como `a verificar`. Ao conferir, use: `existe`, `não existe`,
`parcial`. A coluna **Decisão** recebe `integrar` ou `adiar`.

### 1. Bloqueante — criação do artigo

| Requisitos                                                        | Situação no backend                                                                                                                                                                                | Tela no front            | Decisão                                     |
| :---------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------- | :------------------------------------------ |
| Todo o fluxo do artigo (`ART`, `EDT`, `REV`, `DSC`, `IAA`, `ACP`) | `ArticleFacade.createArticle` existe, mas **nada o chama** fora dos testes: não há rota nem consumidor de `TeamCreated`. Sem artigo criado, nenhuma tela do artigo funciona contra o backend real. | — (não tem tela própria) | **fazer primeiro** (`article-follows-team`) |

**O que falta:** um consumidor de `TeamCreated` no módulo `article` que crie o artigo da equipe
(um artigo por equipe — `article.team_id` já é único). Não depende do frontend: é pré-requisito
para integrar qualquer tela do artigo.

### 2. Funcionalidades ausentes

| Requisito    | Funcionalidade                            | Situação no backend                                                                                         | Tela no front                     | Decisão                            |
| :----------- | :---------------------------------------- | :---------------------------------------------------------------------------------------------------------- | :-------------------------------- | :--------------------------------- |
| `RF-ACS-006` | Conceder permissão a outro usuário        | Sem endpoint. O cálculo de permissões efetivas já considera concessões, mas não há como criá-las.           | existe (`AccessAccountPage`)      | integrar (`permission-delegation`) |
| `RF-ACS-007` | Revogar concessão de permissão            | Sem endpoint.                                                                                               | existe (`AccessAccountPage`)      | integrar (`permission-delegation`) |
| `RF-ACS-008` | Consultar concessões diretas ativas       | Sem endpoint.                                                                                               | existe (`AccessAccountPage`)      | integrar (`permission-delegation`) |
| `RF-REV-003` | Encerrar a entrega no vencimento do prazo | A entrega automática existe no modelo (`automatic`), mas nenhum agendamento a dispara quando a etapa vence. | não se aplica (processo de fundo) |                                    |

### 3. Pendentes na mudança `implement-discussion-assistance-progress`

Mudança OpenSpec aberta, com 16 de 23 tarefas feitas
([tasks.md](openspec/changes/implement-discussion-assistance-progress/tasks.md)).

| Requisito                  | Funcionalidade                                                      | Tarefa | Situação no backend                                                                                                                                                                              | Tela no front | Decisão |
| :------------------------- | :------------------------------------------------------------------ | :----- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------ | :------ |
| `RF-IAA-002`               | Verificar a conformidade do artigo à norma (ABNT)                   | 3.1    | Rota existe (`/articles/:id/compliance-checks`), mas a verificação estruturada com a localização das divergências não está concluída.                                                            | a verificar   |         |
| `RF-ACP-002`               | Acompanhar os eventos e as equipes do curso (painel da coordenação) | 4.2    | Rota existe (`/courses/:id/progress`); falta o recorte por curso, a agregação por evento e o detalhe das equipes.                                                                                | a verificar   |         |
| `RF-ACP-005`               | Gerar o relatório de produção do curso                              | 4.5    | Rota existe (`/courses/:id/reports`); falta responder todas as perguntas do requisito e tratar período sem dados.                                                                                | a verificar   |         |
| `RF-IAA-001`, `RF-IAA-005` | Resumo por IA e consentimento                                       | 1.4    | Rotas existem; **o envio ao serviço externo continua bloqueado** até a decisão sobre serviço, dados enviados, texto do consentimento e base legal. Decisão das partes interessadas, não técnica. | a verificar   |         |

Também ficam abertas nessa mudança as tarefas 1.2 (ADRs dos módulos `discussion`, `notification`,
`assistance` e `progress`, exigidos pelo `ADR-0003 §12`) e 5.2 (sincronizar e arquivar). Elas não
têm tela, mas precisam estar resolvidas antes de arquivar a mudança.

### 4. Parciais — confirmar na integração

| Requisito    | Funcionalidade                                   | Situação no backend                                                                                                                                                            | Tela no front | Decisão |
| :----------- | :----------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------ | :------ |
| `RF-EDT-002` | Editar simultaneamente com os demais integrantes | Há registro de presença (`/articles/:id/presence`) e gravação de conteúdo, mas nada que envie ao vivo as alterações dos outros integrantes. Ver o que a tela do editor espera. | a verificar   |         |
| `RF-INT-001` | Selecionar o idioma da interface                 | O backend guarda a preferência no perfil; o restante é do frontend.                                                                                                            | a verificar   |         |

## Pendências de documentação (sem tela)

- O módulo `article` não tem spec OpenSpec vigente.
- O `ADR-0030` descreve um modelo de nota e publicação diferente do implementado: precisa
  reconciliar o ADR com o código.

Não bloqueiam a integração, mas devem ser resolvidas em mudança própria.

## Rodada de integração de 2026-11-15 (ACS, INS, CUR, TUR, EVT, EQP, ART)

### Mudanças OpenSpec abertas para o backend

| Mudança                  | Lacuna                                                                            |
| :----------------------- | :-------------------------------------------------------------------------------- |
| `article-follows-team`   | Artigo criado no `TeamCreated`; integrantes e orientador do artigo sincronizados  |
| `article-listing`        | `GET /articles` com filtros; orientador do evento alcança todas as equipes (RN3)  |
| `permission-delegation`  | `RF-ACS-006` a `008`: concessão, revogação, consulta; origem `GRANT` nas efetivas |
| `user-directory`         | `GET /users`: escolher pessoa nas designações e resolver nomes de `userId`        |
| `cohort-read-extensions` | `GET /cohorts/:id/professors`; validade, situação e usos na lista de convites     |
| `team-read-extensions`   | `responsibleAdvisorId` na equipe; `GET /team-invitations` (convites recebidos)    |

### Triagem dos campos do frontend sem correspondência direta

Legenda: **(a)** existe com outro nome — mapear; **(b)** derivável de rota existente — o front
compõe; **(c)** coerente com URS/ADR — estender o backend; **(d)** contradiz ou não consta da
URS/ADR — sai da tela.

| Tela        | Campo do front                                   | Classe | Destino                                                       |
| :---------- | :----------------------------------------------- | :----- | :------------------------------------------------------------ |
| Instituição | `acronym`, `legalId`, `domain`, `supportEmail`   | (a)    | `code`, `cnpj`, `website`, `contactEmail`                     |
| Instituição | `admins`                                         | (b)    | `GET /users?role=INSTITUTION_ADMIN&institutionId=`            |
| Instituição | `city`, `state`                                  | (c\*)  | `institution-location`                                        |
| Instituição | `coursesActive`                                  | (d)    | o administrador de sistema não lê cursos                      |
| Curso       | `code`, `status`, `coordinator`                  | (a/b)  | `identification`, `active`, `coordinatorId` + diretório       |
| Curso       | `classes`, `events`, `students` (contagens)      | (d)    | custo de N requisições por linha; sai                         |
| Turma       | `name`, `startDate`, `endDate`, `status`         | (a/b)  | `identification`, `startsAt`, `endsAt`, `active` + datas      |
| Turma       | `professors`, `invitations`                      | (c)    | `cohort-read-extensions`                                      |
| Evento      | `scope`, `title`, `theme`, limites, `milestones` | (a)    | contrato atual; o front passa a pedir problema e objetivos    |
| Evento      | `templateId`                                     | (a)    | `POST /article-template-selections`                           |
| Evento      | `registrationOpen`, `registrationDeadline`       | (d)    | contradiz `RF-EVT-001` RN2 (sem inscrição prévia)             |
| Evento      | `kind`, avaliador com `expertise`/`invited`      | (d)    | sai; avaliadores viram orientadores do evento (`RF-EVT-003`)  |
| Equipe      | `name`, `members`, `responsibleAdvisor`          | (a/c)  | `identification`, membros + diretório, `team-read-extensions` |
| Equipe      | papel `Líder/Autor/Coautor`, título do artigo    | (c\*)  | `team-member-role`, `article-title-and-feedback`              |
| Artigo      | nota, notas por integrante, publicação, situação | (a)    | `assessments`, `member-assessments`, `publications`, status   |
| Artigo      | parecer textual (`feedback`)                     | (c\*)  | `article-title-and-feedback`                                  |

**(c\*)** — campo fora da URS v0.4, estendido no backend por decisão do usuário em 2026-11-15.
**Pendente de ratificação na URS** (`vince-docs`): cidade/UF da instituição, título do artigo,
parecer da nota do artigo e papel do integrante.

Em 2026-11-18, também por decisão do usuário, `INSTITUTION:READ` passou a compor
`INSTITUTION_ADMIN`, `COORDINATOR`, `PROFESSOR` e `STUDENT`, com a nova regra `RF-INS-001` RN4 (o
vinculado lê só a própria instituição), para a tela "Meu acesso" exibir o nome da instituição. A
URS publicada ainda não traz essa composição: **pendente de ratificação** em `vince-docs`
(`pnpm run docs:check-catalog` aponta a diferença).

Todas as mudanças acima foram implementadas e arquivadas em `openspec/changes/archive/2026-11-15-*`.

### Defeitos encontrados na integração (corrigidos)

| Mudança                         | Defeito                                                                                                                |
| :------------------------------ | :--------------------------------------------------------------------------------------------------------------------- |
| `csrf-token-readable-by-client` | O cookie anti-CSRF tinha `Path=/api/v1`, e a aplicação, em `/admin/...`, não conseguia lê-lo. Toda mutação dava `403`. |
| `cohort-read-by-members`        | `COHORT:READ` do professor e do aluno não alcançava turma alguma; o professor não chegava à matrícula nem ao convite.  |

### Resultado

As sete telas falam com o backend real e foram verificadas por 26 testes Playwright contra a pilha
local (`vince-front/e2e/integration`, `pnpm run test:integration`).

### Fora desta rodada

- ~~O coordenador lê todos os artigos da instituição~~ — corrigido em `article-course-scope`
  (2026-11-21).
- As telas de editor, revisão, discussão e assistência continuam nos mocks e não enxergam os
  artigos reais.
- O seed (`pnpm run db:seed`) imprime o resultado, mas o processo não termina, porque alguma conexão
  fica aberta após `context.close()`.
- O código do curso não é único (o mock do frontend impedia duplicata; a URS não exige).
- O backend aceita e-mail com acento antes do `@`, que o campo `type="email"` do navegador recusa.
- O administrador de sistema só convida `INSTITUTION_ADMIN`; professores e alunos entram por convite
  do administrador institucional ou da turma.
- A etapa corrente do artigo é gravada na criação da equipe (ou na primeira sincronização), mas não
  avança sozinha quando a etapa vence: fica para a entrega automática de `RF-REV-003`.
- `src/features/review/api/newArticle.spec.ts`, no frontend, já falhava na `main`, na área de
  revisão, que continua em demonstração.

## Auditoria do contexto de acesso (2026-11-18)

Todas as funções de `RF-ACS-001` a `009` foram exercitadas pela tela contra o backend. Ficam fora da
apresentação, por decisão do usuário:

- `POST /password/recovery` não envia o e-mail (dívida declarada no README do módulo `access`); a
  tela informa "Solicitação registrada", mas o link não chega.
- Por consequência, a conta criada por matrícula (`RF-TUR-003`), que nasce sem senha, não consegue
  entrar (`RF-ACS-001` E4).

Corrigidos: idioma de prévia oculto dos seletores (o backend só aceita `pt-BR`); nome da instituição
na sessão (`institution-read-by-members`); resumo das permissões efetivas reais; filtro "Usuário a
revisar" nas concessões (`RF-ACS-008`); `/entrar` com sessão ativa leva ao painel.

A carga inicial grava os vínculos de papel novos, mas não invalida o cache de permissões efetivas
(Redis, TTL de 1 hora): no ambiente local, as contas já autenticadas só recebem a permissão nova
depois de expirar o cache ou de limpá-lo.

## Auditoria do contexto de instituição (2026-11-18)

Todas as rotas de `RF-INS-001` e `002` passaram a ser usadas pela tela, inclusive a lista e a
revogação de convites. Corrigidos:

- `institution-admin-by-invitation`: o convite de administrador institucional aceito não criava o
  vínculo com a instituição, e a revogação pela tela concluía sem efeito. Contas aceitas antes da
  correção se resolvem com uma nova designação pela tela.
- Tela: domínio opcional também na edição; mensagem para e-mail de outra instituição; seção de
  convites com situação, validade e revogação; validade escolhida na emissão e cópia do link.

## Auditoria do contexto de curso (2026-11-18)

Todas as rotas de `RF-CUR-001` e `002` são usadas pela tela (a consulta por identificador é coberta
pela lista). Correções só no frontend: coordenação ocupada exige revogar antes (`RF-CUR-002` E1),
curso desativado não oferece designação, busca de professor no seletor, destaque do curso
selecionado e limites de tamanho dos campos.

- Curso desativado é definitivo: não há reativação, conforme `RF-CUR-001` (decisão do usuário).
- Designar coordenador ou criar turma em curso desativado responde `VALIDATION_FAILED` sem indicar o
  campo; a tela evita a chamada, mas a resposta segue pouco informativa.

## Auditoria do contexto de turma (2026-11-18)

Todas as rotas de `RF-TUR-001` a `005` passaram a ser usadas, inclusive a alteração da turma.

- `cohort-listing`: `GET /cohorts` devolve numa consulta as turmas que o ator lê; a tela fazia uma
  requisição por curso.
- Tela de turmas: edição, confirmação antes de encerrar, busca no seletor de professor, cópia do
  link e convites legíveis. O administrador institucional, que não tem `COHORT:READ`, deixou de ver
  "Turmas" no menu.
- "Professores e alunos" deixou de ser simulada: diretório da instituição e convite de professor
  pelo coordenador e pelo administrador institucional (`RF-ACS-009`), com situação e revogação.

## Auditoria do contexto de evento (2026-11-18)

Todas as rotas de `RF-EVT-001` a `004` passaram a ser usadas, inclusive a alteração de etapa. A
visibilidade por papel (`RF-EVT-004` RN1) foi confirmada pela API. Correções só no frontend: escopos
oferecidos conforme o vínculo, controles de gestão apenas para o dono do escopo (a mesma hierarquia
de `EventScope`, `ADR-0032`), edição de etapa, confirmação ao cancelar, busca de orientador, lista
agrupada por escopo e atalho para as equipes do evento.

- Pendência de Templates (fora dos contextos desta rodada): o modelo de artigo só é escolhido na
  criação do evento; não há troca posterior pela tela.

## Auditoria do contexto de equipe (2026-11-18)

Todas as rotas de `RF-EQP-001` a `006` são usadas, inclusive a consulta da equipe por identificador
(nome da equipe no convite recebido).

- `team-vacancies`: a equipe traz `activeMemberCount`, para o aluno ver as vagas antes de ingressar
  (`RF-EQP-002`); o aluno só lê o artigo da própria equipe e não tinha como contá-las.
- Tela: evento lido do endereço (atalho vindo de Eventos), gestão de integrantes só para orientadores
  do evento, sem consultas negadas a quem não orienta, vagas por equipe, "Ingressar" apenas com vaga
  e sem equipe no evento, convite recebido com equipe e evento.
- Conflito na URS, mantido por decisão do usuário: `RF-EQP-005` lista o Professor como ator, mas a
  composição de §2.3.1 não lhe dá `TEAM:ASSIGN_ADVISOR`. Em evento de turma, quem nomeia o
  responsável é o coordenador do curso ou o administrador institucional.

## Auditoria do contexto de artigo — avaliação e situação (2026-11-21)

Todas as rotas de `RF-ART-001` a `004` passaram a ser usadas, inclusive a alteração de publicação.

- `article-course-scope`: o coordenador alcança só os artigos dos cursos que coordena (RN3); o
  administrador institucional continua com a instituição inteira.
- `publication-actors`: consulta das publicações por quem lê o artigo (o coordenador recebia `404`);
  registro, alteração e remoção pelo integrante, pelo responsável e por qualquer orientador do evento.
- `article-team-name`: o artigo traz o nome da equipe; a tela fazia uma requisição por evento.
  Artigos anteriores recebem o nome no próximo fato da equipe; até lá, a tela consulta a equipe.
- Tela: filtros por evento e situação, autor no histórico da nota e histórico das notas
  individuais, edição de publicação e confirmação ao remover.
- Fora do escopo desta rodada (relatório, `RF-ACP`): o coordenador não lê as notas individuais, que
  `RF-ART-003` RN2 aponta como a informação principal pedida pela coordenação.
