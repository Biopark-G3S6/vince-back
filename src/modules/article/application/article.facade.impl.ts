import { Injectable, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Page } from '@shared/http/pagination';
import { NotificationFacade } from '@modules/notification/contracts/notification.facade';

import { ArticleFacade } from '../contracts/article.facade';
import type {
  ArticleCorpusEntryDto,
  ArticleCorpusQuery,
  ArticleCitationDto,
  ArticleDto,
  ArticleAssessmentDto,
  ArticleProgressDto,
  ArticleProgressQuery,
  ArticlePresenceDto,
  ArticleQuery,
  ArticleReferenceDto,
  ArticleRemarkDto,
  ArticleSubmissionDto,
  ArticleVersionDto,
  CitationCommand,
  CreateArticleCommand,
  CreateTemplateCommand,
  DecideRemarkCommand,
  ExportArticleCommand,
  ExportedArticleDto,
  ExternalPublicationDto,
  GradeCommand,
  FormatArticleCommand,
  FormatReportDto,
  ImportArticleCommand,
  ListTemplatesCommand,
  PresenceCommand,
  PublicationCommand,
  PublicationQuery,
  ReferenceCommand,
  ReferenceQuery,
  RemarkCommand,
  RemarkQuery,
  RestoreVersionCommand,
  SaveContentCommand,
  SelectTemplateCommand,
  SubmissionComparisonDto,
  SubmissionQuery,
  SubmitArticleCommand,
  TemplateDto,
  TemplateQuery,
  TemplateSelectionDto,
  UpdateReferenceCommand,
  UpdatePublicationCommand,
  UpdateRemarkCommand,
  UpdateTemplateCommand,
} from '../contracts/article.dto';
import type { ArticleResult } from '../contracts/result.dto';
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
} from './editing.use-cases';
import {
  CiteReferenceUseCase,
  CreateReferenceUseCase,
  DeleteReferenceUseCase,
  ListReferencesUseCase,
  UpdateReferenceUseCase,
} from './reference.use-cases';
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
} from './review.use-cases';
import {
  CreateTemplateUseCase,
  DeactivateTemplateUseCase,
  FindTemplateUseCase,
  ListTemplatesUseCase,
  SelectTemplateUseCase,
  UpdateTemplateUseCase,
} from './template.use-cases';
import {
  ListArticleCitationsUseCase,
  ListArticleProgressUseCase,
  ListSystemArticleProgressUseCase,
  ListSimilarityCorpusUseCase,
} from './analysis-read.use-cases';
import {
  CountSystemPublicationsUseCase,
  CreatePublicationUseCase,
  DeletePublicationUseCase,
  ListGradesUseCase,
  ListPublicationsUseCase,
  RecordGradeUseCase,
  UpdatePublicationUseCase,
} from './assessment-publication.use-cases';

@Injectable()
export class ArticleFacadeImpl extends ArticleFacade {
  constructor(
    private readonly createTemplateUseCase: CreateTemplateUseCase,
    private readonly listTemplatesUseCase: ListTemplatesUseCase,
    private readonly findTemplateUseCase: FindTemplateUseCase,
    private readonly updateTemplateUseCase: UpdateTemplateUseCase,
    private readonly deactivateTemplateUseCase: DeactivateTemplateUseCase,
    private readonly selectTemplateUseCase: SelectTemplateUseCase,
    private readonly createArticleUseCase: CreateArticleUseCase,
    private readonly findArticleUseCase: FindArticleUseCase,
    private readonly listArticleProgressUseCase: ListArticleProgressUseCase,
    private readonly listSystemArticleProgressUseCase: ListSystemArticleProgressUseCase,
    private readonly listSimilarityCorpusUseCase: ListSimilarityCorpusUseCase,
    private readonly listArticleCitationsUseCase: ListArticleCitationsUseCase,
    private readonly saveContentUseCase: SaveContentUseCase,
    private readonly markPresenceUseCase: MarkPresenceUseCase,
    private readonly createReferenceUseCase: CreateReferenceUseCase,
    private readonly listReferencesUseCase: ListReferencesUseCase,
    private readonly updateReferenceUseCase: UpdateReferenceUseCase,
    private readonly deleteReferenceUseCase: DeleteReferenceUseCase,
    private readonly citeReferenceUseCase: CiteReferenceUseCase,
    private readonly applyFormatUseCase: ApplyFormatUseCase,
    private readonly importArticleUseCase: ImportArticleUseCase,
    private readonly exportArticleUseCase: ExportArticleUseCase,
    private readonly listHistoryUseCase: ListHistoryUseCase,
    private readonly restoreVersionUseCase: RestoreVersionUseCase,
    private readonly submitArticleUseCase: SubmitArticleUseCase,
    private readonly listSubmissionsUseCase: ListSubmissionsUseCase,
    private readonly revokeSubmissionUseCase: RevokeSubmissionUseCase,
    private readonly createRemarkUseCase: CreateRemarkUseCase,
    private readonly listRemarksUseCase: ListRemarksUseCase,
    private readonly findRemarkUseCase: FindRemarkUseCase,
    private readonly updateRemarkUseCase: UpdateRemarkUseCase,
    private readonly returnArticleUseCase: ReturnArticleUseCase,
    private readonly addressRemarkUseCase: AddressRemarkUseCase,
    private readonly reopenAddressedRemarkUseCase: ReopenAddressedRemarkUseCase,
    private readonly decideRemarkUseCase: DecideRemarkUseCase,
    private readonly compareSubmissionUseCase: CompareSubmissionUseCase,
    private readonly concludeArticleUseCase: ConcludeArticleUseCase,
    private readonly recordGradeUseCase: RecordGradeUseCase,
    private readonly listGradesUseCase: ListGradesUseCase,
    private readonly createPublicationUseCase: CreatePublicationUseCase,
    private readonly listPublicationsUseCase: ListPublicationsUseCase,
    private readonly updatePublicationUseCase: UpdatePublicationUseCase,
    private readonly deletePublicationUseCase: DeletePublicationUseCase,
    private readonly countSystemPublicationsUseCase: CountSystemPublicationsUseCase,
    @Optional() private readonly notifications?: NotificationFacade,
  ) {
    super();
  }

  createTemplate(command: CreateTemplateCommand): Promise<ArticleResult<TemplateDto>> {
    return this.createTemplateUseCase.execute(command);
  }

  listTemplates(command: ListTemplatesCommand): Promise<ArticleResult<Page<TemplateDto>>> {
    return this.listTemplatesUseCase.execute(command);
  }

  findTemplate(query: TemplateQuery): Promise<ArticleResult<TemplateDto>> {
    return this.findTemplateUseCase.execute(query);
  }

  updateTemplate(command: UpdateTemplateCommand): Promise<ArticleResult<TemplateDto>> {
    return this.updateTemplateUseCase.execute(command);
  }

  deactivateTemplate(query: TemplateQuery): Promise<ArticleResult<TemplateDto>> {
    return this.deactivateTemplateUseCase.execute(query);
  }

  selectTemplate(command: SelectTemplateCommand): Promise<ArticleResult<TemplateSelectionDto>> {
    return this.selectTemplateUseCase.execute(command);
  }

  createArticle(command: CreateArticleCommand): Promise<ArticleResult<ArticleDto>> {
    return this.createArticleUseCase.execute(command);
  }

  findArticle(query: ArticleQuery): Promise<ArticleResult<ArticleDto>> {
    return this.findArticleUseCase.execute(query);
  }

  listProgress(query: ArticleProgressQuery): Promise<ArticleResult<Page<ArticleProgressDto>>> {
    return this.listArticleProgressUseCase.execute(query);
  }

  listSystemProgress(
    request: import('@shared/http/pagination').PageRequest,
  ): Promise<ArticleResult<Page<ArticleProgressDto>>> {
    return this.listSystemArticleProgressUseCase.execute(request);
  }

  listSimilarityCorpus(
    query: ArticleCorpusQuery,
  ): Promise<ArticleResult<readonly ArticleCorpusEntryDto[]>> {
    return this.listSimilarityCorpusUseCase.execute(query);
  }

  saveContent(command: SaveContentCommand): Promise<ArticleResult<ArticleDto>> {
    return this.saveContentUseCase.execute(command);
  }

  markPresence(command: PresenceCommand): Promise<ArticleResult<readonly ArticlePresenceDto[]>> {
    return this.markPresenceUseCase.execute(command);
  }

  recordGrade(command: GradeCommand): Promise<ArticleResult<ArticleAssessmentDto>> {
    return this.recordGradeUseCase.execute(command);
  }
  listGrades(query: ArticleQuery): Promise<ArticleResult<readonly ArticleAssessmentDto[]>> {
    return this.listGradesUseCase.execute(query);
  }
  createPublication(command: PublicationCommand): Promise<ArticleResult<ExternalPublicationDto>> {
    return this.createPublicationUseCase.execute(command);
  }
  listPublications(query: ArticleQuery): Promise<ArticleResult<readonly ExternalPublicationDto[]>> {
    return this.listPublicationsUseCase.execute(query);
  }
  updatePublication(
    command: UpdatePublicationCommand,
  ): Promise<ArticleResult<ExternalPublicationDto>> {
    return this.updatePublicationUseCase.execute(command);
  }
  deletePublication(query: PublicationQuery): Promise<ArticleResult<void>> {
    return this.deletePublicationUseCase.execute(query);
  }
  countSystemPublications(courseId: string, periodStart: Date, periodEnd: Date): Promise<number> {
    return this.countSystemPublicationsUseCase.execute(courseId, periodStart, periodEnd);
  }

  createReference(command: ReferenceCommand): Promise<ArticleResult<ArticleReferenceDto>> {
    return this.createReferenceUseCase.execute(command);
  }

  listReferences(query: ArticleQuery): Promise<ArticleResult<readonly ArticleReferenceDto[]>> {
    return this.listReferencesUseCase.execute(query);
  }

  listCitations(query: ArticleQuery): Promise<ArticleResult<readonly ArticleCitationDto[]>> {
    return this.listArticleCitationsUseCase.execute(query);
  }

  updateReference(command: UpdateReferenceCommand): Promise<ArticleResult<ArticleReferenceDto>> {
    return this.updateReferenceUseCase.execute(command);
  }

  deleteReference(query: ReferenceQuery): Promise<ArticleResult<void>> {
    return this.deleteReferenceUseCase.execute(query);
  }

  citeReference(command: CitationCommand): Promise<ArticleResult<ArticleCitationDto>> {
    return this.citeReferenceUseCase.execute(command);
  }

  applyFormat(command: FormatArticleCommand): Promise<ArticleResult<FormatReportDto>> {
    return this.applyFormatUseCase.execute(command);
  }

  importArticle(command: ImportArticleCommand): Promise<ArticleResult<ArticleDto>> {
    return this.importArticleUseCase.execute(command);
  }

  exportArticle(command: ExportArticleCommand): Promise<ArticleResult<ExportedArticleDto>> {
    return this.exportArticleUseCase.execute(command);
  }

  listHistory(query: ArticleQuery): Promise<ArticleResult<readonly ArticleVersionDto[]>> {
    return this.listHistoryUseCase.execute(query);
  }

  restoreVersion(command: RestoreVersionCommand): Promise<ArticleResult<ArticleDto>> {
    return this.restoreVersionUseCase.execute(command);
  }

  async submit(command: SubmitArticleCommand): Promise<ArticleResult<ArticleSubmissionDto>> {
    const result = await this.submitArticleUseCase.execute(command);
    if (result.ok && this.notifications) {
      const article = await this.findArticleUseCase.execute({
        actorId: command.actorId,
        articleId: command.articleId,
      });
      if (article.ok)
        await this.notifications.create({
          eventId: result.value.id,
          actorId: result.value.automatic ? null : command.actorId,
          recipientIds: result.value.automatic
            ? [
                ...article.value.memberIds,
                ...(article.value.advisorId ? [article.value.advisorId] : []),
              ]
            : article.value.advisorId
              ? [article.value.advisorId]
              : [],
          type: result.value.automatic ? 'AUTOMATIC_SUBMISSION' : 'ARTICLE_SUBMITTED',
          targetType: 'ARTICLE',
          targetId: article.value.id,
          data: {
            articleId: article.value.id,
            milestoneOrder: result.value.milestoneOrder,
            submissionId: result.value.id,
          },
        });
    }
    return result;
  }

  listSubmissions(query: ArticleQuery): Promise<ArticleResult<readonly ArticleSubmissionDto[]>> {
    return this.listSubmissionsUseCase.execute(query);
  }

  revokeSubmission(query: SubmissionQuery): Promise<ArticleResult<ArticleDto>> {
    return this.revokeSubmissionUseCase.execute(query);
  }

  createRemark(command: RemarkCommand): Promise<ArticleResult<ArticleRemarkDto>> {
    return this.createRemarkUseCase.execute(command);
  }

  listRemarks(query: ArticleQuery): Promise<ArticleResult<readonly ArticleRemarkDto[]>> {
    return this.listRemarksUseCase.execute(query);
  }

  findRemark(query: RemarkQuery): Promise<ArticleResult<ArticleRemarkDto>> {
    return this.findRemarkUseCase.execute(query);
  }

  async updateRemark(command: UpdateRemarkCommand): Promise<ArticleResult<ArticleRemarkDto>> {
    const result = await this.updateRemarkUseCase.execute(command);
    if (result.ok && result.value.visibleToTeam && this.notifications) {
      const article = await this.findArticleUseCase.execute({
        actorId: command.actorId,
        articleId: command.articleId,
      });
      if (article.ok)
        await this.notifications.create({
          eventId: stableEventId('REMARK_UPDATED', result.value.id, result.value.updatedAt),
          actorId: command.actorId,
          recipientIds: article.value.memberIds,
          type: 'REMARK_UPDATED',
          targetType: 'ARTICLE_REMARK',
          targetId: result.value.id,
          data: { articleId: command.articleId, remarkId: result.value.id },
        });
    }
    return result;
  }

  async returnArticle(query: ArticleQuery): Promise<ArticleResult<ArticleDto>> {
    const result = await this.returnArticleUseCase.execute(query);
    if (result.ok && this.notifications)
      await this.notifications.create({
        eventId: stableEventId('ARTICLE_RETURNED', result.value.id, result.value.updatedAt),
        actorId: query.actorId,
        recipientIds: result.value.memberIds,
        type: 'ARTICLE_RETURNED',
        targetType: 'ARTICLE',
        targetId: result.value.id,
        data: { articleId: result.value.id, milestoneOrder: result.value.currentMilestoneOrder },
      });
    return result;
  }

  addressRemark(query: RemarkQuery): Promise<ArticleResult<ArticleRemarkDto>> {
    return this.addressRemarkUseCase.execute(query);
  }

  async reopenAddressedRemark(query: RemarkQuery): Promise<ArticleResult<ArticleRemarkDto>> {
    const result = await this.reopenAddressedRemarkUseCase.execute(query);
    if (result.ok && result.value.visibleToTeam && this.notifications) {
      const article = await this.findArticleUseCase.execute({
        actorId: query.actorId,
        articleId: query.articleId,
      });
      if (article.ok)
        await this.notifications.create({
          eventId: stableEventId('REMARK_REOPENED', result.value.id, result.value.updatedAt),
          actorId: query.actorId,
          recipientIds: article.value.memberIds,
          type: 'REMARK_REOPENED',
          targetType: 'ARTICLE_REMARK',
          targetId: result.value.id,
          data: { articleId: query.articleId, remarkId: result.value.id },
        });
    }
    return result;
  }

  async decideRemark(command: DecideRemarkCommand): Promise<ArticleResult<ArticleRemarkDto>> {
    const result = await this.decideRemarkUseCase.execute(command);
    if (result.ok && result.value.visibleToTeam && this.notifications) {
      const article = await this.findArticleUseCase.execute({
        actorId: command.actorId,
        articleId: command.articleId,
      });
      if (article.ok)
        await this.notifications.create({
          eventId: stableEventId('REMARK_DECIDED', result.value.id, result.value.updatedAt),
          actorId: command.actorId,
          recipientIds: article.value.memberIds,
          type: 'REMARK_DECIDED',
          targetType: 'ARTICLE_REMARK',
          targetId: result.value.id,
          data: {
            articleId: command.articleId,
            remarkId: result.value.id,
            status: result.value.status,
          },
        });
    }
    return result;
  }

  compareSubmission(query: SubmissionQuery): Promise<ArticleResult<SubmissionComparisonDto>> {
    return this.compareSubmissionUseCase.execute(query);
  }

  async conclude(query: ArticleQuery): Promise<ArticleResult<ArticleDto>> {
    const result = await this.concludeArticleUseCase.execute(query);
    if (result.ok && this.notifications)
      await this.notifications.create({
        eventId: stableEventId('ARTICLE_FINISHED', result.value.id, result.value.updatedAt),
        actorId: query.actorId,
        recipientIds: result.value.memberIds,
        type: 'ARTICLE_FINISHED',
        targetType: 'ARTICLE',
        targetId: result.value.id,
        data: { articleId: result.value.id },
      });
    return result;
  }
}

function stableEventId(type: string, targetId: string, occurredAt: Date): string {
  const bytes = createHash('sha256')
    .update(`${type}:${targetId}:${occurredAt.toISOString()}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const value = bytes.toString('hex');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
