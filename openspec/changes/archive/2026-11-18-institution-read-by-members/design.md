## Context

`FindInstitutionUseCase` e `ListInstitutionsUseCase` não recebem o ator. A permissão é checada na
borda (`ADR-0014` §11); a titularidade fica no caso de uso (`ADR-0014` §12).

## Decisions

- **Escopo pelo vínculo do ator**, obtido por `AccessFacade.findOwnProfile`, como em
  `course/application/course-scope.ts`. `institution` pode depender de `access` (`ADR-0028` §16).
- **Instituição alheia é `RESOURCE_NOT_FOUND`**, não `PERMISSION_DENIED`: não revela a existência.
- **Listagem do vinculado:** uma página com a própria instituição (ativa ou inativa). Sem consulta
  por item (`ADR-0011` §9).
- **Ator opcional na fachada.** Chamadas entre módulos (sem ator) mantêm o comportamento de hoje;
  só a borda HTTP informa o ator.

Alternativa rejeitada: devolver o nome da instituição em `GET /identity`. O `access` não pode
depender de `institution` (`ADR-0027` §9, `ADR-0028` §16).
