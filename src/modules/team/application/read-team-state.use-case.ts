import { Injectable } from '@nestjs/common';

import type { TeamMembershipDto, TeamStateDto } from '../contracts/team.dto';
import { isActiveMember } from '../domain/member';
import { TeamRepository } from '../domain/ports/team-repository';

/** O que se devolve para identificador que não corresponde a equipe alguma. */
const ABSENT: TeamStateDto = {
  exists: false,
  eventId: null,
  institutionId: null,
  responsibleAdvisorId: null,
};

/**
 * As consultas que outro módulo faz à equipe (`ADR-0033` §25).
 *
 * Nenhuma delas verifica permissão: quem chama é outro caso de uso, que já verificou a
 * sua. Repetir a verificação aqui exigiria conhecer o ator de quem pergunta, e não é isso
 * que `ADR-0014` §11 e §12 dividem entre borda e caso de uso.
 */
@Injectable()
export class ReadTeamStateUseCase {
  constructor(private readonly teams: TeamRepository) {}

  async stateOf(teamId: string): Promise<TeamStateDto> {
    const team = await this.teams.findById(teamId);

    if (team === null) {
      return ABSENT;
    }

    const advisor = await this.teams.activeAdvisorOf(teamId);

    return {
      exists: true,
      eventId: team.eventId,
      institutionId: team.institutionId,
      responsibleAdvisorId: advisor?.userId ?? null,
    };
  }

  /**
   * O vínculo do usuário com a equipe.
   *
   * `participated` é verdadeiro também para quem foi removido — é o que sustenta a
   * consulta da nota individual de quem saiu (`ADR-0030` §15).
   */
  async membershipOf(teamId: string, userId: string): Promise<TeamMembershipDto> {
    const history = await this.teams.membershipsOf(teamId, userId);

    return {
      active: history.some(isActiveMember),
      participated: history.length > 0,
    };
  }

  async activeMemberIdsOf(teamId: string): Promise<readonly string[]> {
    return (await this.teams.activeMembersOf(teamId)).map((member) => member.userId);
  }
}
