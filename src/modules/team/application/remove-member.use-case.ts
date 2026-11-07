import { Injectable } from '@nestjs/common';

import { DomainEventBus } from '@shared/events/event-bus';

import type { MemberCommand } from '../contracts/team.dto';
import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { TeamRepository } from '../domain/ports/team-repository';
import { publishFacts } from './publish-facts';
import { TeamScope } from './team-scope';

/**
 * A remoção de integrante (RF-EQP-003).
 *
 * Idempotente, e **não destrutiva**: a participação é encerrada, não apagada (RN2,
 * `ADR-0033` §9). A contribuição e a nota individual de quem saiu continuam consultáveis
 * na vertical do artigo, e apagar a linha as deixaria sem referente.
 */
@Injectable()
export class RemoveMemberUseCase {
  constructor(
    private readonly teams: TeamRepository,
    private readonly scope: TeamScope,
    private readonly events: DomainEventBus,
  ) {}

  async execute(command: MemberCommand, now = new Date()): Promise<Result<void>> {
    const team = await this.teams.findById(command.teamId);

    if (team === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const event = await this.scope.advisorEvent(team.eventId, command.actorId);

    if (!event.ok) {
      return event;
    }

    const outcome = await this.teams.removeMember(command.teamId, command.userId, now);

    await publishFacts(this.events, outcome.facts);

    return ok(undefined);
  }
}
