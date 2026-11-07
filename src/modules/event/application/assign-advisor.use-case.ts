import { Injectable } from '@nestjs/common';

import type { AdvisorCommand } from '../contracts/event.dto';
import { isActive } from '../domain/event';
import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { EventRepository } from '../domain/ports/event-repository';
import { EventScope } from './event-scope';

/**
 * A designação de orientador (RF-EVT-003).
 *
 * Idempotente (E3): designar de novo conclui sem duplicar o vínculo. O professor fora do
 * escopo é recusado com `STUDENT_NOT_ELIGIBLE` — o código do catálogo nomeia o aluno, mas
 * a URS o atribui a este caso (E1), e inventar um segundo código para a mesma condição
 * quebraria `ADR-0025` §8.
 */
@Injectable()
export class AssignAdvisorUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly scope: EventScope,
  ) {}

  async execute(command: AdvisorCommand): Promise<Result<void>> {
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

    const eligible = await this.scope.eligibilityOf(event, [command.userId]);

    if (eligible.get(command.userId) !== true) {
      return fail(FAILURE.STUDENT_NOT_ELIGIBLE);
    }

    await this.events.addAdvisor(command.eventId, command.userId, command.actorId);

    return ok(undefined);
  }
}
