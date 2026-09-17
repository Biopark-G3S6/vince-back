# Módulo `course`

Mantém cursos pertencentes a uma instituição e o vínculo corrente de seu coordenador
(`ADR-0029`). A instituição e o usuário são referências opacas: a existência, o estado e o escopo
são confirmados pelas fachadas de `institution` e `access`.

## Fronteira

```
course/
  contracts/       CourseFacade e DTOs opacos, única superfície pública
  domain/          entidade, invariantes e ports
  application/     casos de uso e implementação da fachada
  infrastructure/  cliente Prisma escopado e repositórios
  presentation/    controllers HTTP e DTOs de entrada/OpenAPI
```

Cada escrita de vínculo e auditoria é uma transação local de `course`. Chamadas a outros módulos
acontecem antes ou depois dela, nunca dentro da transação (`ADR-0005`, `ADR-0019`).
