## Purpose

Definir a conversa contínua entre integrantes de uma equipe e seu orientador responsável, vinculada ao artigo.

## ADDED Requirements

### Requirement: Publicação e leitura da discussão (RF-DSC-001)

O sistema SHALL permitir que integrante da equipe ou orientador responsável publique e consulte mensagens da discussão vinculada ao artigo da equipe. Cada mensagem SHALL registrar autor e instante. A discussão SHALL permanecer disponível em todos os estados do artigo, e cada mensagem SHALL ser visível a todos os participantes autorizados.

#### Scenario: Publicação por participante autorizado

- **WHEN** integrante da equipe ou orientador responsável publica mensagem não vazia
- **THEN** a mensagem fica registrada e disponível aos participantes da mesma equipe

#### Scenario: Acesso fora da equipe

- **WHEN** usuário sem vínculo com a equipe tenta consultar ou publicar na discussão
- **THEN** o sistema responde `RESOURCE_NOT_FOUND`

#### Scenario: Mensagem vazia

- **WHEN** participante tenta publicar mensagem vazia
- **THEN** o sistema responde `VALIDATION_FAILED`

#### Scenario: Discussão durante correção

- **WHEN** o artigo está em `IN_REVIEW`
- **THEN** os participantes continuam podendo usar a discussão sem alterar o artigo

### Requirement: Respostas agrupadas (RF-DSC-002)

O sistema SHALL agrupar respostas sob a mensagem raiz escolhida e SHALL manter somente um nível de resposta. Respostas à resposta SHALL permanecer sob a mesma raiz e ser apresentadas em ordem cronológica.

#### Scenario: Resposta a uma resposta

- **WHEN** participante responde a uma resposta já existente
- **THEN** a nova resposta aparece sob a mesma mensagem raiz, sem criar outro nível

#### Scenario: Mensagem raiz excluída

- **WHEN** uma resposta pertence a uma raiz excluída
- **THEN** a resposta permanece consultável e a raiz é indicada como excluída

### Requirement: Resposta a apontamento (RF-DSC-003)

O sistema SHALL permitir que integrante responda a apontamento devolvido à equipe, publicando a resposta como mensagem comum na discussão e mantendo vínculo navegável entre ambos. Responder SHALL NOT alterar o estado do apontamento.

#### Scenario: Resposta a apontamento devolvido

- **WHEN** integrante responde a apontamento já devolvido
- **THEN** a mensagem aparece na discussão com referência ao apontamento e o estado dele permanece igual

#### Scenario: Apontamento não devolvido

- **WHEN** integrante tenta responder a apontamento ainda não devolvido
- **THEN** o sistema responde `RESOURCE_NOT_FOUND`

### Requirement: Atualização e retomada da discussão (RF-DSC-004)

O sistema SHALL entregar mensagem nova aos participantes conectados sem recarga da página. Após interrupção, o participante SHALL conseguir retomar a partir do último cursor recebido, sem lacuna nem duplicidade.

#### Scenario: Participantes conectados

- **WHEN** participante publica mensagem enquanto outros participantes autorizados acompanham a discussão
- **THEN** a mensagem é entregue aos demais sem ação ou recarga

#### Scenario: Reconexão

- **WHEN** participante restabelece conexão após interrupção
- **THEN** recebe mensagens posteriores ao último cursor confirmado, uma única vez na sequência apresentada

### Requirement: Exclusão de mensagem pelo autor (RF-DSC-001)

O sistema SHALL permitir ao autor excluir a própria mensagem, preservando o registro da exclusão e a estrutura das respostas.

#### Scenario: Exclusão própria

- **WHEN** o autor exclui sua mensagem
- **THEN** o conteúdo deixa de ser apresentado como mensagem ativa e a discussão indica que houve exclusão

#### Scenario: Exclusão por outro participante

- **WHEN** participante tenta excluir mensagem de outro autor
- **THEN** a operação é recusada
