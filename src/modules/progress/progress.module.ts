import { Module, type DynamicModule, type ModuleMetadata } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import type { ProgressRiskConfig } from '@shared/config/environment';
import { AccessFacade } from '@modules/access/contracts/access.facade';
import { ArticleFacade } from '@modules/article/contracts/article.facade';
import { AssistanceFacade } from '@modules/assistance/contracts/assistance.facade';
import { CourseFacade } from '@modules/course/contracts/course.facade';
import { DiscussionFacade } from '@modules/discussion/contracts/discussion.facade';
import { NotificationFacade } from '@modules/notification/contracts/notification.facade';
import { ProgressFacadeImpl } from './application/progress.facade.impl';
import { ProgressRiskWorker } from './application/progress-risk.worker';
import {
  EvaluateProgressRisksUseCase,
  ExportProgressReportUseCase,
  GenerateProgressReportUseCase,
  ProgressUseCaseContext,
  ReadAdvisorProgressDashboardUseCase,
  ReadArticleContributionUseCase,
  ReadCourseProgressDashboardUseCase,
  ReadProgressReportUseCase,
  ReadRiskSignalsUseCase,
} from './application/progress.use-cases';
import { ProgressFacade } from './contracts/progress.facade';
import { ProgressRepository } from './domain/ports/progress-repository';
import { createProgressRepository } from './infrastructure/progress-prisma';
import { ProgressController } from './presentation/progress.controller';

export interface ProgressModuleOptions {
  readonly imports: ModuleMetadata['imports'];
  readonly runWorker: boolean;
  readonly riskConfig: ProgressRiskConfig;
}

@Module({})
export class ProgressModule {
  static forRoot(prisma: PrismaClient, options: ProgressModuleOptions): DynamicModule {
    return {
      module: ProgressModule,
      imports: options.imports,
      controllers: [ProgressController],
      providers: [
        { provide: ProgressRepository, useValue: createProgressRepository(prisma) },
        {
          provide: ProgressUseCaseContext,
          useFactory: (
            repository: ProgressRepository,
            articles: ArticleFacade,
            courses: CourseFacade,
            access: AccessFacade,
            assistance: AssistanceFacade,
            discussion: DiscussionFacade,
            notifications: NotificationFacade,
            riskConfig: ProgressRiskConfig,
          ) =>
            new ProgressUseCaseContext(
              repository,
              articles,
              courses,
              access,
              assistance,
              discussion,
              notifications,
              riskConfig,
            ),
          inject: [
            ProgressRepository,
            ArticleFacade,
            CourseFacade,
            AccessFacade,
            AssistanceFacade,
            DiscussionFacade,
            NotificationFacade,
            'PROGRESS_RISK_CONFIG',
          ],
        },
        ReadAdvisorProgressDashboardUseCase,
        ReadCourseProgressDashboardUseCase,
        ReadRiskSignalsUseCase,
        ReadArticleContributionUseCase,
        GenerateProgressReportUseCase,
        ReadProgressReportUseCase,
        ExportProgressReportUseCase,
        EvaluateProgressRisksUseCase,
        { provide: ProgressFacade, useClass: ProgressFacadeImpl },
        { provide: 'PROGRESS_RISK_CONFIG', useValue: options.riskConfig },
        { provide: 'PROGRESS_RUN_WORKER', useValue: options.runWorker },
        {
          provide: ProgressRiskWorker,
          useFactory: (evaluate: EvaluateProgressRisksUseCase, enabled: boolean) =>
            new ProgressRiskWorker(evaluate, enabled),
          inject: [EvaluateProgressRisksUseCase, 'PROGRESS_RUN_WORKER'],
        },
      ],
      exports: [ProgressFacade],
    };
  }
}
