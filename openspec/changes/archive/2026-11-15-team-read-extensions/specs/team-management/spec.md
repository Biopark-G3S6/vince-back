## ADDED Requirements

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
