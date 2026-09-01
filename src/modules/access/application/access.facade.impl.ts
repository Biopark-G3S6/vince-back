import { Injectable } from '@nestjs/common';

import { AccessFacade } from '../contracts/access.facade';
import type {
  RolePermissionsQuery,
  RolePermissionsResult,
} from '../contracts/role-permissions.dto';
import { FindRolePermissionsUseCase } from './find-role-permissions.use-case';

/**
 * Implementação da fachada. Orquestra casos de uso e mapeia DTOs; nenhuma regra de
 * negócio reside aqui (ADR-0004 §7).
 */
@Injectable()
export class AccessFacadeImpl extends AccessFacade {
  constructor(private readonly findRolePermissions: FindRolePermissionsUseCase) {
    super();
  }

  async permissionsOfRoles(query: RolePermissionsQuery): Promise<RolePermissionsResult> {
    return { permissions: await this.findRolePermissions.execute(query.roleCodes) };
  }
}
