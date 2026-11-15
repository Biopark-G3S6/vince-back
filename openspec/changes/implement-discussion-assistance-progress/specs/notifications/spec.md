## Purpose

Definir a geração, a entrega e a consulta das notificações destinadas a cada usuário.

## ADDED Requirements

### Requirement: Registro e entrega de notificações (RF-DSC-005)

O sistema SHALL registrar notificações na interface para os destinatários identificados pelo vínculo com o fato. A notificação na interface SHALL permanecer habilitada. O autor de um fato SHALL NOT receber notificação por ele mesmo. Falha de e-mail SHALL NOT remover a notificação registrada e SHALL permitir retentativa.

#### Scenario: Fato que alcança outro usuário

- **WHEN** ocorre entrega, devolução, nova mensagem, alteração ou decisão de apontamento, conclusão ou fato de prazo que alcance o usuário
- **THEN** o sistema registra a notificação para os destinatários correspondentes, exceto quem originou o fato

#### Scenario: Falha de e-mail

- **WHEN** o envio de e-mail falha
- **THEN** a notificação permanece na interface e o envio fica elegível a retentativa

#### Scenario: Preferência de e-mail desativada

- **WHEN** o destinatário não habilitou e-mail para aquela categoria
- **THEN** a notificação continua disponível na interface e não é enviada por e-mail

#### Scenario: Idioma da mensagem externa

- **WHEN** o sistema envia e-mail ao destinatário
- **THEN** renderiza a mensagem no idioma preferido pelo destinatário, com fallback para `pt-BR`

### Requirement: Consulta e leitura da caixa pessoal (RF-DSC-006)

O sistema SHALL apresentar notificações do próprio usuário em ordem cronológica inversa, distinguindo as não lidas. O usuário SHALL poder marcar uma notificação ou todas como lidas. Alcançar o objeto de uma notificação SHALL marcá-la como lida.

#### Scenario: Consulta isolada

- **WHEN** usuário consulta suas notificações
- **THEN** vê apenas notificações endereçadas a si, em ordem cronológica inversa e com estado de leitura

#### Scenario: Marcar como lida

- **WHEN** usuário marca uma ou todas as suas notificações como lidas
- **THEN** somente o estado de leitura das notificações próprias é atualizado

#### Scenario: Abrir objeto relacionado

- **WHEN** usuário alcança objeto relacionado e esse objeto permanece acessível
- **THEN** o sistema marca a notificação correspondente como lida

#### Scenario: Objeto removido ou fora do alcance

- **WHEN** usuário tenta alcançar objeto removido ou fora de sua titularidade
- **THEN** o sistema responde `RESOURCE_NOT_FOUND`
