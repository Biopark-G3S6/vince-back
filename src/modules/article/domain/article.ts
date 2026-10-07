import { VIOLATION, type FieldViolation } from './failure';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export const ARTICLE_STATUS = {
  STARTED: 'STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_REVIEW: 'IN_REVIEW',
  FINISHED: 'FINISHED',
} as const;

export type ArticleStatus = (typeof ARTICLE_STATUS)[keyof typeof ARTICLE_STATUS];

export const REMARK_STATUS = {
  OPEN: 'OPEN',
  ADDRESSED: 'ADDRESSED',
  RESOLVED: 'RESOLVED',
  DISMISSED: 'DISMISSED',
} as const;

export type RemarkStatus = (typeof REMARK_STATUS)[keyof typeof REMARK_STATUS];

export const VERSION_KIND = {
  AUTOSAVE: 'AUTOSAVE',
  IMPORT: 'IMPORT',
  RESTORE: 'RESTORE',
  SUBMISSION: 'SUBMISSION',
  FORMAT: 'FORMAT',
} as const;

export type VersionKind = (typeof VERSION_KIND)[keyof typeof VERSION_KIND];

export const EXPORT_FORMAT = {
  DOCX: 'DOCX',
  PDF: 'PDF',
} as const;

export type ExportFormat = (typeof EXPORT_FORMAT)[keyof typeof EXPORT_FORMAT];

export interface Article {
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

export interface Template {
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

export interface TemplateSelection {
  readonly id: string;
  readonly eventId: string;
  readonly institutionId: string;
  readonly courseId: string | null;
  readonly templateId: string | null;
  readonly templateVersionId: string | null;
  readonly selectedBy: string;
  readonly createdAt: Date;
}

export interface ArticleReference {
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

export interface ArticleCitation {
  readonly id: string;
  readonly articleId: string;
  readonly referenceId: string;
  readonly kind: string;
  readonly locator: JsonValue | null;
  readonly page: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export interface ArticleVersion {
  readonly id: string;
  readonly articleId: string;
  readonly kind: VersionKind;
  readonly content: JsonValue;
  readonly authorId: string | null;
  readonly metadata: JsonValue;
  readonly createdAt: Date;
}

export interface ArticleSubmission {
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

export interface ArticleRemark {
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

export interface ArticlePresence {
  readonly articleId: string;
  readonly userId: string;
  readonly cursor: JsonValue;
  readonly updatedAt: Date;
}

export const TEMPLATE_NAME_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const TITLE_MAX_LENGTH = 500;
export const TEXT_MAX_LENGTH = 20_000;
export const IMPORT_MAX_BYTES = 15 * 1024 * 1024;

export function validateRequiredText(
  field: string,
  value: string | undefined,
  maxLength: number,
  into: FieldViolation[],
): void {
  const normalized = (value ?? '').trim();

  if (normalized.length === 0) {
    into.push({ field, code: VIOLATION.REQUIRED });
  } else if (normalized.length > maxLength) {
    into.push({ field, code: VIOLATION.TOO_LONG });
  }
}

export function validateOptionalText(
  field: string,
  value: string | null | undefined,
  maxLength: number,
  into: FieldViolation[],
): void {
  if (value !== undefined && value !== null && value.trim().length > maxLength) {
    into.push({ field, code: VIOLATION.TOO_LONG });
  }
}

export function isEditable(article: Article): boolean {
  return article.status === ARTICLE_STATUS.STARTED || article.status === ARTICLE_STATUS.IN_PROGRESS;
}

export function canReadArticle(article: Article, actorId: string): boolean {
  return (
    article.memberIds.includes(actorId) ||
    article.advisorId === actorId ||
    article.courseId !== null
  );
}

export function isTeamMember(article: Article, actorId: string): boolean {
  return article.memberIds.includes(actorId);
}

export function isResponsibleAdvisor(article: Article, actorId: string): boolean {
  return article.advisorId === actorId;
}

export function currentTextOf(content: JsonValue, anchor: JsonValue): string | null {
  if (!isObject(anchor) || typeof anchor.path !== 'string') {
    return null;
  }

  if (!isObject(content)) {
    return null;
  }

  const value = content[anchor.path];

  return typeof value === 'string' ? value : null;
}

function isObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
