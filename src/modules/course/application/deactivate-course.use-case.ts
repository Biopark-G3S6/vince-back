import { Injectable } from '@nestjs/common';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';

import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { deactivated, type Course } from '../domain/course';
import { CourseRepository } from '../domain/ports/course-repository';
import { actorInstitution } from './course-scope';

@Injectable()
export class DeactivateCourseUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly access: AccessFacade,
    private readonly institutions: InstitutionFacade,
  ) {}

  async execute(actorId: string, courseId: string): Promise<Result<Course>> {
    const course = await this.courses.findById(courseId);

    if (course === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const institution = await actorInstitution(this.access, this.institutions, actorId);

    if (!institution.ok) {
      return institution;
    }

    if (institution.value !== course.institutionId) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    if (!course.active) {
      return ok(course);
    }

    const changed = deactivated(course);
    const saved = await this.courses.setActive(courseId, changed.active);

    return saved === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(saved);
  }
}
