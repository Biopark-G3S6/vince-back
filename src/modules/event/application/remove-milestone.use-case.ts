import { Injectable } from '@nestjs/common';

import type { MilestoneQuery } from '../contracts/event.dto';
import { isActive } from '../domain/event';
import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { hasStarted } from '../domain/milestone';
import { EventRepository } from '../domain/ports/event-repository';
import { EventScope } from './event-scope';

/**
 * A remoção de etapa (RF-EVT-002 E2).
 *
 * Etapa já iniciada não é removível: é a ela que se prendem as entregas e os apontamentos
 * do ciclo de correção (RN3), e removê-la deixaria esses registros sem referente.
 */
@Injectable()
export class RemoveMilestoneUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly scope: EventScope,
  ) {}

  async execute(query: MilestoneQuery, now = new Date()): Promise<Result<void>> {
    const event = await this.events.findById(query.eventId);

    if (event === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }
    if (!(await this.scope.ownsEvent(query.actorId, event))) {
      return fail(FAILURE.PERMISSION_DENIED);
    }
    if (!isActive(event)) {
      return fail(FAILURE.VALIDATION_FAILED);
    }

    const milestone = await this.events.findMilestone(query.milestoneId);

    if (milestone === null || milestone.eventId !== query.eventId) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }
    if (hasStarted(milestone, now)) {
      return fail(FAILURE.VALIDATION_FAILED);
    }

    await this.events.deleteMilestone(milestone.id);

    return ok(undefined);
  }
}
