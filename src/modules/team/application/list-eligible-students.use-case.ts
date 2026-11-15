import { Injectable } from '@nestjs/common';

import { EventFacade } from '@modules/event/contracts/event.facade';
import type { Page, PageRequest } from '@shared/http/pagination';

import { ok, type Result } from '../domain/failure';
import { TeamRepository } from '../domain/ports/team-repository';
import { TeamScope } from './team-scope';

/**
 * Os alunos elegíveis que ainda não integram equipe (RF-EQP-006).
 *
 * A consulta cruza duas fronteiras: a elegibilidade é do escopo, que `event` resolve; a
 * participação é daqui. Não há junção possível entre os dois lados (`ADR-0006`), então a
 * página vem do escopo e o desconto acontece aqui, em **uma** consulta pelos
 * identificadores daquela página (`ADR-0011` §9).
 *
 * _Consequência declarada:_ o desconto é posterior à paginação, de modo que uma página
 * pode voltar **mais curta** que `pageSize` — nunca com um aluno errado, e nunca
 * omitindo quem deveria aparecer em outra página. A alternativa, descontar antes de
 * paginar, exigiria trazer o escopo inteiro para a memória, que é justamente o que
 * `ADR-0011` §6 proíbe.
 */
@Injectable()
export class ListEligibleStudentsUseCase {
  constructor(
    private readonly teams: TeamRepository,
    private readonly scope: TeamScope,
    private readonly events: EventFacade,
  ) {}

  async execute(
    actorId: string,
    eventId: string,
    request: PageRequest,
  ): Promise<Result<Page<string>>> {
    const event = await this.scope.advisorEvent(eventId, actorId);

    if (!event.ok) {
      return event;
    }

    const eligible = await this.events.eligibleStudentsOf({ eventId, request });
    const engaged = new Set(await this.teams.activeMemberIdsOf(eventId, eligible.items));

    return ok({
      items: eligible.items.filter((userId) => !engaged.has(userId)),
      pagination: eligible.pagination,
    });
  }
}
