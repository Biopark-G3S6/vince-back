import type { Page } from '@shared/http/pagination';
import type {
  CreateNotificationsCommand,
  NotificationDto,
  NotificationPreferenceDto,
  NotificationQuery,
  SetNotificationPreferenceCommand,
} from './notification.dto';

export abstract class NotificationFacade {
  abstract create(command: CreateNotificationsCommand): Promise<void>;
  abstract list(query: NotificationQuery): Promise<Page<NotificationDto>>;
  abstract open(userId: string, notificationId: string): Promise<NotificationDto | null>;
  abstract markRead(userId: string, notificationId: string): Promise<boolean>;
  abstract markAllRead(userId: string): Promise<number>;
  abstract listPreferences(userId: string): Promise<readonly NotificationPreferenceDto[]>;
  abstract setPreference(
    command: SetNotificationPreferenceCommand,
  ): Promise<NotificationPreferenceDto>;
}
