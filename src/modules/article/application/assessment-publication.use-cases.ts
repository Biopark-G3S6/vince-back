import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import type {
  ArticleAssessmentDto,
  ArticleQuery,
  ExternalPublicationDto,
  GradeCommand,
  PublicationCommand,
  PublicationQuery,
  UpdatePublicationCommand,
} from '../contracts/article.dto';
import { FAILURE, fail, failValidation, ok, type Result } from '../domain/failure';
import { ArticleRepository } from '../domain/ports/article-repository';
import type { ArticleAssessment, ExternalPublication } from '../domain/ports/article-repository';
import { ArticleScope } from './article-scope';

const MIN_SCORE = 0;
const MAX_SCORE = 10;

@Injectable()
export class RecordGradeUseCase {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}
  async execute(command: GradeCommand): Promise<Result<ArticleAssessmentDto>> {
    const article = await this.scope.readableArticle(command.actorId, command.articleId);
    if (!article.ok) return article;
    if (article.value.advisorId !== command.actorId) return fail(FAILURE.PERMISSION_DENIED);
    if (!Number.isFinite(command.score) || command.score < MIN_SCORE || command.score > MAX_SCORE)
      return failValidation([{ field: 'score', code: 'MALFORMED' }]);
    if (command.memberId !== undefined && !article.value.memberIds.includes(command.memberId))
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    return ok(
      toAssessment(
        await this.articles.createAssessment({
          articleId: command.articleId,
          memberId: command.memberId ?? null,
          score: command.score,
          evaluatedBy: command.actorId,
        }),
      ),
    );
  }
}

@Injectable()
export class ListGradesUseCase {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}
  async execute(query: ArticleQuery): Promise<Result<readonly ArticleAssessmentDto[]>> {
    const article = await this.scope.readableArticle(query.actorId, query.articleId);
    if (!article.ok) return article;
    if (article.value.advisorId !== query.actorId) return fail(FAILURE.PERMISSION_DENIED);
    return ok((await this.articles.listAssessments(query.articleId)).map(toAssessment));
  }
}

@Injectable()
export class CreatePublicationUseCase {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}
  async execute(command: PublicationCommand): Promise<Result<ExternalPublicationDto>> {
    const article = await this.scope.readableArticle(command.actorId, command.articleId);
    if (!article.ok) return article;
    if (
      !article.value.memberIds.includes(command.actorId) &&
      article.value.advisorId !== command.actorId
    )
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    const violations = publicationViolations(command);
    if (violations.length > 0) return failValidation(violations);
    return ok(
      toPublication(
        await this.articles.createPublication({
          id: uuidv7(),
          articleId: command.articleId,
          venueName: command.venueName.trim(),
          kind: command.kind,
          publicationDate: command.publicationDate,
          url: command.url.trim(),
          createdBy: command.actorId,
          updatedBy: command.actorId,
        }),
      ),
    );
  }
}

@Injectable()
export class ListPublicationsUseCase {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}
  async execute(query: ArticleQuery): Promise<Result<readonly ExternalPublicationDto[]>> {
    const article = await this.scope.readableArticle(query.actorId, query.articleId);
    if (!article.ok) return article;
    if (
      !article.value.memberIds.includes(query.actorId) &&
      article.value.advisorId !== query.actorId
    )
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    return ok((await this.articles.listPublications(query.articleId)).map(toPublication));
  }
}

@Injectable()
export class UpdatePublicationUseCase {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}
  async execute(command: UpdatePublicationCommand): Promise<Result<ExternalPublicationDto>> {
    const article = await this.scope.readableArticle(command.actorId, command.articleId);
    if (!article.ok) return article;
    if (
      !article.value.memberIds.includes(command.actorId) &&
      article.value.advisorId !== command.actorId
    )
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    if ((await this.articles.findPublication(command.articleId, command.publicationId)) === null)
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    const violations = publicationViolations(command);
    if (violations.length > 0) return failValidation(violations);
    const result = await this.articles.updatePublication({
      id: command.publicationId,
      articleId: command.articleId,
      updatedBy: command.actorId,
      venueName: command.venueName?.trim(),
      kind: command.kind,
      publicationDate: command.publicationDate,
      url: command.url?.trim(),
    });
    return result === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(toPublication(result));
  }
}

@Injectable()
export class DeletePublicationUseCase {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}
  async execute(query: PublicationQuery): Promise<Result<void>> {
    const article = await this.scope.readableArticle(query.actorId, query.articleId);
    if (!article.ok) return article;
    if (
      !article.value.memberIds.includes(query.actorId) &&
      article.value.advisorId !== query.actorId
    )
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    return (await this.articles.deletePublication(query.articleId, query.publicationId))
      ? ok(undefined)
      : fail(FAILURE.RESOURCE_NOT_FOUND);
  }
}

@Injectable()
export class CountSystemPublicationsUseCase {
  constructor(private readonly articles: ArticleRepository) {}
  execute(courseId: string, periodStart: Date, periodEnd: Date): Promise<number> {
    return this.articles.countPublications(courseId, periodStart, periodEnd);
  }
}

function publicationViolations(
  value: Partial<PublicationCommand>,
): { field: string; code: 'REQUIRED' | 'MALFORMED' | 'TOO_LONG' }[] {
  const errors: { field: string; code: 'REQUIRED' | 'MALFORMED' | 'TOO_LONG' }[] = [];
  if (value.venueName !== undefined && value.venueName.trim().length === 0)
    errors.push({ field: 'venueName', code: 'REQUIRED' });
  if (value.venueName !== undefined && value.venueName.length > 300)
    errors.push({ field: 'venueName', code: 'TOO_LONG' });
  if (value.url !== undefined) {
    try {
      const url = new URL(value.url);
      if (url.protocol !== 'http:' && url.protocol !== 'https:')
        errors.push({ field: 'url', code: 'MALFORMED' });
    } catch {
      errors.push({ field: 'url', code: 'MALFORMED' });
    }
  }
  if (value.publicationDate !== undefined && Number.isNaN(value.publicationDate.getTime()))
    errors.push({ field: 'publicationDate', code: 'MALFORMED' });
  return errors;
}
function toAssessment(value: ArticleAssessment): ArticleAssessmentDto {
  return {
    id: value.id,
    articleId: value.articleId,
    memberId: value.memberId,
    score: value.score,
    evaluatedBy: value.evaluatedBy,
    createdAt: value.createdAt,
  };
}
function toPublication(value: ExternalPublication): ExternalPublicationDto {
  return { ...value };
}
