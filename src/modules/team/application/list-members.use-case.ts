import { Injectable } from '@nestjs/common';

import { toPage, type Page, type PageRequest } from '@shared/http/pagination';

import { FAILURE, fail, ok, type Result } from '../domain/failure';
import type { TeamMember } from '../domain/member';
import { TeamRepository } from '../domain/ports/team-repository';
import { TeamScope } from './team-scope';

/**
 * Os integrantes da equipe (RF-EQP-003, RF-EQP-006).
 *
 * A listagem inclui quem saiu, distinguido pela situação: a remoção preserva a
 * participação, e esconder a linha encerrada seria apagá-la por outro meio.
 */
@Injectable()
export class ListMembersUseCase {
  constructor(
    private readonly teams: TeamRepository,
    private readonly scope: TeamScope,
  ) {}

  async execute(
    actorId: string,
    teamId: string,
    request: PageRequest,
  ): Promise<Result<Page<TeamMember>>> {
    const team = await this.teams.findById(teamId);

    if (team === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const event = await this.scope.readableEvent(team.eventId, actorId);

    if (!event.ok) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const rows = await this.teams.listMembers(teamId, request);

    return ok(toPage(request, rows.rows, rows.totalItems));
  }
}
