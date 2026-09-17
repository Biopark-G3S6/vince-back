import { Injectable } from '@nestjs/common';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';

import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { COORDINATOR_ROLE } from '../domain/ports/coordinator-repository';
import { CoordinatorRepository } from '../domain/ports/coordinator-repository';
import { CourseRepository } from '../domain/ports/course-repository';
import { actorInstitution } from './course-scope';

@Injectable()
export class AssignCoordinatorUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly coordinators: CoordinatorRepository,
    private readonly access: AccessFacade,
    private readonly institutions: InstitutionFacade,
  ) {}

  async execute(actorId: string, courseId: string, userId: string): Promise<Result<void>> {
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
      return fail(FAILURE.VALIDATION_FAILED);
    }

    const current = await this.coordinators.findByCourse(courseId);

    if (current !== null) {
      return current.userId === userId ? ok(undefined) : fail(FAILURE.COORDINATOR_ALREADY_ASSIGNED);
    }

    const target = await this.access.findOwnProfile({ actorId: userId, userId });

    if (!target.ok || !target.value.active) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    if (target.value.institutionId !== course.institutionId) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    const assigned = await this.access.assignRole({ actorId, userId, roleCode: COORDINATOR_ROLE });

    if (!assigned.ok) {
      return assigned.failure.code === FAILURE.RESOURCE_NOT_FOUND
        ? fail(FAILURE.RESOURCE_NOT_FOUND)
        : fail(FAILURE.PERMISSION_DENIED);
    }

    const linked = await this.coordinators.assign(courseId, userId, actorId);

    if (linked.changed || linked.currentUserId === userId) {
      return ok(undefined);
    }

    return fail(FAILURE.COORDINATOR_ALREADY_ASSIGNED);
  }
}
