## Why

A URS 0.4 descreve capacidades necessárias para a produção acadêmica que ainda não estão
implementadas: conversa contínua entre equipe e orientador, notificações, análises de apoio,
acompanhamento e relatórios. Esta mudança detalha os contratos de comportamento de `RF-DSC-001` a
`RF-DSC-006`, `RF-IAA-001` a `RF-IAA-005` e `RF-ACP-001` a `RF-ACP-006`.

## What Changes

- Acrescenta discussão por artigo, mensagens públicas aos participantes, respostas com um nível,
  resposta a apontamento, exclusão preservando o registro e entrega em tempo real recuperável.
- Acrescenta caixa de notificações própria, marcação de leitura e entrega por e-mail conforme
  preferência do destinatário.
- Acrescenta verificações ABNT, de similaridade interna e de indícios objetivos de autoria, além de
  resumo assistivo de mudanças condicionado ao consentimento institucional.
- Acrescenta consentimento institucional auditável para processamento externo de conteúdo.
- Acrescenta painéis de orientação e coordenação, sinais automáticos de risco, quadro de contribuição,
  relatório de produção por período e exportação fiel do relatório.
- `RF-INT-001` já está atendido no backend por `GET/PATCH /profile`, com `preferredLanguage`,
  validação de `pt-BR` e `LANGUAGE_NOT_SUPPORTED`; não será reimplementado nesta mudança.

## Capabilities

### New Capabilities

- `team-discussion`: mensagens da equipe, respostas, vínculo com apontamentos e entrega em tempo real
  (`RF-DSC-001` a `RF-DSC-004`).
- `notifications`: geração, entrega, consulta e leitura de notificações (`RF-DSC-005` e `RF-DSC-006`).
- `automated-assistance`: resumo, conformidade ABNT, similaridade, indícios de autoria e consentimento
  institucional (`RF-IAA-001` a `RF-IAA-005`).
- `progress-and-reports`: painéis, sinais de risco, contribuição, relatório e exportação
  (`RF-ACP-001` a `RF-ACP-006`).

### Modified Capabilities

Nenhuma spec vigente é modificada nesta proposta. A preferência de idioma permanece em `access`, já
implementada conforme `RF-INT-001`; o cliente é responsável pela tradução e formatação segundo
ADR-0026. Os módulos de artigo, equipes, eventos, turmas e cursos serão integrados por contratos
públicos e eventos, conforme ADRs aceitos.

## Impact

- Novos contratos HTTP/OpenAPI que aplicam os códigos e permissões já declarados na URS; a
  implementação deve identificar lacunas de catálogo sem criar códigos ou permissões sem origem.
- `RF-INT-001` já tem persistência, leitura e atualização no perfil do módulo `access`; essa capacidade
  fica fora desta mudança.
- Os limites de propriedade dos quatro módulos foram registrados nos ADRs 0030 a 0033 em `vince-docs`.
  As implementações usam fachadas e repositórios próprios; a integração com as mudanças ainda abertas de
  equipe e evento segue pendente.
- `RF-IAA-001` não pode enviar conteúdo a serviço externo em produção enquanto serviço, finalidade,
  declaração de consentimento e base legal não forem definidos (URS §3, item 12). O sistema deve
  permanecer utilizável quando a análise estiver indisponível.
- A implementação precisa concluir o alinhamento com as mudanças OpenSpec de equipe e evento, ainda sem
  módulos neste checkout. Isso mantém incompletos o cronograma/título por evento e o recorte de relatório
  pelo calendário do curso.
