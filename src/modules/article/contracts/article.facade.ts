import type { Page } from '@shared/http/pagination';

import type {
  ArticleCitationDto,
  ArticleDto,
  ArticleReferenceDto,
  ArticleRemarkDto,
  ArticleSubmissionDto,
  ArticleVersionDto,
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
  abstract saveContent(command: SaveContentCommand): Promise<ArticleResult<ArticleDto>>;
  abstract markPresence(
    command: PresenceCommand,
  ): Promise<ArticleResult<readonly ArticlePresenceDto[]>>;

  abstract createReference(command: ReferenceCommand): Promise<ArticleResult<ArticleReferenceDto>>;
  abstract listReferences(
    query: ArticleQuery,
  ): Promise<ArticleResult<readonly ArticleReferenceDto[]>>;
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
