import { Injectable } from '@nestjs/common';

import { EventFacade } from '@modules/event/contracts/event.facade';

import type { ArticleSituationDto } from '../contracts/article.dto';
import type { Article } from '../domain/article';
import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { ArticleRepository } from '../domain/ports/article-repository';
import { ArticleScope } from './article-scope';

/**
 * A situação do artigo (RF-ART-001).
 *
 * Fora do alcance do ator, `RESOURCE_NOT_FOUND` (E1) — e não `PERMISSION_DENIED`: dizer
 * "existe, mas não é seu" revelaria a existência do artigo de outra equipe.
 *
 * A etapa corrente vem do cronograma do evento, por fachada: ela é dado de `event`, e
 * guardá-la aqui seria copiar o cronograma (`ADR-0030` §10).
 */
@Injectable()
export class FindSituationUseCase {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly scope: ArticleScope,
    private readonly events: EventFacade,
  ) {}

  async byId(actorId: string, articleId: string): Promise<Result<ArticleSituationDto>> {
    return this.situationOf(await this.articles.findById(articleId), actorId);
  }

  async byTeam(actorId: string, teamId: string): Promise<Result<ArticleSituationDto>> {
    return this.situationOf(await this.articles.findByTeam(teamId), actorId);
  }

  private async situationOf(
    article: Article | null,
    actorId: string,
  ): Promise<Result<ArticleSituationDto>> {
    if (article === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }
    if (!(await this.scope.readable(article, actorId))) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const [milestone, grade] = await Promise.all([
      this.events.currentMilestoneOf(article.eventId),
      this.articles.findGrade(article.id),
    ]);

    return ok({
      article,
      currentMilestone:
        milestone === null
          ? null
          : {
              id: milestone.id,
              name: milestone.name,
              order: milestone.order,
              dueAt: milestone.dueAt,
            },
      grade,
    });
  }
}
