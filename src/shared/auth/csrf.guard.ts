import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { ApiFailure } from '../errors/api-failure';
import { CSRF_HEADER, isValidCsrfToken } from './csrf';
import { readSessionId } from './session-cookie';

/**
 * A proteção contra falsificação de requisição entre sítios (`ADR-0013` §13, §14).
 *
 * Alcança **só o que altera estado**: método seguro passa sem token, porque não há estado
 * a proteger e exigir token em leitura só quebraria navegação.
 *
 * **Sem sessão, não há o que forjar.** A requisição que não porta identificador de sessão
 * é deixada seguir — a autenticação é o próprio caso: ninguém forja uma entrada em nome de
 * um usuário que não está autenticado. É também o que mantém o encerramento de sessão
 * idempotente quando a credencial já expirou (RF-ACS-002 E1).
 *
 * A recusa devolve `PERMISSION_DENIED`, e não um código próprio: o catálogo da URS §2.4
 * não tem entrada para falsificação, `ADR-0025` §20 não admite código fora dele, e o que
 * de fato ocorreu é uma requisição não autorizada.
 */
const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly secret: string,
    private readonly sessionCookieName: string,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    if (!STATE_CHANGING.has(request.method.toUpperCase())) {
      return true;
    }

    const sessionId = readSessionId(request, this.sessionCookieName);

    if (sessionId === null) {
      return true;
    }

    const received = request.headers[CSRF_HEADER];
    const token = Array.isArray(received) ? received[0] : received;

    if (typeof token !== 'string' || !isValidCsrfToken(token, sessionId, this.secret)) {
      throw new ApiFailure('PERMISSION_DENIED');
    }

    return true;
  }
}
