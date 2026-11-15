export interface FieldViolationDto {
  readonly field: string;
  readonly code: string;
}

export interface ArticleFailureDto {
  readonly code: string;
  readonly fields?: readonly FieldViolationDto[];
}

export type ArticleResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: ArticleFailureDto };
