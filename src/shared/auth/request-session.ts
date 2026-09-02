import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { ApiFailure } from '../errors/api-failure';
import type { Session } from './session';

/**
 * A sessão resolvida pela guarda, disponível ao controlador.
 *
 * A chave é um símbolo, e não uma propriedade nomeada, para não aumentar o tipo de
 * `Request` do Express em toda a aplicação: quem não passou pela guarda não tem o que ler,
 * e o compilador não sugere o contrário.
 */
const SESSION_KEY = Symbol.for('vince:session');

type SessionCarrier = Record<symbol, unknown>;

export function attachSession(request: Request, session: Session): void {
  (request as unknown as SessionCarrier)[SESSION_KEY] = session;
}

export function sessionOf(request: Request): Session | null {
  const found = (request as unknown as SessionCarrier)[SESSION_KEY];

  return found === undefined ? null : (found as Session);
}

/**
 * A sessão corrente, no parâmetro do controlador.
 *
 * A ausência é falha de programação — só existe em rota que não declarou exigir sessão —,
 * e por isso recusa em vez de devolver nulo: uma rota que se declara autenticada e recebe
 * sessão nula trataria o anônimo como titular.
 */
export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Session => {
    const session = sessionOf(context.switchToHttp().getRequest<Request>());

    if (session === null) {
      throw new ApiFailure('AUTHENTICATION_FAILED');
    }

    return session;
  },
);
