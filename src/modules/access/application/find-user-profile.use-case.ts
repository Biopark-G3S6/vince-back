import { Injectable } from '@nestjs/common';

import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { UserRepository, type UserAccountWithRoles } from '../domain/ports/user-repository';

/**
 * Consulta do perfil próprio (RF-ACS-005).
 *
 * A titularidade é verificada **aqui**, e não por permissão (decisão D2): RF-ACS-005
 * declara "— (próprio perfil)", e `ADR-0014` §12 e §13 são explícitos — a permissão
 * autoriza a ação, a titularidade autoriza o registro, e regra de titularidade não vira
 * permissão. Modelar `USER:READ_SELF` produziria permissão sem RF de origem (§7).
 */
@Injectable()
export class FindUserProfileUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(actorId: string, userId: string): Promise<Result<UserAccountWithRoles>> {
    if (actorId !== userId) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    const found = await this.users.findWithRoles(userId);

    return found === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(found);
  }
}
