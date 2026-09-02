import type { FieldError } from '../http/response-envelope';
import type { FieldViolationCode, ResponseCode } from '../http/response-code';

/**
 * A falha **esperada** (`ADR-0022` §12, §13): validação, violação de regra de negócio,
 * recurso inexistente, autorização negada.
 *
 * É exceção, e não união discriminada, porque atravessa a borda HTTP, onde quem a produz
 * — uma guarda, um interceptador, um controlador — nem sempre é quem devolve a resposta.
 * Dentro de um módulo a convenção continua sendo o `Result` de `domain/failure.ts`: o
 * caso de uso não conhece HTTP, e a conversão acontece no controlador.
 *
 * O status HTTP não é escolhido aqui: ele é o do catálogo, em `response-code.ts`. Ter
 * dois lugares decidindo o status do mesmo código é como a resposta passa a contradizer
 * o corpo, contra `ADR-0025` §14.
 */
export class ApiFailure extends Error {
  constructor(
    readonly code: ResponseCode,
    readonly fields?: readonly FieldError[],
  ) {
    super(code);
    this.name = 'ApiFailure';
  }
}

/** Falha de validação com um item por campo, na ordem em que foram apurados. */
export function validationFailure(fields: readonly FieldError[]): ApiFailure {
  return new ApiFailure('VALIDATION_FAILED', fields);
}

export function fieldError(
  field: string,
  code: FieldViolationCode,
  meta?: Readonly<Record<string, string | number | boolean>>,
): FieldError {
  return meta === undefined ? { field, code } : { field, code, meta };
}
