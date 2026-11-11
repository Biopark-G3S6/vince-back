import { Injectable } from '@nestjs/common';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { CourseFacade } from '@modules/course/contracts/course.facade';

import type { RevokeCohortInvitationCommand } from '../contracts/cohort.dto';
import { CohortRepository } from '../domain/ports/cohort-repository';
import { professorCohort } from './cohort-scope';
import type { Result } from '../domain/failure';

@Injectable()
export class RevokeInvitationUseCase {
  constructor(
    private readonly cohorts: CohortRepository,
    private readonly courses: CourseFacade,
    private readonly access: AccessFacade,
  ) {}

  async execute(command: RevokeCohortInvitationCommand): Promise<Result<void>> {
    const scoped = await professorCohort(
      this.courses,
      this.cohorts,
      command.actorId,
      command.cohortId,
    );

    if (!scoped.ok) {
      return scoped;
    }

    const local = await this.cohorts.findInvitation(command.invitationId);

    if (local === null || local.cohortId !== command.cohortId) {
      return { ok: true, value: undefined };
    }

    const revoked = await this.access.revokeInvitation({
      actorId: command.actorId,
      institutionId: scoped.value.institutionId,
      invitationId: command.invitationId,
    });

    return revoked.ok ? { ok: true, value: undefined } : { ok: false, failure: revoked.failure };
  }
}
