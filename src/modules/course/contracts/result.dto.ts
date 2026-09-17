export interface FieldViolationDto {
  readonly field: string;
  readonly code: string;
}

export interface FailureDto {
  readonly code: string;
  readonly fields?: readonly FieldViolationDto[];
}

export type CourseResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly failure: FailureDto };
