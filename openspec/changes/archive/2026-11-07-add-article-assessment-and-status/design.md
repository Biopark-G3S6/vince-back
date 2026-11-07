## Context

Consulte `proposal.md` para a motivação. O artigo nasce associado à equipe, mas a situação, as
avaliações e as publicações possuem regras próprias. A vertical deve respeitar `ADR-0006` e não ler
tabelas de equipe ou evento diretamente.

## Goals / Non-Goals

**Goals:**

- Isolar artigo, histórico de avaliações e publicação externa no módulo `article` candidato.
- Permitir leitura por vínculo e escrita de nota somente pelo orientador responsável.
- Preservar histórico imutável de nota e manter a API sem texto destinado à interface.

**Non-Goals:**

- Implementar edição, submissão, revisão, transição automática de etapas ou assistência automatizada.
- Verificar publicação em serviço externo ou manter catálogo de veículos.
- Calcular aprovação agregada ou relatórios de acompanhamento.

## Decisions

### D1 — Entidades e histórico

O schema `article` possuirá artigo, avaliação do artigo, avaliação individual, histórico de alterações e
publicação externa. As linhas históricas serão append-only, com `authorId` e instante; não haverá
exclusão lógica por padrão, salvo a retenção exigida pela auditoria. `teamId`, `eventId` e `userId` serão
referências opacas indexadas.

### D2 — Leitura e titularidade

As rotas exigirão `ARTICLE:READ` ou `PUBLICATION:READ`, mas o caso de uso consultará fachadas de `team`,
`event`, `cohort` e `course` para verificar alcance. O aluno será limitado à própria equipe; orientador
do evento e coordenador terão os alcances da URS. A alternativa de replicar todas as equipes localmente
antes da necessidade é rejeitada por custo e eventual consistência desnecessária.

### D3 — Rotas de avaliação e publicação

As rotas serão `GET /articles/:articleId`, `PUT /articles/:articleId/grade`, `PUT
/articles/:articleId/member-grades/:userId`, `GET/POST /articles/:articleId/publications`, `PATCH
/articles/:articleId/publications/:publicationId` e `DELETE` para a publicação. O estado e a etapa
corrente serão leitura; mudanças de estado pertencem às verticais de edição/revisão futuras.

### D4 — Nota e concorrência

Cada gravação de nota criará uma nova versão histórica dentro da transação local e atualizará a visão
corrente. O intervalo de nota será validado no domínio. Conflitos de atualização usarão versão ou escrita
condicional, evitando perda silenciosa de uma avaliação.

### D5 — A faixa de nota é premissa declarada, não requisito ratificado

`RF-ART-002` E2 e `RF-ART-003` E2 exigem recusar nota "fora da faixa admitida" sem dizer qual é.
Fixamos de 0 a 10, com duas casas decimais, em um lugar só: `domain/grade.ts`, com a restrição de
verificação da migração impondo o mesmo intervalo no banco.

Não é decisão de arquitetura, e por isso não vira ADR: é lacuna da URS que a implementação não pode
contornar sem escolher. A escolha é a escala corrente nas instituições de origem da elicitação.
**Alterá-la exige alterar a URS e a migração juntas** — e é por isso que os dois lugares citam um ao
outro.

### D6 — A publicação externa tem dois tipos, e não texto livre

`RF-ART-004` reconhece "evento científico ou periódico externo", e `RF-ACP-005` RN1 consolida a
produção por essa distinção. O campo é, portanto, `EVENT` ou `JOURNAL`, com restrição de verificação
no banco — e não texto livre, que tornaria a consolidação uma heurística sobre o que cada pessoa
digitou. O que continua fora de escopo é o **catálogo** de veículos (RN1): o nome do veículo é texto,
porque é ele que não tem catálogo.

## Risks / Trade-offs

- **Dados de vínculo podem estar eventualmente consistentes** → consultas por fachada com códigos
  `RESOURCE_NOT_FOUND` quando o vínculo não for confirmado e testes de isolamento por perfil.
- **Histórico cresce com cada alteração** → índices por artigo/integrante e paginação das consultas de
  histórico, sem apagar evidência.
- **Avaliação individual após remoção de integrante** → manter identificador e snapshot mínimo da
  participação no histórico, sem reativar o vínculo.

## Migration Plan

1. Registrar ADR de `article` e alinhar o contrato de evento `TeamCreated`.
2. Criar schema/migração `article` e consumidor de criação inicial.
3. Publicar situação e avaliações; depois publicar a gestão de publicação externa.
4. Executar testes de autorização, histórico, concorrência, paginação e jornada equipe-artigo.
5. Rollback: desabilitar escritas novas e manter leitura dos artigos, notas e publicações existentes.
