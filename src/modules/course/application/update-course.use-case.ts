import { Injectable } from '@nestjs/common';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';

import type { UpdateCourseCommand } from '../contracts/course.dto';
import { FAILURE, fail, failValidation, ok, type Result } from '../domain/failure';
import { violationsOfUpdate, withChanges, type Course } from '../domain/course';
import { CourseRepository } from '../domain/ports/course-repository';
import { actorInstitution } from './course-scope';

@Injectable()
export class UpdateCourseUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly access: AccessFacade,
    private readonly institutions: InstitutionFacade,
  ) {}

  async execute(command: UpdateCourseCommand): Promise<Result<Course>> {
    const violations = violationsOfUpdate(command);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    const course = await this.courses.findById(command.courseId);

    if (course === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const institution = await actorInstitution(this.access, this.institutions, command.actorId);

    if (!institution.ok) {
      return institution;
    }

    if (institution.value !== course.institutionId) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    const saved = await this.courses.save(withChanges(course, command));

    if (saved === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    return ok(saved);
  }
}
