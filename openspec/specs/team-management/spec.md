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
- **THEN** a resposta tem status HTTP `422` e código `ADVISOR_NOT_ASSIGNED_TO_EVENT`

#### Scenario: Aluno não elegível

- **WHEN** aluno fora do escopo tenta ingressar em equipe
- **THEN** a resposta tem status HTTP `422` e código `STUDENT_NOT_ELIGIBLE`

### Requirement: Artigo acompanha a equipe

O artigo de uma equipe SHALL refletir a composição ativa e o orientador responsável corrente da
equipe. Ingresso, designação, remoção de integrante e designação ou revogação do orientador
responsável MUST passar a valer para o acesso ao artigo sem ação adicional. Integrantes ativos SHALL
ler e editar o artigo; o orientador responsável corrente SHALL ser quem avalia o artigo e os
integrantes. A criação do artigo MUST ser idempotente: o reprocessamento do mesmo fato de criação de
equipe não cria um segundo artigo.

#### Scenario: Equipe criada gera artigo uma única vez

- **WHEN** uma equipe é criada e o fato de criação é processado mais de uma vez
- **THEN** existe exatamente um artigo associado à equipe, em estado `STARTED`

#### Scenario: Integrante que ingressa passa a acessar o artigo

- **WHEN** um aluno ingressa na equipe ou é designado a ela
- **THEN** o aluno consegue consultar o artigo da equipe

#### Scenario: Integrante removido perde o acesso de edição

- **WHEN** um integrante é removido da equipe
- **THEN** a edição do artigo por esse usuário é recusada

#### Scenario: Orientador responsável designado passa a avaliar

- **WHEN** um orientador do evento é designado responsável pela equipe
- **THEN** a avaliação do artigo por esse orientador é aceita

#### Scenario: Orientador responsável revogado deixa de avaliar

- **WHEN** a designação do orientador responsável é revogada
- **THEN** a avaliação do artigo por esse orientador é recusada com `PERMISSION_DENIED`

### Requirement: Orientador responsável na consulta da equipe

A consulta individual e a listagem de equipes do evento SHALL incluir `responsibleAdvisorId`, com o
identificador do orientador responsável corrente, ou `null` quando não houver designação ativa.

#### Scenario: Equipe com responsável

- **WHEN** um orientador é designado responsável e a equipe é consultada
- **THEN** a resposta traz `responsibleAdvisorId` igual ao identificador do orientador

#### Scenario: Responsável revogado

- **WHEN** a designação é revogada e a equipe é consultada
- **THEN** a resposta traz `responsibleAdvisorId` nulo

### Requirement: Convites recebidos pelo aluno

O sistema SHALL expor `GET /api/v1/team-invitations`, exigindo `TEAM:JOIN`, paginado conforme o
contrato de resposta, devolvendo somente os convites de equipe pendentes e não expirados cujo
convidado é o próprio ator, com o identificador do convite, da equipe e do evento e a validade.
Convites aceitos, recusados, expirados ou endereçados a outro aluno MUST NOT constar.

#### Scenario: Aluno consulta os próprios convites

- **WHEN** um aluno com um convite pendente e outro já recusado consulta os convites recebidos
- **THEN** a resposta contém apenas o convite pendente

#### Scenario: Convite de outro aluno

- **WHEN** existe convite pendente endereçado a outro aluno
- **THEN** ele não consta da resposta do ator

### Requirement: Papel do integrante

Cada integrante SHALL ter um papel: `LEADER`, `AUTHOR` ou `COAUTHOR`.

- **Valor inicial:** quem ingressa, é designado ou aceita convite nasce como `COAUTHOR`.
- **Leitura:** a listagem de integrantes SHALL devolver o papel.
- **Alteração:** `PATCH /api/v1/teams/:teamId/members/:userId` exige `TEAM:ASSIGN_MEMBER` e o mesmo
  alcance da designação de integrante.
- **Recusas:**
  - papel fora da lista → `VALIDATION_FAILED`;
  - usuário que não é integrante ativo → `RESOURCE_NOT_FOUND`.
- **Efeito:** o papel MUST NOT alterar permissões nem o acesso ao artigo.

#### Scenario: Integrante passa a líder

- **WHEN** o orientador do evento define `role` `LEADER` para um integrante ativo
- **THEN** a listagem de integrantes devolve o integrante com `role` `LEADER`

#### Scenario: Não integrante

- **WHEN** o papel é definido para um usuário que não integra a equipe
- **THEN** a resposta é `404` com `RESOURCE_NOT_FOUND`
