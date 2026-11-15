import { Injectable } from '@nestjs/common';

import { toPage, type Page, type PageRequest } from '@shared/http/pagination';

import { FAILURE, fail, ok, type Result } from '../domain/failure';
import type { TeamInvitation } from '../domain/invitation';
import { TeamRepository } from '../domain/ports/team-repository';
import { TeamScope } from './team-scope';

/** Os convites de uma equipe, para o orientador do evento (RF-EQP-004). */
@Injectable()
export class ListInvitationsUseCase {
  constructor(
    private readonly teams: TeamRepository,
    private readonly scope: TeamScope,
  ) {}

  async execute(
    actorId: string,
    teamId: string,
    request: PageRequest,
  ): Promise<Result<Page<TeamInvitation>>> {
    const team = await this.teams.findById(teamId);

    if (team === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const event = await this.scope.advisorEvent(team.eventId, actorId);

    if (!event.ok) {
      return event;
    }

    const rows = await this.teams.listInvitations(teamId, request);

    return ok(toPage(request, rows.rows, rows.totalItems));
  }
}
