import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import type { CreateEventCommand } from '../contracts/event.dto';
import { eventOf, isEventScopeType, violationsOfDraft, type Event } from '../domain/event';
import { failValidation, ok, type Result } from '../domain/failure';
import { EventRepository } from '../domain/ports/event-repository';
import { EventScope } from './event-scope';

/**
 * A criação do evento (RF-EVT-001).
 *
 * A ordem das verificações é deliberada: primeiro a forma do que chegou, depois o alvo e
 * a titularidade. Inverter faria o sistema responder sobre a existência de uma turma
 * antes de saber se o pedido era sequer válido.
 */
@Injectable()
export class CreateEventUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly scope: EventScope,
  ) {}

  async execute(command: CreateEventCommand): Promise<Result<Event>> {
    const violations = violationsOfDraft(command);
    const scopeType = command.scopeType;

    // O tipo de escopo é conferido junto das demais violações, e não antes delas: quem
    // errou o escopo provavelmente errou mais coisas, e uma resposta por vez transforma
    // o preenchimento do formulário em adivinhação.
    if (!isEventScopeType(scopeType)) {
      return failValidation([...violations, { field: 'scopeType', code: 'UNSUPPORTED' }]);
    }

    if (violations.length > 0) {
      return failValidation(violations);
    }

    const target = await this.scope.ownedTarget(command.actorId, scopeType, command.scopeId);

    if (!target.ok) {
      return target;
    }

    const event = eventOf(
      {
        id: uuidv7(),
        institutionId: target.value.institutionId,
        courseId: target.value.courseId,
        scopeType,
        scopeId: command.scopeId,
        ownerId: command.actorId,
      },
      command,
    );

    return ok(await this.events.create(event));
  }
}
