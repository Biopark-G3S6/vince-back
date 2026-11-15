import { Injectable } from '@nestjs/common';
import type { Page } from '@shared/http/pagination';
import type {
  CreateNotificationsCommand,
  NotificationDto,
  NotificationPreferenceDto,
  NotificationQuery,
  SetNotificationPreferenceCommand,
} from '../contracts/notification.dto';
import { NotificationFacade } from '../contracts/notification.facade';
import {
  CreateNotificationsUseCase,
  ListNotificationPreferencesUseCase,
  ListNotificationsUseCase,
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
  OpenNotificationUseCase,
  SetNotificationPreferenceUseCase,
} from './notification.use-cases';

@Injectable()
export class NotificationFacadeImpl extends NotificationFacade {
  constructor(
    private readonly createNotifications: CreateNotificationsUseCase,
    private readonly listNotifications: ListNotificationsUseCase,
    private readonly openNotification: OpenNotificationUseCase,
    private readonly markReadUseCase: MarkNotificationReadUseCase,
    private readonly markAllReadUseCase: MarkAllNotificationsReadUseCase,
    private readonly listPreferencesUseCase: ListNotificationPreferencesUseCase,
    private readonly setPreferenceUseCase: SetNotificationPreferenceUseCase,
  ) {
    super();
  }

  create(command: CreateNotificationsCommand): Promise<void> {
    return this.createNotifications.execute(command);
  }

  list(query: NotificationQuery): Promise<Page<NotificationDto>> {
    return this.listNotifications.execute(query);
  }

  open(userId: string, notificationId: string): Promise<NotificationDto | null> {
    return this.openNotification.execute(userId, notificationId);
  }

  markRead(userId: string, notificationId: string): Promise<boolean> {
    return this.markReadUseCase.execute(userId, notificationId);
  }

  markAllRead(userId: string): Promise<number> {
    return this.markAllReadUseCase.execute(userId);
  }

  listPreferences(userId: string): Promise<readonly NotificationPreferenceDto[]> {
    return this.listPreferencesUseCase.execute(userId);
  }

  setPreference(command: SetNotificationPreferenceCommand): Promise<NotificationPreferenceDto> {
    return this.setPreferenceUseCase.execute(command);
  }
}
