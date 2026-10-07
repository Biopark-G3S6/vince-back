import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

const jsonSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(jsonSchema),
  ]),
);

const optionalString = z.string().nullable().optional();

export class TemplateResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  institutionId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  courseId!: string | null;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  currentVersionNumber!: number;

  @ApiProperty({ format: 'uuid' })
  currentVersionId!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  content!: unknown;
}

export class TemplateSelectionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty({ format: 'uuid' })
  institutionId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  courseId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  templateId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  templateVersionId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class ArticleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  institutionId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  courseId!: string | null;

  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty({ format: 'uuid' })
  teamId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  advisorId!: string | null;

  @ApiProperty({ type: [String], format: 'uuid' })
  memberIds!: string[];

  @ApiProperty({ enum: ['STARTED', 'IN_PROGRESS', 'IN_REVIEW', 'FINISHED'] })
  status!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  currentMilestoneId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  currentMilestoneOrder!: number | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  currentMilestoneDeadline!: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  content!: unknown;

  @ApiProperty({ type: 'object', additionalProperties: true })
  formatProfile!: unknown;
}

export class ReferenceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  articleId!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  authors!: unknown;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  year!: number | null;

  @ApiPropertyOptional({ nullable: true })
  vehicle!: string | null;

  @ApiPropertyOptional({ nullable: true })
  doi!: string | null;

  @ApiPropertyOptional({ nullable: true })
  url!: string | null;
}

export class CitationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  articleId!: string;

  @ApiProperty({ format: 'uuid' })
  referenceId!: string;

  @ApiProperty()
  kind!: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  locator!: unknown;

  @ApiPropertyOptional({ nullable: true })
  page!: string | null;
}

export class PresenceResponseDto {
  @ApiProperty({ format: 'uuid' })
  articleId!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  cursor!: unknown;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class VersionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  kind!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  content!: unknown;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  authorId!: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata!: unknown;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class SubmissionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  articleId!: string;

  @ApiProperty({ format: 'uuid' })
  milestoneId!: string;

  @ApiProperty()
  milestoneOrder!: number;

  @ApiProperty()
  automatic!: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  submittedBy!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class RemarkResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  articleId!: string;

  @ApiProperty({ format: 'uuid' })
  submissionId!: string;

  @ApiProperty({ enum: ['OPEN', 'ADDRESSED', 'RESOLVED', 'DISMISSED'] })
  status!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  anchor!: unknown;

  @ApiProperty()
  originalText!: string;

  @ApiPropertyOptional({ nullable: true })
  currentText!: string | null;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  visibleToTeam!: boolean;
}

export class FormatReportResponseDto {
  @ApiProperty({ type: ArticleResponseDto })
  article!: ArticleResponseDto;

  @ApiProperty()
  changed!: boolean;

  @ApiProperty()
  norm!: string;

  @ApiProperty({ type: [String] })
  changes!: string[];
}

export class ExportedArticleResponseDto {
  @ApiProperty({ format: 'uuid' })
  articleId!: string;

  @ApiProperty({ enum: ['DOCX', 'PDF'] })
  format!: string;

  @ApiProperty()
  fileName!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  content!: unknown;

  @ApiProperty({ format: 'date-time' })
  generatedAt!: string;
}

export class ComparisonResponseDto {
  @ApiProperty({ type: SubmissionResponseDto })
  submission!: SubmissionResponseDto;

  @ApiPropertyOptional({ type: SubmissionResponseDto, nullable: true })
  previousSubmission!: SubmissionResponseDto | null;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  differences!: unknown[];
}

export class CreateTemplateRequestDto {
  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  courseId?: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  content!: unknown;
}

export class UpdateTemplateRequestDto {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  courseId?: string | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  content?: unknown;
}

export class SelectTemplateRequestDto {
  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  courseId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  templateId?: string | null;
}

export class ContentRequestDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  content!: unknown;

  @ApiPropertyOptional({ format: 'uuid' })
  baseVersionId?: string;
}

export class PresenceRequestDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  cursor!: unknown;
}

export class ReferenceRequestDto {
  @ApiProperty()
  type!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  authors!: unknown;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  year?: number | null;

  @ApiPropertyOptional({ nullable: true })
  vehicle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  edition?: string | null;

  @ApiPropertyOptional({ nullable: true })
  place?: string | null;

  @ApiPropertyOptional({ nullable: true })
  publisher?: string | null;

  @ApiPropertyOptional({ nullable: true })
  pages?: string | null;

  @ApiPropertyOptional({ nullable: true })
  doi?: string | null;

  @ApiPropertyOptional({ nullable: true })
  url?: string | null;
}

export class CitationRequestDto {
  @ApiProperty()
  kind!: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  locator?: unknown;

  @ApiPropertyOptional({ nullable: true })
  page?: string | null;
}

export class FormatRequestDto {
  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  target?: unknown;
}

export class ImportRequestDto {
  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  sizeBytes!: number;

  @ApiProperty({ type: 'object', additionalProperties: true })
  content!: unknown;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  metadata?: unknown;

  @ApiPropertyOptional()
  confirmReplace?: boolean;
}

export class RemarkRequestDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  anchor!: unknown;

  @ApiProperty()
  originalText!: string;

  @ApiProperty()
  body!: string;
}

export class UpdateRemarkRequestDto {
  @ApiProperty()
  body!: string;
}

export class DecideRemarkRequestDto {
  @ApiProperty({ enum: ['OPEN', 'RESOLVED', 'DISMISSED'] })
  decision!: 'OPEN' | 'RESOLVED' | 'DISMISSED';

  @ApiPropertyOptional({ nullable: true })
  reason?: string | null;
}

export class DecisionReasonRequestDto {
  @ApiPropertyOptional({ nullable: true })
  reason?: string | null;
}

export const createTemplateSchema = z.object({
  name: z.string(),
  description: optionalString,
  courseId: z.string().uuid().nullable().optional(),
  content: jsonSchema,
});

export const updateTemplateSchema = z.object({
  name: z.string().optional(),
  description: optionalString,
  courseId: z.string().uuid().nullable().optional(),
  content: jsonSchema.optional(),
});

export const selectTemplateSchema = z.object({
  eventId: z.string().uuid(),
  courseId: z.string().uuid().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
});

export const contentSchema = z.object({
  content: jsonSchema,
  baseVersionId: z.string().uuid().optional(),
});

export const presenceSchema = z.object({ cursor: jsonSchema });

export const referenceSchema = z.object({
  type: z.string(),
  authors: jsonSchema,
  title: z.string(),
  year: z.number().int().nullable().optional(),
  vehicle: optionalString,
  edition: optionalString,
  place: optionalString,
  publisher: optionalString,
  pages: optionalString,
  doi: optionalString,
  url: optionalString,
});

export const citationSchema = z.object({
  kind: z.string(),
  locator: jsonSchema.nullable().optional(),
  page: optionalString,
});

export const formatSchema = z.object({ target: jsonSchema.nullable().optional() });

export const importSchema = z.object({
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  content: jsonSchema,
  metadata: jsonSchema.optional(),
  confirmReplace: z.boolean().optional(),
});

export const remarkSchema = z.object({
  anchor: jsonSchema,
  originalText: z.string(),
  body: z.string(),
});

export const updateRemarkSchema = z.object({ body: z.string() });

export const decideRemarkSchema = z.object({
  decision: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']),
  reason: optionalString,
});

export const decisionReasonSchema = z.object({ reason: optionalString });
