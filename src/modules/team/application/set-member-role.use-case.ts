import { Injectable } from '@nestjs/common';

import type { MemberRoleCommand } from '../contracts/team.dto';
import { FAILURE, fail, failValidation, ok, type Result } from '../domain/failure';
import { isMemberRole, type TeamMember } from '../domain/member';
import { TeamRepository } from '../domain/ports/team-repository';
import { TeamScope } from './team-scope';

/**
 * O papel do integrante (`team-member-role`). Mesmo alcance da designação de integrante:
 * o orientador do evento organiza as equipes do evento.
 */
@Injectable()
export class SetMemberRoleUseCase {
  constructor(
    private readonly teams: TeamRepository,
    private readonly scope: TeamScope,
  ) {}

  async execute(command: MemberRoleCommand): Promise<Result<TeamMember>> {
    if (!isMemberRole(command.role)) {
      return failValidation([{ field: 'role', code: 'MALFORMED' }]);
    }

    const team = await this.teams.findById(command.teamId);

    if (team === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const event = await this.scope.advisorEvent(team.eventId, command.actorId);

    if (!event.ok) {
      return event;
    }

    const member = await this.teams.setMemberRole(command.teamId, command.userId, command.role);

    return member === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(member);
  }
}
