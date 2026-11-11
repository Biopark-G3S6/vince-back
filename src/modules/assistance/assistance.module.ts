import { Module, type DynamicModule, type ModuleMetadata } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import type { AssistanceConfig } from '@shared/config/environment';
import { AccessFacade } from '@modules/access/contracts/access.facade';
import { ArticleFacade } from '@modules/article/contracts/article.facade';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';
import { AssistanceFacadeImpl } from './application/assistance.facade.impl';
import {
  AssistanceUseCaseContext,
  CheckArticleComplianceUseCase,
  CheckArticleSimilarityUseCase,
  ReadAiConsentUseCase,
  ReadAuthorshipSignalsUseCase,
  ReadComplianceHistoryUseCase,
  ReadSimilarityHistoryUseCase,
  SetAiConsentUseCase,
  SummarizeArticleChangesUseCase,
} from './application/assistance.use-cases';
import { AssistanceFacade } from './contracts/assistance.facade';
import { AssistanceProvider } from './domain/ports/assistance-provider';
import { AssistanceRepository } from './domain/ports/assistance-repository';
import { HttpAssistanceProvider } from './infrastructure/http-assistance-provider';
import { createAssistanceRepository } from './infrastructure/assistance-prisma';
import { AssistanceController } from './presentation/assistance.controller';

export interface AssistanceModuleOptions {
  readonly imports: ModuleMetadata['imports'];
  readonly configuration: AssistanceConfig;
}

@Module({})
export class AssistanceModule {
  static forRoot(prisma: PrismaClient, options: AssistanceModuleOptions): DynamicModule {
    return {
      module: AssistanceModule,
      imports: options.imports,
      controllers: [AssistanceController],
      providers: [
        { provide: AssistanceRepository, useValue: createAssistanceRepository(prisma) },
        {
          provide: AssistanceProvider,
          useValue: new HttpAssistanceProvider(options.configuration),
        },
        {
          provide: AssistanceUseCaseContext,
          useFactory: (
            repository: AssistanceRepository,
            access: AccessFacade,
            institutions: InstitutionFacade,
            articles: ArticleFacade,
            provider: AssistanceProvider,
            configuration: AssistanceConfig,
          ) =>
            new AssistanceUseCaseContext(
              repository,
              access,
              institutions,
              articles,
              provider,
              configuration,
            ),
          inject: [
            AssistanceRepository,
            AccessFacade,
            InstitutionFacade,
            ArticleFacade,
            AssistanceProvider,
            'ASSISTANCE_CONFIG',
          ],
        },
        ReadAiConsentUseCase,
        SetAiConsentUseCase,
        SummarizeArticleChangesUseCase,
        CheckArticleComplianceUseCase,
        ReadComplianceHistoryUseCase,
        CheckArticleSimilarityUseCase,
        ReadSimilarityHistoryUseCase,
        ReadAuthorshipSignalsUseCase,
        { provide: AssistanceFacade, useClass: AssistanceFacadeImpl },
        { provide: 'ASSISTANCE_CONFIG', useValue: options.configuration },
      ],
      exports: [AssistanceFacade],
    };
  }
}
