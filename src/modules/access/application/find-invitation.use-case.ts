import { Injectable } from '@nestjs/common';

import { hashInvitationToken, INVITATION_PURPOSE } from '../domain/invitation';
import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { InvitationRepository } from '../domain/ports/invitation-repository';

export interface PublicInvitation {
  readonly id: string;
  readonly roleCode: string;
  readonly institutionId: string;
  readonly institutionName: string;
  readonly targetEmail?: string;
}

@Injectable()
export class FindInvitationUseCase {
  constructor(private readonly invitations: InvitationRepository) {}

  async execute(token: string): Promise<Result<PublicInvitation>> {
    const invitation = await this.invitations.findPublic(hashInvitationToken(token), new Date());

    if (
      invitation === null ||
      invitation.purpose !== INVITATION_PURPOSE.ACCOUNT_CREATION ||
      invitation.roleCode === null ||
      invitation.institutionId === null ||
      invitation.institutionName === null
    ) {
      return fail(FAILURE.INVITATION_EXPIRED);
    }

    return ok({
      id: invitation.id,
      roleCode: invitation.roleCode,
      institutionId: invitation.institutionId,
      institutionName: invitation.institutionName,
      ...(invitation.targetEmail === null ? {} : { targetEmail: invitation.targetEmail }),
    });
  }
}
