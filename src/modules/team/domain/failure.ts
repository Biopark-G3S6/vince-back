export interface FieldViolation {
  readonly field: string;
  readonly code: string;
}

export const FAILURE = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  EVENT_TEAM_LIMIT_REACHED: 'EVENT_TEAM_LIMIT_REACHED',
  TEAM_SIZE_LIMIT_REACHED: 'TEAM_SIZE_LIMIT_REACHED',
  STUDENT_ALREADY_IN_TEAM: 'STUDENT_ALREADY_IN_TEAM',
  STUDENT_NOT_ELIGIBLE: 'STUDENT_NOT_ELIGIBLE',
  ADVISOR_NOT_ASSIGNED_TO_EVENT: 'ADVISOR_NOT_ASSIGNED_TO_EVENT',
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
