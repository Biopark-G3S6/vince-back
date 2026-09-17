# team-management Specification

## Purpose

Permite formar equipes dentro de eventos, controlar seus integrantes e atribuir responsabilidade direta
de orientação, mantendo os limites e a elegibilidade definidos pelo evento.

## Requirements

### Requirement: Criação de equipe e artigo inicial

O sistema SHALL permitir ao orientador do evento criar equipe em evento ativo, respeitando o limite
máximo de equipes. A criação SHALL criar exatamente um artigo associado à equipe, em estado `STARTED`.

#### Scenario: Equipe criada

- **WHEN** orientador designado informa identificação em evento ativo com vaga de equipe
- **THEN** a equipe é criada
- **AND** existe um artigo associado em estado `STARTED`

#### Scenario: Limite de equipes atingido

- **WHEN** orientador tenta criar equipe após atingir o limite do evento
- **THEN** a operação falha com `EVENT_TEAM_LIMIT_REACHED`

#### Scenario: Evento cancelado

- **WHEN** orientador tenta criar equipe em evento cancelado
- **THEN** a operação falha com `VALIDATION_FAILED`

### Requirement: Ingresso e designação de integrante

O sistema SHALL permitir ao aluno elegível ingressar em uma equipe com vaga e ao orientador designar ou
remover aluno elegível. Um aluno SHALL integrar no máximo uma equipe por evento, e o tamanho máximo SHALL
ser revalidado no momento do ingresso ou designação. A remoção NÃO DEVE apagar contribuições já
registradas no artigo.

#### Scenario: Aluno ingressa

- **WHEN** aluno elegível solicita ingresso em equipe com vaga
- **THEN** o aluno passa a ser integrante da equipe

#### Scenario: Aluno em segunda equipe

- **WHEN** aluno já integrante de uma equipe do evento solicita outra
- **THEN** a operação falha com `STUDENT_ALREADY_IN_TEAM`

#### Scenario: Equipe cheia

- **WHEN** ingresso ou designação ocorre após o tamanho máximo ser atingido
- **THEN** a operação falha com `TEAM_SIZE_LIMIT_REACHED`

#### Scenario: Remoção preserva contribuição

- **WHEN** orientador remove integrante que já contribuiu no artigo
- **THEN** a participação e suas contribuições históricas continuam consultáveis

### Requirement: Convite de integrante

O sistema SHALL permitir ao orientador convidar aluno elegível para equipe ativa, com prazo de validade.
O aceite SHALL revalidar elegibilidade, unicidade de equipe e limite de tamanho no instante do aceite.

#### Scenario: Convite aceito

- **WHEN** aluno aceita convite válido enquanto há vaga
- **THEN** o aluno passa a integrar a equipe

#### Scenario: Convite expirado

- **WHEN** aluno tenta aceitar convite após o prazo
- **THEN** a operação falha com `INVITATION_EXPIRED`

#### Scenario: Vaga preenchida antes do aceite

- **WHEN** outro ingresso preenche a equipe antes do aceite do convite
- **THEN** a operação falha com `TEAM_SIZE_LIMIT_REACHED`

### Requirement: Orientador responsável

O sistema SHALL permitir ao dono do escopo designar e revogar, por equipe, um orientador responsável
entre os orientadores do evento. Uma equipe SHALL ter no máximo um responsável ativo; a responsabilidade
direta SHALL determinar quem pode avaliar o artigo e seus integrantes.

#### Scenario: Responsável designado

- **WHEN** dono do escopo designa orientador já designado ao evento
- **THEN** o orientador passa a ser responsável direto pela equipe

#### Scenario: Professor não orientador

- **WHEN** o dono tenta nomear professor não designado ao evento
- **THEN** a operação falha com `ADVISOR_NOT_ASSIGNED_TO_EVENT`

### Requirement: Alunos elegíveis sem equipe

O sistema SHALL permitir ao orientador consultar a lista de alunos elegíveis pelo escopo que não integram
nenhuma equipe do evento.

#### Scenario: Lista de pendentes

- **WHEN** orientador consulta alunos sem equipe
- **THEN** recebe exatamente os alunos elegíveis que ainda não participam de equipe

#### Scenario: Lista esvaziada

- **WHEN** todos os alunos elegíveis ingressam em equipes
- **THEN** a consulta retorna lista vazia com paginação válida

### Requirement: Contrato HTTP de equipe

Os endpoints SHALL exigir as permissões `TEAM:*` correspondentes, SHALL respeitar titularidade dentro do
caso de uso, SHALL usar envelope e paginação da API e SHALL constar da especificação OpenAPI.

#### Scenario: Orientador não designado

- **WHEN** professor não orientador chama endpoint restrito de equipe
- **THEN** a resposta tem status HTTP `403` e código `ADVISOR_NOT_ASSIGNED_TO_EVENT`

#### Scenario: Aluno não elegível

- **WHEN** aluno fora do escopo tenta ingressar em equipe
- **THEN** a resposta tem status HTTP `422` e código `STUDENT_NOT_ELIGIBLE`
