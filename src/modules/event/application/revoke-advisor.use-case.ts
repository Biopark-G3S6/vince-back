import { Injectable } from '@nestjs/common';

import type { AdvisorCommand } from '../contracts/event.dto';
import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { EventRepository } from '../domain/ports/event-repository';
import { EventScope } from './event-scope';

/**
 * A revogação de orientador (RF-EVT-003).
 *
 * Idempotente, e permitida em evento cancelado: desfazer vínculo é o que se faz ao
 * encerrar, e recusá-lo ali deixaria a designação presa ao evento morto.
 */
@Injectable()
export class RevokeAdvisorUseCase {
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

    await this.events.removeAdvisor(command.eventId, command.userId, command.actorId);

    return ok(undefined);
  }
}
