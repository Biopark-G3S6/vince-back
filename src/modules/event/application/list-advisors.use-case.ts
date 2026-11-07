import { Injectable } from '@nestjs/common';

import { toPage, type Page, type PageRequest } from '@shared/http/pagination';

import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { EventRepository } from '../domain/ports/event-repository';
import { EventScope } from './event-scope';

/** Os orientadores de um evento alcançado pelo ator (RF-EVT-003). */
@Injectable()
export class ListAdvisorsUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly scope: EventScope,
  ) {}

  async execute(
    actorId: string,
    eventId: string,
    request: PageRequest,
  ): Promise<Result<Page<string>>> {
    const reach = await this.scope.reachOf(actorId);

    if ((await this.events.findReachable(eventId, reach)) === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const rows = await this.events.listAdvisors(eventId, request);

    return ok(toPage(request, rows.rows, rows.totalItems));
  }
}
