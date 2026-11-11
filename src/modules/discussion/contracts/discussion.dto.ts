import type { PageRequest } from '@shared/http/pagination';

export interface DiscussionMessageDto {
  readonly id: string;
  readonly articleId: string;
  readonly teamId: string;
  readonly authorId: string;
  readonly rootId: string | null;
  readonly remarkId: string | null;
  readonly body: string | null;
  readonly deleted: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface DiscussionQuery {
  readonly actorId: string;
  readonly articleId: string;
  readonly request: PageRequest;
}
export interface PublishMessageCommand {
  readonly actorId: string;
  readonly articleId: string;
  readonly body: string;
  readonly replyToId?: string;
  readonly remarkId?: string;
}
