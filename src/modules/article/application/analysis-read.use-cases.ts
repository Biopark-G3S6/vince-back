import { Injectable } from '@nestjs/common';

import { ArticleScope } from './article-scope';
import type {
  ArticleCorpusEntryDto,
  ArticleCorpusQuery,
  ArticleProgressDto,
  ArticleProgressQuery,
  ArticleQuery,
} from '../contracts/article.dto';
import { ok, type Result } from '../domain/failure';
import { ArticleRepository } from '../domain/ports/article-repository';

@Injectable()
export class ListArticleProgressUseCase {
  constructor(
    private readonly scope: ArticleScope,
    private readonly articles: ArticleRepository,
  ) {}

  async execute(
    query: ArticleProgressQuery,
  ): Promise<Result<import('@shared/http/pagination').Page<ArticleProgressDto>>> {
    const filter = await this.scope.progressFilter(query.actorId, query.scope, query.courseId);

    if (!filter.ok) {
      return filter;
    }

    const result = await this.articles.listProgress(filter.value, query.request);

    return ok({
      items: result.items.map(({ article, ...progress }) => ({
        articleId: article.id,
        institutionId: article.institutionId,
        courseId: article.courseId,
        eventId: article.eventId,
        teamId: article.teamId,
        advisorId: article.advisorId,
        memberIds: article.memberIds,
        status: article.status,
        currentMilestoneId: article.currentMilestoneId,
        currentMilestoneOrder: article.currentMilestoneOrder,
        currentMilestoneDeadline: article.currentMilestoneDeadline,
        lastMilestoneOrder: article.lastMilestoneOrder,
        ...progress,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
      })),
      pagination: result.pagination,
    });
  }
}

/** Projeção restrita a processos internos de consolidação, sem controller HTTP. */
@Injectable()
export class ListSystemArticleProgressUseCase {
  constructor(private readonly articles: ArticleRepository) {}

  async execute(
    request: import('@shared/http/pagination').PageRequest,
  ): Promise<Result<import('@shared/http/pagination').Page<ArticleProgressDto>>> {
    const result = await this.articles.listProgress({}, request);
    return ok({
      items: result.items.map(({ article, ...progress }) => ({
        articleId: article.id,
        institutionId: article.institutionId,
        courseId: article.courseId,
        eventId: article.eventId,
        teamId: article.teamId,
        advisorId: article.advisorId,
        memberIds: article.memberIds,
        status: article.status,
        currentMilestoneId: article.currentMilestoneId,
        currentMilestoneOrder: article.currentMilestoneOrder,
        currentMilestoneDeadline: article.currentMilestoneDeadline,
        lastMilestoneOrder: article.lastMilestoneOrder,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        ...progress,
      })),
      pagination: result.pagination,
    });
  }
}

@Injectable()
export class ListSimilarityCorpusUseCase {
  constructor(private readonly scope: ArticleScope) {}

  async execute(query: ArticleCorpusQuery): Promise<Result<readonly ArticleCorpusEntryDto[]>> {
    const result = await this.scope.similarityCorpus(query.actorId, query.articleId);

    if (!result.ok) {
      return result;
    }

    return ok(
      result.value.map(({ article, references, citations }) => ({
        articleId: article.id,
        content: article.content,
        references: references.map((reference) => ({ ...reference })),
        citations: citations.map((citation) => ({ ...citation })),
      })),
    );
  }
}

@Injectable()
export class ListArticleCitationsUseCase {
  constructor(
    private readonly scope: ArticleScope,
    private readonly articles: ArticleRepository,
  ) {}

  async execute(query: ArticleQuery) {
    const article = await this.scope.readableArticle(query.actorId, query.articleId);

    if (!article.ok) {
      return article;
    }

    const citations = await this.articles.listCitations(query.articleId);

    return ok(citations.map((citation) => ({ ...citation })));
  }
}
