import { Injectable } from '@nestjs/common';

import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { TeamRepository } from '../domain/ports/team-repository';
import type { Team } from '../domain/team';
import { TeamScope } from './team-scope';

/** A consulta de uma equipe, restrita a quem alcança o seu evento (RF-EQP-006). */
@Injectable()
export class FindTeamUseCase {
  constructor(
    private readonly teams: TeamRepository,
    private readonly scope: TeamScope,
  ) {}

  async execute(actorId: string, teamId: string): Promise<Result<Team>> {
    const team = await this.teams.findById(teamId);

    if (team === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const event = await this.scope.readableEvent(team.eventId, actorId);

    return event.ok ? ok(team) : fail(FAILURE.RESOURCE_NOT_FOUND);
  }
}
