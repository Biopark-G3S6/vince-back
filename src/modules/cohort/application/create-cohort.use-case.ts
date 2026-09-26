import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { CourseFacade } from '@modules/course/contracts/course.facade';

import type { CreateCohortCommand } from '../contracts/cohort.dto';
import { FAILURE, fail, failValidation, ok, type Result } from '../domain/failure';
import { cohortOf, violationsOfDraft, type Cohort } from '../domain/cohort';
import { CohortRepository } from '../domain/ports/cohort-repository';

@Injectable()
export class CreateCohortUseCase {
  constructor(
    private readonly cohorts: CohortRepository,
    private readonly courses: CourseFacade,
  ) {}

  async execute(command: CreateCohortCommand): Promise<Result<Cohort>> {
    const violations = violationsOfDraft(command);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    const course = await this.courses.stateOf(command.courseId);

    if (!course.exists) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }
    if (!course.active) {
      return fail(FAILURE.VALIDATION_FAILED);
    }
    if ((await this.courses.coordinatorOf(command.courseId)) !== command.actorId) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    const cohort = cohortOf(uuidv7(), command.courseId, command);
    const created = await this.cohorts.create(cohort);

    return created === null ? fail(FAILURE.COHORT_ALREADY_EXISTS) : ok(created);
  }
}
