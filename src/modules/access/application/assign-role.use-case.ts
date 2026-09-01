import { Injectable } from '@nestjs/common';

import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { PermissionCache } from '../domain/ports/permission-cache';
import { RoleAssignmentRepository } from '../domain/ports/role-assignment-repository';
import { UserRepository } from '../domain/ports/user-repository';
import { isKnownRole, normalizeOptionalText } from '../domain/user';

/**
 * Atribuição e revogação de papel (RF-INS-002 E1, RF-TUR-002 E1).
 *
 * As duas operações vivem no mesmo caso de uso porque são a mesma regra em dois
 * sentidos: mesmas pré-condições, mesma trilha, mesma invalidação de cache. Separá-las
 * duplicaria as quatro verificações abaixo.
 *
 * Ambas são **idempotentes**: atribuir papel já possuído e revogar papel não possuído
 * concluem com sucesso, sem segundo vínculo e sem segundo registro na trilha. A trilha
 * registra o que mudou, não o que foi pedido — repetição que nada altera nada acrescenta.
 *
 * A gravação da trilha ocorre na mesma transação da operação (decisão D4,
 * `ADR-0019` §1): é o que garante que a falha não deixe rastro parcial.
 */
@Injectable()
export class AssignRoleUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly assignments: RoleAssignmentRepository,
    private readonly cache: PermissionCache,
  ) {}

  async execute(
    actorId: string | null | undefined,
    userId: string,
    roleCode: string,
    operation: 'assign' | 'revoke',
  ): Promise<Result<void>> {
    if (!isKnownRole(roleCode)) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    // Conta inativa é indistinguível de conta inexistente para quem atribui papel: a
    // spec manda `RESOURCE_NOT_FOUND` nos dois casos.
    const found = await this.users.findWithRoles(userId);

    if (found === null || !found.account.active) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const actor = normalizeOptionalText(actorId);

    const outcome =
      operation === 'assign'
        ? await this.assignments.assign(actor, userId, roleCode)
        : await this.assignments.revoke(actor, userId, roleCode);

    // A invalidação segue o commit, e só ocorre quando algo de fato mudou. Operação
    // idempotente que nada alterou não tem o que invalidar.
    if (outcome.changed) {
      await this.cache.invalidate(userId);
    }

    return ok(undefined);
  }
}
