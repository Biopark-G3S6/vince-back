## 1. Pré-requisitos e contrato de convite

- [ ] 1.1 Registrar em `vince-docs` o ADR do módulo `cohort`, declarando turma, matrícula e propriedade do contexto de convite; verificar atualização do índice.
- [ ] 1.2 Conferir `add-course-management` aplicado ou disponível como pré-requisito e alinhar os contratos de curso usados pela turma; verificar integração de fachada.
- [ ] 1.3 Atualizar o contrato `user-invitation` e os catálogos para o contexto `COHORT`; verificar que convites institucionais existentes continuam compatíveis.

## 2. Persistência e domínio

- [ ] 2.1 Criar estrutura e schema Prisma do módulo `cohort` para turma, matrícula, professor e convite; verificar migração e ausência de FK entre módulos.
- [ ] 2.2 Implementar invariantes de período, unicidade, estado da turma, limite de matrícula e unicidade de aluno ativo; verificar testes de domínio e concorrência.
- [ ] 2.3 Implementar evento/outbox de aceitação de convite e consumidor idempotente de matrícula; verificar retry, duplicidade e comportamento de falha.

## 3. Casos de uso

- [ ] 3.1 Implementar manutenção de turma e designação/revogação de professor com titularidade do coordenador; verificar cenários de `RF-TUR-001` e `RF-TUR-002`.
- [ ] 3.2 Implementar cadastro direto de aluno chamando `access` para criação sem senha e criando matrícula local; verificar `EMAIL_ALREADY_REGISTERED` e `STUDENT_ALREADY_ENROLLED`.
- [ ] 3.3 Implementar emissão, listagem, revogação e aceitação de convite de turma sem permitir alteração de papel, turma ou instituição; verificar cenários públicos da spec.
- [ ] 3.4 Publicar `CohortFacade` e seus DTOs, mantendo a comunicação com `course` e `access` somente por `contracts`; verificar lint arquitetural.

## 4. HTTP e jornada

- [ ] 4.1 Implementar controllers de turma, professores, matrículas e convites com envelope, paginação, códigos e OpenAPI; verificar todas as rotas administrativas e públicas.
- [ ] 4.2 Adicionar teste de jornada convite válido até matrícula ativa, incluindo expiração, revogação e falha do consumidor; verificar que a operação é reprocessável.
- [ ] 4.3 Executar `pnpm run verify`, testes de contagem e teste de isolamento entre cursos; verificar todos os cenários de `cohort-management` e `user-invitation` modificado.
