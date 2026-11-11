import { Injectable } from '@nestjs/common';

import { CourseFacade } from '@modules/course/contracts/course.facade';

import type { UpdateCohortCommand } from '../contracts/cohort.dto';
import { FAILURE, fail, failValidation, ok, type Result } from '../domain/failure';
import { violationsOfUpdate, withChanges, type Cohort } from '../domain/cohort';
import { CohortRepository } from '../domain/ports/cohort-repository';
import { coordinatorCohort } from './cohort-scope';

@Injectable()
export class UpdateCohortUseCase {
  constructor(
    private readonly cohorts: CohortRepository,
    private readonly courses: CourseFacade,
  ) {}

  async execute(command: UpdateCohortCommand): Promise<Result<Cohort>> {
    const scoped = await coordinatorCohort(
      this.courses,
      this.cohorts,
      command.actorId,
      command.cohortId,
    );

    if (!scoped.ok) {
      return scoped;
    }

    const violations = violationsOfUpdate(command, scoped.value.cohort);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    const saved = await this.cohorts.save(withChanges(scoped.value.cohort, command));

    return saved === null ? fail(FAILURE.COHORT_ALREADY_EXISTS) : ok(saved);
  }
}
