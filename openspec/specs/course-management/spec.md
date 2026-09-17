# course-management Specification

## Purpose

Oferece à instituição uma forma isolada de manter cursos e designar o coordenador responsável pela
organização das turmas e dos relatórios acadêmicos.

## Requirements

### Requirement: Manutenção de curso

O sistema SHALL expor endpoints autenticados para criar, listar, consultar por identificador, alterar e
desativar cursos. A criação SHALL exigir nome e identificação, vincular o curso à instituição do ator
e iniciar o recurso ativo. A listagem SHALL ser paginada.

#### Scenario: Curso criado

- **WHEN** um administrador institucional autorizado envia nome e identificação válidos
- **THEN** o sistema cria um curso ativo na instituição do ator
- **AND** responde `201` com o recurso e `Location`

#### Scenario: Listagem paginada

- **WHEN** um ator autorizado consulta os cursos da sua instituição
- **THEN** recebe somente cursos daquela instituição em página limitada
- **AND** a resposta informa `page`, `pageSize` e `hasNext`

#### Scenario: Dados obrigatórios ausentes

- **WHEN** a criação ou alteração não informa um campo obrigatório
- **THEN** a operação falha com `VALIDATION_FAILED` e detalhamento por campo

### Requirement: Isolamento e estado do curso

O sistema SHALL verificar a titularidade institucional dentro do caso de uso. Curso de outra instituição
SHALL ser tratado como inacessível ao ator. A desativação SHALL preservar o registro, ser idempotente e
impedir a criação de novas turmas e eventos vinculados ao curso.

#### Scenario: Curso de outra instituição

- **WHEN** um administrador tenta consultar ou alterar curso de instituição alheia
- **THEN** a operação falha com `PERMISSION_DENIED`

#### Scenario: Desativação repetida

- **WHEN** um administrador desativa um curso já inativo
- **THEN** a operação conclui sem criar outro registro nem alterar o histórico do curso

#### Scenario: Curso inativo usado como origem

- **WHEN** uma operação tenta criar turma ou evento para curso inativo
- **THEN** a operação é recusada com `VALIDATION_FAILED`

### Requirement: Designação do coordenador

O sistema SHALL permitir ao administrador institucional autorizado designar e revogar o coordenador
ativo de um curso. O curso SHALL possuir no máximo um coordenador ativo; a designação SHALL atribuir o
papel `COORDINATOR` e a revogação SHALL preservar concessões diretas que não dependam do vínculo.

#### Scenario: Coordenador designado

- **WHEN** o administrador designa usuário ativo a curso ativo da sua instituição
- **THEN** o usuário passa a ser coordenador daquele curso
- **AND** pode criar turmas nesse curso e não em outro curso

#### Scenario: Coordenador já existente

- **WHEN** o administrador tenta designar outro usuário enquanto há coordenador ativo
- **THEN** a operação falha com `COORDINATOR_ALREADY_ASSIGNED`

#### Scenario: Usuário inexistente

- **WHEN** a designação informa usuário que não existe ou está inativo
- **THEN** a operação falha com `RESOURCE_NOT_FOUND`

#### Scenario: Revogação

- **WHEN** o administrador revoga o coordenador do curso
- **THEN** o vínculo deixa de autorizar ações sobre o curso
- **AND** concessões diretas do usuário permanecem independentes

### Requirement: Contrato HTTP de curso

Os endpoints de curso SHALL exigir as permissões declaradas na URS (`COURSE:CREATE`, `COURSE:READ`,
`COURSE:UPDATE`, `COURSE:DEACTIVATE`, `COURSE:ASSIGN_COORDINATOR` e `COURSE:REVOKE_COORDINATOR`) e
SHALL usar o envelope único, códigos estáveis e a especificação OpenAPI publicados pela API.

#### Scenario: Ator sem permissão

- **WHEN** um ator autenticado sem a permissão necessária chama um endpoint de curso
- **THEN** a resposta tem status HTTP `403` e código `PERMISSION_DENIED`

#### Scenario: Recurso inexistente

- **WHEN** um identificador de curso não existe no escopo consultado
- **THEN** a resposta tem status HTTP `404` e código `RESOURCE_NOT_FOUND`
