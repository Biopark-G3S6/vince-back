## 1. Pré-requisitos arquiteturais e catálogo

- [x] 1.1 Registrar em `vince-docs` o ADR do módulo `course`, declarando capacidade, tabelas e dependências; verificar que o índice de ADRs foi atualizado.
- [x] 1.2 Conferir na URS as permissões e códigos usados por `RF-CUR-001` e `RF-CUR-002`; verificar correspondência com `docs:check-catalog`.

## 2. Persistência e domínio

- [x] 2.1 Criar a estrutura do módulo `course` e o schema Prisma proprietário; verificar lint de fronteiras e migração em banco limpo.
- [x] 2.2 Implementar entidade, invariantes de curso, estado ativo e vínculos de coordenador; verificar testes unitários de validação e idempotência.
- [x] 2.3 Implementar repositórios, índices e trilha de auditoria com UUIDv7 e `timestamptz`; verificar teste de propriedade exclusiva e consulta paginada.

## 3. Casos de uso e integração

- [x] 3.1 Implementar criar, listar, consultar, alterar e desativar curso com validação de instituição e titularidade; verificar cenários da spec `course-management`.
- [x] 3.2 Implementar designar e revogar coordenador usando a fachada de `access`, sem transação entre módulos; verificar máximo de um coordenador e auditoria.
- [x] 3.3 Publicar a fachada abstrata `CourseFacade` e os DTOs opacos; verificar que o módulo exporta somente a fachada.

## 4. HTTP e verificação

- [x] 4.1 Implementar controllers, validação, permissões, envelope, paginação, códigos HTTP e `Location` das rotas de curso; verificar contrato OpenAPI.
- [x] 4.2 Adicionar testes de integração de autorização, isolamento entre instituições, curso inativo e respostas de erro; verificar ausência de acesso direto a infraestrutura na presentation.
- [x] 4.3 Executar `pnpm run verify` e o teste de invariância de consultas; verificar que todos os cenários da spec estão cobertos.
