import { Injectable } from '@nestjs/common';

import type { Page, PageRequest } from '@shared/http/pagination';
import { toPage } from '@shared/http/pagination';
import { CourseFacade } from '@modules/course/contracts/course.facade';

import type { Enrollment } from '../domain/enrollment';
import { ok, type Result } from '../domain/failure';
import { CohortRepository } from '../domain/ports/cohort-repository';
import { professorCohort } from './cohort-scope';

@Injectable()
export class ListEnrollmentsUseCase {
  constructor(
    private readonly cohorts: CohortRepository,
    private readonly courses: CourseFacade,
  ) {}

  async execute(
    actorId: string,
    cohortId: string,
    request: PageRequest,
  ): Promise<Result<Page<Enrollment>>> {
    const scoped = await professorCohort(this.courses, this.cohorts, actorId, cohortId);

    if (!scoped.ok) {
      return scoped;
    }

    const rows = await this.cohorts.listEnrollments(cohortId, request);

    return ok(toPage(request, rows.rows, rows.totalItems));
  }
}
