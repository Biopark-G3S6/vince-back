import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import type {
  ArticleDto,
  ArticlePresenceDto,
  ArticleQuery,
  ArticleVersionDto,
  CreateArticleCommand,
  ExportArticleCommand,
  ExportedArticleDto,
  FormatArticleCommand,
  FormatReportDto,
  ImportArticleCommand,
  PresenceCommand,
  RestoreVersionCommand,
  SaveContentCommand,
} from '../contracts/article.dto';
import {
  ARTICLE_STATUS,
  EXPORT_FORMAT,
  IMPORT_MAX_BYTES,
  VERSION_KIND,
  type JsonValue,
} from '../domain/article';
import { FAILURE, fail, ok, type Result } from '../domain/failure';
import { ArticleRepository } from '../domain/ports/article-repository';
import { ArticleScope } from './article-scope';

@Injectable()
export class CreateArticleUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(command: CreateArticleCommand): Promise<Result<ArticleDto>> {
    const institution = await this.scope.actorInstitution(command.actorId);

    if (!institution.ok) {
      return institution;
    }

    let content: JsonValue = {};

    if (command.templateVersionId !== undefined && command.templateVersionId !== null) {
      const templates = await this.repo.listTemplates(
        institution.value.id,
        {
          page: 1,
          pageSize: 100,
          withTotal: false,
        },
        { includeInactive: true },
      );
      const template = templates.items.find(
        (item) => item.currentVersionId === command.templateVersionId,
      );
      content = template?.content ?? {};
    }

    return ok(
      await this.repo.createArticle({
        id: uuidv7(),
        institutionId: command.institutionId ?? institution.value.id,
        courseId: command.courseId ?? null,
        eventId: command.eventId,
        teamId: command.teamId,
        advisorId: command.advisorId ?? null,
        memberIds: command.memberIds,
        currentMilestoneId: command.currentMilestoneId ?? null,
        currentMilestoneOrder: command.currentMilestoneOrder ?? null,
        currentMilestoneDeadline: command.currentMilestoneDeadline ?? null,
        lastMilestoneOrder: command.lastMilestoneOrder ?? null,
        templateVersionId: command.templateVersionId ?? null,
        content,
      }),
    );
  }
}

@Injectable()
export class FindArticleUseCase {
  constructor(private readonly scope: ArticleScope) {}

  async execute(query: ArticleQuery): Promise<Result<ArticleDto>> {
    return this.scope.readableArticle(query.actorId, query.articleId);
  }
}

@Injectable()
export class SaveContentUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(command: SaveContentCommand): Promise<Result<ArticleDto>> {
    const article = await this.scope.editableArticle(command.actorId, command.articleId);

    if (!article.ok) {
      return article;
    }

    const nextStatus =
      article.value.status === ARTICLE_STATUS.STARTED
        ? ARTICLE_STATUS.IN_PROGRESS
        : article.value.status;
    const saved = await this.repo.saveArticleContent(
      command.articleId,
      command.content,
      nextStatus,
    );

    if (saved === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    await this.repo.createVersion({
      id: uuidv7(),
      articleId: command.articleId,
      kind: VERSION_KIND.AUTOSAVE,
      content: command.content,
      authorId: command.actorId,
      metadata: { baseVersionId: command.baseVersionId ?? null },
    });

    return ok(saved);
  }
}

@Injectable()
export class MarkPresenceUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(command: PresenceCommand): Promise<Result<readonly ArticlePresenceDto[]>> {
    const article = await this.scope.editableArticle(command.actorId, command.articleId);

    if (!article.ok) {
      return article;
    }

    return ok(await this.repo.upsertPresence(command.articleId, command.actorId, command.cursor));
  }
}

@Injectable()
export class ApplyFormatUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(command: FormatArticleCommand): Promise<Result<FormatReportDto>> {
    const article = await this.scope.editableArticle(command.actorId, command.articleId);

    if (!article.ok) {
      return article;
    }

    await this.repo.createVersion({
      id: uuidv7(),
      articleId: command.articleId,
      kind: VERSION_KIND.FORMAT,
      content: article.value.content,
      authorId: command.actorId,
      metadata: { norm: 'ABNT', target: command.target ?? null },
    });

    return ok({
      article: article.value,
      changed: false,
      norm: 'ABNT',
      target: command.target ?? null,
      changes: [],
    });
  }
}

@Injectable()
export class ImportArticleUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(command: ImportArticleCommand): Promise<Result<ArticleDto>> {
    const article = await this.scope.editableArticle(command.actorId, command.articleId);

    if (!article.ok) {
      return article;
    }

    if (!command.fileName.toLowerCase().endsWith('.docx')) {
      return fail(FAILURE.FILE_FORMAT_NOT_SUPPORTED);
    }

    if (command.sizeBytes > IMPORT_MAX_BYTES) {
      return fail(FAILURE.FILE_TOO_LARGE);
    }

    const saved = await this.repo.saveArticleContent(
      command.articleId,
      command.content,
      ARTICLE_STATUS.IN_PROGRESS,
    );

    if (saved === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    await this.repo.createVersion({
      id: uuidv7(),
      articleId: command.articleId,
      kind: VERSION_KIND.IMPORT,
      content: command.content,
      authorId: command.actorId,
      metadata: {
        fileName: command.fileName,
        mimeType: command.mimeType,
        sizeBytes: command.sizeBytes,
        importedMetadata: command.metadata ?? null,
        confirmReplace: command.confirmReplace === true,
      },
    });

    return ok(saved);
  }
}

@Injectable()
export class ExportArticleUseCase {
  constructor(private readonly scope: ArticleScope) {}

  async execute(command: ExportArticleCommand): Promise<Result<ExportedArticleDto>> {
    const article = await this.scope.readableArticle(command.actorId, command.articleId);

    if (!article.ok) {
      return article;
    }

    return ok({
      articleId: command.articleId,
      format: command.format,
      fileName: `article-${command.articleId}.${command.format === EXPORT_FORMAT.PDF ? 'pdf' : 'docx'}`,
      content: article.value.content,
      generatedAt: new Date(),
    });
  }
}

@Injectable()
export class ListHistoryUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(query: ArticleQuery): Promise<Result<readonly ArticleVersionDto[]>> {
    const article = await this.scope.readableArticle(query.actorId, query.articleId);

    if (!article.ok) {
      return article;
    }

    if (
      !article.value.memberIds.includes(query.actorId) &&
      article.value.advisorId !== query.actorId
    ) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    return ok(await this.repo.listVersions(query.articleId));
  }
}

@Injectable()
export class RestoreVersionUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(command: RestoreVersionCommand): Promise<Result<ArticleDto>> {
    const article = await this.scope.editableArticle(command.actorId, command.articleId);

    if (!article.ok) {
      return article;
    }

    const version = await this.repo.findVersion(command.articleId, command.versionId);

    if (version === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const saved = await this.repo.saveArticleContent(
      command.articleId,
      version.content,
      article.value.status,
    );

    if (saved === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    await this.repo.createVersion({
      id: uuidv7(),
      articleId: command.articleId,
      kind: VERSION_KIND.RESTORE,
      content: version.content,
      authorId: command.actorId,
      metadata: { restoredVersionId: command.versionId },
    });

    return ok(saved);
  }
}
