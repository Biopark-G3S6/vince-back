import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import type { CreateMilestoneCommand } from '../contracts/event.dto';
import { isActive } from '../domain/event';
import { FAILURE, fail, failValidation, ok, type Result } from '../domain/failure';
import {
  milestoneOf,
  scheduleConflicts,
  violationsOfDraft,
  type Milestone,
} from '../domain/milestone';
import { EventRepository } from '../domain/ports/event-repository';
import { EventScope } from './event-scope';

/**
 * A criação de etapa do cronograma (RF-EVT-002).
 *
 * A coerência é conferida sobre o **cronograma candidato**, e não sobre a etapa que
 * chegou: inserir uma etapa entre duas existentes pode quebrar a ordem sem que nada na
 * etapa informada esteja errado.
 */
@Injectable()
export class CreateMilestoneUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly scope: EventScope,
  ) {}

  async execute(command: CreateMilestoneCommand): Promise<Result<Milestone>> {
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

    const violations = violationsOfDraft(command);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    const milestone = milestoneOf(uuidv7(), command.eventId, {
      name: command.name,
      order: command.order,
      dueAt: command.dueAt,
    });
    const schedule = await this.events.listMilestones(command.eventId);

    if (scheduleConflicts([...schedule, milestone])) {
      return fail(FAILURE.MILESTONE_DATE_CONFLICT);
    }

    const created = await this.events.createMilestone(milestone);

    // `null` é a ordem já ocupada, arbitrada pelo índice único: entre conferir o
    // cronograma e gravar cabe outra criação, e é o banco que decide.
    return created === null ? fail(FAILURE.MILESTONE_DATE_CONFLICT) : ok(created);
  }
}
