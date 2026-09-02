/**
 * A falha classificada, produzida pela camada de aplicação (decisão D1 do
 * `design.md` desta vertical).
 *
 * Nesta vertical não existe HTTP: não há rota, envelope nem tratador global — todos
 * nascem em `add-session-authentication`. O caso de uso, ainda assim, precisa dizer
 * **qual** falha ocorreu, com o código do catálogo da URS §2.4, porque `ADR-0022` §12 e
 * §13 classificam a falha esperada independentemente do transporte e `ADR-0025` §7 exige
 * código estável e independente de idioma.
 *
 * Manter a classificação aqui faz do controller da vertical seguinte uma tradução de
 * código para status HTTP, e nada mais. Lançar exceção do NestJS no lugar acoplaria a
 * aplicação ao framework HTTP, contra `ADR-0003` §4.
 *
 * O tipo estreito não sai do módulo: em `contracts/` o código atravessa como texto
 * opaco, pelo mesmo motivo que papel e permissão (`ADR-0027` §14).
 */

/** Os códigos do catálogo da URS §2.4 que esta vertical produz. */
export const FAILURE = {
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  LANGUAGE_NOT_SUPPORTED: 'LANGUAGE_NOT_SUPPORTED',
} as const;

export type FailureCode = (typeof FAILURE)[keyof typeof FAILURE];

/**
 * O vocabulário do detalhamento por campo. É mais fino que o de `FAILURE`: a URS §2.4
 * cataloga o código da resposta, e `ADR-0025` §17 exige que cada item de `errors`
 * carregue o seu próprio `code`, que diz o que há de errado com aquele campo.
 */
export const VIOLATION = {
  REQUIRED: 'REQUIRED',
  MALFORMED: 'MALFORMED',
  TOO_SHORT: 'TOO_SHORT',
  TOO_LONG: 'TOO_LONG',
  NOT_EDITABLE: 'NOT_EDITABLE',
  /** O valor está bem formado e não confere — a senha atual, notadamente. */
  INCORRECT: 'INCORRECT',
} as const;

export type ViolationCode = (typeof VIOLATION)[keyof typeof VIOLATION];

/**
 * Um item por campo inválido (`ADR-0025` §16, §17).
 *
 * NÃO carrega o valor submetido (`ADR-0025` §18, `PAD-SEG-025`): o e-mail é dado
 * pessoal, e ecoá-lo aqui o levaria a todo lugar por onde a falha passasse.
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
 * União discriminada, e não exceção, porque a falha esperada é resultado previsto do
 * caso de uso — o tipo obriga quem chama a tratá-la.
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
