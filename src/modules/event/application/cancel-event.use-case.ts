import { Injectable } from '@nestjs/common';

import { EVENT_STATUS, type Event } from '../domain/event';
import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { EventRepository } from '../domain/ports/event-repository';
import { EventScope } from './event-scope';

/**
 * O cancelamento (RF-EVT-001).
 *
 * Idempotente, e **não destrutivo**: o evento permanece consultável como cancelado, e o
 * que ele passa a recusar é a formação de equipe — recusa que acontece no módulo que
 * possui a equipe, ao consultar este estado (`ADR-0032` §19).
 */
@Injectable()
export class CancelEventUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly scope: EventScope,
  ) {}

  async execute(actorId: string, eventId: string): Promise<Result<Event>> {
    const current = await this.events.findById(eventId);

    if (current === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }
    if (!(await this.scope.ownsEvent(actorId, current))) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    const cancelled = await this.events.setStatus(eventId, EVENT_STATUS.CANCELLED);

    return cancelled === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(cancelled);
  }
}
