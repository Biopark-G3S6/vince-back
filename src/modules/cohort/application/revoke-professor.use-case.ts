import { Injectable } from '@nestjs/common';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { CourseFacade } from '@modules/course/contracts/course.facade';

import type { ProfessorCommand } from '../contracts/cohort.dto';
import { CohortRepository } from '../domain/ports/cohort-repository';
import { coordinatorCohort } from './cohort-scope';

@Injectable()
export class RevokeProfessorUseCase {
  constructor(
    private readonly cohorts: CohortRepository,
    private readonly courses: CourseFacade,
    private readonly access: AccessFacade,
  ) {}

  async execute(
    command: ProfessorCommand,
  ): Promise<
    | { ok: true; value: undefined }
    | { ok: false; failure: { code: string; fields?: readonly { field: string; code: string }[] } }
  > {
    const scoped = await coordinatorCohort(
      this.courses,
      this.cohorts,
      command.actorId,
      command.cohortId,
      false,
    );

    if (!scoped.ok) {
      return scoped;
    }

    await this.cohorts.removeProfessor(command.cohortId, command.userId, command.actorId);

    if ((await this.cohorts.countProfessorAssignments(command.userId)) === 0) {
      const role = await this.access.revokeRole({
        actorId: command.actorId,
        userId: command.userId,
        roleCode: 'PROFESSOR',
      });

      if (!role.ok && role.failure.code !== 'RESOURCE_NOT_FOUND') {
        return { ok: false, failure: role.failure };
      }
    }

    return { ok: true, value: undefined };
  }
}
