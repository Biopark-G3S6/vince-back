/**
 * A falha classificada, produzida pela camada de aplicação do módulo `institution`.
 *
 * Mesma forma que a do módulo `access`, e declarada aqui de propósito: o conjunto de
 * códigos é **o que este módulo produz**, e não o catálogo inteiro. `access` não emite
 * `INSTITUTION_INACTIVE`; `institution` não emite `EMAIL_ALREADY_REGISTERED`. Um tipo
 * comum em `shared/` os uniria num vocabulário que nenhum dos dois módulos usa por
 * inteiro, e o compilador deixaria de reprovar o código que um deles não pode emitir.
 *
 * O tipo estreito não sai do módulo: em `contracts/` o código atravessa como texto opaco,
 * pelo mesmo motivo que papel e permissão (`ADR-0028` §23).
 */

/** Os códigos do catálogo da URS §2.4 que este módulo produz. */
export const FAILURE = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  INSTITUTION_INACTIVE: 'INSTITUTION_INACTIVE',
} as const;

export type FailureCode = (typeof FAILURE)[keyof typeof FAILURE];

/**
 * O vocabulário do detalhamento por campo (`ADR-0025` §17).
 *
 * `DUPLICATE` diz o que `TOO_LONG` e `MALFORMED` não dizem: o valor está bem formado e
 * já pertence a outra instituição. A sigla e o CNPJ são únicos, e recusar a segunda
 * gravação sem nomear o campo faria o cliente adivinhar qual dos dois colidiu.
 */
export const VIOLATION = {
  REQUIRED: 'REQUIRED',
  MALFORMED: 'MALFORMED',
  TOO_LONG: 'TOO_LONG',
  DUPLICATE: 'DUPLICATE',
} as const;

export type ViolationCode = (typeof VIOLATION)[keyof typeof VIOLATION];

/**
 * Um item por campo inválido (`ADR-0025` §16, §17).
 *
 * NÃO carrega o valor submetido (`ADR-0025` §18, `PAD-SEG-025`).
 */
export interface FieldViolation {
  readonly field: string;
  readonly code: ViolationCode;
}

export interface Failure {
  readonly code: FailureCode;
  /** Presente apenas na falha originada de validação de campos (`ADR-0025` §16). */
  readonly fields?: readonly FieldViolation[];
}

/**
 * O retorno de um caso de uso: o valor, ou a falha classificada.
 *
 * União discriminada, e não exceção, porque a falha esperada é resultado previsto do caso
 * de uso — o tipo obriga quem chama a tratá-la.
 */
export type Result<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly failure: Failure };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T>(code: FailureCode, fields?: readonly FieldViolation[]): Result<T> {
  return { ok: false, failure: fields === undefined ? { code } : { code, fields } };
}

/** Falha de validação com os campos apurados, na ordem em que foram declarados. */
export function failValidation<T>(fields: readonly FieldViolation[]): Result<T> {
  return { ok: false, failure: { code: FAILURE.VALIDATION_FAILED, fields } };
}
