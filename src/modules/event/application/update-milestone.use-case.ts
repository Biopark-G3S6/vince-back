import { Injectable } from '@nestjs/common';

import type { UpdateMilestoneCommand } from '../contracts/event.dto';
import { isActive } from '../domain/event';
import { FAILURE, fail, failValidation, ok, type Result } from '../domain/failure';
import {
  scheduleConflicts,
  violationsOfUpdate,
  withChanges,
  type Milestone,
} from '../domain/milestone';
import { EventRepository } from '../domain/ports/event-repository';
import { EventScope } from './event-scope';

/** A alteração de etapa (RF-EVT-002), conferida sobre o cronograma inteiro. */
@Injectable()
export class UpdateMilestoneUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly scope: EventScope,
  ) {}

  async execute(command: UpdateMilestoneCommand): Promise<Result<Milestone>> {
    const event = await this.events.findById(command.eventId);

    if (event === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }
    if (!(await this.scope.ownsEvent(command.actorId, event))) {
      return fail(FAILURE.PERMISSION_DENIED);
    }
    if (!isActive(event)) {
      return fail(FAILURE.VALIDATION_FAILED);
    }

    const current = await this.events.findMilestone(command.milestoneId);

    if (current === null || current.eventId !== command.eventId) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const violations = violationsOfUpdate(command);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    const changed = withChanges(current, command);
    const schedule = await this.events.listMilestones(command.eventId);
    const candidate = schedule.map((entry) => (entry.id === changed.id ? changed : entry));

    if (scheduleConflicts(candidate)) {
      return fail(FAILURE.MILESTONE_DATE_CONFLICT);
    }

    const saved = await this.events.saveMilestone(changed);

    return saved === null ? fail(FAILURE.MILESTONE_DATE_CONFLICT) : ok(saved);
  }
}
