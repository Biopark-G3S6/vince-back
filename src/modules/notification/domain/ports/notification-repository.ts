export interface NotificationRecord {
  readonly id: string;
  readonly recipientId: string;
  readonly eventId: string;
  readonly type: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly data: unknown;
  readonly readAt: Date | null;
  readonly createdAt: Date;
}

export interface EmailDeliveryRecord {
  readonly id: string;
  readonly status: string;
  readonly attempts: number;
  readonly updatedAt: Date;
  readonly createdAt: Date;
  readonly notification: NotificationRecord;
}

export interface EmailPreferencePair {
  readonly userId: string;
  readonly type: string;
}

export interface EmailDeliveryUpdate {
  readonly status: string;
  readonly attempts?: number;
  readonly sentAt?: Date | null;
  readonly nextAttemptAt?: Date | null;
  readonly lastErrorCode?: string | null;
}

export abstract class NotificationRepository {
  abstract enabledEmailRecipients(
    userIds: readonly string[],
    type: string,
  ): Promise<readonly string[]>;
  abstract upsertNotification(
    data: Omit<NotificationRecord, 'readAt' | 'createdAt'> & { readonly id: string },
  ): Promise<NotificationRecord>;
  abstract upsertEmailDelivery(id: string, notificationId: string): Promise<void>;
  abstract openNotification(
    userId: string,
    notificationId: string,
    at: Date,
  ): Promise<NotificationRecord | null>;
  abstract listNotifications(
    userId: string,
    unreadOnly: boolean,
    skip: number,
    take: number,
  ): Promise<readonly NotificationRecord[]>;
  abstract countNotifications(userId: string, unreadOnly: boolean): Promise<number>;
  abstract markRead(userId: string, notificationId: string, at: Date): Promise<boolean>;
  abstract markAllRead(userId: string, at: Date): Promise<number>;
  abstract listPreferences(
    userId: string,
  ): Promise<readonly { readonly type: string; readonly enabled: boolean }[]>;
  abstract setPreference(
    userId: string,
    type: string,
    enabled: boolean,
  ): Promise<{ readonly type: string; readonly enabled: boolean }>;
  abstract dueEmailDeliveries(
    now: Date,
    staleBefore: Date,
    take: number,
  ): Promise<readonly EmailDeliveryRecord[]>;
  abstract enabledPreferencePairs(
    pairs: readonly EmailPreferencePair[],
  ): Promise<readonly EmailPreferencePair[]>;
  abstract claimEmailDelivery(id: string, status: string, updatedAt: Date): Promise<boolean>;
  abstract updateEmailDelivery(id: string, data: EmailDeliveryUpdate): Promise<void>;
}
