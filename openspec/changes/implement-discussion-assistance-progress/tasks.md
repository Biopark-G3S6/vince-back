## 1. Pré-requisitos arquiteturais e de contrato

- [ ] 1.1 Alinhar a mudança com as mudanças OpenSpec ativas de equipe, evento, turma, artigo e revisão; identificar os contratos que elas vão publicar.
- [ ] 1.2 Propor e registrar em `vince-docs` os ADRs de propriedade para discussão, notificações, assistência e acompanhamento; declarar tabelas, fachadas, eventos e consumidores. Atualizar o índice de ADRs e o ponteiro do submódulo.
- [x] 1.3 Definir o contrato de entrega em tempo real com retomada por cursor, autenticação por sessão e reconexão sem lacunas ou duplicidades.
- [ ] 1.4 Resolver as informações pendentes de `RF-IAA-001` (serviço, finalidade, dados enviados, texto do consentimento e base legal); manter bloqueado o envio externo até essa decisão.
- [x] 1.5 Conferir na URS os códigos de resposta e permissões necessários; acrescentar apenas códigos derivados de cenário aprovado e associar suas chaves de tradução padrão.

## 2. Discussão e notificações

- [x] 2.1 Implementar persistência e casos de uso de mensagens, respostas de nível único, resposta a apontamento, exclusão rastreável e autorização por titularidade.
- [x] 2.2 Implementar listagem cronológica e fluxo em tempo real com cursor retomável; entregar a outros participantes conectados sem incluir o autor da mensagem.
- [x] 2.3 Implementar caixa de notificações por usuário, marcação individual/em lote e navegação que marca como lida, mantendo isolamento por destinatário.
- [x] 2.4 Ligar os eventos de entrega, devolução, discussão, apontamentos, conclusão, prazo e risco à geração idempotente de notificações.
- [x] 2.5 Implementar preferência de e-mail, retentativa independente e renderização no idioma do destinatário; registrar controllers, permissões, envelope e OpenAPI.

## 3. Assistência automatizada

- [ ] 3.1 Implementar verificação estruturada de conformidade ABNT com localização de divergências, sem corrigir o texto nem bloquear entrega.
- [x] 3.2 Implementar comparação de similaridade apenas com o acervo interno; ocultar a origem aos alunos e expô-la apenas aos orientadores.
- [x] 3.3 Implementar consulta de indícios objetivos a partir do histórico e metadados disponíveis; não produzir classificação de texto como gerado por IA.
- [x] 3.4 Implementar persistência e auditoria de consentimento institucional, com revogação efetiva imediata e bloqueio de chamadas externas sem consentimento.
- [x] 3.5 Implementar resumo de mudanças por provider port, com tratamento de indisponibilidade que não interrompa a correção; habilitar integração externa somente após a conclusão de 1.4.

## 4. Acompanhamento e relatórios

- [x] 4.1 Implementar painel do orientador com equipes próprias, estado, etapa/prazo, entrega, apontamentos e tempo desde a edição do artigo.
- [ ] 4.2 Implementar painel da coordenação limitado ao curso, agregação por evento e visão detalhada das equipes autorizadas.
- [x] 4.3 Implementar sinais automáticos para as condições mínimas da URS, sem repetição enquanto ativos, sem exposição à equipe e com encerramento automático quando cessarem.
- [x] 4.4 Implementar contribuição por integrante a partir do histórico, sem sugerir ou calcular nota e com indicação explícita de que volume não representa contribuição.
- [ ] 4.5 Implementar relatório por curso/período com todas as perguntas de `RF-ACP-005`, visibilidade restrita e resposta válida para período sem dados.
- [x] 4.6 Implementar exportação CSV que reproduza integralmente os dados apresentados no relatório.

## 5. Integração HTTP e documentação

- [x] 5.1 Publicar todos os novos controllers e fachadas no composition root, declarar permissões e erros em OpenAPI e manter a fronteira de camadas e schemas.
- [ ] 5.2 Atualizar as specs vigentes e encerrar/arquivar esta mudança somente após os cenários comportamentais estarem implementados.

## Pendências de integração e validação

- As mudanças OpenSpec de `team` e `event` continuam sem implementação. Por isso o painel do curso não consegue
  apresentar cronograma/título de evento e o relatório usa `Article.createdAt` como base de período declarada no
  próprio snapshot (`periodBasis: ARTICLE_CREATED_AT`).
- O editor pode persistir medições reais em `formatProfile` junto do conteúdo. O verificador compara margens,
  espaçamentos, paginação, títulos, legendas e citações longas, devolvendo caminho e severidade. Campo sem
  medição fica `UNVERIFIED` e não produz uma afirmação falsa de conformidade. A conferência de referência por
  tipo de fonte ainda depende de um catálogo de tipos, que o contrato atual deixa como texto livre; esses casos
  também retornam `UNVERIFIED`.
- O resumo externo segue bloqueado sem provedor, finalidade, texto de consentimento e base legal preenchidos.
- O e-mail usa webhook HTTP com retentativa. Mensagens de discussão já saem de outbox transacional, com
  polling no papel `worker`, retentativa exponencial e entrega idempotente. Os eventos de artigo e de risco
  também geram notificações com chave idempotente, mas chamam a fachada após a mudança de estado, sem
  outbox transacional.
- Foram executados typecheck, lint, validação Prisma e conferência de catálogo. A suíte de testes não foi executada.
