## Context

Consulte `proposal.md` para a motivação. Eventos dependem de vínculos mantidos por `course` e `cohort`,
mas devem possuir propriedade de dados própria. A autorização combina escopo de negócio com permissões
globais, conforme `ADR-0014`.

## Goals / Non-Goals

**Goals:**

- Isolar evento, etapa e designação de orientador no módulo `event` candidato.
- Validar o escopo do ator sem junções ou leitura direta de tabelas externas.
- Preservar invariantes de cronograma e limites sob concorrência.

**Non-Goals:**

- Criar equipes, artigos ou entregas de revisão.
- Abrir consulta institucional ampla além dos vínculos descritos na URS.
- Inferir traduções de conteúdo produzido por usuários.

## Decisions

### D1 — Escopo como tipo e identificador

O evento guardará `scopeType` (`INSTITUTION`, `COURSE` ou `COHORT`) e `scopeId`, além de
`institutionId` derivado do alvo validado. Os identificadores externos serão opacos. A alternativa de
três tabelas de evento por escopo é rejeitada porque duplicaria ciclo de vida e autorização.

### D2 — Fachadas e elegibilidade

O caso de uso chamará as fachadas de `institution`, `course` e `cohort` conforme o tipo do escopo e a
fachada de `access` para permissões e contas. Não haverá consulta cruzada no Prisma. A elegibilidade
será avaliada por uma operação em lote, não por consulta dentro de laço, observando `ADR-0011`.

### D3 — Rotas e cronograma

As rotas serão `POST/GET /events`, `GET/PATCH /events/:eventId`, `POST
/events/:eventId/cancellation`, `POST/GET/PATCH/DELETE /events/:eventId/milestones` e
`POST/DELETE /events/:eventId/advisors/:userId`. A criação de etapa e a alteração do cronograma serão
transações locais; a validação de ordem ocorrerá antes da escrita e a remoção de etapa iniciada será
recusada.

### D4 — Limites protegidos

O caso de uso calculará o uso atual por consulta agregada única e recusará redução abaixo do uso. A
criação posterior de equipe deverá revalidar o limite no próprio módulo que possui equipes; o módulo de
evento não tentará participar da transação de equipe.

## Risks / Trade-offs

- **Elegibilidade atravessa várias fronteiras** → fachadas em lote e snapshots de identificadores, sem
  junções; aceitar eventual consistência somente onde a URS não exige decisão imediata.
- **Alteração de cronograma pode conflitar com entregas futuras** → bloquear remoção de etapa iniciada e
  cobrir alterações concorrentes com controle otimista ou escrita condicional.
- **O limite de equipe pode divergir durante a criação concorrente** → a operação de equipe deverá
  reservar/revalidar o limite dentro de sua transação e retornar `EVENT_TEAM_LIMIT_REACHED`.

## Migration Plan

1. Registrar ADR do módulo e confirmar códigos de escopo na URS.
2. Criar schema/migração `event` e fachadas dos módulos predecessores.
3. Publicar endpoints de evento e cronograma, depois habilitar orientadores.
4. Executar testes de cada escopo, paginação, concorrência e invariância de consultas.
5. Rollback: desabilitar novas escritas e preservar eventos já criados como dados consultáveis.
