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
| Instituição | `city`, `state`                                  | ?      | a decidir (ver abaixo)                                        |
| Instituição | `coursesActive`                                  | (d)    | o administrador de sistema não lê cursos                      |
| Curso       | `code`, `status`, `coordinator`                  | (a/b)  | `identification`, `active`, `coordinatorId` + diretório       |
| Curso       | `classes`, `events`, `students` (contagens)      | (d)    | custo de N requisições por linha; sai                         |
| Turma       | `name`, `startDate`, `endDate`, `status`         | (a/b)  | `identification`, `startsAt`, `endsAt`, `active` + datas      |
| Turma       | `professors`, `invitations`                      | (c)    | `cohort-read-extensions`                                      |
| Evento      | `scope`, `title`, `theme`, limites, `milestones` | (a)    | contrato atual; o front passa a pedir problema e objetivos    |
| Evento      | `templateId`                                     | (a)    | `POST /article-template-selections`                           |
| Evento      | `registrationOpen`, `registrationDeadline`       | (d)    | contradiz `RF-EVT-001` RN2 (sem inscrição prévia)             |
| Evento      | `kind`, avaliador com `expertise`/`invited`      | ?      | a decidir; avaliadores viram orientadores (`EVT-003`)         |
| Equipe      | `name`, `members`, `responsibleAdvisor`          | (a/c)  | `identification`, membros + diretório, `team-read-extensions` |
| Equipe      | papel `Líder/Autor/Coautor`, título do artigo    | ?      | a decidir                                                     |
| Artigo      | nota, notas por integrante, publicação, situação | (a)    | `assessments`, `member-assessments`, `publications`, status   |
| Artigo      | parecer textual (`feedback`)                     | ?      | a decidir                                                     |

### Fora desta rodada

- O coordenador lê todos os artigos da instituição (`ArticleScope.readableArticle`). A URS
  (`RF-ART-001` RN3) o restringe ao próprio curso. Fica para mudança própria.
- As telas de editor, revisão, discussão e assistência continuam nos mocks e não enxergam os
  artigos reais.
- O seed (`pnpm run db:seed`) imprime o resultado, mas o processo não termina, porque alguma conexão
  fica aberta após `context.close()`.
