import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { DomainEvent, DomainEventBus } from '@shared/events/event-bus';

import { ArticleFacade } from '../contracts/article.facade';

/**
 * O fato de criação de equipe, assinado no barramento (`ADR-0030` §9).
 *
 * O módulo `article` **não pergunta** a `team` se há equipe nova: ele escuta. É o que
 * mantém a dependência de mão única no sentido da escrita e evita que a transação de
 * `team` espere por este módulo.
 */
@Injectable()
export class TeamCreatedConsumer implements OnModuleInit, OnModuleDestroy {
  private unsubscribe?: () => void;

  constructor(
    private readonly events: DomainEventBus,
    private readonly articles: ArticleFacade,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.events.subscribe('TeamCreated', (event) => this.consume(event));
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private async consume(event: DomainEvent): Promise<void> {
    const payload = event.payload;

    await this.articles.handleTeamCreated({
      factId: textOf(payload.factId) ?? '',
      teamId: textOf(payload.teamId) ?? '',
      eventId: textOf(payload.eventId) ?? '',
      institutionId: textOf(payload.institutionId) ?? '',
      occurredAt: new Date(textOf(payload.occurredAt) ?? new Date().toISOString()),
    });
  }
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
