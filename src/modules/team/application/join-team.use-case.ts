import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { DomainEventBus } from '@shared/events/event-bus';

import type { JoinTeamCommand, MemberCommand } from '../contracts/team.dto';
import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { memberOf, type TeamMember } from '../domain/member';
import { TeamRepository } from '../domain/ports/team-repository';
import { publishFacts } from './publish-facts';
import { TeamScope } from './team-scope';

/**
 * O ingresso do aluno (RF-EQP-002) e a designação pelo orientador (RF-EQP-003).
 *
 * São o mesmo ato com atores diferentes, e as regras de participação são idênticas: por
 * isso compartilham o caminho de escrita, e divergem apenas em quem autoriza. Separá-los
 * em dois casos de uso duplicaria quatro recusas.
 */
@Injectable()
export class JoinTeamUseCase {
  constructor(
    private readonly teams: TeamRepository,
    private readonly scope: TeamScope,
    private readonly events: DomainEventBus,
  ) {}

  /** O aluno ingressa por conta própria: o ator é o candidato. */
  async join(command: JoinTeamCommand): Promise<Result<TeamMember>> {
    return this.enter(command.actorId, command.teamId, command.actorId, false);
  }

  /** O orientador designa: o ator autoriza, e o candidato é outro. */
  async assign(command: MemberCommand): Promise<Result<TeamMember>> {
    return this.enter(command.actorId, command.teamId, command.userId, true);
  }

  private async enter(
    actorId: string,
    teamId: string,
    userId: string,
    requiresAdvisor: boolean,
  ): Promise<Result<TeamMember>> {
    const team = await this.teams.findById(teamId);

    if (team === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const event = requiresAdvisor
      ? await this.scope.advisorEvent(team.eventId, actorId)
      : await this.scope.activeEvent(team.eventId);

    if (!event.ok) {
      return event;
    }

    if (!(await this.scope.isEligible(team.eventId, userId))) {
      return fail(FAILURE.STUDENT_NOT_ELIGIBLE);
    }

    const outcome = await this.teams.addMember(
      memberOf(uuidv7(), team.eventId, teamId, userId),
      event.value.maxTeamSize,
    );

    if (outcome.kind === 'TEAM_FULL') {
      return fail(FAILURE.TEAM_SIZE_LIMIT_REACHED);
    }
    if (outcome.kind === 'ALREADY_IN_TEAM') {
      return fail(FAILURE.STUDENT_ALREADY_IN_TEAM);
    }

    await publishFacts(this.events, outcome.facts);

    return ok(outcome.member);
  }
}
