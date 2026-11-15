import { Injectable } from '@nestjs/common';

import { toPage, type Page, type PageRequest } from '@shared/http/pagination';

import { ok, type Result } from '../domain/failure';
import { TeamRepository } from '../domain/ports/team-repository';
import type { Team } from '../domain/team';
import { TeamScope } from './team-scope';

/** As equipes de um evento alcançado pelo ator (RF-EQP-002 fluxo principal). */
@Injectable()
export class ListTeamsUseCase {
  constructor(
    private readonly teams: TeamRepository,
    private readonly scope: TeamScope,
  ) {}

  async execute(
    actorId: string,
    eventId: string,
    request: PageRequest,
  ): Promise<Result<Page<Team>>> {
    const event = await this.scope.readableEvent(eventId, actorId);

    if (!event.ok) {
      return event;
    }

    const rows = await this.teams.listByEvent(eventId, request);

    return ok(toPage(request, rows.rows, rows.totalItems));
  }
}
