# Módulo `cohort`

Mantém turmas, designações de professores, matrículas e o vínculo local de convites de ingresso
(`ADR-0031`). Curso, instituição, usuário e convite são referências opacas: existência, estado e
autorização são confirmados pelas fachadas dos módulos proprietários.

## Fronteira

```
cohort/
  contracts/       CohortFacade, DTOs e eventos de contrato
  domain/          entidades, invariantes e ports
  application/     casos de uso e integração de eventos
  infrastructure/  cliente Prisma escopado e repositórios
  presentation/    controllers HTTP e DTOs de entrada/OpenAPI
  cohort.module.ts composition root do módulo
```

As escritas locais de turma, vínculo, matrícula, auditoria e outbox usam transação do módulo. Chamadas
a `course`, `institution` e `access` acontecem fora dessas transações (`ADR-0005`, `ADR-0019`).
