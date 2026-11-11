import { Injectable } from '@nestjs/common';

import type { Page, PageRequest } from '@shared/http/pagination';
import { toPage } from '@shared/http/pagination';
import { CourseFacade } from '@modules/course/contracts/course.facade';

import { FAILURE, fail, ok, type Result } from '../domain/failure';
import type { Cohort } from '../domain/cohort';
import { CohortRepository } from '../domain/ports/cohort-repository';

@Injectable()
export class ListCohortsUseCase {
  constructor(
    private readonly cohorts: CohortRepository,
    private readonly courses: CourseFacade,
  ) {}

  async execute(
    actorId: string,
    courseId: string,
    request: PageRequest,
  ): Promise<Result<Page<Cohort>>> {
    const course = await this.courses.stateOf(courseId);

    if (!course.exists) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }
    if ((await this.courses.coordinatorOf(courseId)) !== actorId) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    const rows = await this.cohorts.listByCourse(courseId, request);

    return ok(toPage(request, rows.rows, rows.totalItems));
  }
}
