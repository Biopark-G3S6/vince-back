import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import type {
  ArticleCitationDto,
  ArticleQuery,
  ArticleReferenceDto,
  CitationCommand,
  ReferenceCommand,
  ReferenceQuery,
  UpdateReferenceCommand,
} from '../contracts/article.dto';
import { FAILURE, fail, failValidation, ok, type Result } from '../domain/failure';
import { ArticleRepository } from '../domain/ports/article-repository';
import { ArticleScope } from './article-scope';
import { validateReference } from './article-validation';

@Injectable()
export class CreateReferenceUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(command: ReferenceCommand): Promise<Result<ArticleReferenceDto>> {
    const article = await this.scope.editableArticle(command.actorId, command.articleId);

    if (!article.ok) {
      return article;
    }

    const violations = validateReference(command);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    return ok(
      await this.repo.createReference({
        id: uuidv7(),
        articleId: command.articleId,
        type: command.type.trim(),
        authors: command.authors,
        title: command.title.trim(),
        year: command.year ?? null,
        vehicle: command.vehicle?.trim() ?? null,
        edition: command.edition?.trim() ?? null,
        place: command.place?.trim() ?? null,
        publisher: command.publisher?.trim() ?? null,
        pages: command.pages?.trim() ?? null,
        doi: command.doi?.trim() ?? null,
        url: command.url?.trim() ?? null,
        actorId: command.actorId,
      }),
    );
  }
}

@Injectable()
export class ListReferencesUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(query: ArticleQuery): Promise<Result<readonly ArticleReferenceDto[]>> {
    const article = await this.scope.readableArticle(query.actorId, query.articleId);

    if (!article.ok) {
      return article;
    }

    return ok(await this.repo.listReferences(query.articleId));
  }
}

@Injectable()
export class UpdateReferenceUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(command: UpdateReferenceCommand): Promise<Result<ArticleReferenceDto>> {
    const article = await this.scope.editableArticle(command.actorId, command.articleId);

    if (!article.ok) {
      return article;
    }

    const updated = await this.repo.updateReference({
      id: command.referenceId,
      articleId: command.articleId,
      type: command.type?.trim(),
      authors: command.authors,
      title: command.title?.trim(),
      year: command.year,
      vehicle: command.vehicle?.trim() ?? command.vehicle,
      edition: command.edition?.trim() ?? command.edition,
      place: command.place?.trim() ?? command.place,
      publisher: command.publisher?.trim() ?? command.publisher,
      pages: command.pages?.trim() ?? command.pages,
      doi: command.doi?.trim() ?? command.doi,
      url: command.url?.trim() ?? command.url,
    });

    return updated === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(updated);
  }
}

@Injectable()
export class DeleteReferenceUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(query: ReferenceQuery): Promise<Result<void>> {
    const article = await this.scope.editableArticle(query.actorId, query.articleId);

    if (!article.ok) {
      return article;
    }

    if (await this.repo.referenceHasCitations(query.articleId, query.referenceId)) {
      return fail(FAILURE.REFERENCE_IN_USE);
    }

    const deleted = await this.repo.deleteReference(query.articleId, query.referenceId);

    return deleted ? ok(undefined) : fail(FAILURE.RESOURCE_NOT_FOUND);
  }
}

@Injectable()
export class CiteReferenceUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(command: CitationCommand): Promise<Result<ArticleCitationDto>> {
    const article = await this.scope.editableArticle(command.actorId, command.articleId);

    if (!article.ok) {
      return article;
    }

    const reference = await this.repo.findReference(command.articleId, command.referenceId);

    if (reference === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    return ok(
      await this.repo.createCitation({
        id: uuidv7(),
        articleId: command.articleId,
        referenceId: command.referenceId,
        kind: command.kind,
        locator: command.locator ?? null,
        page: command.page ?? null,
        actorId: command.actorId,
      }),
    );
  }
}
