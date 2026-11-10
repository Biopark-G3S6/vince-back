import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { AccessFacade } from '@modules/access/contracts/access.facade';
import { offsetOf, takeOf, toPage, type Page } from '@shared/http/pagination';
import type {
  CreateNotificationsCommand,
  NotificationDto,
  NotificationPreferenceDto,
  NotificationQuery,
  SetNotificationPreferenceCommand,
} from '../contracts/notification.dto';
import { EmailDeliveryProvider } from '../domain/ports/email-delivery-provider';
import {
  NotificationRepository,
  type EmailDeliveryRecord,
  type NotificationRecord,
} from '../domain/ports/notification-repository';

@Injectable()
export class CreateNotificationsUseCase {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly access: AccessFacade,
  ) {}

  async execute(command: CreateNotificationsCommand): Promise<void> {
    const recipients = [...new Set(command.recipientIds)].filter((id) => id !== command.actorId);
    if (recipients.length === 0) return;
    const users = await this.access.findNotificationRecipients(recipients);
    const activeIds = users.filter((user) => user.active).map((user) => user.userId);
    if (activeIds.length === 0) return;
    const eventId = command.eventId ?? uuidv7();
    const emailEnabled = new Set(
      await this.repository.enabledEmailRecipients(activeIds, command.type),
    );
    for (const userId of activeIds) {
      const notification = await this.repository.upsertNotification({
        id: uuidv7(),
        eventId,
        recipientId: userId,
        type: command.type,
        targetType: command.targetType,
        targetId: command.targetId,
        data: command.data ?? {},
      });
      if (emailEnabled.has(userId))
        await this.repository.upsertEmailDelivery(uuidv7(), notification.id);
    }
  }
}

@Injectable()
export class OpenNotificationUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  async execute(userId: string, notificationId: string): Promise<NotificationDto | null> {
    const row = await this.repository.openNotification(userId, notificationId, new Date());
    return row ? toDto(row) : null;
  }
}

@Injectable()
export class ListNotificationsUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  async execute(query: NotificationQuery): Promise<Page<NotificationDto>> {
    const rows = await this.repository.listNotifications(
      query.userId,
      query.unreadOnly ?? false,
      offsetOf(query.request),
      takeOf(query.request),
    );
    const total = query.request.withTotal
      ? await this.repository.countNotifications(query.userId, query.unreadOnly ?? false)
      : undefined;
    return toPage(query.request, rows.map(toDto), total);
  }
}

@Injectable()
export class MarkNotificationReadUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  execute(userId: string, notificationId: string): Promise<boolean> {
    return this.repository.markRead(userId, notificationId, new Date());
  }
}

@Injectable()
export class MarkAllNotificationsReadUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  execute(userId: string): Promise<number> {
    return this.repository.markAllRead(userId, new Date());
  }
}

@Injectable()
export class ListNotificationPreferencesUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  execute(userId: string): Promise<readonly NotificationPreferenceDto[]> {
    return this.repository.listPreferences(userId);
  }
}

@Injectable()
export class SetNotificationPreferenceUseCase {
  constructor(private readonly repository: NotificationRepository) {}

  execute(command: SetNotificationPreferenceCommand): Promise<NotificationPreferenceDto> {
    return this.repository.setPreference(command.userId, command.type, command.enabled);
  }
}

@Injectable()
export class DispatchNotificationEmailsUseCase {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly access: AccessFacade,
    private readonly provider: EmailDeliveryProvider,
  ) {}

  async execute(): Promise<void> {
    if (!this.provider.available) return;
    const now = new Date();
    const deliveries = await this.repository.dueEmailDeliveries(
      now,
      new Date(now.getTime() - 15 * 60 * 1000),
      50,
    );
    if (deliveries.length === 0) return;
    const recipientIds = [
      ...new Set(deliveries.map((delivery) => delivery.notification.recipientId)),
    ];
    const [recipients, preferences] = await Promise.all([
      this.access.findNotificationRecipients(recipientIds),
      this.repository.enabledPreferencePairs(
        deliveries.map((delivery) => ({
          userId: delivery.notification.recipientId,
          type: delivery.notification.type,
        })),
      ),
    ]);
    const recipientsById = new Map(recipients.map((recipient) => [recipient.userId, recipient]));
    const emailEnabled = new Set(
      preferences.map((preference) => `${preference.userId}:${preference.type}`),
    );
    for (const delivery of deliveries) await this.deliver(delivery, recipientsById, emailEnabled);
  }

  private async deliver(
    delivery: EmailDeliveryRecord,
    recipientsById: ReadonlyMap<
      string,
      {
        readonly userId: string;
        readonly active: boolean;
        readonly email: string;
        readonly preferredLanguage: string | null;
      }
    >,
    emailEnabled: ReadonlySet<string>,
  ): Promise<void> {
    if (
      !(await this.repository.claimEmailDelivery(delivery.id, delivery.status, delivery.updatedAt))
    )
      return;
    const recipientId = delivery.notification.recipientId;
    const recipient = recipientsById.get(recipientId);
    if (!recipient?.active || !emailEnabled.has(`${recipientId}:${delivery.notification.type}`)) {
      await this.repository.updateEmailDelivery(delivery.id, {
        status: 'CANCELLED',
        nextAttemptAt: null,
      });
      return;
    }
    try {
      const language = recipient.preferredLanguage ?? 'pt-BR';
      const template = localizedTemplate(delivery.notification.type, language);
      await this.provider.send({
        to: recipient.email,
        language,
        subject: template.subject,
        text: template.text,
        type: delivery.notification.type,
        targetType: delivery.notification.targetType,
        targetId: delivery.notification.targetId,
        data: delivery.notification.data,
      });
      await this.repository.updateEmailDelivery(delivery.id, {
        status: 'SENT',
        attempts: delivery.attempts + 1,
        sentAt: new Date(),
        nextAttemptAt: null,
        lastErrorCode: null,
      });
    } catch {
      const attempts = delivery.attempts + 1;
      const delayMs = Math.min(6 * 60 * 60 * 1000, 30_000 * 2 ** Math.min(attempts - 1, 10));
      await this.repository.updateEmailDelivery(delivery.id, {
        status: 'RETRY',
        attempts,
        nextAttemptAt: new Date(Date.now() + delayMs),
        lastErrorCode: 'EMAIL_DELIVERY_FAILED',
      });
    }
  }
}

function toDto(row: NotificationRecord): NotificationDto {
  return {
    id: row.id,
    eventId: row.eventId,
    type: row.type,
    targetType: row.targetType,
    targetId: row.targetId,
    data: asRecord(row.data),
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function localizedTemplate(type: string, language: string): { subject: string; text: string } {
  const templates: Readonly<
    Record<string, Readonly<Record<string, { subject: string; text: string }>>>
  > = {
    'pt-BR': {
      ARTICLE_SUBMITTED: {
        subject: 'Nova etapa entregue',
        text: 'A equipe entregou uma nova etapa do artigo para revisão.',
      },
      AUTOMATIC_SUBMISSION: {
        subject: 'Entrega automática registrada',
        text: 'Uma etapa foi entregue automaticamente após o prazo.',
      },
      ARTICLE_RETURNED: {
        subject: 'Artigo devolvido para revisão',
        text: 'O orientador devolveu o artigo com apontamentos para a equipe.',
      },
      DISCUSSION_MESSAGE: {
        subject: 'Nova mensagem na discussão',
        text: 'Há uma nova mensagem na discussão da equipe.',
      },
      REMARK_UPDATED: {
        subject: 'Apontamento atualizado',
        text: 'Um apontamento visível à equipe foi atualizado.',
      },
      REMARK_REOPENED: {
        subject: 'Apontamento reaberto',
        text: 'Um apontamento foi reaberto para acompanhamento.',
      },
      REMARK_DECIDED: {
        subject: 'Apontamento avaliado',
        text: 'O orientador registrou uma decisão sobre um apontamento.',
      },
      ARTICLE_FINISHED: {
        subject: 'Artigo concluído',
        text: 'O ciclo de produção do artigo foi concluído.',
      },
      RISK_SIGNAL: {
        subject: 'Equipe requer atenção',
        text: 'Uma condição de acompanhamento foi identificada para a equipe.',
      },
      MILESTONE_DEADLINE_SOON: {
        subject: 'Prazo de etapa próximo',
        text: 'O prazo da etapa atual está próximo.',
      },
      DEFAULT: {
        subject: 'Você tem uma nova notificação',
        text: 'Acesse a plataforma para consultar os detalhes.',
      },
    },
  };
  const catalog = templates[language] ?? templates['pt-BR']!;
  return catalog[type] ?? catalog.DEFAULT!;
}
