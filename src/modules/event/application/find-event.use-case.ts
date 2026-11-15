import { Injectable } from '@nestjs/common';

import { FAILURE, fail, ok, type Result } from '../domain/failure';
import type { Event } from '../domain/event';
import { EventRepository } from '../domain/ports/event-repository';
import { EventScope } from './event-scope';

/**
 * A consulta de um evento (RF-EVT-004).
 *
 * Fora do alcance do ator, a resposta é `RESOURCE_NOT_FOUND` e não `PERMISSION_DENIED`
 * (RF-EVT-004 E1): dizer "existe, mas não é seu" já revelaria a existência.
 */
@Injectable()
export class FindEventUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly scope: EventScope,
  ) {}

  async execute(actorId: string, eventId: string): Promise<Result<Event>> {
    const reach = await this.scope.reachOf(actorId);
    const event = await this.events.findReachable(eventId, reach);

    return event === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(event);
  }
}
