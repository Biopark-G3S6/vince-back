import type { Page } from '@shared/http/pagination';

import type {
  ArticleCitationDto,
  ArticleCorpusEntryDto,
  ArticleCorpusQuery,
  ArticleDto,
  ArticleAssessmentDto,
  ArticleProgressDto,
  ArticleProgressQuery,
  ArticleReferenceDto,
  ArticleRemarkDto,
  ArticleSubmissionDto,
  ArticleVersionDto,
  ExternalPublicationDto,
  GradeCommand,
  PublicationCommand,
  PublicationQuery,
  UpdatePublicationCommand,
  CreateArticleCommand,
  CreateTemplateCommand,
  DecideRemarkCommand,
  ExportArticleCommand,
  ExportedArticleDto,
  FormatArticleCommand,
  FormatReportDto,
  ImportArticleCommand,
  ListTemplatesCommand,
  PresenceCommand,
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
  UpdateRemarkCommand,
  UpdateTemplateCommand,
  ArticlePresenceDto,
  ArticleQuery,
  CitationCommand,
} from './article.dto';
import type { ArticleResult } from './result.dto';

export abstract class ArticleFacade {
  abstract createTemplate(command: CreateTemplateCommand): Promise<ArticleResult<TemplateDto>>;
  abstract listTemplates(command: ListTemplatesCommand): Promise<ArticleResult<Page<TemplateDto>>>;
  abstract findTemplate(query: TemplateQuery): Promise<ArticleResult<TemplateDto>>;
  abstract updateTemplate(command: UpdateTemplateCommand): Promise<ArticleResult<TemplateDto>>;
  abstract deactivateTemplate(query: TemplateQuery): Promise<ArticleResult<TemplateDto>>;
  abstract selectTemplate(
    command: SelectTemplateCommand,
  ): Promise<ArticleResult<TemplateSelectionDto>>;

  abstract createArticle(command: CreateArticleCommand): Promise<ArticleResult<ArticleDto>>;
  abstract findArticle(query: ArticleQuery): Promise<ArticleResult<ArticleDto>>;
  abstract listProgress(
    query: ArticleProgressQuery,
  ): Promise<ArticleResult<Page<ArticleProgressDto>>>;
  /** Projeção interna para worker e consolidações; não é exposta por rota HTTP. */
  abstract listSystemProgress(
    request: import('@shared/http/pagination').PageRequest,
  ): Promise<ArticleResult<Page<ArticleProgressDto>>>;
  abstract listSimilarityCorpus(
    query: ArticleCorpusQuery,
  ): Promise<ArticleResult<readonly ArticleCorpusEntryDto[]>>;
  abstract saveContent(command: SaveContentCommand): Promise<ArticleResult<ArticleDto>>;
  abstract markPresence(
    command: PresenceCommand,
  ): Promise<ArticleResult<readonly ArticlePresenceDto[]>>;
  abstract recordGrade(command: GradeCommand): Promise<ArticleResult<ArticleAssessmentDto>>;
  abstract listGrades(query: ArticleQuery): Promise<ArticleResult<readonly ArticleAssessmentDto[]>>;
  abstract createPublication(
    command: PublicationCommand,
  ): Promise<ArticleResult<ExternalPublicationDto>>;
  abstract listPublications(
    query: ArticleQuery,
  ): Promise<ArticleResult<readonly ExternalPublicationDto[]>>;
  abstract updatePublication(
    command: UpdatePublicationCommand,
  ): Promise<ArticleResult<ExternalPublicationDto>>;
  abstract deletePublication(query: PublicationQuery): Promise<ArticleResult<void>>;
  /** Agregado interno para relatório ACP; não exposto em endpoint público do artigo. */
  abstract countSystemPublications(
    courseId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<number>;

  abstract createReference(command: ReferenceCommand): Promise<ArticleResult<ArticleReferenceDto>>;
  abstract listReferences(
    query: ArticleQuery,
  ): Promise<ArticleResult<readonly ArticleReferenceDto[]>>;
  abstract listCitations(
    query: ArticleQuery,
  ): Promise<ArticleResult<readonly ArticleCitationDto[]>>;
  abstract updateReference(
    command: UpdateReferenceCommand,
  ): Promise<ArticleResult<ArticleReferenceDto>>;
  abstract deleteReference(query: ReferenceQuery): Promise<ArticleResult<void>>;
  abstract citeReference(command: CitationCommand): Promise<ArticleResult<ArticleCitationDto>>;

  abstract applyFormat(command: FormatArticleCommand): Promise<ArticleResult<FormatReportDto>>;
  abstract importArticle(command: ImportArticleCommand): Promise<ArticleResult<ArticleDto>>;
  abstract exportArticle(command: ExportArticleCommand): Promise<ArticleResult<ExportedArticleDto>>;
  abstract listHistory(query: ArticleQuery): Promise<ArticleResult<readonly ArticleVersionDto[]>>;
  abstract restoreVersion(command: RestoreVersionCommand): Promise<ArticleResult<ArticleDto>>;

  abstract submit(command: SubmitArticleCommand): Promise<ArticleResult<ArticleSubmissionDto>>;
  abstract listSubmissions(
    query: ArticleQuery,
  ): Promise<ArticleResult<readonly ArticleSubmissionDto[]>>;
  abstract revokeSubmission(query: SubmissionQuery): Promise<ArticleResult<ArticleDto>>;
  abstract createRemark(command: RemarkCommand): Promise<ArticleResult<ArticleRemarkDto>>;
  abstract listRemarks(query: ArticleQuery): Promise<ArticleResult<readonly ArticleRemarkDto[]>>;
  abstract findRemark(query: RemarkQuery): Promise<ArticleResult<ArticleRemarkDto>>;
  abstract updateRemark(command: UpdateRemarkCommand): Promise<ArticleResult<ArticleRemarkDto>>;
  abstract returnArticle(query: ArticleQuery): Promise<ArticleResult<ArticleDto>>;
  abstract addressRemark(query: RemarkQuery): Promise<ArticleResult<ArticleRemarkDto>>;
  abstract reopenAddressedRemark(query: RemarkQuery): Promise<ArticleResult<ArticleRemarkDto>>;
  abstract decideRemark(command: DecideRemarkCommand): Promise<ArticleResult<ArticleRemarkDto>>;
  abstract compareSubmission(
    query: SubmissionQuery,
  ): Promise<ArticleResult<SubmissionComparisonDto>>;
  abstract conclude(query: ArticleQuery): Promise<ArticleResult<ArticleDto>>;
}
