import type { ZodIssue, ZodType } from 'zod';

import { validationFailure } from '../errors/api-failure';
import { FIELD_VIOLATION } from './response-code';
import type { FieldError } from './response-envelope';

/**
 * A validação do corpo da requisição, traduzida para o detalhamento por campo de
 * `ADR-0025` §16 e §17.
 *
 * **Todas as violações de uma vez**, e não a primeira: apurar uma por vez faria o cliente
 * descobrir os seus erros em tantas idas quantas fossem.
 *
 * **A mensagem do validador nunca sai daqui.** Ela cita o valor recebido, e `ADR-0025`
 * §18 e `PAD-SEG-025` proíbem ecoá-lo; o que atravessa é o código do campo e, quando há
 * limite violado, o próprio limite — que é do sistema, não do usuário, e é o que
 * `ADR-0026` §16 quer em `meta` para o cliente interpolar na mensagem traduzida.
 */
export function parseOrFail<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  throw validationFailure(result.error.issues.map(toFieldError));
}

function toFieldError(issue: ZodIssue): FieldError {
  const field = issue.path.length === 0 ? 'body' : issue.path.map(String).join('.');

  switch (issue.code) {
    case 'invalid_type':
      return issue.received === 'undefined' || issue.received === 'null'
        ? { field, code: FIELD_VIOLATION.REQUIRED }
        : { field, code: FIELD_VIOLATION.MALFORMED };

    case 'too_small':
      // Mínimo de um caractere é "obrigatório", não "curto demais": o campo está vazio.
      return Number(issue.minimum) <= 1
        ? { field, code: FIELD_VIOLATION.REQUIRED }
        : { field, code: FIELD_VIOLATION.TOO_SHORT, meta: { minimum: Number(issue.minimum) } };

    case 'too_big':
      return { field, code: FIELD_VIOLATION.TOO_LONG, meta: { maximum: Number(issue.maximum) } };

    default:
      return { field, code: FIELD_VIOLATION.MALFORMED };
  }
}
