import { Injectable } from '@nestjs/common';

import { toPage, type Page, type PageRequest } from '@shared/http/pagination';

import { ok, type Result } from '../domain/failure';
import type { TeamInvitation } from '../domain/invitation';
import { TeamRepository } from '../domain/ports/team-repository';

/**
 * Os convites que o aluno recebeu (`team-read-extensions`, RF-EQP-004).
 *
 * O aceite e a recusa são por identificador de convite; sem esta consulta, o convidado não
 * teria como descobri-lo. A titularidade é o próprio filtro: só o que é endereçado ao ator.
 */
@Injectable()
export class ListReceivedInvitationsUseCase {
  constructor(private readonly teams: TeamRepository) {}

  async execute(actorId: string, request: PageRequest): Promise<Result<Page<TeamInvitation>>> {
    const rows = await this.teams.listReceivedInvitations(actorId, new Date(), request);

    return ok(toPage(request, rows.rows, rows.totalItems));
  }
}
