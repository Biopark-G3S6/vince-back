/** Falhas que a vertical de curso pode produzir. */
export const FAILURE = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  INSTITUTION_INACTIVE: 'INSTITUTION_INACTIVE',
  COORDINATOR_ALREADY_ASSIGNED: 'COORDINATOR_ALREADY_ASSIGNED',
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
