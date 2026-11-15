import { Module, type DynamicModule, type ModuleMetadata } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { DiscussionFacadeImpl } from './application/discussion.facade.impl';
import { DiscussionOutboxWorker } from './application/discussion-outbox.worker';
import {
  DispatchDiscussionNotificationsUseCase,
  DiscussionArticleScope,
  ListDiscussionMessagesUseCase,
  ListRemarkDiscussionMessagesUseCase,
  PublishDiscussionMessageUseCase,
  ReadDiscussionMessagesAfterUseCase,
  RemoveOwnDiscussionMessageUseCase,
} from './application/discussion.use-cases';
import { DiscussionFacade } from './contracts/discussion.facade';
import { DiscussionRepository } from './domain/ports/discussion-repository';
import { createDiscussionRepository } from './infrastructure/discussion-prisma';
import {
  DiscussionController,
  RemarkDiscussionController,
} from './presentation/discussion.controller';

export interface DiscussionModuleOptions {
  readonly imports: ModuleMetadata['imports'];
  readonly runWorker: boolean;
}

@Module({})
export class DiscussionModule {
  static forRoot(prisma: PrismaClient, options: DiscussionModuleOptions): DynamicModule {
    return {
      module: DiscussionModule,
      imports: options.imports,
      controllers: [DiscussionController, RemarkDiscussionController],
      providers: [
        { provide: DiscussionRepository, useValue: createDiscussionRepository(prisma) },
        DiscussionArticleScope,
        ListDiscussionMessagesUseCase,
        ReadDiscussionMessagesAfterUseCase,
        ListRemarkDiscussionMessagesUseCase,
        PublishDiscussionMessageUseCase,
        RemoveOwnDiscussionMessageUseCase,
        DispatchDiscussionNotificationsUseCase,
        { provide: DiscussionFacade, useClass: DiscussionFacadeImpl },
        { provide: 'DISCUSSION_RUN_WORKER', useValue: options.runWorker },
        {
          provide: DiscussionOutboxWorker,
          useFactory: (dispatch: DispatchDiscussionNotificationsUseCase, enabled: boolean) =>
            new DiscussionOutboxWorker(dispatch, enabled),
          inject: [DispatchDiscussionNotificationsUseCase, 'DISCUSSION_RUN_WORKER'],
        },
      ],
      exports: [DiscussionFacade],
    };
  }
}
