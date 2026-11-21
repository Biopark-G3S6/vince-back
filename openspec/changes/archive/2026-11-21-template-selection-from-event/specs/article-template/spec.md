## Purpose

Seleção do template pelo evento e conteúdo inicial dos artigos (`RF-TPL-002`).

## ADDED Requirements

### Requirement: Seleção do template pelo dono do evento

O sistema SHALL registrar a seleção do template de um evento obtendo a instituição e o curso do
próprio evento. Evento inexistente SHALL responder `RESOURCE_NOT_FOUND`; ator que não é dono do escopo
do evento SHALL receber `PERMISSION_DENIED`; template restrito a curso diferente do curso do evento
SHALL responder `RESOURCE_NOT_FOUND`; nova seleção para o mesmo evento SHALL responder
`TEMPLATE_ALREADY_FIXED`.

#### Scenario: Template do curso no evento de turma

- **WHEN** o dono de um evento de turma seleciona um template restrito ao curso dessa turma
- **THEN** a seleção é registrada com a versão corrente do template

#### Scenario: Troca recusada

- **WHEN** a seleção do evento é solicitada novamente
- **THEN** a resposta é `TEMPLATE_ALREADY_FIXED`

### Requirement: Artigo nasce com a versão congelada

O artigo criado com a equipe SHALL nascer com o conteúdo da versão do template congelada pelo evento.
Sem seleção, ou com a opção em branco, o artigo SHALL nascer vazio. Alteração posterior do template
SHALL NOT alcançar os artigos do evento.

#### Scenario: Template alterado depois da seleção

- **WHEN** o template é alterado depois de o evento o selecionar e, em seguida, uma equipe é criada
- **THEN** o artigo da equipe nasce com o conteúdo da versão selecionada, e não da nova
