import { Injectable } from '@nestjs/common';

import { toPage, type Page, type PageRequest } from '@shared/http/pagination';

import { FAILURE, fail, ok, type Result } from '../domain/failure';
import type { Milestone } from '../domain/milestone';
import { EventRepository } from '../domain/ports/event-repository';
import { EventScope } from './event-scope';

/** O cronograma de um evento alcançado pelo ator (RF-EVT-002, RF-EVT-004). */
@Injectable()
export class ListMilestonesUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly scope: EventScope,
  ) {}

  async execute(
    actorId: string,
    eventId: string,
    request: PageRequest,
  ): Promise<Result<Page<Milestone>>> {
    const reach = await this.scope.reachOf(actorId);

    if ((await this.events.findReachable(eventId, reach)) === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const rows = await this.events.listMilestonePage(eventId, request);

    return ok(toPage(request, rows.rows, rows.totalItems));
  }
}
