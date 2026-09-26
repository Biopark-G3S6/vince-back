## 1. Pré-requisitos arquiteturais

- [ ] 1.1 Registrar em `vince-docs` o ADR do módulo `team`, declarando equipe, integrante, convite e responsabilidade; verificar atualização do índice.
- [ ] 1.2 Confirmar contratos de `event`, `cohort` e criação inicial de artigo; verificar que limites e elegibilidade estão definidos antes do código.
- [ ] 1.3 Conferir permissões `TEAM:*` e códigos da URS; verificar correspondência com os catálogos.

## 2. Persistência e domínio

- [ ] 2.1 Criar estrutura e schema Prisma do módulo `team`, incluindo índices únicos por evento/aluno e tabelas de convite e responsabilidade; verificar migração limpa.
- [ ] 2.2 Implementar invariantes de limite, elegibilidade, uma equipe por evento e estado do evento; verificar testes unitários e concorrentes.
- [ ] 2.3 Implementar outbox `TeamCreated` e consumidor de criação do artigo `STARTED`; verificar idempotência, retry e DLQ.

## 3. Casos de uso

- [ ] 3.1 Implementar criação de equipe e confirmação de artigo inicial; verificar limite de equipes e evento cancelado.
- [ ] 3.2 Implementar ingresso, designação, remoção e consulta de integrantes; verificar duplicidade, lotação e preservação de contribuição.
- [ ] 3.3 Implementar convite de integrante e aceite com revalidação no momento do aceite; verificar expiração e lotação concorrente.
- [ ] 3.4 Implementar orientador responsável e consulta de alunos elegíveis sem equipe; verificar `ADVISOR_NOT_ASSIGNED_TO_EVENT` e paginação.
- [ ] 3.5 Publicar `TeamFacade` e DTOs sem expor entidades ou Prisma; verificar comunicação somente por `contracts`.

## 4. HTTP e jornada

- [ ] 4.1 Implementar controllers de equipe, integrantes, convites e responsável com permissões, envelope, códigos e OpenAPI; verificar rotas autenticadas e de aceite.
- [ ] 4.2 Adicionar jornada de evento até equipe, artigo inicial, ingresso e designação do responsável; verificar consistência eventual e reprocessamento.
- [ ] 4.3 Executar `pnpm run verify`, testes de concorrência e invariância de consultas; verificar todos os cenários da spec.
