import { Module, type DynamicModule, type ModuleMetadata } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { DomainEventBus } from '@shared/events/event-bus';

import { ArticleFacadeImpl } from './application/article.facade.impl';
import { ArticleScope } from './application/article-scope';
import { ConsumeTeamCreatedUseCase } from './application/consume-team-created.use-case';
import { FindSituationUseCase } from './application/find-situation.use-case';
import { GradeArticleUseCase } from './application/grade-article.use-case';
import { ListGradesUseCase } from './application/list-grades.use-case';
import { ManagePublicationUseCase } from './application/manage-publication.use-case';
import { TeamCreatedConsumer } from './application/team-created.consumer';
import { ArticleFacade } from './contracts/article.facade';
import { ArticleRepository } from './domain/ports/article-repository';
import { ArticlePrisma, createArticlePrisma } from './infrastructure/article-prisma';
import { PrismaArticleRepository } from './infrastructure/prisma-article.repository';
import { ArticleController, TeamArticleController } from './presentation/article.controller';
import { PublicationController } from './presentation/publication.controller';

export interface ArticleModuleOptions {
  readonly imports: ModuleMetadata['imports'];
  readonly events: DomainEventBus;
}

/**
 * O registro do módulo `article` (`ADR-0003` §9).
 *
 * Depende das fachadas de `team`, `event` e `course` para resolver alcance e
 * responsabilidade (`ADR-0030` §10). A criação do artigo não vem por fachada alguma: vem
 * do fato `TeamCreated`, consumido do barramento (§9).
 */
@Module({})
export class ArticleModule {
  static forRoot(prisma: PrismaClient, options: ArticleModuleOptions): DynamicModule {
    return {
      module: ArticleModule,
      imports: options.imports,
      controllers: [ArticleController, TeamArticleController, PublicationController],
      providers: [
        { provide: DomainEventBus, useValue: options.events },
        { provide: ArticlePrisma, useValue: createArticlePrisma(prisma) },
        { provide: ArticleRepository, useClass: PrismaArticleRepository },
        ArticleScope,
        ConsumeTeamCreatedUseCase,
        FindSituationUseCase,
        GradeArticleUseCase,
        ListGradesUseCase,
        ManagePublicationUseCase,
        TeamCreatedConsumer,
        { provide: ArticleFacade, useClass: ArticleFacadeImpl },
      ],
      exports: [ArticleFacade],
    };
  }
}
