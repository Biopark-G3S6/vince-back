import { Module, type DynamicModule, type ModuleMetadata } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import type { NotificationEmailConfig } from '@shared/config/environment';
import { NotificationFacadeImpl } from './application/notification.facade.impl';
import { NotificationEmailWorker } from './application/notification-email.worker';
import {
  CreateNotificationsUseCase,
  DispatchNotificationEmailsUseCase,
  ListNotificationPreferencesUseCase,
  ListNotificationsUseCase,
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
  OpenNotificationUseCase,
  SetNotificationPreferenceUseCase,
} from './application/notification.use-cases';
import { NotificationFacade } from './contracts/notification.facade';
import { EmailDeliveryProvider } from './domain/ports/email-delivery-provider';
import { NotificationRepository } from './domain/ports/notification-repository';
import { HttpEmailDeliveryProvider } from './infrastructure/http-email-delivery-provider';
import { createNotificationRepository } from './infrastructure/notification-prisma';
import { NotificationController } from './presentation/notification.controller';

export interface NotificationModuleOptions {
  readonly imports: ModuleMetadata['imports'];
  readonly runWorker: boolean;
  readonly emailConfig: NotificationEmailConfig;
}

@Module({})
export class NotificationModule {
  static forRoot(prisma: PrismaClient, options: NotificationModuleOptions): DynamicModule {
    return {
      module: NotificationModule,
      imports: options.imports,
      controllers: [NotificationController],
      providers: [
        { provide: NotificationRepository, useValue: createNotificationRepository(prisma) },
        {
          provide: EmailDeliveryProvider,
          useValue: new HttpEmailDeliveryProvider(options.emailConfig),
        },
        CreateNotificationsUseCase,
        OpenNotificationUseCase,
        ListNotificationsUseCase,
        MarkNotificationReadUseCase,
        MarkAllNotificationsReadUseCase,
        ListNotificationPreferencesUseCase,
        SetNotificationPreferenceUseCase,
        DispatchNotificationEmailsUseCase,
        { provide: NotificationFacade, useClass: NotificationFacadeImpl },
        { provide: 'NOTIFICATION_RUN_WORKER', useValue: options.runWorker },
        {
          provide: NotificationEmailWorker,
          useFactory: (dispatch: DispatchNotificationEmailsUseCase, enabled: boolean) =>
            new NotificationEmailWorker(dispatch, enabled),
          inject: [DispatchNotificationEmailsUseCase, 'NOTIFICATION_RUN_WORKER'],
        },
      ],
      exports: [NotificationFacade],
    };
  }
}
