## Contexto

O backend é um monólito modular NestJS/Prisma. Cada módulo possui schema e fachada próprios. Uma
consulta entre módulos não pode ler tabelas alheias; integrações usam contratos públicos e, como
padrão, eventos via outbox/BullMQ. A API usa permissões na borda, titularidade dentro do caso de uso,
envelope comum e códigos independentes de idioma.

## Fronteiras candidatas para ADR

Antes de criar qualquer módulo ou tabela, registrar ADRs em `vince-docs` e atualizar o índice do
submódulo `docs`:

- `discussion`: mensagens e respostas vinculadas a artigo/apontamento; a titularidade é validada
  contra equipe e orientador responsável por fachadas públicas. O fluxo em tempo real precisa de
  histórico com cursor para recuperar mensagens após desconexão.
- `notification`: caixa e estado de leitura pertencem ao destinatário. Fatos de artigo, revisão,
  prazo e risco chegam por eventos; deduplicação é necessária porque a entrega é pelo menos uma vez.
- `assistance`: resultados de verificações e consentimentos não devem alterar artigo, apontamento,
  avaliação nem nota. A verificação ABNT, similaridade interna e sinais objetivos são dados
  estruturados e subsídios. O acesso ao texto ocorre pela fachada proprietária do artigo.
- `progress`: sinais e relatórios pertencem à capacidade de acompanhamento. O módulo consome eventos
  e consulta fachadas em lote; não lê diretamente schemas de artigo, curso, evento, turma ou equipe.
- `access`: idioma já é preferência do perfil, conforme ADR-0026 §25, exposta em `GET/PATCH /profile`
  (`preferredLanguage`). O backend valida o catálogo lançado (`pt-BR`) e retorna
  `LANGUAGE_NOT_SUPPORTED`; esta mudança não altera esse contrato.

Esses nomes e limites são uma proposta de trabalho. Os ADRs devem confirmar também quais tabelas,
eventos publicados/consumidos, fachadas requeridas e papéis de execução pertencem a cada módulo.

## Contrato HTTP candidato

Os caminhos implementados e publicados no OpenAPI usam recursos sob `articles`, `notifications`,
`courses` e `institutions`, com paginação nas listagens. Mensagens e notificações não incluem texto de
interface. A transmissão em tempo real usa SSE e cursor de retomada por `Last-Event-ID`. A preferência
de idioma continua em `PATCH /profile`.

| Operação                                 | Rota candidata                                                                                                    | Requisito          |
| :--------------------------------------- | :---------------------------------------------------------------------------------------------------------------- | :----------------- |
| Consultar/publicar mensagens e respostas | `GET/POST /articles/{articleId}/discussion/messages` (`replyToId` ou `remarkId` no corpo)                         | RF-DSC-001/002/003 |
| Excluir mensagem própria                 | `DELETE /articles/{articleId}/discussion/messages/{messageId}`                                                    | RF-DSC-001         |
| Acompanhar mensagens ao vivo             | `GET /articles/{articleId}/discussion/messages/stream`                                                            | RF-DSC-004         |
| Navegar do apontamento para respostas    | `GET /articles/{articleId}/remarks/{remarkId}/discussion-messages`                                                | RF-DSC-003         |
| Consultar e marcar notificações          | `GET /notifications`; `GET /notifications/{id}`; `PATCH /notifications/{id}/read`; `POST /notifications/read-all` | RF-DSC-006         |
| Preferência de entrega por e-mail        | `GET/PUT /notifications/preferences/email`                                                                        | RF-DSC-005         |
| Solicitar/consultar verificações         | `POST/GET /articles/{articleId}/compliance-checks`; `POST/GET /articles/{articleId}/similarity-checks`            | RF-IAA-002/003     |
| Gerar resumo/consultar indícios          | `POST /articles/{articleId}/assistance/summary`; `GET /articles/{articleId}/authorship-signals`                   | RF-IAA-001/004     |
| Consultar/alterar consentimento          | `GET/PUT /institutions/{institutionId}/ai-consent`                                                                | RF-IAA-005         |
| Consultar painéis e contribuição         | `GET /progress/advisor`; `GET /courses/{courseId}/progress`; `GET /articles/{articleId}/contributions`            | RF-ACP-001/002/004 |
| Consultar sinais de risco                | `GET /progress/risk-signals`                                                                                      | RF-ACP-003         |
| Gerar/consultar/exportar relatório       | `POST /courses/{courseId}/reports`; `GET /reports/{reportId}`; `GET /reports/{reportId}/export?format=CSV`        | RF-ACP-005/006     |

Todas as rotas novas ficam sob o prefixo global configurado (`/api/v1` neste repositório). A rota de
internacionalização já existe em `GET/PATCH /profile`.

## Integração e consistência

- Gravar mensagens e o evento de publicação na mesma transação do módulo proprietário. O relay
  publica pelo outbox; o consumidor entrega aos participantes sem incluir o autor do fato.
- Gravar a notificação na caixa antes de tentar o e-mail. Falha de e-mail retém a notificação e
  agenda retentativa. A preferência de e-mail não desliga a entrega na interface.
- Guardar versão do consentimento, autor e instante. Revogação bloqueia novas submissões de conteúdo
  imediatamente; análise externa não ocorre dentro de transação de banco.
- Produzir sinais e relatórios a partir de fatos registrados. Nenhum resultado automático toma
  decisão de correção, autoria, nota ou sanção.
- Manter UUIDv7, nomes de identificadores em inglês, schema por módulo, timestamps com fuso,
  paginação do ADR-0025 e códigos/permissions derivados da URS.

### Perfil de formatação ABNT

`PUT /articles/{articleId}/content` aceita `formatProfile` opcional com medições fornecidas pelo
editor e o registra no campo `article.formatProfile` e no histórico da versão salva. A forma do
objeto é:

```json
{
  "norm": "ABNT",
  "margins": {
    "paperSize": "A4",
    "twoSided": false,
    "topCm": 3,
    "bottomCm": 2,
    "leftCm": 3,
    "rightCm": 2
  },
  "font": { "family": "Arial", "bodySizePt": 12, "auxiliarySizePt": 10 },
  "lineSpacing": {
    "body": 1.5,
    "references": 1,
    "referenceSeparation": 1,
    "captions": 1,
    "longQuotation": 1
  },
  "firstLineIndent": { "bodyCm": 1.25 },
  "alignment": { "body": "JUSTIFIED", "references": "LEFT", "longQuotation": "LEFT" },
  "pageNumbering": {
    "countedFrom": "TITLE_PAGE",
    "visibleFrom": "FIRST_TEXTUAL_PAGE",
    "position": "TOP_RIGHT"
  },
  "headingStyles": [
    { "path": "$.content[1]", "role": "SECTION", "level": 1, "numbered": true, "alignment": "LEFT" }
  ],
  "captions": [
    {
      "path": "$.content[5]",
      "kind": "FIGURE",
      "number": "1",
      "title": "Título",
      "source": "Elaborado pelo autor"
    }
  ],
  "longQuotation": [
    {
      "path": "$.content[8]",
      "lineCount": 4,
      "leftIndentCm": 4,
      "lineSpacing": 1,
      "fontSizePt": 10
    }
  ]
}
```

A análise verifica medidas obrigatórias e campos estruturados contra ABNT NBR 14724:2024, ABNT
NBR 10520:2023 e NBR 6023:2025. Tamanho de fonte 12 e recuo de 4 cm em citação longa são recomendações: aparecem
como `RECOMMENDATION`. Campos sem medição aparecem como `UNVERIFIED`; `conformant` é `null` quando
faltam medições e não há divergência comprovada.

Para a checagem de estrutura, o conteúdo do editor representa títulos como nós JSON com `type: "heading"`
e texto em `content`; a verificação retorna os caminhos desses nós quando encontra seções ausentes.
O editor é responsável por enviar no perfil uma medição para cada título, legenda e citação longa que
exista no documento. O catálogo de tipos de referência ainda não está fechado; cada referência recebe
`REFERENCE_FORMAT_UNVERIFIED` até que existam regras de elementos essenciais por tipo.

## Dependências e limitações

1. Os ADRs 0030 a 0033 já registram a propriedade de discussão, notificações, assistência e progresso
   no submódulo `docs`; falta registrar o novo ponteiro do submódulo junto das alterações de documentação.
2. Compatibilizar a proposta com `add-team-management`, `add-event-management`,
   `add-cohort-management` e `add-article-assessment-and-status`. As mudanças de equipe e evento ainda
   não publicam módulos neste checkout.
3. Confirmar serviço externo, conteúdo enviado, finalidade e declaração exibida para `RF-IAA-001`.
   Até lá, nenhuma chamada externa pode ser habilitada em produção; consentimento sozinho não supre
   essas definições.
4. As permissões `MESSAGE:*`, `NOTIFICATION:*`, `AI_SUMMARY:READ`, `COMPLIANCE_CHECK:*`,
   `SIMILARITY_CHECK:*`, `AUTHORSHIP_SIGNAL:READ`, `INSTITUTION:CONSENT_AI`, `PROGRESS:READ`,
   `RISK_SIGNAL:READ`, `CONTRIBUTION:READ` e `REPORT:*`, e os códigos `LANGUAGE_NOT_SUPPORTED`,
   `AI_CONSENT_REQUIRED` e `REPORT_NOT_READY` já constam nos catálogos do repositório/URS.
5. `RF-INT-001` já está implementado no módulo `access` por `GET/PATCH /profile`, incluindo leitura,
   atualização e validação de idioma suportado; tradução e formatação da interface ficam no cliente,
   conforme ADR-0026.
6. A URS deixa limiares de risco, composição do relatório e formatos de exportação à implementação.
   A escolha inicial proposta é parametrizar limiares e oferecer CSV, sem esconder nenhuma pergunta
   obrigatória de `RF-ACP-005`.
