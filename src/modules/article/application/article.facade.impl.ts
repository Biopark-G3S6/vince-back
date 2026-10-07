import { Injectable } from '@nestjs/common';
import type { Page } from '@shared/http/pagination';

import { ArticleFacade } from '../contracts/article.facade';
import type {
  ArticleCitationDto,
  ArticleDto,
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

  saveContent(command: SaveContentCommand): Promise<ArticleResult<ArticleDto>> {
    return this.saveContentUseCase.execute(command);
  }

  markPresence(command: PresenceCommand): Promise<ArticleResult<readonly ArticlePresenceDto[]>> {
    return this.markPresenceUseCase.execute(command);
  }

  createReference(command: ReferenceCommand): Promise<ArticleResult<ArticleReferenceDto>> {
    return this.createReferenceUseCase.execute(command);
  }

  listReferences(query: ArticleQuery): Promise<ArticleResult<readonly ArticleReferenceDto[]>> {
    return this.listReferencesUseCase.execute(query);
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

  submit(command: SubmitArticleCommand): Promise<ArticleResult<ArticleSubmissionDto>> {
    return this.submitArticleUseCase.execute(command);
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

  updateRemark(command: UpdateRemarkCommand): Promise<ArticleResult<ArticleRemarkDto>> {
    return this.updateRemarkUseCase.execute(command);
  }

  returnArticle(query: ArticleQuery): Promise<ArticleResult<ArticleDto>> {
    return this.returnArticleUseCase.execute(query);
  }

  addressRemark(query: RemarkQuery): Promise<ArticleResult<ArticleRemarkDto>> {
    return this.addressRemarkUseCase.execute(query);
  }

  reopenAddressedRemark(query: RemarkQuery): Promise<ArticleResult<ArticleRemarkDto>> {
    return this.reopenAddressedRemarkUseCase.execute(query);
  }

  decideRemark(command: DecideRemarkCommand): Promise<ArticleResult<ArticleRemarkDto>> {
    return this.decideRemarkUseCase.execute(command);
  }

  compareSubmission(query: SubmissionQuery): Promise<ArticleResult<SubmissionComparisonDto>> {
    return this.compareSubmissionUseCase.execute(query);
  }

  conclude(query: ArticleQuery): Promise<ArticleResult<ArticleDto>> {
    return this.concludeArticleUseCase.execute(query);
  }
}
