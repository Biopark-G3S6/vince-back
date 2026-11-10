import type { Page } from '@shared/http/pagination';
import type {
  DiscussionMessageDto,
  DiscussionQuery,
  PublishMessageCommand,
} from './discussion.dto';

export abstract class DiscussionFacade {
  abstract list(query: DiscussionQuery): Promise<Page<DiscussionMessageDto>>;
  abstract after(
    actorId: string,
    articleId: string,
    messageId?: string,
  ): Promise<readonly DiscussionMessageDto[]>;
  abstract forRemark(
    actorId: string,
    articleId: string,
    remarkId: string,
  ): Promise<readonly DiscussionMessageDto[]>;
  abstract publish(command: PublishMessageCommand): Promise<DiscussionMessageDto>;
  abstract remove(actorId: string, articleId: string, messageId: string): Promise<boolean>;
}
