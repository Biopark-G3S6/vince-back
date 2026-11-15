import { Injectable } from '@nestjs/common';

import type { UpdateEventCommand } from '../contracts/event.dto';
import { isActive, violationsOfUpdate, withChanges, type Event } from '../domain/event';
import { FAILURE, fail, failValidation, ok, type Result } from '../domain/failure';
import { EventRepository } from '../domain/ports/event-repository';
import { EventScope } from './event-scope';

/**
 * A alteração do evento (RF-EVT-001).
 *
 * Escopo e ancestralidade não entram: são imutáveis depois da criação (`ADR-0032` §9), e
 * o comando sequer os declara. A redução de limite abaixo do uso projetado é recusada
 * pelo domínio (E4).
 */
@Injectable()
export class UpdateEventUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly scope: EventScope,
  ) {}

  async execute(command: UpdateEventCommand): Promise<Result<Event>> {
    const current = await this.events.findById(command.eventId);

    if (current === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }
    if (!(await this.scope.ownsEvent(command.actorId, current))) {
      return fail(FAILURE.PERMISSION_DENIED);
    }
    if (!isActive(current)) {
      return fail(FAILURE.VALIDATION_FAILED);
    }

    const violations = violationsOfUpdate(command, current);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    const saved = await this.events.save(withChanges(current, command));

    return saved === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(saved);
  }
}
