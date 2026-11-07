import { Injectable } from '@nestjs/common';

import type { TeamUsageEvent } from '../contracts/event.dto';
import { EventRepository } from '../domain/ports/event-repository';

/**
 * O consumo do fato de formação, que alimenta a projeção de uso (`ADR-0032` §16).
 *
 * Idempotente pela tabela de eventos processados: a reentrega do mesmo fato não altera
 * nada. **Não reverte** o que `team` gravou e não falha a transação dela — a projeção é
 * conveniência de recusa antecipada, e a sua defasagem não autoriza equipe acima do teto
 * (§17).
 *
 * Fato sem identificador não é processado: sem ele não há como garantir a idempotência, e
 * aplicar às cegas seria pior do que descartar.
 */
@Injectable()
export class ConsumeTeamUsageUseCase {
  constructor(private readonly events: EventRepository) {}

  async execute(event: TeamUsageEvent): Promise<void> {
    if (event.factId.length === 0 || event.eventId.length === 0) {
      return;
    }

    await this.events.projectTeamUsage({
      factId: event.factId,
      factType: event.factType,
      eventId: event.eventId,
      teamsInUse: Math.max(0, event.teamsInUse),
      largestTeamSize: Math.max(0, event.largestTeamSize),
    });
  }
}
