import { Injectable } from '@nestjs/common';

import { AccessFacade } from '@modules/access/contracts/access.facade';

import type { InvitationIssuedDto, IssueInvitationCommand } from '../contracts/invitation.dto';
import type { InstitutionResult } from '../contracts/result.dto';
import { FAILURE, fail } from '../domain/failure';
import { InstitutionRepository } from '../domain/ports/institution-repository';

@Injectable()
export class IssueInvitationUseCase {
  constructor(
    private readonly institutions: InstitutionRepository,
    private readonly access: AccessFacade,
  ) {}

  async execute(command: IssueInvitationCommand): Promise<InstitutionResult<InvitationIssuedDto>> {
    const institution = await this.institutions.findById(command.institutionId);

    if (institution === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    if (!institution.active) {
      return fail(FAILURE.INSTITUTION_INACTIVE);
    }

    const scope = await actorCanOperate(this.access, command.actorId, command.institutionId);

    if (!scope) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    const issued = await this.access.issueInvitation({
      ...command,
      institutionName: institution.name,
    });

    return issued.ok ? { ok: true, value: issued.value } : { ok: false, failure: issued.failure };
  }
}

export async function actorCanOperate(
  access: AccessFacade,
  actorId: string,
  institutionId: string,
): Promise<boolean> {
  const profile = await access.findOwnProfile({ actorId, userId: actorId });

  if (!profile.ok || !profile.value.active) {
    return false;
  }

  return (
    profile.value.roleCodes.includes('SYSTEM_ADMIN') ||
    profile.value.institutionId === institutionId
  );
}
