export const FAILURE = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  INSTITUTION_INACTIVE: 'INSTITUTION_INACTIVE',
  TEMPLATE_ALREADY_FIXED: 'TEMPLATE_ALREADY_FIXED',
  ARTICLE_LOCKED_FOR_REVIEW: 'ARTICLE_LOCKED_FOR_REVIEW',
  ARTICLE_ALREADY_FINISHED: 'ARTICLE_ALREADY_FINISHED',
  ARTICLE_NOT_IN_REVIEW: 'ARTICLE_NOT_IN_REVIEW',
  REFERENCE_IN_USE: 'REFERENCE_IN_USE',
  FILE_FORMAT_NOT_SUPPORTED: 'FILE_FORMAT_NOT_SUPPORTED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  SUBMISSION_ALREADY_MADE: 'SUBMISSION_ALREADY_MADE',
  MILESTONE_NOT_OPEN: 'MILESTONE_NOT_OPEN',
  MILESTONE_DEADLINE_PASSED: 'MILESTONE_DEADLINE_PASSED',
  MILESTONE_PENDING: 'MILESTONE_PENDING',
  REVIEW_ALREADY_STARTED: 'REVIEW_ALREADY_STARTED',
  REMARK_ALREADY_CLOSED: 'REMARK_ALREADY_CLOSED',
  REMARK_PENDING: 'REMARK_PENDING',
} as const;

export type FailureCode = (typeof FAILURE)[keyof typeof FAILURE];

export const VIOLATION = {
  REQUIRED: 'REQUIRED',
  MALFORMED: 'MALFORMED',
  TOO_LONG: 'TOO_LONG',
} as const;

export type ViolationCode = (typeof VIOLATION)[keyof typeof VIOLATION];

export interface FieldViolation {
  readonly field: string;
  readonly code: ViolationCode;
}

export interface Failure {
  readonly code: FailureCode;
  readonly fields?: readonly FieldViolation[];
}

export type Result<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly failure: Failure };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T>(code: FailureCode, fields?: readonly FieldViolation[]): Result<T> {
  return fields === undefined
    ? { ok: false, failure: { code } }
    : { ok: false, failure: { code, fields } };
}

export function failValidation<T>(fields: readonly FieldViolation[]): Result<T> {
  return { ok: false, failure: { code: FAILURE.VALIDATION_FAILED, fields } };
}
