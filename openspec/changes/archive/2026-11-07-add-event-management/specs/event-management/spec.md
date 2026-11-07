## Purpose

Organiza a produção acadêmica por evento, escopo e cronograma, permitindo que os responsáveis definam
orientadores e que cada usuário consulte somente os eventos alcançados pelos seus vínculos.

## ADDED Requirements

### Requirement: Manutenção de evento por escopo

O sistema SHALL permitir ao dono autorizado criar, consultar, alterar e cancelar evento com escopo de
turma, curso ou instituição. A criação SHALL exigir título, tema, problema, objetivos, limite de equipes
e tamanho máximo de equipe, e SHALL tornar elegíveis os professores e alunos do alvo.

#### Scenario: Evento de turma criado

- **WHEN** professor autorizado seleciona turma ativa e informa dados e limites positivos
- **THEN** o sistema cria evento ativo pertencente à instituição do alvo
- **AND** os usuários elegíveis pelo escopo podem formar equipes

#### Scenario: Professor tenta escopo superior

- **WHEN** professor com vínculo apenas a turma tenta criar evento de curso ou instituição
- **THEN** a operação falha com `EVENT_SCOPE_NOT_ALLOWED`

#### Scenario: Alvo inexistente ou inativo

- **WHEN** o alvo selecionado não existe ou está inativo
- **THEN** a operação falha com `RESOURCE_NOT_FOUND`

#### Scenario: Limites inválidos

- **WHEN** limite de equipes ou tamanho máximo é ausente, zero ou negativo
- **THEN** a operação falha com `VALIDATION_FAILED`

### Requirement: Alteração e limites do evento

O sistema SHALL preservar a instituição do evento e SHALL impedir que uma alteração reduza o limite de
equipes abaixo da quantidade já criada ou o tamanho máximo abaixo da quantidade atual de integrantes.
Cancelamento SHALL impedir novas operações de formação de equipe.

#### Scenario: Redução abaixo do uso

- **WHEN** o dono tenta reduzir um limite abaixo do uso atual
- **THEN** a operação falha com `VALIDATION_FAILED`

#### Scenario: Evento cancelado

- **WHEN** o dono cancela evento ativo
- **THEN** o evento permanece consultável como cancelado
- **AND** novas criações e ingressos de equipe são recusados

### Requirement: Cronograma de etapas

O sistema SHALL permitir ao dono do evento criar, consultar, alterar e remover etapas. Cada etapa SHALL
ter nome, ordem e prazo; as datas SHALL crescer estritamente segundo a ordem. Etapa já iniciada NÃO DEVE
ser removida.

#### Scenario: Cronograma válido

- **WHEN** o dono informa etapas com ordens e datas crescentes
- **THEN** o cronograma é aceito e fica associado ao evento

#### Scenario: Datas fora de ordem

- **WHEN** uma etapa tem prazo anterior ou igual ao da etapa precedente
- **THEN** a operação falha com `MILESTONE_DATE_CONFLICT`

#### Scenario: Remoção de etapa iniciada

- **WHEN** o dono tenta remover etapa que já iniciou
- **THEN** a operação falha com `VALIDATION_FAILED`

### Requirement: Orientadores e consulta por escopo

O sistema SHALL permitir ao dono designar e revogar professores elegíveis como orientadores do evento.
Também SHALL expor consulta autenticada de eventos organizados por escopo, aplicando: aluno vê eventos
em que é elegível; professor vê eventos em que é orientador ou dono; coordenador vê os do seu curso; e
administrador institucional vê os da sua instituição.

#### Scenario: Orientador designado

- **WHEN** dono do escopo designa professor elegível
- **THEN** o professor pode consultar todas as equipes do evento

#### Scenario: Professor inelegível

- **WHEN** o dono tenta designar professor fora do escopo do evento
- **THEN** a operação falha com `STUDENT_NOT_ELIGIBLE`

#### Scenario: Designação repetida

- **WHEN** o dono designa novamente orientador já designado
- **THEN** a operação conclui sem duplicar o vínculo

#### Scenario: Consulta fora do vínculo

- **WHEN** usuário consulta evento ao qual não tem vínculo
- **THEN** a resposta falha com `RESOURCE_NOT_FOUND`

### Requirement: Contrato HTTP de evento

Os endpoints SHALL exigir `EVENT:*` e `MILESTONE:*` conforme a operação, SHALL devolver envelope único
com códigos estáveis e SHALL constar da especificação OpenAPI. Toda listagem SHALL ser paginada.

#### Scenario: Ator sem permissão

- **WHEN** ator autenticado sem a permissão necessária chama endpoint de evento
- **THEN** a resposta tem status HTTP `403` e código `PERMISSION_DENIED`

#### Scenario: Evento inexistente

- **WHEN** um identificador de evento não existe ou não é alcançado pelo ator
- **THEN** a resposta tem status HTTP `404` e código `RESOURCE_NOT_FOUND`
