import { Injectable } from '@nestjs/common';

import { toPage, type Page, type PageRequest } from '@shared/http/pagination';

import { FAILURE, fail, ok, type Result } from '../domain/failure';
import type { Grade, MemberGrade } from '../domain/grade';
import { ArticleRepository } from '../domain/ports/article-repository';
import { ArticleScope } from './article-scope';

/** As notas correntes e o histórico de avaliações (`ADR-0030` §18). */
@Injectable()
export class ListGradesUseCase {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async memberGrades(actorId: string, articleId: string): Promise<Result<readonly MemberGrade[]>> {
    const article = await this.articles.findById(articleId);

    if (article === null || !(await this.scope.readable(article, actorId))) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    return ok(await this.articles.listMemberGrades(articleId));
  }

  async history(
    actorId: string,
    articleId: string,
    request: PageRequest,
    userId?: string,
  ): Promise<Result<Page<Grade> | Page<MemberGrade>>> {
    const article = await this.articles.findById(articleId);

    if (article === null || !(await this.scope.readable(article, actorId))) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    if (userId === undefined) {
      const rows = await this.articles.listGradeHistory(articleId, request);

      return ok(toPage(request, rows.rows, rows.totalItems));
    }

    const rows = await this.articles.listMemberGradeHistory(articleId, userId, request);

    return ok(toPage(request, rows.rows, rows.totalItems));
  }
}
