import { Module, type DynamicModule, type ModuleMetadata } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { DomainEventBus } from '@shared/events/event-bus';

import { AssignAdvisorUseCase } from './application/assign-advisor.use-case';
import { CancelEventUseCase } from './application/cancel-event.use-case';
import { ConsumeTeamUsageUseCase } from './application/consume-team-usage.use-case';
import { CreateEventUseCase } from './application/create-event.use-case';
import { CreateMilestoneUseCase } from './application/create-milestone.use-case';
import { EventFacadeImpl } from './application/event.facade.impl';
import { EventScope } from './application/event-scope';
import { FindEventUseCase } from './application/find-event.use-case';
import { ListAdvisorsUseCase } from './application/list-advisors.use-case';
import { ListEventsUseCase } from './application/list-events.use-case';
import { ListMilestonesUseCase } from './application/list-milestones.use-case';
import { ReadEventStateUseCase } from './application/read-event-state.use-case';
import { RemoveMilestoneUseCase } from './application/remove-milestone.use-case';
import { RevokeAdvisorUseCase } from './application/revoke-advisor.use-case';
import { TeamUsageConsumer } from './application/team-usage.consumer';
import { UpdateEventUseCase } from './application/update-event.use-case';
import { UpdateMilestoneUseCase } from './application/update-milestone.use-case';
import { EventFacade } from './contracts/event.facade';
import { EventRepository } from './domain/ports/event-repository';
import { createEventPrisma, EventPrisma } from './infrastructure/event-prisma';
import { PrismaEventRepository } from './infrastructure/prisma-event.repository';
import { EventAdvisorController } from './presentation/event-advisor.controller';
import { EventController } from './presentation/event.controller';
import { EventMilestoneController } from './presentation/event-milestone.controller';

export interface EventModuleOptions {
  readonly imports: ModuleMetadata['imports'];
  readonly events: DomainEventBus;
}

/**
 * O registro do módulo `event` (`ADR-0003` §9).
 *
 * Ponto único de providers, rotas e consumidores. Depende das fachadas de `access`,
 * `institution`, `course` e `cohort` — as quatro entram por `imports`, vindas do
 * composition root, porque é delas que vêm o alvo e a elegibilidade (`ADR-0032` §12).
 */
@Module({})
export class EventModule {
  static forRoot(prisma: PrismaClient, options: EventModuleOptions): DynamicModule {
    return {
      module: EventModule,
      imports: options.imports,
      controllers: [EventController, EventMilestoneController, EventAdvisorController],
      providers: [
        { provide: DomainEventBus, useValue: options.events },
        { provide: EventPrisma, useValue: createEventPrisma(prisma) },
        { provide: EventRepository, useClass: PrismaEventRepository },
        EventScope,
        CreateEventUseCase,
        ListEventsUseCase,
        FindEventUseCase,
        UpdateEventUseCase,
        CancelEventUseCase,
        CreateMilestoneUseCase,
        ListMilestonesUseCase,
        UpdateMilestoneUseCase,
        RemoveMilestoneUseCase,
        AssignAdvisorUseCase,
        RevokeAdvisorUseCase,
        ListAdvisorsUseCase,
        ReadEventStateUseCase,
        ConsumeTeamUsageUseCase,
        TeamUsageConsumer,
        { provide: EventFacade, useClass: EventFacadeImpl },
      ],
      exports: [EventFacade],
    };
  }
}
