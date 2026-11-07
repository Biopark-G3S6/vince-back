import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import type { InviteMemberCommand } from '../contracts/team.dto';
import { FAILURE, fail, failValidation, ok, type Result } from '../domain/failure';
import { invitationOf, violationsOfInvitation, type TeamInvitation } from '../domain/invitation';
import { TeamRepository } from '../domain/ports/team-repository';
import { TeamScope } from './team-scope';

/**
 * O convite de integrante (RF-EQP-004).
 *
 * A emissão **não reserva vaga**: ela confere elegibilidade e prazo, e todas as regras
 * são reavaliadas no aceite (RN2). Reservar aqui bloquearia a vaga de quem talvez nunca
 * aceite.
 */
@Injectable()
export class InviteMemberUseCase {
  constructor(
    private readonly teams: TeamRepository,
    private readonly scope: TeamScope,
  ) {}

  async execute(command: InviteMemberCommand, now = new Date()): Promise<Result<TeamInvitation>> {
    const violations = violationsOfInvitation(command.expiresAt, now);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    const team = await this.teams.findById(command.teamId);

    if (team === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const event = await this.scope.advisorEvent(team.eventId, command.actorId);

    if (!event.ok) {
      return event;
    }

    if (!(await this.scope.isEligible(team.eventId, command.userId))) {
      return fail(FAILURE.STUDENT_NOT_ELIGIBLE);
    }

    const invitation = await this.teams.createInvitation(
      invitationOf(uuidv7(), team.eventId, command.teamId, command.userId, command.expiresAt),
    );

    // `null` é convite pendente já existente para o mesmo aluno: repetir a emissão não
    // enfileira convites, e o pedido conclui sem criar um segundo.
    return invitation === null
      ? failValidation([{ field: 'userId', code: 'ALREADY_INVITED' }])
      : ok(invitation);
  }
}
