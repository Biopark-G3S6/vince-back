import type { PageRequest } from '@shared/http/pagination';

export interface NotificationDto {
  readonly id: string;
  readonly eventId: string;
  readonly type: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly readAt: Date | null;
  readonly createdAt: Date;
}

export interface NotificationQuery {
  readonly userId: string;
  readonly request: PageRequest;
  readonly unreadOnly?: boolean;
}

export interface NotificationPreferenceDto {
  readonly type: string;
  readonly enabled: boolean;
}

export interface SetNotificationPreferenceCommand {
  readonly userId: string;
  readonly type: string;
  readonly enabled: boolean;
}

export interface CreateNotificationsCommand {
  readonly eventId?: string;
  readonly actorId?: string | null;
  readonly recipientIds: readonly string[];
  readonly type: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly data?: Readonly<Record<string, unknown>>;
}
