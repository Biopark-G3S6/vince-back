import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';
import { ApiFailure } from '@shared/errors/api-failure';
import { offsetOf, takeOf, toPage, type Page } from '@shared/http/pagination';
import { ArticleFacade } from '@modules/article/contracts/article.facade';
import { NotificationFacade } from '@modules/notification/contracts/notification.facade';
import type {
  DiscussionMessageDto,
  DiscussionQuery,
  PublishMessageCommand,
} from '../contracts/discussion.dto';
import { DiscussionRepository } from '../domain/ports/discussion-repository';

@Injectable()
export class DiscussionArticleScope {
  constructor(private readonly articles: ArticleFacade) {}

  async participant(actorId: string, articleId: string) {
    const found = await this.articles.findArticle({ actorId, articleId });
    if (!found.ok) throw new ApiFailure('RESOURCE_NOT_FOUND');
    const article = found.value;
    if (!article.memberIds.includes(actorId) && article.advisorId !== actorId)
      throw new ApiFailure('RESOURCE_NOT_FOUND');
    return article;
  }
}

@Injectable()
export class ListDiscussionMessagesUseCase {
  constructor(
    private readonly repository: DiscussionRepository,
    private readonly scope: DiscussionArticleScope,
  ) {}

  async execute(query: DiscussionQuery): Promise<Page<DiscussionMessageDto>> {
    const article = await this.scope.participant(query.actorId, query.articleId);
    const rows = await this.repository.list(
      article.id,
      offsetOf(query.request),
      takeOf(query.request),
    );
    const total = query.request.withTotal ? await this.repository.count(article.id) : undefined;
    return toPage(query.request, rows.map(toDto), total);
  }
}

@Injectable()
export class ReadDiscussionMessagesAfterUseCase {
  constructor(
    private readonly repository: DiscussionRepository,
    private readonly scope: DiscussionArticleScope,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly articleId: string;
    readonly messageId?: string;
  }): Promise<readonly DiscussionMessageDto[]> {
    const article = await this.scope.participant(input.actorId, input.articleId);
    if (!input.messageId) return (await this.repository.listFirst(article.id, 100)).map(toDto);
    if (!isUuid(input.messageId)) throw new ApiFailure('RESOURCE_NOT_FOUND');
    const cursor = await this.repository.find(input.messageId, article.id);
    if (!cursor) throw new ApiFailure('RESOURCE_NOT_FOUND');
    return (await this.repository.listAfter(article.id, cursor.createdAt, cursor.id, 100)).map(
      toDto,
    );
  }
}

@Injectable()
export class ListRemarkDiscussionMessagesUseCase {
  constructor(
    private readonly repository: DiscussionRepository,
    private readonly scope: DiscussionArticleScope,
    private readonly articles: ArticleFacade,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly articleId: string;
    readonly remarkId: string;
  }): Promise<readonly DiscussionMessageDto[]> {
    const article = await this.scope.participant(input.actorId, input.articleId);
    if (!article.memberIds.includes(input.actorId)) throw new ApiFailure('RESOURCE_NOT_FOUND');
    const remark = await this.articles.findRemark({
      actorId: input.actorId,
      articleId: input.articleId,
      remarkId: input.remarkId,
    });
    if (!remark.ok || !remark.value.visibleToTeam) throw new ApiFailure('RESOURCE_NOT_FOUND');
    return (await this.repository.listForRemark(article.id, input.remarkId)).map(toDto);
  }
}

@Injectable()
export class PublishDiscussionMessageUseCase {
  constructor(
    private readonly repository: DiscussionRepository,
    private readonly scope: DiscussionArticleScope,
    private readonly articles: ArticleFacade,
  ) {}

  async execute(command: PublishMessageCommand): Promise<DiscussionMessageDto> {
    const body = command.body.trim();
    if (!body) throw new ApiFailure('VALIDATION_FAILED', [{ field: 'body', code: 'REQUIRED' }]);
    const article = await this.scope.participant(command.actorId, command.articleId);
    let rootId: string | null = null;
    if (command.replyToId) {
      const parent = await this.repository.find(command.replyToId, article.id);
      if (!parent) throw new ApiFailure('RESOURCE_NOT_FOUND');
      rootId = parent.rootId ?? parent.id;
    }
    if (command.remarkId) {
      if (!article.memberIds.includes(command.actorId)) throw new ApiFailure('RESOURCE_NOT_FOUND');
      const remark = await this.articles.findRemark({
        actorId: command.actorId,
        articleId: article.id,
        remarkId: command.remarkId,
      });
      if (!remark.ok || !remark.value.visibleToTeam) throw new ApiFailure('RESOURCE_NOT_FOUND');
    }
    const now = new Date();
    const messageId = uuidv7();
    const eventId = uuidv7();
    const row = await this.repository.createWithOutbox(
      {
        id: messageId,
        articleId: article.id,
        teamId: article.teamId,
        authorId: command.actorId,
        rootId,
        remarkId: command.remarkId ?? null,
        body,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: eventId,
        type: 'DISCUSSION_MESSAGE_PUBLISHED',
        contractVersion: 1,
        payload: {
          messageId,
          articleId: article.id,
          actorId: command.actorId,
          recipientIds: [...article.memberIds, ...(article.advisorId ? [article.advisorId] : [])],
        },
        correlationId: messageId,
      },
    );
    return toDto(row);
  }
}

@Injectable()
export class RemoveOwnDiscussionMessageUseCase {
  constructor(
    private readonly repository: DiscussionRepository,
    private readonly scope: DiscussionArticleScope,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly articleId: string;
    readonly messageId: string;
  }): Promise<boolean> {
    const article = await this.scope.participant(input.actorId, input.articleId);
    return this.repository.removeOwn(article.id, input.actorId, input.messageId, new Date());
  }
}

@Injectable()
export class DispatchDiscussionNotificationsUseCase {
  constructor(
    private readonly repository: DiscussionRepository,
    private readonly notifications: NotificationFacade,
  ) {}

  async execute(): Promise<void> {
    const events = await this.repository.listPendingOutbox(100);
    for (const event of events) {
      const retryDelayMs = Math.min(5 * 60 * 1000, 1_000 * 2 ** Math.min(event.attempts, 8));
      if (Date.now() - event.updatedAt.getTime() < retryDelayMs) continue;
      if (!(await this.repository.claimOutbox(event.id, event.updatedAt))) continue;
      try {
        if (event.type !== 'DISCUSSION_MESSAGE_PUBLISHED') throw new Error('UNKNOWN_OUTBOX_EVENT');
        const payload = z
          .object({
            messageId: z.string().uuid(),
            articleId: z.string().uuid(),
            actorId: z.string().uuid(),
            recipientIds: z.array(z.string().uuid()),
          })
          .parse(event.payload);
        await this.notifications.create({
          eventId: event.id,
          actorId: payload.actorId,
          recipientIds: payload.recipientIds,
          type: 'DISCUSSION_MESSAGE',
          targetType: 'DISCUSSION_MESSAGE',
          targetId: payload.messageId,
          data: { articleId: payload.articleId, messageId: payload.messageId },
        });
        await this.repository.markOutboxPublished(event.id, new Date());
      } catch {
        // O evento permanece pendente e será tentado novamente com recuo exponencial.
      }
    }
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toDto(row: {
  id: string;
  articleId: string;
  teamId: string;
  authorId: string;
  rootId: string | null;
  remarkId: string | null;
  body: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): DiscussionMessageDto {
  return {
    id: row.id,
    articleId: row.articleId,
    teamId: row.teamId,
    authorId: row.authorId,
    rootId: row.rootId,
    remarkId: row.remarkId,
    body: row.body,
    deleted: row.deletedAt !== null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
