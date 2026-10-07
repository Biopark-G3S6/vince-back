import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import type {
  ArticleDto,
  ArticleQuery,
  ArticleRemarkDto,
  ArticleSubmissionDto,
  DecideRemarkCommand,
  RemarkCommand,
  RemarkQuery,
  SubmissionComparisonDto,
  SubmissionQuery,
  SubmitArticleCommand,
  UpdateRemarkCommand,
  WordDifferenceDto,
} from '../contracts/article.dto';
import {
  ARTICLE_STATUS,
  REMARK_STATUS,
  TEXT_MAX_LENGTH,
  VERSION_KIND,
  currentTextOf,
  type ArticleSubmission,
  type JsonValue,
  type RemarkStatus,
  validateRequiredText,
} from '../domain/article';
import {
  FAILURE,
  fail,
  failValidation,
  ok,
  type FieldViolation,
  type Result,
} from '../domain/failure';
import { ArticleRepository } from '../domain/ports/article-repository';
import { ArticleScope } from './article-scope';

@Injectable()
export class SubmitArticleUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(command: SubmitArticleCommand): Promise<Result<ArticleSubmissionDto>> {
    const article = await this.scope.editableArticle(command.actorId, command.articleId);

    if (!article.ok) {
      return article;
    }

    if (article.value.currentMilestoneId === null || article.value.currentMilestoneOrder === null) {
      return fail(FAILURE.MILESTONE_NOT_OPEN);
    }

    const submission = await this.repo.createSubmission({
      id: uuidv7(),
      articleId: command.articleId,
      milestoneId: article.value.currentMilestoneId,
      milestoneOrder: article.value.currentMilestoneOrder,
      content: article.value.content,
      submittedBy: command.automatic === true ? null : command.actorId,
      automatic: command.automatic === true,
    });

    if (submission === 'ALREADY_EXISTS') {
      return fail(FAILURE.SUBMISSION_ALREADY_MADE);
    }

    await this.repo.createVersion({
      id: uuidv7(),
      articleId: command.articleId,
      kind: VERSION_KIND.SUBMISSION,
      content: article.value.content,
      authorId: command.automatic === true ? null : command.actorId,
      metadata: { submissionId: submission.id, automatic: submission.automatic },
    });
    await this.repo.updateArticleStatus(command.articleId, ARTICLE_STATUS.IN_REVIEW);

    return ok(submission);
  }
}

@Injectable()
export class ListSubmissionsUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(query: ArticleQuery): Promise<Result<readonly ArticleSubmissionDto[]>> {
    const article = await this.scope.readableArticle(query.actorId, query.articleId);

    if (!article.ok) {
      return article;
    }

    return ok(await this.repo.listSubmissions(query.articleId));
  }
}

@Injectable()
export class RevokeSubmissionUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(query: SubmissionQuery): Promise<Result<ArticleDto>> {
    const article = await this.scope.readableArticle(query.actorId, query.articleId);

    if (!article.ok) {
      return article;
    }

    if (!article.value.memberIds.includes(query.actorId)) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const submission = await this.repo.findSubmission(query.articleId, query.submissionId);

    if (submission === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    if (submission.automatic) {
      return fail(FAILURE.MILESTONE_DEADLINE_PASSED);
    }

    if (await this.repo.hasRemarksForSubmission(query.submissionId)) {
      return fail(FAILURE.REVIEW_ALREADY_STARTED);
    }

    await this.repo.deleteSubmission(query.articleId, query.submissionId);
    const updated = await this.repo.updateArticleStatus(
      query.articleId,
      ARTICLE_STATUS.IN_PROGRESS,
    );

    return updated === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(updated);
  }
}

@Injectable()
export class CreateRemarkUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(command: RemarkCommand): Promise<Result<ArticleRemarkDto>> {
    const article = await this.scope.reviewableByAdvisor(command.actorId, command.articleId);

    if (!article.ok) {
      return article;
    }

    const submission = await this.repo.findSubmission(command.articleId, command.submissionId);

    if (submission === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const violations: FieldViolation[] = [];
    validateRequiredText('body', command.body, TEXT_MAX_LENGTH, violations);
    validateRequiredText('originalText', command.originalText, TEXT_MAX_LENGTH, violations);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    return ok(
      await this.repo.createRemark({
        id: uuidv7(),
        articleId: command.articleId,
        submissionId: command.submissionId,
        anchor: command.anchor,
        originalText: command.originalText,
        currentText: currentTextOf(article.value.content, command.anchor),
        body: command.body.trim(),
        actorId: command.actorId,
      }),
    );
  }
}

@Injectable()
export class ListRemarksUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(query: ArticleQuery): Promise<Result<readonly ArticleRemarkDto[]>> {
    const article = await this.scope.readableArticle(query.actorId, query.articleId);

    if (!article.ok) {
      return article;
    }

    const remarks = await this.repo.listRemarks(query.articleId);

    return article.value.advisorId === query.actorId
      ? ok(remarks)
      : ok(remarks.filter((remark) => remark.visibleToTeam));
  }
}

@Injectable()
export class FindRemarkUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(query: RemarkQuery): Promise<Result<ArticleRemarkDto>> {
    const article = await this.scope.readableArticle(query.actorId, query.articleId);

    if (!article.ok) {
      return article;
    }

    const remark = await this.repo.findRemark(query.articleId, query.remarkId);

    if (remark === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    if (!remark.visibleToTeam && article.value.advisorId !== query.actorId) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    return ok({ ...remark, currentText: currentTextOf(article.value.content, remark.anchor) });
  }
}

@Injectable()
export class UpdateRemarkUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(command: UpdateRemarkCommand): Promise<Result<ArticleRemarkDto>> {
    const article = await this.scope.reviewableByAdvisor(command.actorId, command.articleId);

    if (!article.ok) {
      return article;
    }

    const remark = await this.repo.findRemark(command.articleId, command.remarkId);

    if (remark === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    if (isClosedRemark(remark.status)) {
      return fail(FAILURE.REMARK_ALREADY_CLOSED);
    }

    const updated = await this.repo.updateRemarkBody(
      command.articleId,
      command.remarkId,
      command.body.trim(),
    );

    return updated === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(updated);
  }
}

@Injectable()
export class ReturnArticleUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(query: ArticleQuery): Promise<Result<ArticleDto>> {
    const article = await this.scope.reviewableByAdvisor(query.actorId, query.articleId);

    if (!article.ok) {
      return article;
    }

    await this.repo.revealRemarks(query.articleId);
    const updated = await this.repo.updateArticleStatus(
      query.articleId,
      ARTICLE_STATUS.IN_PROGRESS,
    );

    return updated === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(updated);
  }
}

@Injectable()
export class AddressRemarkUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(query: RemarkQuery): Promise<Result<ArticleRemarkDto>> {
    const article = await this.scope.editableArticle(query.actorId, query.articleId);

    if (!article.ok) {
      return article;
    }

    const remark = await this.repo.findRemark(query.articleId, query.remarkId);

    if (remark === null || !remark.visibleToTeam) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    if (isClosedRemark(remark.status)) {
      return fail(FAILURE.REMARK_ALREADY_CLOSED);
    }

    const updated = await this.repo.setRemarkStatus(
      query.articleId,
      query.remarkId,
      REMARK_STATUS.ADDRESSED,
      query.actorId,
    );

    return updated === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(updated);
  }
}

@Injectable()
export class ReopenAddressedRemarkUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(query: RemarkQuery): Promise<Result<ArticleRemarkDto>> {
    const article = await this.scope.editableArticle(query.actorId, query.articleId);

    if (!article.ok) {
      return article;
    }

    const updated = await this.repo.setRemarkStatus(
      query.articleId,
      query.remarkId,
      REMARK_STATUS.OPEN,
      query.actorId,
    );

    return updated === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(updated);
  }
}

@Injectable()
export class DecideRemarkUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(command: DecideRemarkCommand): Promise<Result<ArticleRemarkDto>> {
    const article = await this.scope.reviewableByAdvisor(command.actorId, command.articleId);

    if (!article.ok) {
      return article;
    }

    const remark = await this.repo.findRemark(command.articleId, command.remarkId);

    if (remark === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    if (isClosedRemark(remark.status)) {
      return fail(FAILURE.REMARK_ALREADY_CLOSED);
    }

    const updated = await this.repo.setRemarkStatus(
      command.articleId,
      command.remarkId,
      command.decision,
      command.actorId,
      command.reason,
    );

    return updated === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(updated);
  }
}

@Injectable()
export class CompareSubmissionUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(query: SubmissionQuery): Promise<Result<SubmissionComparisonDto>> {
    const article = await this.scope.readableArticle(query.actorId, query.articleId);

    if (!article.ok) {
      return article;
    }

    const submissions = await this.repo.listSubmissions(query.articleId);
    const submission = submissions.find((item) => item.id === query.submissionId);

    if (submission === undefined) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const previous = previousSubmissionOf(submissions, submission);

    return ok({
      submission,
      previousSubmission: previous,
      differences: diffWords(
        stringifyContent(previous?.content ?? {}),
        stringifyContent(submission.content),
      ),
    });
  }
}

@Injectable()
export class ConcludeArticleUseCase {
  constructor(
    private readonly repo: ArticleRepository,
    private readonly scope: ArticleScope,
  ) {}

  async execute(query: ArticleQuery): Promise<Result<ArticleDto>> {
    const article = await this.scope.reviewableByAdvisor(query.actorId, query.articleId);

    if (!article.ok) {
      return article;
    }

    if (
      article.value.lastMilestoneOrder !== null &&
      article.value.currentMilestoneOrder !== null &&
      article.value.currentMilestoneOrder < article.value.lastMilestoneOrder
    ) {
      return fail(FAILURE.MILESTONE_PENDING);
    }

    if (await this.repo.hasOpenRemarks(query.articleId)) {
      return fail(FAILURE.REMARK_PENDING);
    }

    const updated = await this.repo.updateArticleStatus(query.articleId, ARTICLE_STATUS.FINISHED);

    return updated === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(updated);
  }
}

function isClosedRemark(status: RemarkStatus): boolean {
  return status === REMARK_STATUS.RESOLVED || status === REMARK_STATUS.DISMISSED;
}

function previousSubmissionOf(
  submissions: readonly ArticleSubmission[],
  submission: ArticleSubmission,
): ArticleSubmission | null {
  return (
    submissions
      .filter((item) => item.milestoneOrder < submission.milestoneOrder)
      .sort((left, right) => right.milestoneOrder - left.milestoneOrder)[0] ?? null
  );
}

function stringifyContent(content: JsonValue): string {
  return JSON.stringify(content);
}

function diffWords(before: string, after: string): readonly WordDifferenceDto[] {
  const left = new Set(before.split(/\s+/).filter((word) => word.length > 0));
  const right = new Set(after.split(/\s+/).filter((word) => word.length > 0));
  const removed = [...left]
    .filter((word) => !right.has(word))
    .map((value) => ({ kind: 'REMOVED' as const, value }));
  const inserted = [...right]
    .filter((word) => !left.has(word))
    .map((value) => ({ kind: 'INSERTED' as const, value }));

  return [...removed, ...inserted];
}
