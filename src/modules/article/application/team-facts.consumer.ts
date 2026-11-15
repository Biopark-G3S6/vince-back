import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { DomainEvent, DomainEventBus } from '@shared/events/event-bus';

import { SyncArticleWithTeamUseCase } from './team-sync.use-case';

/**
 * Os fatos de equipe que mudam o artigo: o nascimento da equipe, a sua composição e o
 * seu responsável (`ADR-0005` §6 — `article` escuta, não é chamado por `team`).
 *
 * Os três seguem o mesmo caminho porque o tratamento relê o estado corrente: o fato diz
 * apenas **qual** equipe mudou.
 */
const TEAM_FACTS = ['TeamCreated', 'TeamCompositionChanged', 'TeamAdvisorChanged'] as const;

@Injectable()
export class TeamFactsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly subscriptions: (() => void)[] = [];

  constructor(
    private readonly events: DomainEventBus,
    private readonly sync: SyncArticleWithTeamUseCase,
  ) {}

  onModuleInit(): void {
    for (const type of TEAM_FACTS) {
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
    const { teamId, articleTitle } = event.payload;

    if (typeof teamId === 'string') {
      await this.sync.execute(teamId, typeof articleTitle === 'string' ? articleTitle : null);
    }
  }
}
