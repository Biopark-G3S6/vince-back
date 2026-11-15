## Context

- `ResolveEffectivePermissionsUseCase` já faz a união de origens (`PERMISSION_SOURCE.GRANT` está
  declarada mas não usada) e grava o resultado em cache.
- O cache é invalidado por eventos de papel e de instituição.
- As trilhas de auditoria existentes, como `RoleAssignmentAudit`, não têm chave estrangeira e guardam
  códigos textuais.

## Goals / Non-Goals

**Goals:**

- `RF-ACS-006` a `RF-ACS-008` completos.
- Permissões efetivas corretas, inclusive após a expiração.

**Non-Goals:**

- Notificar o beneficiário.
- Concessão entre instituições.
- Concessão pelo administrador de sistema, que não tem `PERMISSION_GRANT:*`.

## Decisions

1. **Uma tabela, que é também a trilha.**
   - O `ADR-0027` §5 enumera `permission_grant` e §6 proíbe qualquer tabela fora da lista. Uma
     `permission_grant_audit` exigiria reescrever o ADR, então ela não existe.
   - Colunas: `id`, `granter_id`, `beneficiary_id`, `institution_id`, `permission_id`,
     `valid_until`, `revoked_at`, `revoked_by`, `created_at`, `updated_at`.
   - A linha nunca é removida, e a revogação preenche `revoked_at`/`revoked_by` uma única vez. Assim
     a própria tabela guarda concedente, beneficiário, permissão e os instantes de concessão e de
     revogação (`ADR-0014` §18), e o repositório não expõe alteração nem remoção.
   - Chave estrangeira para `permission`, exigida por `ADR-0018` §12 e prevista no `ADR-0027`
     ("Alternativas rejeitadas"). Não há chave para `user`, para que a trilha não dependa da conta.
   - Índice em `(beneficiary_id)` e em `(institution_id, created_at)`.
   - A migração é escrita à mão, porque `migrate dev` arrasta o schema de observabilidade.
2. **Nova origem na apuração.** O repositório devolve as permissões das concessões ativas, com
   `revoked_at is null and (valid_until is null or valid_until > now())`, numa única consulta
   adicional (`ADR-0011` §9).
3. **Cache e expiração.** A chave do beneficiário é invalidada na concessão e na revogação. Ao gravar
   o cache, se houver concessão com validade, o TTL da entrada é limitado ao menor `valid_until`. Para
   isso, `PermissionCache.write` passa a aceitar um TTL opcional.
   - Alternativa rejeitada: tarefa agendada que varre expirações. Exige o papel `worker` e deixa uma
     janela de erro.
4. **Verificação de delegação.** A permissão do concedente é conferida pelas suas permissões
   efetivas, que já unem papéis e concessões. Um beneficiário PODE, portanto, reconceder o que
   recebeu, desde que também tenha `PERMISSION_GRANT:CREATE` (`ADR-0014` §15).
5. **Rotas.** O recurso `permission-grants` é plano; o filtro vai na query. A revogação é `DELETE` sem
   corpo, no mesmo molde de `DELETE /institutions/:id/admins/:userId`.

## Risks / Trade-offs

- [O TTL limitado à validade reduz o aproveitamento do cache] → o efeito fica restrito a quem tem
  concessão com prazo, que são poucos usuários.
