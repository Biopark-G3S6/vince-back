import { Injectable } from '@nestjs/common';

import type { InvitationAcceptedEvent } from '../contracts/cohort.facade';
import { CohortRepository } from '../domain/ports/cohort-repository';

@Injectable()
export class ConsumeInvitationAcceptedUseCase {
  constructor(private readonly cohorts: CohortRepository) {}

  async execute(event: InvitationAcceptedEvent): Promise<void> {
    if (event.scopeType !== 'COHORT' || event.scopeId === null || event.roleCode !== 'STUDENT') {
      return;
    }

    const cohort = await this.cohorts.findById(event.scopeId);

    if (cohort === null || !cohort.active) {
      return;
    }

    await this.cohorts.consumeInvitationAccepted({
      eventId: event.eventId,
      invitationId: event.invitationId,
      cohortId: event.scopeId,
      userId: event.userId,
    });
  }
}
