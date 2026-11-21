import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { DomainEvent, DomainEventBus } from '@shared/events/event-bus';

import { LinkInvitedAdminUseCase } from './link-invited-admin.use-case';

/** Os fatos de outros módulos que interessam à instituição (`ADR-0005`). */
@Injectable()
export class InstitutionEventConsumer implements OnModuleInit, OnModuleDestroy {
  private unsubscribe?: () => void;

  constructor(
    private readonly events: DomainEventBus,
    private readonly linkInvitedAdmin: LinkInvitedAdminUseCase,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.events.subscribe('InvitationAccepted', (event) => this.consume(event));
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private async consume(event: DomainEvent): Promise<void> {
    const payload = event.payload;

    await this.linkInvitedAdmin.execute({
      userId: textOf(payload.userId) ?? '',
      roleCode: textOf(payload.roleCode) ?? '',
      institutionId: textOf(payload.institutionId) ?? '',
      scopeType: textOf(payload.scopeType),
    });
  }
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
