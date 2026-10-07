import type { PageRequest } from '@shared/http/pagination';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type ArticleStatus = 'STARTED' | 'IN_PROGRESS' | 'IN_REVIEW' | 'FINISHED';
export type RemarkStatus = 'OPEN' | 'ADDRESSED' | 'RESOLVED' | 'DISMISSED';
export type VersionKind = 'AUTOSAVE' | 'IMPORT' | 'RESTORE' | 'SUBMISSION' | 'FORMAT';
export type ExportFormat = 'DOCX' | 'PDF';

export interface ArticleDto {
  readonly id: string;
  readonly institutionId: string;
  readonly courseId: string | null;
  readonly eventId: string;
  readonly teamId: string;
  readonly advisorId: string | null;
  readonly memberIds: readonly string[];
  readonly status: ArticleStatus;
  readonly currentMilestoneId: string | null;
  readonly currentMilestoneOrder: number | null;
  readonly currentMilestoneDeadline: Date | null;
  readonly lastMilestoneOrder: number | null;
  readonly templateVersionId: string | null;
  readonly content: JsonValue;
  readonly formatProfile: JsonValue;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TemplateDto {
  readonly id: string;
  readonly institutionId: string;
  readonly courseId: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly active: boolean;
  readonly currentVersionNumber: number;
  readonly currentVersionId: string;
  readonly content: JsonValue;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TemplateSelectionDto {
  readonly id: string;
  readonly eventId: string;
  readonly institutionId: string;
  readonly courseId: string | null;
  readonly templateId: string | null;
  readonly templateVersionId: string | null;
  readonly selectedBy: string;
  readonly createdAt: Date;
}

export interface ArticleReferenceDto {
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
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ArticleCitationDto {
  readonly id: string;
  readonly articleId: string;
  readonly referenceId: string;
  readonly kind: string;
  readonly locator: JsonValue | null;
  readonly page: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export interface ArticleVersionDto {
  readonly id: string;
  readonly articleId: string;
  readonly kind: VersionKind;
  readonly content: JsonValue;
  readonly authorId: string | null;
  readonly metadata: JsonValue;
  readonly createdAt: Date;
}

export interface ArticleSubmissionDto {
  readonly id: string;
  readonly articleId: string;
  readonly milestoneId: string;
  readonly milestoneOrder: number;
  readonly content: JsonValue;
  readonly submittedBy: string | null;
  readonly automatic: boolean;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}

export interface ArticleRemarkDto {
  readonly id: string;
  readonly articleId: string;
  readonly submissionId: string;
  readonly status: RemarkStatus;
  readonly anchor: JsonValue;
  readonly originalText: string;
  readonly currentText: string | null;
  readonly body: string;
  readonly visibleToTeam: boolean;
  readonly createdBy: string;
  readonly addressedBy: string | null;
  readonly addressedAt: Date | null;
  readonly decidedBy: string | null;
  readonly decidedAt: Date | null;
  readonly decisionReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ArticlePresenceDto {
  readonly articleId: string;
  readonly userId: string;
  readonly cursor: JsonValue;
  readonly updatedAt: Date;
}

export interface ActorCommand {
  readonly actorId: string;
}

export interface CreateTemplateCommand extends ActorCommand {
  readonly name: string;
  readonly description?: string | null;
  readonly courseId?: string | null;
  readonly content: JsonValue;
}

export interface ListTemplatesCommand extends ActorCommand {
  readonly request: PageRequest;
  readonly courseId?: string;
  readonly includeInactive?: boolean;
}

export interface TemplateQuery extends ActorCommand {
  readonly templateId: string;
}

export interface UpdateTemplateCommand extends TemplateQuery {
  readonly name?: string;
  readonly description?: string | null;
  readonly courseId?: string | null;
  readonly content?: JsonValue;
}

export interface SelectTemplateCommand extends ActorCommand {
  readonly eventId: string;
  readonly institutionId?: string;
  readonly courseId?: string | null;
  readonly templateId?: string | null;
}

export interface ArticleQuery extends ActorCommand {
  readonly articleId: string;
}

export interface CreateArticleCommand extends ActorCommand {
  readonly institutionId?: string;
  readonly courseId?: string | null;
  readonly eventId: string;
  readonly teamId: string;
  readonly advisorId?: string | null;
  readonly memberIds: readonly string[];
  readonly currentMilestoneId?: string | null;
  readonly currentMilestoneOrder?: number | null;
  readonly currentMilestoneDeadline?: Date | null;
  readonly lastMilestoneOrder?: number | null;
  readonly templateVersionId?: string | null;
}

export interface SaveContentCommand extends ArticleQuery {
  readonly content: JsonValue;
  readonly baseVersionId?: string;
}

export interface PresenceCommand extends ArticleQuery {
  readonly cursor: JsonValue;
}

export interface ReferenceCommand extends ArticleQuery {
  readonly type: string;
  readonly authors: JsonValue;
  readonly title: string;
  readonly year?: number | null;
  readonly vehicle?: string | null;
  readonly edition?: string | null;
  readonly place?: string | null;
  readonly publisher?: string | null;
  readonly pages?: string | null;
  readonly doi?: string | null;
  readonly url?: string | null;
}

export interface ReferenceQuery extends ArticleQuery {
  readonly referenceId: string;
}

export interface UpdateReferenceCommand extends ReferenceQuery {
  readonly type?: string;
  readonly authors?: JsonValue;
  readonly title?: string;
  readonly year?: number | null;
  readonly vehicle?: string | null;
  readonly edition?: string | null;
  readonly place?: string | null;
  readonly publisher?: string | null;
  readonly pages?: string | null;
  readonly doi?: string | null;
  readonly url?: string | null;
}

export interface CitationCommand extends ReferenceQuery {
  readonly kind: string;
  readonly locator?: JsonValue | null;
  readonly page?: string | null;
}

export interface FormatArticleCommand extends ArticleQuery {
  readonly target?: JsonValue | null;
}

export interface ImportArticleCommand extends ArticleQuery {
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly content: JsonValue;
  readonly metadata?: JsonValue;
  readonly confirmReplace?: boolean;
}

export interface ExportArticleCommand extends ArticleQuery {
  readonly format: ExportFormat;
}

export interface ExportedArticleDto {
  readonly articleId: string;
  readonly format: ExportFormat;
  readonly fileName: string;
  readonly content: JsonValue;
  readonly generatedAt: Date;
}

export interface FormatReportDto {
  readonly article: ArticleDto;
  readonly changed: boolean;
  readonly norm: 'ABNT';
  readonly target: JsonValue | null;
  readonly changes: readonly string[];
}

export interface RestoreVersionCommand extends ArticleQuery {
  readonly versionId: string;
}

export interface SubmitArticleCommand extends ArticleQuery {
  readonly automatic?: boolean;
}

export interface SubmissionQuery extends ArticleQuery {
  readonly submissionId: string;
}

export interface RemarkCommand extends SubmissionQuery {
  readonly anchor: JsonValue;
  readonly originalText: string;
  readonly body: string;
}

export interface RemarkQuery extends ArticleQuery {
  readonly remarkId: string;
}

export interface UpdateRemarkCommand extends RemarkQuery {
  readonly body: string;
}

export interface DecideRemarkCommand extends RemarkQuery {
  readonly decision: Extract<RemarkStatus, 'OPEN' | 'RESOLVED' | 'DISMISSED'>;
  readonly reason?: string | null;
}

export interface SubmissionComparisonDto {
  readonly submission: ArticleSubmissionDto;
  readonly previousSubmission: ArticleSubmissionDto | null;
  readonly differences: readonly WordDifferenceDto[];
}

export interface WordDifferenceDto {
  readonly kind: 'UNCHANGED' | 'INSERTED' | 'REMOVED';
  readonly value: string;
}
