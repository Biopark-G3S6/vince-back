import { Injectable } from '@nestjs/common';
import type { Page } from '@shared/http/pagination';
import type {
  DiscussionMessageDto,
  DiscussionQuery,
  PublishMessageCommand,
} from '../contracts/discussion.dto';
import { DiscussionFacade } from '../contracts/discussion.facade';
import {
  ListDiscussionMessagesUseCase,
  ListRemarkDiscussionMessagesUseCase,
  PublishDiscussionMessageUseCase,
  ReadDiscussionMessagesAfterUseCase,
  RemoveOwnDiscussionMessageUseCase,
} from './discussion.use-cases';

@Injectable()
export class DiscussionFacadeImpl extends DiscussionFacade {
  constructor(
    private readonly listMessages: ListDiscussionMessagesUseCase,
    private readonly readAfter: ReadDiscussionMessagesAfterUseCase,
    private readonly listRemarkMessages: ListRemarkDiscussionMessagesUseCase,
    private readonly publishMessage: PublishDiscussionMessageUseCase,
    private readonly removeMessage: RemoveOwnDiscussionMessageUseCase,
  ) {
    super();
  }

  list(query: DiscussionQuery): Promise<Page<DiscussionMessageDto>> {
    return this.listMessages.execute(query);
  }

  after(
    actorId: string,
    articleId: string,
    messageId?: string,
  ): Promise<readonly DiscussionMessageDto[]> {
    return this.readAfter.execute({ actorId, articleId, messageId });
  }

  forRemark(
    actorId: string,
    articleId: string,
    remarkId: string,
  ): Promise<readonly DiscussionMessageDto[]> {
    return this.listRemarkMessages.execute({ actorId, articleId, remarkId });
  }

  publish(command: PublishMessageCommand): Promise<DiscussionMessageDto> {
    return this.publishMessage.execute(command);
  }

  remove(actorId: string, articleId: string, messageId: string): Promise<boolean> {
    return this.removeMessage.execute({ actorId, articleId, messageId });
  }
}
