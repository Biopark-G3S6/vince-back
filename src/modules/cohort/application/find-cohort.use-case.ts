import { Injectable } from '@nestjs/common';

import { CourseFacade } from '@modules/course/contracts/course.facade';

import { CohortRepository } from '../domain/ports/cohort-repository';
import { readableCohort } from './cohort-scope';
import { type Result } from '../domain/failure';
import type { Cohort } from '../domain/cohort';

@Injectable()
export class FindCohortUseCase {
  constructor(
    private readonly cohorts: CohortRepository,
    private readonly courses: CourseFacade,
  ) {}

  async execute(actorId: string, cohortId: string): Promise<Result<Cohort>> {
    const scoped = await readableCohort(this.courses, this.cohorts, actorId, cohortId);

    return scoped.ok ? ok(scoped.value.cohort) : { ok: false, failure: scoped.failure };
  }
}

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}
