import { CourseFacade } from '@modules/course/contracts/course.facade';

import { FAILURE, fail, type Result } from '../domain/failure';
import { CohortRepository } from '../domain/ports/cohort-repository';
import type { Cohort } from '../domain/cohort';

export interface ScopedCohort {
  readonly cohort: Cohort;
  readonly institutionId: string;
}

export async function coordinatorCohort(
  courses: CourseFacade,
  cohorts: CohortRepository,
  actorId: string,
  cohortId: string,
  requireActive = true,
): Promise<Result<ScopedCohort>> {
  const cohort = await cohorts.findById(cohortId);

  if (cohort === null) {
    return fail(FAILURE.RESOURCE_NOT_FOUND);
  }

  const course = await courses.stateOf(cohort.courseId);

  if (!course.exists) {
    return fail(FAILURE.RESOURCE_NOT_FOUND);
  }

  if (requireActive && (!course.active || !cohort.active)) {
    return fail(FAILURE.VALIDATION_FAILED);
  }

  if ((await courses.coordinatorOf(cohort.courseId)) !== actorId) {
    return fail(FAILURE.PERMISSION_DENIED);
  }

  return { ok: true, value: { cohort, institutionId: course.institutionId as string } };
}

export async function professorCohort(
  courses: CourseFacade,
  cohorts: CohortRepository,
  actorId: string,
  cohortId: string,
): Promise<Result<ScopedCohort>> {
  const scoped = await coordinatorCohort(courses, cohorts, actorId, cohortId);

  if (scoped.ok) {
    return scoped;
  }

  const cohort = await cohorts.findById(cohortId);

  if (cohort === null) {
    return scoped;
  }

  const course = await courses.stateOf(cohort.courseId);

  if (!course.exists || !course.active || !cohort.active) {
    return fail(FAILURE.PERMISSION_DENIED);
  }

  return (await cohorts.hasProfessor(cohortId, actorId))
    ? { ok: true, value: { cohort, institutionId: course.institutionId as string } }
    : fail(FAILURE.PERMISSION_DENIED);
}
