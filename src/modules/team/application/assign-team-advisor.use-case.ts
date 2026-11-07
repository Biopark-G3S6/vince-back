import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { EventFacade } from '@modules/event/contracts/event.facade';

import type { TeamAdvisorCommand } from '../contracts/team.dto';
import { advisorOf } from '../domain/advisor';
import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { TeamRepository } from '../domain/ports/team-repository';
import { TeamScope } from './team-scope';

/**
 * O orientador responsável pela equipe (RF-EQP-005).
 *
 * Quem nomeia é o **dono do escopo** do evento, e o nomeado precisa já estar designado
 * como orientador **do evento** (E1): a responsabilidade direta distribui a carga entre
 * quem já orienta, e não cria orientação nova.
 *
 * A designação substitui o responsável anterior em uma só transação: uma equipe tem no
 * máximo um responsável ativo (RN3), e passar por um estado sem responsável deixaria a
 * avaliação sem titular.
 */
@Injectable()
export class AssignTeamAdvisorUseCase {
  constructor(
    private readonly teams: TeamRepository,
    private readonly scope: TeamScope,
    private readonly events: EventFacade,
  ) {}

  async assign(command: TeamAdvisorCommand): Promise<Result<void>> {
    const team = await this.teams.findById(command.teamId);

    if (team === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const event = await this.scope.ownedEvent(team.eventId, command.actorId);

    if (!event.ok) {
      return event;
    }

    if (!(await this.events.isAdvisor(team.eventId, command.userId))) {
      return fail(FAILURE.ADVISOR_NOT_ASSIGNED_TO_EVENT);
    }

    await this.teams.assignAdvisor(
      advisorOf(uuidv7(), command.teamId, command.userId),
      command.actorId,
    );

    return ok(undefined);
  }

  /** A revogação é idempotente e vale também em evento cancelado. */
  async revoke(command: TeamAdvisorCommand): Promise<Result<void>> {
    const team = await this.teams.findById(command.teamId);

    if (team === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    if (!(await this.events.isScopeOwner(team.eventId, command.actorId))) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    await this.teams.revokeAdvisor(command.teamId, command.userId, command.actorId);

    return ok(undefined);
  }
}
