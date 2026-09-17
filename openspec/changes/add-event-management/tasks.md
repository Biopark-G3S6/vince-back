## 1. Pré-requisitos arquiteturais

- [ ] 1.1 Registrar em `vince-docs` o ADR do módulo `event`, declarando evento, etapa e designação de orientador; verificar o índice de ADRs.
- [ ] 1.2 Conferir os códigos de escopo, cronograma, elegibilidade e permissões `EVENT:*`/`MILESTONE:*` na URS; verificar os catálogos.
- [ ] 1.3 Confirmar os contratos de `course` e `cohort` necessários para validar os três tipos de escopo; verificar que não há dependência de tabela externa.

## 2. Persistência e domínio

- [ ] 2.1 Criar estrutura e schema Prisma do módulo `event` para evento, etapa e orientador; verificar migração com schema próprio e índices de filtro.
- [ ] 2.2 Implementar invariantes de escopo, estado, limites e cronograma; verificar testes de datas crescentes, remoção de etapa iniciada e redução de limite.
- [ ] 2.3 Implementar repositórios e consultas paginadas em lote; verificar teste de invariância de consultas para diferentes quantidades de eventos e orientadores.

## 3. Casos de uso e integração

- [ ] 3.1 Implementar ciclo de vida do evento com titularidade por escopo e chamadas às fachadas proprietárias; verificar `EVENT_SCOPE_NOT_ALLOWED` e alvo inativo.
- [ ] 3.2 Implementar criação, alteração e remoção de etapas com proteção de etapa iniciada; verificar `MILESTONE_DATE_CONFLICT`.
- [ ] 3.3 Implementar designação/revogação de orientadores e consulta por escopo; verificar elegibilidade e idempotência.
- [ ] 3.4 Publicar `EventFacade` e DTOs públicos sem tipos de ORM; verificar export único e lint de fronteiras.

## 4. HTTP e verificação

- [ ] 4.1 Implementar controllers de eventos, etapas e orientadores com permissões, envelope, paginação, códigos e OpenAPI; verificar rotas e status HTTP.
- [ ] 4.2 Adicionar testes de autorização por perfil, isolamento entre escopos e evento cancelado; verificar que usuário fora do vínculo recebe `RESOURCE_NOT_FOUND`.
- [ ] 4.3 Executar `pnpm run verify` e a jornada de evento por instituição, curso e turma; verificar cobertura dos cenários da spec.
