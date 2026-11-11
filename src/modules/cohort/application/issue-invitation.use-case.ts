import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';
import { CourseFacade } from '@modules/course/contracts/course.facade';

import type { CohortInvitationDto, IssueCohortInvitationCommand } from '../contracts/cohort.dto';
import { FAILURE, fail, failValidation, ok, type Result } from '../domain/failure';
import type { CohortInvitation } from '../domain/enrollment';
import { CohortRepository } from '../domain/ports/cohort-repository';
import { professorCohort } from './cohort-scope';

@Injectable()
export class IssueInvitationUseCase {
  constructor(
    private readonly cohorts: CohortRepository,
    private readonly courses: CourseFacade,
    private readonly institutions: InstitutionFacade,
    private readonly access: AccessFacade,
  ) {}

  async execute(command: IssueCohortInvitationCommand): Promise<Result<CohortInvitationDto>> {
    if (
      !Number.isFinite(command.expiresAt.getTime()) ||
      command.expiresAt.getTime() <= Date.now()
    ) {
      return failValidation([{ field: 'expiresAt', code: 'MALFORMED' }]);
    }

    const scoped = await professorCohort(
      this.courses,
      this.cohorts,
      command.actorId,
      command.cohortId,
    );

    if (!scoped.ok) {
      return scoped;
    }

    const institution = await this.institutions.findById({
      institutionId: scoped.value.institutionId,
    });

    if (!institution.ok) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const issued = await this.access.issueInvitation({
      actorId: command.actorId,
      institutionId: scoped.value.institutionId,
      institutionName: institution.value.name,
      roleCode: 'STUDENT',
      targetEmail: null,
      expiresAt: command.expiresAt,
      maxUses: null,
      scopeType: 'COHORT',
      scopeId: command.cohortId,
    });

    if (!issued.ok) {
      return { ok: false, failure: issued.failure };
    }

    const invitation: CohortInvitation = {
      id: uuidv7(),
      invitationId: issued.value.id,
      cohortId: command.cohortId,
      professorId: command.actorId,
    };
    const local = await this.cohorts.createInvitation(invitation);

    return local === null
      ? ok({ ...invitation, url: issued.value.url })
      : ok({ ...local, url: issued.value.url });
  }
}
