import { Injectable } from '@nestjs/common';

import { AccessFacade } from '@modules/access/contracts/access.facade';

import type { InvitationPageDto, ListInvitationsCommand } from '../contracts/invitation.dto';
import type { InstitutionResult } from '../contracts/result.dto';
import { FAILURE } from '../domain/failure';
import { InstitutionRepository } from '../domain/ports/institution-repository';
import { actorCanOperate } from './issue-invitation.use-case';

@Injectable()
export class ListInvitationsUseCase {
  constructor(
    private readonly institutions: InstitutionRepository,
    private readonly access: AccessFacade,
  ) {}

  async execute(command: ListInvitationsCommand): Promise<InstitutionResult<InvitationPageDto>> {
    const institution = await this.institutions.findById(command.institutionId);

    if (institution === null) {
      return { ok: false, failure: { code: FAILURE.RESOURCE_NOT_FOUND } };
    }

    if (!(await actorCanOperate(this.access, command.actorId, command.institutionId))) {
      return { ok: false, failure: { code: FAILURE.PERMISSION_DENIED } };
    }

    return { ok: true, value: await this.access.listInvitations(command) };
  }
}
