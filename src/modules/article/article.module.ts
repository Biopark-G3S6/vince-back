import { Module, type DynamicModule, type ModuleMetadata } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { ArticleFacadeImpl } from './application/article.facade.impl';
import { ArticleScope } from './application/article-scope';
import {
  ApplyFormatUseCase,
  CreateArticleUseCase,
  ExportArticleUseCase,
  FindArticleUseCase,
  ImportArticleUseCase,
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
import { ArticleFacade } from './contracts/article.facade';
import { ArticleRepository } from './domain/ports/article-repository';
import { ArticlePrisma, createArticlePrisma } from './infrastructure/article-prisma';
import { PrismaArticleRepository } from './infrastructure/prisma-article.repository';
import { ArticleController } from './presentation/article.controller';

export interface ArticleModuleOptions {
  readonly imports: ModuleMetadata['imports'];
}

@Module({})
export class ArticleModule {
  static forRoot(prisma: PrismaClient, options: ArticleModuleOptions): DynamicModule {
    return {
      module: ArticleModule,
      imports: options.imports,
      controllers: [ArticleController],
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
        { provide: ArticleFacade, useClass: ArticleFacadeImpl },
      ],
      exports: [ArticleFacade],
    };
  }
}
