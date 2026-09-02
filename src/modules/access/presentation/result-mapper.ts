import { ApiFailure } from '@shared/errors/api-failure';
import { isKnownResponseCode } from '@shared/http/response-code';

import type { AccessResult } from '../contracts/result.dto';

/**
 * Traduz o resultado da fachada em resposta HTTP.
 *
 * É **toda** a responsabilidade do controlador diante de uma falha, e é assim de propósito:
 * o caso de uso já classificou com o código do catálogo, e o status HTTP de cada código
 * está declarado em ponto único. Não há decisão a tomar aqui — só a conversão.
 *
 * Código que a fachada devolva e o catálogo não conheça vira `INTERNAL_ERROR`, e não é
 * repassado ao cliente: um código fora do catálogo é defeito do servidor, e `ADR-0025` §20
 * não admite que o cliente receba código que não possa traduzir.
 */
export function unwrap<T>(result: AccessResult<T>): T {
  if (result.ok) {
    return result.value;
  }

  const { code, fields } = result.failure;

  throw new ApiFailure(
    isKnownResponseCode(code) ? code : 'INTERNAL_ERROR',
    fields?.map((violation) => ({ field: violation.field, code: violation.code })),
  );
}
