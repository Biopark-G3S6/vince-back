## 1. Pré-requisitos arquiteturais

- [ ] 1.1 Registrar em `vince-docs` o ADR do módulo `article`, declarando artigo, avaliações, histórico e publicação externa; verificar o índice de ADRs.
- [ ] 1.2 Confirmar contratos de `team`/`event` para criação inicial, leitura de etapa e verificação de alcance; verificar ausência de junções entre schemas.
- [ ] 1.3 Conferir permissões `ARTICLE:*`, `PUBLICATION:*` e códigos de validação na URS; verificar os catálogos antes da implementação.

## 2. Persistência e domínio

- [ ] 2.1 Criar estrutura e schema Prisma do módulo `article`, com artigo, notas, histórico e publicação externa; verificar UUIDv7, índices e migração limpa.
- [ ] 2.2 Implementar estados do artigo, faixa de nota e invariantes de publicação; verificar testes de domínio sem dependência HTTP ou ORM.
- [ ] 2.3 Implementar histórico append-only de avaliações e consultas paginadas; verificar que autor, instante e valores anteriores são preservados.

## 3. Casos de uso e integração

- [ ] 3.1 Implementar consumidor idempotente de `TeamCreated` para artigo `STARTED`; verificar retry e não duplicação.
- [ ] 3.2 Implementar consulta de situação e etapa com titularidade por aluno, orientador e coordenador; verificar isolamento por perfil.
- [ ] 3.3 Implementar nota do artigo e notas individuais somente para orientador responsável; verificar histórico, faixa e integrante removido.
- [ ] 3.4 Implementar CRUD de publicação externa sem catálogo de terceiros; verificar endereço inválido, alcance e exclusão.
- [ ] 3.5 Publicar `ArticleFacade` e DTOs sem tipos de ORM; verificar export único e contratos estáveis.

## 4. HTTP e verificação

- [ ] 4.1 Implementar controllers de situação, avaliação e publicação com permissões, envelope, paginação, códigos e OpenAPI; verificar semântica `200`, `201`, `204`, `403`, `404` e `422`.
- [ ] 4.2 Adicionar testes de concorrência e auditoria para alterações de notas; verificar que nenhuma alteração apaga histórico.
- [ ] 4.3 Executar `pnpm run verify` e a jornada equipe-artigo-avaliação-publicação; verificar cobertura completa da spec `article-assessment-and-status`.
