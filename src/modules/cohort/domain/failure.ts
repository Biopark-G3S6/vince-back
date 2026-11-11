export interface FieldViolation {
  readonly field: string;
  readonly code: string;
}

export const FAILURE = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  COHORT_ALREADY_EXISTS: 'COHORT_ALREADY_EXISTS',
  STUDENT_ALREADY_ENROLLED: 'STUDENT_ALREADY_ENROLLED',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  INVITATION_REVOKED: 'INVITATION_REVOKED',
} as const;

export type FailureCode = (typeof FAILURE)[keyof typeof FAILURE];

export interface Failure {
  readonly code: string;
  readonly fields?: readonly FieldViolation[];
}

export type Result<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly failure: Failure };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T>(code: FailureCode): Result<T> {
  return { ok: false, failure: { code } };
}

export function failValidation<T>(fields: readonly FieldViolation[]): Result<T> {
  return { ok: false, failure: { code: FAILURE.VALIDATION_FAILED, fields } };
}
