export interface DiscussionMessageRecord {
  readonly id: string;
  readonly articleId: string;
  readonly teamId: string;
  readonly authorId: string;
  readonly rootId: string | null;
  readonly remarkId: string | null;
  readonly body: string | null;
  readonly deletedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateDiscussionMessage {
  readonly id: string;
  readonly articleId: string;
  readonly teamId: string;
  readonly authorId: string;
  readonly rootId: string | null;
  readonly remarkId: string | null;
  readonly body: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateDiscussionOutboxEvent {
  readonly id: string;
  readonly type: string;
  readonly contractVersion: number;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly correlationId: string;
}

export interface DiscussionOutboxRecord {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
  readonly attempts: number;
  readonly updatedAt: Date;
}

export abstract class DiscussionRepository {
  abstract list(
    articleId: string,
    skip: number,
    take: number,
  ): Promise<readonly DiscussionMessageRecord[]>;
  abstract count(articleId: string): Promise<number>;
  abstract listFirst(articleId: string, take: number): Promise<readonly DiscussionMessageRecord[]>;
  abstract find(id: string, articleId: string): Promise<DiscussionMessageRecord | null>;
  abstract listAfter(
    articleId: string,
    createdAt: Date,
    id: string,
    take: number,
  ): Promise<readonly DiscussionMessageRecord[]>;
  abstract listForRemark(
    articleId: string,
    remarkId: string,
  ): Promise<readonly DiscussionMessageRecord[]>;
  abstract createWithOutbox(
    message: CreateDiscussionMessage,
    event: CreateDiscussionOutboxEvent,
  ): Promise<DiscussionMessageRecord>;
  abstract markOutboxPublished(eventId: string, at: Date): Promise<void>;
  abstract listPendingOutbox(take: number): Promise<readonly DiscussionOutboxRecord[]>;
  abstract claimOutbox(eventId: string, updatedAt: Date): Promise<boolean>;
  abstract removeOwn(
    articleId: string,
    actorId: string,
    messageId: string,
    at: Date,
  ): Promise<boolean>;
}
