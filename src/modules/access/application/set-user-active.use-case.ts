import { Injectable } from '@nestjs/common';

import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { PermissionCache } from '../domain/ports/permission-cache';
import { UserRepository, type UserAccountWithRoles } from '../domain/ports/user-repository';

/**
 * Desativação e reativação de conta.
 *
 * A desativação **não** remove a conta nem os seus vínculos de papel, e **não** libera o
 * e-mail: a linha permanece, com o índice único a ocupar o endereço. É estado de negócio,
 * e não exclusão lógica (decisão D5, `ADR-0018` §18) — RF-ACS-001 E2 lhe dá significado
 * próprio, e por isso nenhuma consulta o filtra implicitamente.
 *
 * O cache das permissões efetivas é invalidado a cada transição, porque a conta inativa
 * tem conjunto vazio: sem isso, a apuração seguinte serviria as permissões de antes
 * (`ADR-0014` §10).
 */
@Injectable()
export class SetUserActiveUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly cache: PermissionCache,
  ) {}

  async execute(userId: string, active: boolean): Promise<Result<UserAccountWithRoles>> {
    const changed = await this.users.setActive(userId, active);

    if (changed === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    await this.cache.invalidate(userId);

    const roleCodes = (await this.users.findWithRoles(userId))?.roleCodes ?? [];

    return ok({ account: changed, roleCodes });
  }
}
