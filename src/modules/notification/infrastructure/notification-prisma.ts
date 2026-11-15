import { Prisma, type PrismaClient } from '@prisma/client';
import {
  NotificationRepository,
  type EmailDeliveryRecord,
  type EmailDeliveryUpdate,
  type EmailPreferencePair,
  type NotificationRecord,
} from '../domain/ports/notification-repository';

const OWNED_MODELS = new Set([
  'notification',
  'notificationEmailPreference',
  'emailDelivery',
  'notificationOutbox',
]);

function scope(prisma: PrismaClient) {
  return prisma.$extends({
    name: 'notification-scope',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          const name = model.charAt(0).toLowerCase() + model.slice(1);
          if (!OWNED_MODELS.has(name))
            throw new Error(`O módulo notification não possui o model ${model} (${operation}).`);
          return query(args);
        },
      },
    },
  });
}

type Scoped = ReturnType<typeof scope>;

export function createNotificationRepository(prisma: PrismaClient): NotificationRepository {
  return new PrismaNotificationRepository(scope(prisma));
}

class PrismaNotificationRepository extends NotificationRepository {
  constructor(private readonly db: Scoped) {
    super();
  }

  async enabledEmailRecipients(
    userIds: readonly string[],
    type: string,
  ): Promise<readonly string[]> {
    if (userIds.length === 0) return [];
    const rows = await this.db.notificationEmailPreference.findMany({
      where: { userId: { in: [...userIds] }, type, enabled: true },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  }

  async upsertNotification(
    data: Omit<NotificationRecord, 'readAt' | 'createdAt'> & { readonly id: string },
  ): Promise<NotificationRecord> {
    return this.db.notification.upsert({
      where: { eventId_recipientId: { eventId: data.eventId, recipientId: data.recipientId } },
      create: {
        id: data.id,
        eventId: data.eventId,
        recipientId: data.recipientId,
        type: data.type,
        targetType: data.targetType,
        targetId: data.targetId,
        data: data.data as Prisma.InputJsonValue,
      },
      update: {},
    });
  }

  async upsertEmailDelivery(id: string, notificationId: string): Promise<void> {
    await this.db.emailDelivery.upsert({
      where: { notificationId },
      create: { id, notificationId, status: 'PENDING' },
      update: {},
    });
  }

  async openNotification(
    userId: string,
    notificationId: string,
    at: Date,
  ): Promise<NotificationRecord | null> {
    await this.db.notification.updateMany({
      where: { id: notificationId, recipientId: userId, readAt: null },
      data: { readAt: at },
    });
    return this.db.notification.findFirst({ where: { id: notificationId, recipientId: userId } });
  }

  listNotifications(
    userId: string,
    unreadOnly: boolean,
    skip: number,
    take: number,
  ): Promise<readonly NotificationRecord[]> {
    return this.db.notification.findMany({
      where: { recipientId: userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take,
    });
  }

  countNotifications(userId: string, unreadOnly: boolean): Promise<number> {
    return this.db.notification.count({
      where: { recipientId: userId, ...(unreadOnly ? { readAt: null } : {}) },
    });
  }

  async markRead(userId: string, notificationId: string, at: Date): Promise<boolean> {
    const updated = await this.db.notification.updateMany({
      where: { id: notificationId, recipientId: userId, readAt: null },
      data: { readAt: at },
    });
    if (updated.count > 0) return true;
    return (
      (await this.db.notification.count({ where: { id: notificationId, recipientId: userId } })) > 0
    );
  }

  async markAllRead(userId: string, at: Date): Promise<number> {
    const updated = await this.db.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: at },
    });
    return updated.count;
  }

  async listPreferences(
    userId: string,
  ): Promise<readonly { readonly type: string; readonly enabled: boolean }[]> {
    return this.db.notificationEmailPreference.findMany({
      where: { userId },
      orderBy: { type: 'asc' },
      select: { type: true, enabled: true },
    });
  }

  async setPreference(
    userId: string,
    type: string,
    enabled: boolean,
  ): Promise<{ readonly type: string; readonly enabled: boolean }> {
    return this.db.notificationEmailPreference.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, enabled },
      update: { enabled },
      select: { type: true, enabled: true },
    });
  }

  async dueEmailDeliveries(
    now: Date,
    staleBefore: Date,
    take: number,
  ): Promise<readonly EmailDeliveryRecord[]> {
    const rows = await this.db.emailDelivery.findMany({
      where: {
        OR: [
          {
            status: { in: ['PENDING', 'RETRY'] },
            OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
          },
          { status: 'PROCESSING', updatedAt: { lt: staleBefore } },
        ],
      },
      include: { notification: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take,
    });
    return rows.map(({ notification, ...delivery }) => ({ ...delivery, notification }));
  }

  async enabledPreferencePairs(
    pairs: readonly EmailPreferencePair[],
  ): Promise<readonly EmailPreferencePair[]> {
    if (pairs.length === 0) return [];
    const rows = await this.db.notificationEmailPreference.findMany({
      where: { OR: pairs.map(({ userId, type }) => ({ userId, type, enabled: true })) },
      select: { userId: true, type: true },
    });
    return rows;
  }

  async claimEmailDelivery(id: string, status: string, updatedAt: Date): Promise<boolean> {
    const claimed = await this.db.emailDelivery.updateMany({
      where: { id, status, updatedAt },
      data: { status: 'PROCESSING' },
    });
    return claimed.count > 0;
  }

  async updateEmailDelivery(id: string, data: EmailDeliveryUpdate): Promise<void> {
    await this.db.emailDelivery.update({ where: { id }, data });
  }
}
