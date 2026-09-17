import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';

import type { CreateCourseCommand } from '../contracts/course.dto';
import { failValidation, ok, type Result } from '../domain/failure';
import { courseOf, violationsOfDraft, type Course } from '../domain/course';
import { CourseRepository } from '../domain/ports/course-repository';
import { actorInstitution } from './course-scope';

@Injectable()
export class CreateCourseUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly access: AccessFacade,
    private readonly institutions: InstitutionFacade,
  ) {}

  async execute(command: CreateCourseCommand): Promise<Result<Course>> {
    const violations = violationsOfDraft(command);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    const institution = await actorInstitution(this.access, this.institutions, command.actorId);

    if (!institution.ok) {
      return institution;
    }

    const course = courseOf(uuidv7(), institution.value, {
      name: command.name,
      identification: command.identification,
    });
    return ok(await this.courses.create(course));
  }
}
