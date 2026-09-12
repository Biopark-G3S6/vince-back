import { Injectable } from '@nestjs/common';

import { InvitationRepository } from '../domain/ports/invitation-repository';

export interface RevokeInvitationInput {
  readonly institutionId: string;
  readonly invitationId: string;
  readonly actorId: string;
}

@Injectable()
export class RevokeInvitationUseCase {
  constructor(private readonly invitations: InvitationRepository) {}

  async execute(input: RevokeInvitationInput): Promise<void> {
    await this.invitations.revokeAccountInvitation(
      input.institutionId,
      input.invitationId,
      input.actorId,
      new Date(),
    );
  }
}
