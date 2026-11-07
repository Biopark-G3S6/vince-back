import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { DomainEventBus } from '@shared/events/event-bus';

import type { InvitationResponseCommand } from '../contracts/team.dto';
import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { memberOf, type TeamMember } from '../domain/member';
import { TeamRepository } from '../domain/ports/team-repository';
import { publishFacts } from './publish-facts';
import { TeamScope } from './team-scope';

/**
 * O aceite e a recusa do convite (RF-EQP-004).
 *
 * Quem aceita é o **convidado**, e só ele: a titularidade é verificada aqui, dentro do
 * caso de uso, e não como permissão (`ADR-0014` §12).
 *
 * Todas as regras são reavaliadas no instante do aceite (RN2): prazo, elegibilidade,
 * unicidade por evento e lotação. A vaga pode ter sido preenchida entre a emissão e o
 * aceite, e é exatamente o cenário que a spec exige recusar.
 */
@Injectable()
export class RespondInvitationUseCase {
  constructor(
    private readonly teams: TeamRepository,
    private readonly scope: TeamScope,
    private readonly events: DomainEventBus,
  ) {}

  async accept(command: InvitationResponseCommand, now = new Date()): Promise<Result<TeamMember>> {
    const invitation = await this.teams.findInvitation(command.invitationId);

    if (invitation === null || invitation.userId !== command.actorId) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const event = await this.scope.activeEvent(invitation.eventId);

    if (!event.ok) {
      return event;
    }

    if (!(await this.scope.isEligible(invitation.eventId, command.actorId))) {
      return fail(FAILURE.STUDENT_NOT_ELIGIBLE);
    }

    const outcome = await this.teams.acceptInvitation(
      invitation.id,
      memberOf(uuidv7(), invitation.eventId, invitation.teamId, command.actorId, now),
      event.value.maxTeamSize,
      now,
    );

    switch (outcome.kind) {
      case 'EXPIRED':
        return fail(FAILURE.INVITATION_EXPIRED);
      case 'GONE':
        return fail(FAILURE.INVITATION_REVOKED);
      case 'TEAM_FULL':
        return fail(FAILURE.TEAM_SIZE_LIMIT_REACHED);
      case 'ALREADY_IN_TEAM':
        return fail(FAILURE.STUDENT_ALREADY_IN_TEAM);
      case 'JOINED':
        await publishFacts(this.events, outcome.facts);

        return ok(outcome.member);
    }
  }

  /** A recusa encerra o convite sem efeito sobre a equipe (`ADR-0033` §23). */
  async decline(command: InvitationResponseCommand): Promise<Result<void>> {
    const invitation = await this.teams.findInvitation(command.invitationId);

    if (invitation === null || invitation.userId !== command.actorId) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    await this.teams.declineInvitation(invitation.id);

    return ok(undefined);
  }
}
