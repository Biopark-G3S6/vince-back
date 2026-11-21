import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { DomainEventBus } from '@shared/events/event-bus';

import type { CreateTeamCommand } from '../contracts/team.dto';
import { FAILURE, fail, failValidation, ok, type Result } from '../domain/failure';
import { TeamRepository } from '../domain/ports/team-repository';
import { teamOf, violationsOfDraft, type Team } from '../domain/team';
import { publishFacts } from './publish-facts';
import { TeamScope } from './team-scope';

/**
 * A criação da equipe (RF-EQP-001).
 *
 * O artigo **não** é criado aqui: a equipe grava `TeamCreated` na sua outbox e o módulo
 * `article` o consome, criando o artigo `STARTED` de forma idempotente (`ADR-0033` §17,
 * §18). A transação desta operação não espera por esse consumo, e nenhum consumidor pode
 * desfazê-la.
 *
 * O limite de equipes é conferido **dentro** da transação de escrita (§14): a leitura
 * prévia do limite informa, e é o repositório que arbitra.
 */
@Injectable()
export class CreateTeamUseCase {
  constructor(
    private readonly teams: TeamRepository,
    private readonly scope: TeamScope,
    private readonly events: DomainEventBus,
  ) {}

  async execute(command: CreateTeamCommand): Promise<Result<Team>> {
    const violations = violationsOfDraft(command);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    const event = await this.scope.advisorEvent(command.eventId, command.actorId);

    if (!event.ok) {
      return event;
    }

    const team = teamOf(uuidv7(), command.eventId, event.value.institutionId as string, command);
    const outcome = await this.teams.createTeam(
      team,
      event.value.maxTeams,
      command.articleTitle?.trim() || null,
    );

    if (outcome.kind === 'LIMIT_REACHED') {
      return fail(FAILURE.EVENT_TEAM_LIMIT_REACHED);
    }
    if (outcome.kind === 'DUPLICATE') {
      return failValidation([{ field: 'identification', code: 'ALREADY_USED' }]);
    }

    await publishFacts(this.events, outcome.facts);

    return ok(outcome.team);
  }
}
