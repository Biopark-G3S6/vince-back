import type { Page, PageRequest } from '@shared/http/pagination';

import type {
  Article,
  ArticleCitation,
  ArticlePresence,
  ArticleReference,
  ArticleRemark,
  ArticleSubmission,
  ArticleVersion,
  JsonValue,
  RemarkStatus,
  Template,
  TemplateSelection,
  VersionKind,
} from '../article';

export interface TemplateCreateData {
  readonly id: string;
  readonly versionId: string;
  readonly institutionId: string;
  readonly courseId: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly content: JsonValue;
  readonly actorId: string;
}

export interface TemplateUpdateData {
  readonly id: string;
  readonly versionId?: string;
  readonly name?: string;
  readonly description?: string | null;
  readonly courseId?: string | null;
  readonly content?: JsonValue;
  readonly actorId: string;
}

export interface ArticleCreateData {
  readonly id: string;
  readonly institutionId: string;
  readonly courseId: string | null;
  readonly eventId: string;
  readonly teamId: string;
  readonly advisorId: string | null;
  readonly memberIds: readonly string[];
  readonly currentMilestoneId: string | null;
  readonly currentMilestoneOrder: number | null;
  readonly currentMilestoneDeadline: Date | null;
  readonly lastMilestoneOrder: number | null;
  readonly templateVersionId: string | null;
  readonly content: JsonValue;
}

export interface ReferenceData {
  readonly id: string;
  readonly articleId: string;
  readonly type: string;
  readonly authors: JsonValue;
  readonly title: string;
  readonly year: number | null;
  readonly vehicle: string | null;
  readonly edition: string | null;
  readonly place: string | null;
  readonly publisher: string | null;
  readonly pages: string | null;
  readonly doi: string | null;
  readonly url: string | null;
  readonly actorId: string;
}

export interface CitationData {
  readonly id: string;
  readonly articleId: string;
  readonly referenceId: string;
  readonly kind: string;
  readonly locator: JsonValue | null;
  readonly page: string | null;
  readonly actorId: string;
}

export interface VersionData {
  readonly id: string;
  readonly articleId: string;
  readonly kind: VersionKind;
  readonly content: JsonValue;
  readonly authorId: string | null;
  readonly metadata: JsonValue;
}

export interface SubmissionData {
  readonly id: string;
  readonly articleId: string;
  readonly milestoneId: string;
  readonly milestoneOrder: number;
  readonly content: JsonValue;
  readonly submittedBy: string | null;
  readonly automatic: boolean;
}

export interface RemarkData {
  readonly id: string;
  readonly articleId: string;
  readonly submissionId: string;
  readonly anchor: JsonValue;
  readonly originalText: string;
  readonly currentText: string | null;
  readonly body: string;
  readonly actorId: string;
}

export abstract class ArticleRepository {
  abstract createTemplate(data: TemplateCreateData): Promise<Template>;
  abstract listTemplates(
    institutionId: string,
    request: PageRequest,
    filters: { readonly courseId?: string; readonly includeInactive: boolean },
  ): Promise<Page<Template>>;
  abstract findTemplate(id: string): Promise<Template | null>;
  abstract updateTemplate(data: TemplateUpdateData): Promise<Template | null>;
  abstract setTemplateActive(id: string, active: boolean): Promise<Template | null>;
  abstract createSelection(data: {
    readonly id: string;
    readonly eventId: string;
    readonly institutionId: string;
    readonly courseId: string | null;
    readonly templateId: string | null;
    readonly templateVersionId: string | null;
    readonly actorId: string;
  }): Promise<TemplateSelection | 'ALREADY_EXISTS'>;

  abstract createArticle(data: ArticleCreateData): Promise<Article>;
  abstract findArticle(id: string): Promise<Article | null>;
  abstract saveArticleContent(
    id: string,
    content: JsonValue,
    status: Article['status'],
  ): Promise<Article | null>;
  abstract updateArticleStatus(id: string, status: Article['status']): Promise<Article | null>;
  abstract upsertPresence(
    articleId: string,
    userId: string,
    cursor: JsonValue,
  ): Promise<readonly ArticlePresence[]>;

  abstract createReference(data: ReferenceData): Promise<ArticleReference>;
  abstract listReferences(articleId: string): Promise<readonly ArticleReference[]>;
  abstract findReference(articleId: string, referenceId: string): Promise<ArticleReference | null>;
  abstract updateReference(
    data: Partial<ReferenceData> & ReferenceDataPick,
  ): Promise<ArticleReference | null>;
  abstract deleteReference(articleId: string, referenceId: string): Promise<boolean>;
  abstract referenceHasCitations(articleId: string, referenceId: string): Promise<boolean>;
  abstract createCitation(data: CitationData): Promise<ArticleCitation>;

  abstract createVersion(data: VersionData): Promise<ArticleVersion>;
  abstract listVersions(articleId: string): Promise<readonly ArticleVersion[]>;
  abstract findVersion(articleId: string, versionId: string): Promise<ArticleVersion | null>;

  abstract createSubmission(data: SubmissionData): Promise<ArticleSubmission | 'ALREADY_EXISTS'>;
  abstract listSubmissions(articleId: string): Promise<readonly ArticleSubmission[]>;
  abstract findSubmission(
    articleId: string,
    submissionId: string,
  ): Promise<ArticleSubmission | null>;
  abstract deleteSubmission(articleId: string, submissionId: string): Promise<boolean>;
  abstract createRemark(data: RemarkData): Promise<ArticleRemark>;
  abstract listRemarks(articleId: string): Promise<readonly ArticleRemark[]>;
  abstract findRemark(articleId: string, remarkId: string): Promise<ArticleRemark | null>;
  abstract updateRemarkBody(
    articleId: string,
    remarkId: string,
    body: string,
  ): Promise<ArticleRemark | null>;
  abstract revealRemarks(articleId: string): Promise<void>;
  abstract setRemarkStatus(
    articleId: string,
    remarkId: string,
    status: RemarkStatus,
    actorId: string,
    reason?: string | null,
  ): Promise<ArticleRemark | null>;
  abstract hasOpenRemarks(articleId: string): Promise<boolean>;
  abstract hasRemarksForSubmission(submissionId: string): Promise<boolean>;
}

export interface ReferenceDataPick {
  readonly id: string;
  readonly articleId: string;
}
