import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { DomainEvent, DomainEventBus } from '@shared/events/event-bus';

import { EventFacade } from '../contracts/event.facade';

/**
 * Os fatos de formação de equipe, assinados no barramento (`ADR-0033` §20).
 *
 * O módulo `event` **não pergunta** ao módulo da equipe: ele escuta. É o que mantém a
 * dependência de mão única e evita o ciclo que `ADR-0005` §6 proíbe.
 *
 * Os dois tipos de fato são tratados pelo mesmo caminho porque transportam a mesma
 * informação: as contagens resultantes, já apuradas pelo publicador.
 */
const USAGE_FACTS = ['TeamCreated', 'TeamCompositionChanged'] as const;

@Injectable()
export class TeamUsageConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly subscriptions: (() => void)[] = [];

  constructor(
    private readonly events: DomainEventBus,
    private readonly facade: EventFacade,
  ) {}

  onModuleInit(): void {
    for (const type of USAGE_FACTS) {
      this.subscriptions.push(this.events.subscribe(type, (event) => this.consume(event)));
    }
  }

  onModuleDestroy(): void {
    for (const unsubscribe of this.subscriptions) {
      unsubscribe();
    }

    this.subscriptions.length = 0;
  }

  private async consume(event: DomainEvent): Promise<void> {
    const payload = event.payload;

    await this.facade.handleTeamUsage({
      factId: textOf(payload.factId) ?? '',
      factType: event.type,
      eventId: textOf(payload.eventId) ?? '',
      teamsInUse: numberOf(payload.teamsInUse),
      largestTeamSize: numberOf(payload.largestTeamSize),
      occurredAt: new Date(textOf(payload.occurredAt) ?? new Date().toISOString()),
    });
  }
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function numberOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
