import { Injectable } from '@nestjs/common';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { CourseFacade } from '@modules/course/contracts/course.facade';

import type { ProfessorCommand } from '../contracts/cohort.dto';
import type { Result } from '../domain/failure';
import { CohortRepository } from '../domain/ports/cohort-repository';
import { coordinatorCohort } from './cohort-scope';

@Injectable()
export class AssignProfessorUseCase {
  constructor(
    private readonly cohorts: CohortRepository,
    private readonly courses: CourseFacade,
    private readonly access: AccessFacade,
  ) {}

  async execute(command: ProfessorCommand): Promise<Result<void>> {
    const scoped = await coordinatorCohort(
      this.courses,
      this.cohorts,
      command.actorId,
      command.cohortId,
    );

    if (!scoped.ok) {
      return scoped;
    }

    const role = await this.access.assignRole({
      actorId: command.actorId,
      userId: command.userId,
      roleCode: 'PROFESSOR',
    });

    if (!role.ok) {
      return { ok: false, failure: role.failure };
    }

    await this.cohorts.addProfessor(command.cohortId, command.userId, command.actorId);

    return { ok: true, value: undefined };
  }
}
