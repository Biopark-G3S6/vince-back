import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import type { TeamCreatedEvent } from '../contracts/article.dto';
import { startedArticle } from '../domain/article';
import { ArticleRepository } from '../domain/ports/article-repository';

/**
 * A criação do artigo inicial, a partir do fato publicado por `team` (`ADR-0030` §9).
 *
 * Idempotente **pelo índice único** sobre `team_id`: a reentrega do mesmo fato encontra o
 * artigo já criado e conclui sem criar um segundo. Não participa da transação de `team` e
 * **não a reverte** (§11): se falhar, retentativa e dead-letter queue cuidam
 * (`ADR-0012`, `ADR-0021`), e a equipe continua existindo sem artigo até convergir.
 *
 * Fato sem equipe não é processado: sem o identificador não há o que criar, e inventá-lo
 * seria criar artigo órfão.
 */
@Injectable()
export class ConsumeTeamCreatedUseCase {
  constructor(private readonly articles: ArticleRepository) {}

  async execute(event: TeamCreatedEvent): Promise<void> {
    if (event.teamId.length === 0 || event.eventId.length === 0) {
      return;
    }

    await this.articles.createForTeam(
      startedArticle({
        id: uuidv7(),
        teamId: event.teamId,
        eventId: event.eventId,
        institutionId: event.institutionId,
      }),
      event.factId,
      'TeamCreated',
    );
  }
}
