## Context

Consulte `proposal.md` para a motivação. O repositório já possui `access` e `institution`, mas a
decomposição dos módulos acadêmicos ainda não foi registrada em ADR. O desenho deve obedecer às
fronteiras de `ADR-0003` a `ADR-0007`, à propriedade de dados de `ADR-0006` e ao contrato HTTP de
`ADR-0017` e `ADR-0025`.

## Goals / Non-Goals

**Goals:**

- Entregar a vertical de curso como um módulo isolado, com dados próprios e uma única fachada pública.
- Compor autorização de borda com verificação de titularidade dentro dos casos de uso.
- Manter a operação de designação de coordenador idempotente e auditável.

**Non-Goals:**

- Criar turmas, eventos, relatórios ou cadastro administrativo de usuários.
- Alterar o modelo de papéis globais ou permitir papéis escopados.
- Aplicar a mudança antes do ADR que declarar o módulo e suas tabelas.

## Decisions

### D1 — Módulo `course` com propriedade exclusiva

O módulo candidato `course` possuirá schema `course` e tabelas para curso, vínculo de coordenador e
auditoria da designação. `institutionId` e `userId` serão referências opacas indexadas, sem chaves
estrangeiras entre módulos. A alternativa de colocar cursos em `institution` é rejeitada porque
`ADR-0028 §3` reserva aquele módulo à instituição e seus administradores.

### D2 — Escopo validado no caso de uso

Controllers exigirão `COURSE:*` na borda. Os casos de uso consultarão a fachada de `institution` para
confirmar existência e estado e validarão que o ator atua na instituição; chamarão a fachada de
`access` apenas para papel, conta e auditoria de atribuição. A permissão sozinha não autoriza registro
específico (`ADR-0014 §12`). A alternativa de consultar tabelas de `access` ou `institution` diretamente
é rejeitada por `ADR-0006`.

### D3 — Rotas e semântica HTTP

As rotas serão `POST /courses`, `GET /courses`, `GET /courses/:courseId`, `PATCH /courses/:courseId`,
`POST /courses/:courseId/deactivation`, `POST /courses/:courseId/coordinator` e
`DELETE /courses/:courseId/coordinator/:userId`. Desativação e revogação usarão operação própria; as
listas usarão a paginação estabelecida por `ADR-0011` e `ADR-0025`. Alterar o estado por `PATCH` é
rejeitado porque mistura permissões distintas.

### D4 — Transações locais e auditoria

Cada caso de uso de escrita será uma transação limitada ao schema `course`, com timeout. A atribuição,
revogação e respectiva auditoria serão gravadas juntas. A chamada de `access` ocorrerá fora da
transação; repetição convergirá para o estado correto, como já ocorre em `institution`.

## Risks / Trade-offs

- **ADR do módulo ainda não existe** → bloquear a aplicação até declarar capacidade e tabelas em
  `vince-docs`.
- **Referências sem FK podem apontar para conta removida ou instituição inexistente** → validar cada
  referência pela fachada proprietária antes da escrita e cobrir falhas de consistência em testes.
- **Consultas por instituição podem gerar N+1** → usar consulta paginada única e teste de invariância de
  contagem conforme `ADR-0011`.

## Migration Plan

1. Registrar o ADR do módulo e conferir catálogos da URS.
2. Criar schema/migração `course` e aplicar a vertical atrás das rotas versionadas.
3. Executar testes de domínio, integração HTTP, autorização, isolamento e contagem de consultas.
4. Rollback: desabilitar as rotas e reverter a migração somente antes de dados de curso serem aceitos;
   depois disso, usar migração compatível, nunca apagar dados de negócio.
