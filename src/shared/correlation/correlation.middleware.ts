import type { NextFunction, Request, Response } from 'express';

import {
  CORRELATION_HEADER,
  resolveCorrelationId,
  runWithContext,
  type RequestContext,
} from './correlation';

/**
 * A borda em que a correlação nasce (`ADR-0022` §7).
 *
 * É middleware do Express aplicado com `app.use`, e não middleware do NestJS declarado
 * por módulo, por uma razão que importa: assim ele alcança **também** a requisição que
 * não casa com rota alguma. `ADR-0025` §30 quer `X-Correlation-Id` em toda resposta, e o
 * `404` de rota inexistente é uma delas.
 *
 * O cabeçalho é escrito **antes** de o controlador executar, e não ao devolver: a falha
 * inesperada não passa por lugar algum em que se possa confiar, e escrito aqui ele já
 * está no objeto de resposta quando o tratador global assume.
 */
export function correlationMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const received = request.headers[CORRELATION_HEADER];
  const correlationId = resolveCorrelationId(
    Array.isArray(received) ? received[0] : (received ?? undefined),
  );

  response.setHeader('X-Correlation-Id', correlationId);

  const context: RequestContext = { correlationId, userId: null };

  runWithContext(context, () => {
    next();
  });
}
