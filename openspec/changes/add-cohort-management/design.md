## Context

Consulte `proposal.md` para a motivação. A vertical depende de cursos, da fachada de `access` e do
mecanismo de convite já existente. `ADR-0003` exige um ADR próprio para o novo módulo; `ADR-0005` e
`ADR-0019` proíbem transação distribuída entre a criação da conta e a matrícula.

## Goals / Non-Goals

**Goals:**

- Isolar turma, matrícula e regras de designação em um módulo `cohort` candidato.
- Reutilizar a política de convite e de senha sem permitir que `access` conheça tabelas de turma.
- Garantir idempotência e unicidade sob concorrência.

**Non-Goals:**

- Criar ou alterar o catálogo de papéis em tempo de execução.
- Implementar eventos, equipes ou avaliação de artigos.
- Fazer matrícula por chave estrangeira ou transação distribuída.

## Decisions

### D1 — Dados próprios e referências opacas

O schema `cohort` possuirá `cohort`, `enrollment`, vínculos de professor e o estado local do convite de
turma, conforme ADR próprio. `courseId` e `userId` serão colunas indexadas sem FK entre módulos. A
matrícula será entidade própria, com unicidade para o aluno ativo conforme a restrição da URS.

### D2 — Designação e titularidade

As rotas exigirão `COHORT:*`, `ENROLLMENT:*` ou `INVITATION:*`; os casos de uso confirmarão coordenador,
professor, curso e estado da turma por fachadas. A alternativa de modelar "coordenador deste curso" como
permissão separada é rejeitada por `ADR-0014 §13`: titularidade é regra do registro.

### D3 — Rotas

As rotas administrativas serão `POST/GET /courses/:courseId/cohorts`, `GET/PATCH
/cohorts/:cohortId`, `POST /cohorts/:cohortId/deactivation`, `POST/DELETE
/cohorts/:cohortId/professors/:userId`, `POST /cohorts/:cohortId/enrollments`, e
`POST/GET /cohorts/:cohortId/invitations` com revogação por recurso. A aceitação pública continuará em
`POST /invitations/:token/acceptance`, com o contexto da turma.

### D4 — Convite e matrícula por evento

O módulo `cohort` validará turma e professor e solicitará ao `access` um convite cujo contexto contenha
`scopeType=COHORT` e `scopeId` opaco. Ao aceitar, `access` criará a conta e publicará `InvitationAccepted`
na outbox; o consumidor de `cohort` criará a matrícula de forma idempotente. O consumidor não fará parte
da transação de `access`, não reverterá a aceitação e tratará duplicidade como sucesso, conforme
`ADR-0005` e `ADR-0021`. A resposta da jornada só será considerada completa quando a projeção de
matrícula estiver confirmada pelo fluxo de integração.

### D5 — Concorrência

Criação de matrícula, ingresso e aceite de convite usarão unicidades e escrita condicional no módulo
`cohort`; leitura seguida de escrita sem proteção é rejeitada porque permite duas matrículas ativas ou
excesso de integrantes.

## Risks / Trade-offs

- **Aceitação e matrícula são eventualmente consistentes** → publicar o fato na mesma transação de
  `access`, consumir com idempotência e expor o estado da jornada até a matrícula existir.
- **Convite de turma amplia contrato de `access`** → transportar somente contexto opaco e manter validação
  de turma no emissor, sem dependência inversa de `access` para `cohort`.
- **A conta pode existir se o consumidor falhar** → retry/DLQ do relay e reconciliação por `invitationId`,
  nunca criação duplicada nem transação distribuída.

## Migration Plan

1. Registrar ADR do módulo e a alteração compatível de `user-invitation`.
2. Criar schema/migração `cohort`, contexto de convite e consumidor do evento.
3. Publicar rotas administrativas e habilitar a aceitação de convite de turma após o consumidor estar
   operacional.
4. Validar jornada completa, concorrência e DLQ antes de liberar a rota pública.
5. Rollback: retirar emissão/aceitação de turma, mantendo convites institucionais e dados já criados;
   não remover matrículas nem contas por rollback de código.
