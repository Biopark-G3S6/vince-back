import { Module, type DynamicModule, type ModuleMetadata } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { DomainEventBus } from '@shared/events/event-bus';

import { AssignProfessorUseCase } from './application/assign-professor.use-case';
import { CohortEventConsumer } from './application/cohort-event.consumer';
import { CohortFacadeImpl } from './application/cohort.facade.impl';
import { ConsumeInvitationAcceptedUseCase } from './application/consume-invitation-accepted.use-case';
import { CreateCohortUseCase } from './application/create-cohort.use-case';
import { DeactivateCohortUseCase } from './application/deactivate-cohort.use-case';
import { EnrollStudentUseCase } from './application/enroll-student.use-case';
import { FindCohortUseCase } from './application/find-cohort.use-case';
import { IssueInvitationUseCase } from './application/issue-invitation.use-case';
import { ListCohortsUseCase } from './application/list-cohorts.use-case';
import { ListEnrollmentsUseCase } from './application/list-enrollments.use-case';
import { ListInvitationsUseCase } from './application/list-invitations.use-case';
import { RevokeInvitationUseCase } from './application/revoke-invitation.use-case';
import { RevokeProfessorUseCase } from './application/revoke-professor.use-case';
import { UpdateCohortUseCase } from './application/update-cohort.use-case';
import { CohortFacade } from './contracts/cohort.facade';
import { CohortRepository } from './domain/ports/cohort-repository';
import { createCohortPrisma, CohortPrisma } from './infrastructure/cohort-prisma';
import { PrismaCohortRepository } from './infrastructure/prisma-cohort.repository';
import { CohortController } from './presentation/cohort.controller';
import { CohortEnrollmentController } from './presentation/cohort-enrollment.controller';
import { CohortInvitationController } from './presentation/cohort-invitation.controller';
import { CohortProfessorController } from './presentation/cohort-professor.controller';
import { CourseCohortController } from './presentation/course-cohort.controller';

export interface CohortModuleOptions {
  readonly imports: ModuleMetadata['imports'];
  readonly events: DomainEventBus;
}

@Module({})
export class CohortModule {
  static forRoot(prisma: PrismaClient, options: CohortModuleOptions): DynamicModule {
    return {
      module: CohortModule,
      imports: options.imports,
      controllers: [
        CohortController,
        CourseCohortController,
        CohortProfessorController,
        CohortEnrollmentController,
        CohortInvitationController,
      ],
      providers: [
        { provide: DomainEventBus, useValue: options.events },
        { provide: CohortPrisma, useValue: createCohortPrisma(prisma) },
        { provide: CohortRepository, useClass: PrismaCohortRepository },
        CreateCohortUseCase,
        ListCohortsUseCase,
        FindCohortUseCase,
        UpdateCohortUseCase,
        DeactivateCohortUseCase,
        AssignProfessorUseCase,
        RevokeProfessorUseCase,
        EnrollStudentUseCase,
        ListEnrollmentsUseCase,
        IssueInvitationUseCase,
        ListInvitationsUseCase,
        RevokeInvitationUseCase,
        ConsumeInvitationAcceptedUseCase,
        CohortEventConsumer,
        { provide: CohortFacade, useClass: CohortFacadeImpl },
      ],
      exports: [CohortFacade],
    };
  }
}
