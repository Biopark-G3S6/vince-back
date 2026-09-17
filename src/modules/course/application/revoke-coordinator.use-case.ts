import { Injectable } from '@nestjs/common';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';

import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { COORDINATOR_ROLE } from '../domain/ports/coordinator-repository';
import { CoordinatorRepository } from '../domain/ports/coordinator-repository';
import { CourseRepository } from '../domain/ports/course-repository';
import { actorInstitution } from './course-scope';

@Injectable()
export class RevokeCoordinatorUseCase {
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

    const revoked = await this.coordinators.revoke(courseId, userId, actorId);

    if (!revoked.changed) {
      return ok(undefined);
    }

    if ((await this.coordinators.countByUser(userId)) === 0) {
      const role = await this.access.revokeRole({ actorId, userId, roleCode: COORDINATOR_ROLE });

      if (!role.ok && role.failure.code !== FAILURE.RESOURCE_NOT_FOUND) {
        return fail(FAILURE.PERMISSION_DENIED);
      }
    }

    return ok(undefined);
  }
}
