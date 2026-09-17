import { Injectable } from '@nestjs/common';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';

import { FAILURE, fail, ok } from '../domain/failure';
import type { Course } from '../domain/course';
import { CourseRepository } from '../domain/ports/course-repository';
import { actorInstitution } from './course-scope';

@Injectable()
export class FindCourseUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly access: AccessFacade,
    private readonly institutions: InstitutionFacade,
  ) {}

  async execute(actorId: string, courseId: string) {
    const course = await this.courses.findById(courseId);

    if (course === null) {
      return fail<Course>(FAILURE.RESOURCE_NOT_FOUND);
    }

    const institution = await actorInstitution(this.access, this.institutions, actorId);

    if (!institution.ok) {
      return institution;
    }

    return institution.value === course.institutionId
      ? ok(course)
      : fail<Course>(FAILURE.PERMISSION_DENIED);
  }
}
