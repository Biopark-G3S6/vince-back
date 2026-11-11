import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { CourseFacade } from '@modules/course/contracts/course.facade';

import type { EnrollmentCommand } from '../contracts/cohort.dto';
import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { ENROLLMENT_STATUS, type Enrollment } from '../domain/enrollment';
import { CohortRepository } from '../domain/ports/cohort-repository';
import { professorCohort } from './cohort-scope';

@Injectable()
export class EnrollStudentUseCase {
  constructor(
    private readonly cohorts: CohortRepository,
    private readonly courses: CourseFacade,
    private readonly access: AccessFacade,
  ) {}

  async execute(command: EnrollmentCommand): Promise<Result<Enrollment>> {
    const scoped = await professorCohort(
      this.courses,
      this.cohorts,
      command.actorId,
      command.cohortId,
    );

    if (!scoped.ok) {
      return scoped;
    }

    const user = await this.access.createUser({
      email: command.email,
      name: command.name,
      roleCode: 'STUDENT',
      institutionId: scoped.value.institutionId,
      actorId: command.actorId,
    });

    if (!user.ok) {
      return { ok: false, failure: user.failure };
    }

    const enrollment: Enrollment = {
      id: uuidv7(),
      cohortId: command.cohortId,
      userId: user.value.id,
      status: ENROLLMENT_STATUS.ACTIVE,
    };
    const created = await this.cohorts.createEnrollment(enrollment);

    return created === null ? fail(FAILURE.STUDENT_ALREADY_ENROLLED) : ok(created);
  }
}
