import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { currentContext } from '../correlation/correlation';
import { ApiFailure } from '../errors/api-failure';
import {
  ROUTE_AUTHENTICATED_KEY,
  ROUTE_PERMISSION_KEY,
  ROUTE_PUBLIC_KEY,
} from '../http/route-access';
import { routeOf } from '../http/request-route';
import { StructuredLogger } from '../logging/logger';
import { IdentityResolver } from './identity';
import { attachSession } from './request-session';
import { SessionStore } from './session-store';
import { readSessionId } from './session-cookie';

/**
 * A guarda de borda: **a verificação de permissão antes do caso de uso** (`ADR-0014` §11,
 * decisão D4).
 *
 * Registrada globalmente, o que a torna o caminho de toda rota — inclusive da que alguém
 * escreveu esta manhã. Rota sem declaração de acesso não é servida: a inicialização já a
 * teria recusado, e esta guarda recusa de novo, porque uma defesa que existe em um só
 * lugar é uma defesa que se remove por engano.
 *
 * **A permissão confrontada é a resolvida no servidor**, nunca a que o cliente enviou. Não
 * há caminho para o contrário: esta guarda não lê corpo nem cabeçalho à procura de
 * permissão — ela pergunta ao resolvedor, que consulta a base.
 *
 * **A titularidade não passa por aqui** (`ADR-0014` §12, §13): possuir `ARTICLE:UPDATE`
 * autoriza a ação, não o registro. Quem decide de quem é o registro é o caso de uso do
 * módulo dono dele.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  private readonly logger = new StructuredLogger('shared');

  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionStore,
    private readonly identities: IdentityResolver,
    private readonly sessionCookieName: string,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(ROUTE_PUBLIC_KEY, targets) === true) {
      return true;
    }

    const authenticated = this.reflector.getAllAndOverride<boolean>(
      ROUTE_AUTHENTICATED_KEY,
      targets,
    );
    const permission = this.reflector.getAllAndOverride<string>(ROUTE_PERMISSION_KEY, targets);

    // Rota sem declaração alguma. A inicialização já deveria tê-la recusado; se chegou
    // aqui, nega — falhar fechado é a razão de a declaração ser obrigatória.
    if (authenticated !== true && permission === undefined) {
      throw new ApiFailure('PERMISSION_DENIED');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const state = await this.resolveSession(request);

    const context_ = currentContext();

    if (context_ !== null) {
      context_.userId = state.userId;
    }

    if (permission === undefined) {
      return true;
    }

    const granted = await this.identities.permissionsOf(state.userId);

    if (!granted.includes(permission)) {
      // A negativa de autorização é registrada (`ADR-0014` §14), e os campos são os da
      // lista de permissão — nenhum dado pessoal entra.
      this.logger.warn('AUTHORIZATION_DENIED', {
        route: routeOf(request),
        method: request.method,
        userId: state.userId,
        requiredPermission: permission,
        statusCode: 403,
        responseCode: 'PERMISSION_DENIED',
      });

      throw new ApiFailure('PERMISSION_DENIED');
    }

    return true;
  }

  /**
   * Resolve a sessão, ou recusa.
   *
   * **A indisponibilidade do repositório de sessões recusa a requisição** (`ADR-0013` §16):
   * o erro do Redis não sobe como falha inesperada, vira negativa de autenticação — que é
   * o que o ADR manda —, e fica registrado para que a queda não passe despercebida. Não
   * existe caminho neste método que aceite a requisição sem ter lido a sessão.
   */
  private async resolveSession(request: Request) {
    const sessionId = readSessionId(request, this.sessionCookieName);

    if (sessionId === null) {
      throw new ApiFailure('AUTHENTICATION_FAILED');
    }

    let state;

    try {
      state = await this.sessions.resolve(sessionId);
    } catch (cause) {
      this.logger.error('SESSION_STORE_UNAVAILABLE', {
        route: routeOf(request),
        method: request.method,
        statusCode: 401,
        responseCode: 'AUTHENTICATION_FAILED',
        failureClass: 'unexpected',
        errorName: cause instanceof Error ? cause.name : typeof cause,
        errorMessage: cause instanceof Error ? cause.message : String(cause),
      });

      throw new ApiFailure('AUTHENTICATION_FAILED');
    }

    if (state === null) {
      throw new ApiFailure('AUTHENTICATION_FAILED');
    }

    attachSession(request, { id: sessionId, state });

    return state;
  }
}
