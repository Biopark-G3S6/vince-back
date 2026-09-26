import { Injectable } from '@nestjs/common';

import { CourseFacade } from '@modules/course/contracts/course.facade';

import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { deactivated, type Cohort } from '../domain/cohort';
import { CohortRepository } from '../domain/ports/cohort-repository';
import { coordinatorCohort } from './cohort-scope';

@Injectable()
export class DeactivateCohortUseCase {
  constructor(
    private readonly cohorts: CohortRepository,
    private readonly courses: CourseFacade,
  ) {}

  async execute(actorId: string, cohortId: string): Promise<Result<Cohort>> {
    const scoped = await coordinatorCohort(this.courses, this.cohorts, actorId, cohortId, false);

    if (!scoped.ok) {
      return scoped;
    }

    const saved = await this.cohorts.setActive(cohortId, false);

    return saved === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(deactivated(saved));
  }
}
