import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import type {
  GrantPermissionCommand,
  ListPermissionGrantsQuery,
  PermissionGrantDto,
  PermissionGrantPage,
  RevokePermissionGrantCommand,
} from '../contracts/permission-grant.dto';
import { FAILURE, fail, failValidation, ok, type Result } from '../domain/failure';
import { PermissionCache } from '../domain/ports/permission-cache';
import {
  PermissionGrantRepository,
  type PermissionGrantRecord,
} from '../domain/ports/permission-grant-repository';
import { UserRepository } from '../domain/ports/user-repository';
import { ResolveEffectivePermissionsUseCase } from './resolve-effective-permissions.use-case';

function toDto(record: PermissionGrantRecord): PermissionGrantDto {
  return {
    id: record.id,
    beneficiaryId: record.beneficiaryId,
    granterId: record.granterId,
    permission: record.permissionCode,
    grantedAt: record.createdAt,
    validUntil: record.validUntil,
  };
}

/**
 * A instituição de quem age: concessão, revogação e consulta não atravessam a fronteira
 * de isolamento (RF-INS-001 RN1). Conta sem instituição — o administrador de sistema —
 * não possui `PERMISSION_GRANT:*`, e se chegasse aqui seria recusada.
 */
async function actorInstitution(
  permissions: ResolveEffectivePermissionsUseCase,
  actorId: string,
): Promise<Result<{ readonly institutionId: string; readonly held: readonly string[] }>> {
  const resolved = await permissions.execute(actorId);

  return resolved.institutionId === null
    ? fail(FAILURE.PERMISSION_DENIED)
    : ok({ institutionId: resolved.institutionId, held: resolved.permissions });
}

/**
 * Conceder permissão a outro usuário (RF-ACS-006, `ADR-0014` §15–§19).
 *
 * A posse é conferida contra as permissões **efetivas** do concedente — papéis e
 * concessões —, e não só contra as do papel: é o que §15 diz, e o que permite ao
 * substituto de uma força-tarefa repassar o que recebeu.
 */
@Injectable()
export class GrantPermissionUseCase {
  constructor(
    private readonly grants: PermissionGrantRepository,
    private readonly users: UserRepository,
    private readonly permissions: ResolveEffectivePermissionsUseCase,
    private readonly cache: PermissionCache,
  ) {}

  async execute(command: GrantPermissionCommand): Promise<Result<PermissionGrantDto>> {
    const now = new Date();

    if (command.validUntil !== undefined && command.validUntil !== null) {
      if (command.validUntil.getTime() <= now.getTime()) {
        return failValidation([{ field: 'validUntil', code: 'MALFORMED' }]);
      }
    }

    if (command.actorId === command.beneficiaryId) {
      return fail(FAILURE.SELF_GRANT_NOT_ALLOWED);
    }

    const actor = await actorInstitution(this.permissions, command.actorId);

    if (!actor.ok) {
      return actor;
    }

    if (!actor.value.held.includes(command.permission)) {
      return fail(FAILURE.GRANT_NOT_HELD_BY_GRANTER);
    }

    const beneficiary = await this.users.findWithRoles(command.beneficiaryId);

    if (
      beneficiary === null ||
      !beneficiary.account.active ||
      beneficiary.account.institutionId !== actor.value.institutionId
    ) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const created = await this.grants.create({
      id: uuidv7(),
      granterId: command.actorId,
      beneficiaryId: command.beneficiaryId,
      institutionId: actor.value.institutionId,
      permissionCode: command.permission,
      validUntil: command.validUntil ?? null,
    });

    // Só alcança aqui permissão que o concedente possui, e toda permissão possuída está no
    // catálogo; a guarda cobre o catálogo alterado entre a apuração e a gravação.
    if (created === 'UNKNOWN_PERMISSION') {
      return failValidation([{ field: 'permission', code: 'MALFORMED' }]);
    }

    await this.cache.invalidate(command.beneficiaryId);

    return ok(toDto(created));
  }
}

/** Revogar concessão (RF-ACS-007, `ADR-0014` §21): qualquer portador, efeito imediato. */
@Injectable()
export class RevokePermissionGrantUseCase {
  constructor(
    private readonly grants: PermissionGrantRepository,
    private readonly permissions: ResolveEffectivePermissionsUseCase,
    private readonly cache: PermissionCache,
  ) {}

  async execute(command: RevokePermissionGrantCommand): Promise<Result<void>> {
    const actor = await actorInstitution(this.permissions, command.actorId);

    if (!actor.ok) {
      return actor;
    }

    const beneficiaryId = await this.grants.revoke(
      command.grantId,
      actor.value.institutionId,
      command.actorId,
      new Date(),
    );

    if (beneficiaryId === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    await this.cache.invalidate(beneficiaryId);

    return ok(undefined);
  }
}

/** Consultar concessões diretas ativas (RF-ACS-008, `ADR-0014` §20). */
@Injectable()
export class ListPermissionGrantsUseCase {
  constructor(
    private readonly grants: PermissionGrantRepository,
    private readonly permissions: ResolveEffectivePermissionsUseCase,
  ) {}

  async execute(query: ListPermissionGrantsQuery): Promise<Result<PermissionGrantPage>> {
    const actor = await actorInstitution(this.permissions, query.actorId);

    if (!actor.ok) {
      return actor;
    }

    const page = await this.grants.listActive(
      {
        institutionId: actor.value.institutionId,
        ...(query.beneficiaryId === undefined ? {} : { beneficiaryId: query.beneficiaryId }),
        ...(query.granterId === undefined ? {} : { granterId: query.granterId }),
      },
      query.request,
      new Date(),
    );

    return ok({ items: page.items.map(toDto), pagination: page.pagination });
  }
}
