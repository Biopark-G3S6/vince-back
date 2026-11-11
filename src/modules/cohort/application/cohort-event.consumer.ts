import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { DomainEvent, DomainEventBus } from '@shared/events/event-bus';

import { CohortFacade } from '../contracts/cohort.facade';

@Injectable()
export class CohortEventConsumer implements OnModuleInit, OnModuleDestroy {
  private unsubscribe?: () => void;

  constructor(
    private readonly events: DomainEventBus,
    private readonly cohort: CohortFacade,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.events.subscribe('InvitationAccepted', (event) => this.consume(event));
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private async consume(event: DomainEvent): Promise<void> {
    const payload = event.payload;
    const scopeType = textOf(payload.scopeType);
    const scopeId = textOf(payload.scopeId);
    const occurredAt = textOf(payload.occurredAt);

    await this.cohort.handleInvitationAccepted({
      eventId: requiredText(payload.eventId),
      invitationId: requiredText(payload.invitationId),
      userId: requiredText(payload.userId),
      roleCode: requiredText(payload.roleCode),
      institutionId: requiredText(payload.institutionId),
      scopeType,
      scopeId,
      occurredAt: new Date(occurredAt ?? new Date().toISOString()),
    });
  }
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function requiredText(value: unknown): string {
  return textOf(value) ?? '';
}
