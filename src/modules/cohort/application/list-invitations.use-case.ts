import { Injectable } from '@nestjs/common';

import type { Page, PageRequest } from '@shared/http/pagination';
import { toPage } from '@shared/http/pagination';
import { AccessFacade } from '@modules/access/contracts/access.facade';
import { CourseFacade } from '@modules/course/contracts/course.facade';

import type { CohortInvitationDto } from '../contracts/cohort.dto';
import { CohortRepository } from '../domain/ports/cohort-repository';
import { professorCohort } from './cohort-scope';
import type { Result } from '../domain/failure';

@Injectable()
export class ListInvitationsUseCase {
  constructor(
    private readonly cohorts: CohortRepository,
    private readonly courses: CourseFacade,
    private readonly access: AccessFacade,
  ) {}

  async execute(
    actorId: string,
    cohortId: string,
    request: PageRequest,
  ): Promise<Result<Page<CohortInvitationDto>>> {
    const scoped = await professorCohort(this.courses, this.cohorts, actorId, cohortId);

    if (!scoped.ok) {
      return scoped;
    }

    const page = await this.access.listInvitations({
      institutionId: scoped.value.institutionId,
      request,
      scopeType: 'COHORT',
      scopeId: cohortId,
    });
    const local = await this.cohorts.listInvitations(cohortId, request);
    const professors = new Map(local.rows.map((item) => [item.invitationId, item.professorId]));
    const items = page.items.map((item) => ({
      id: item.id,
      invitationId: item.id,
      cohortId,
      professorId: professors.get(item.id) ?? actorId,
    }));

    return { ok: true, value: toPage(request, items, page.pagination.totalItems) };
  }
}
