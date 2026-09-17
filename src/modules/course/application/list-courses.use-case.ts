import { Injectable } from '@nestjs/common';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';
import { toPage, type PageRequest } from '@shared/http/pagination';

import { CourseRepository } from '../domain/ports/course-repository';
import { actorInstitution } from './course-scope';

@Injectable()
export class ListCoursesUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly access: AccessFacade,
    private readonly institutions: InstitutionFacade,
  ) {}

  async execute(actorId: string, request: PageRequest) {
    const institution = await actorInstitution(this.access, this.institutions, actorId);

    if (!institution.ok) {
      return institution;
    }

    const { rows, totalItems } = await this.courses.list(institution.value, request);

    return { ok: true as const, value: toPage(request, rows, totalItems) };
  }
}
