import { Module, type DynamicModule, type ModuleMetadata } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { DomainEventBus } from '@shared/events/event-bus';

import { AssignTeamAdvisorUseCase } from './application/assign-team-advisor.use-case';
import { CreateTeamUseCase } from './application/create-team.use-case';
import { FindTeamUseCase } from './application/find-team.use-case';
import { InviteMemberUseCase } from './application/invite-member.use-case';
import { JoinTeamUseCase } from './application/join-team.use-case';
import { ListEligibleStudentsUseCase } from './application/list-eligible-students.use-case';
import { ListInvitationsUseCase } from './application/list-invitations.use-case';
import { ListMembersUseCase } from './application/list-members.use-case';
import { ListTeamsUseCase } from './application/list-teams.use-case';
import { ReadTeamStateUseCase } from './application/read-team-state.use-case';
import { RemoveMemberUseCase } from './application/remove-member.use-case';
import { RespondInvitationUseCase } from './application/respond-invitation.use-case';
import { TeamFacadeImpl } from './application/team.facade.impl';
import { TeamScope } from './application/team-scope';
import { TeamFacade } from './contracts/team.facade';
import { TeamRepository } from './domain/ports/team-repository';
import { PrismaTeamRepository } from './infrastructure/prisma-team.repository';
import { createTeamPrisma, TeamPrisma } from './infrastructure/team-prisma';
import {
  EventEligibleStudentController,
  EventTeamController,
} from './presentation/event-team.controller';
import { TeamAdvisorController } from './presentation/team-advisor.controller';
import { TeamController } from './presentation/team.controller';
import {
  TeamInvitationController,
  TeamInvitationResponseController,
} from './presentation/team-invitation.controller';
import {
  TeamMemberController,
  TeamMembershipController,
} from './presentation/team-member.controller';

export interface TeamModuleOptions {
  readonly imports: ModuleMetadata['imports'];
  readonly events: DomainEventBus;
}

/**
 * O registro do módulo `team` (`ADR-0003` §9).
 *
 * Depende da fachada de `event` — e de mais nenhuma: o estado, os limites, a orientação e
 * a elegibilidade vêm todos de lá (`ADR-0033` §12). A dependência é de mão única; o que
 * este módulo devolve ao evento são **fatos**, publicados no barramento.
 */
@Module({})
export class TeamModule {
  static forRoot(prisma: PrismaClient, options: TeamModuleOptions): DynamicModule {
    return {
      module: TeamModule,
      imports: options.imports,
      controllers: [
        EventTeamController,
        EventEligibleStudentController,
        TeamController,
        TeamMembershipController,
        TeamMemberController,
        TeamInvitationController,
        TeamInvitationResponseController,
        TeamAdvisorController,
      ],
      providers: [
        { provide: DomainEventBus, useValue: options.events },
        { provide: TeamPrisma, useValue: createTeamPrisma(prisma) },
        { provide: TeamRepository, useClass: PrismaTeamRepository },
        TeamScope,
        CreateTeamUseCase,
        ListTeamsUseCase,
        FindTeamUseCase,
        JoinTeamUseCase,
        RemoveMemberUseCase,
        ListMembersUseCase,
        InviteMemberUseCase,
        RespondInvitationUseCase,
        ListInvitationsUseCase,
        AssignTeamAdvisorUseCase,
        ListEligibleStudentsUseCase,
        ReadTeamStateUseCase,
        { provide: TeamFacade, useClass: TeamFacadeImpl },
      ],
      exports: [TeamFacade],
    };
  }
}
