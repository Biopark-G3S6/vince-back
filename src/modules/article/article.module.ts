import { Module, type DynamicModule, type ModuleMetadata } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { DomainEventBus } from '@shared/events/event-bus';

import { ArticleFacadeImpl } from './application/article.facade.impl';
import {
  ListArticleCitationsUseCase,
  ListArticleProgressUseCase,
  ListSystemArticleProgressUseCase,
  ListSimilarityCorpusUseCase,
} from './application/analysis-read.use-cases';
import { ArticleScope } from './application/article-scope';
import {
  ApplyFormatUseCase,
  CreateArticleUseCase,
  ExportArticleUseCase,
  FindArticleUseCase,
  ImportArticleUseCase,
  ListArticlesUseCase,
  ListHistoryUseCase,
  MarkPresenceUseCase,
  RestoreVersionUseCase,
  SaveContentUseCase,
} from './application/editing.use-cases';
import {
  CiteReferenceUseCase,
  CreateReferenceUseCase,
  DeleteReferenceUseCase,
  ListReferencesUseCase,
  UpdateReferenceUseCase,
} from './application/reference.use-cases';
import {
  AddressRemarkUseCase,
  CompareSubmissionUseCase,
  ConcludeArticleUseCase,
  CreateRemarkUseCase,
  DecideRemarkUseCase,
  FindRemarkUseCase,
  ListRemarksUseCase,
  ListSubmissionsUseCase,
  ReopenAddressedRemarkUseCase,
  ReturnArticleUseCase,
  RevokeSubmissionUseCase,
  SubmitArticleUseCase,
  UpdateRemarkUseCase,
} from './application/review.use-cases';
import {
  CreateTemplateUseCase,
  DeactivateTemplateUseCase,
  FindTemplateUseCase,
  ListTemplatesUseCase,
  SelectTemplateUseCase,
  UpdateTemplateUseCase,
} from './application/template.use-cases';
import { TeamFactsConsumer } from './application/team-facts.consumer';
import { SyncArticleWithTeamUseCase } from './application/team-sync.use-case';
import { ArticleFacade } from './contracts/article.facade';
import { ArticleRepository } from './domain/ports/article-repository';
import { ArticlePrisma, createArticlePrisma } from './infrastructure/article-prisma';
import { PrismaArticleRepository } from './infrastructure/prisma-article.repository';
import { ArticleController } from './presentation/article.controller';
import { AssessmentPublicationController } from './presentation/assessment-publication.controller';
import {
  CountSystemPublicationsUseCase,
  CreatePublicationUseCase,
  DeletePublicationUseCase,
  ListGradesUseCase,
  ListPublicationsUseCase,
  RecordGradeUseCase,
  UpdatePublicationUseCase,
} from './application/assessment-publication.use-cases';

export interface ArticleModuleOptions {
  readonly imports: ModuleMetadata['imports'];
  /**
   * O barramento dos fatos de equipe. Presente, o módulo cria e mantém o artigo de cada
   * equipe, e então `imports` DEVE trazer as fachadas de `team` e `event`.
   */
  readonly teamFacts?: DomainEventBus;
}

@Module({})
export class ArticleModule {
  static forRoot(prisma: PrismaClient, options: ArticleModuleOptions): DynamicModule {
    return {
      module: ArticleModule,
      imports: options.imports,
      controllers: [ArticleController, AssessmentPublicationController],
      providers: [
        { provide: ArticlePrisma, useValue: createArticlePrisma(prisma) },
        { provide: ArticleRepository, useClass: PrismaArticleRepository },
        ArticleScope,
        CreateTemplateUseCase,
        ListTemplatesUseCase,
        FindTemplateUseCase,
        UpdateTemplateUseCase,
        DeactivateTemplateUseCase,
        SelectTemplateUseCase,
        CreateArticleUseCase,
        FindArticleUseCase,
        ListArticlesUseCase,
        ListArticleProgressUseCase,
        ListSystemArticleProgressUseCase,
        ListSimilarityCorpusUseCase,
        ListArticleCitationsUseCase,
        RecordGradeUseCase,
        ListGradesUseCase,
        CreatePublicationUseCase,
        ListPublicationsUseCase,
        UpdatePublicationUseCase,
        DeletePublicationUseCase,
        CountSystemPublicationsUseCase,
        SaveContentUseCase,
        MarkPresenceUseCase,
        CreateReferenceUseCase,
        ListReferencesUseCase,
        UpdateReferenceUseCase,
        DeleteReferenceUseCase,
        CiteReferenceUseCase,
        ApplyFormatUseCase,
        ImportArticleUseCase,
        ExportArticleUseCase,
        ListHistoryUseCase,
        RestoreVersionUseCase,
        SubmitArticleUseCase,
        ListSubmissionsUseCase,
        RevokeSubmissionUseCase,
        CreateRemarkUseCase,
        ListRemarksUseCase,
        FindRemarkUseCase,
        UpdateRemarkUseCase,
        ReturnArticleUseCase,
        AddressRemarkUseCase,
        ReopenAddressedRemarkUseCase,
        DecideRemarkUseCase,
        CompareSubmissionUseCase,
        ConcludeArticleUseCase,
        ...(options.teamFacts === undefined
          ? []
          : [
              { provide: DomainEventBus, useValue: options.teamFacts },
              SyncArticleWithTeamUseCase,
              TeamFactsConsumer,
            ]),
        { provide: ArticleFacade, useClass: ArticleFacadeImpl },
      ],
      exports: [ArticleFacade],
    };
  }
}
