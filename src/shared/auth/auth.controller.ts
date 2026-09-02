import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { AuthConfig } from '../config/environment';
import { ApiEnvelope, ApiFailures } from '../http/openapi';
import { AuthenticatedRoute, PublicRoute } from '../http/route-access';
import { parseOrFail } from '../http/validation';
import { AuthenticateRequestDto, authenticateSchema, IdentityDto } from './auth.dto';
import { AuthenticationService } from './authentication.service';
import { csrfTokenFor } from './csrf';
import type { AuthenticatedIdentity } from './identity';
import { CurrentSession } from './request-session';
import type { Session } from './session-store';
import { clearAuthCookies, readSessionId, setCsrfCookie, setSessionCookie } from './session-cookie';

/**
 * As rotas da presença autenticada: entrar, sair, e saber quem se é.
 *
 * Residem em `shared/` porque a autenticação é preocupação transversal (`ADR-0013` §17), e
 * **nenhum módulo tem mecanismo próprio** (§18). São as três primeiras rotas publicadas
 * pelo sistema.
 */
@ApiTags('Autenticação')
@Controller()
export class AuthController {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly config: AuthConfig,
  ) {}

  /**
   * RF-ACS-001. Público por definição — é a porta.
   *
   * Devolve `200`, e não `201`: `ADR-0025` §27 exige que o `201` traga o recurso criado em
   * `data` e um cabeçalho `Location` apontando para ele, e a sessão é opaca — não tem
   * endereço, e publicar um seria publicar a credencial na URL, contra `ADR-0013` §9. O que
   * volta em `data` é a identidade, que é leitura (§26).
   */
  @Post('sessions')
  @PublicRoute()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Estabelece a sessão por e-mail e senha',
    description:
      'Devolve a identidade e as permissões efetivas, e emite dois cookies: o de sessão, ' +
      'inacessível a script, e o do token anti-CSRF, que o cliente lê e devolve em ' +
      '`X-CSRF-Token` nas requisições que alteram estado.',
  })
  @ApiEnvelope(IdentityDto, { description: 'Sessão estabelecida.' })
  @ApiFailures('VALIDATION_FAILED', 'AUTHENTICATION_FAILED')
  async authenticate(
    @Body() body: AuthenticateRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<IdentityDto> {
    const credentials = parseOrFail(authenticateSchema, body);

    const { session, identity } = await this.authentication.authenticate(
      credentials.email,
      credentials.password,
      { ip: request.ip ?? null, userAgent: request.headers['user-agent'] ?? null },
      readSessionId(request, this.config.session.cookieName),
    );

    this.issueCookies(response, session);

    return toIdentityDto(identity);
  }

  /**
   * RF-ACS-002. **Público, e não autenticado**, o que parece errado e não é: E1 exige que
   * o encerramento com credencial já expirada conclua com sucesso, e uma rota autenticada
   * responderia `401` — recusando-se a encerrar justamente a sessão que já não vale.
   *
   * A proteção anti-CSRF continua valendo: a guarda a exige de toda requisição que altere
   * estado e porte identificador de sessão.
   */
  @Delete('sessions/current')
  @PublicRoute()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Encerra a sessão corrente',
    description:
      'Idempotente (RF-ACS-002 E1). Afeta apenas a sessão corrente (RN1): as demais ' +
      'sessões do mesmo usuário permanecem válidas.',
  })
  async endSession(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authentication.endSession(readSessionId(request, this.config.session.cookieName));

    clearAuthCookies(response, this.config.session.cookieName, this.config.csrfCookieName);
  }

  /**
   * `ADR-0013` §20. O cliente o consulta uma vez por carregamento (`ADR-0017` §18).
   *
   * Reemite o cookie do token anti-CSRF, para que o cliente que o perdeu — aba nova, cookie
   * de sessão ainda válido — o recupere sem precisar autenticar-se de novo.
   */
  @Get('identity')
  @AuthenticatedRoute()
  @ApiOperation({
    summary: 'A identidade do usuário autenticado',
    description:
      'As permissões devolvidas servem EXCLUSIVAMENTE para compor a interface. Ocultar ' +
      'uma ação não a protege: o servidor verifica a permissão a cada requisição.',
  })
  @ApiEnvelope(IdentityDto)
  @ApiFailures('AUTHENTICATION_FAILED')
  async identity(
    @CurrentSession() session: Session,
    @Res({ passthrough: true }) response: Response,
  ): Promise<IdentityDto> {
    const identity = await this.authentication.identityOf(session.state.userId);

    setCsrfCookie(
      response,
      this.config.csrfCookieName,
      csrfTokenFor(session.id, this.config.csrfSecret),
      this.config.session.idleTtlSeconds,
    );

    return toIdentityDto(identity);
  }

  private issueCookies(response: Response, session: Session): void {
    setSessionCookie(
      response,
      this.config.session.cookieName,
      session.id,
      this.config.session.idleTtlSeconds,
    );

    setCsrfCookie(
      response,
      this.config.csrfCookieName,
      csrfTokenFor(session.id, this.config.csrfSecret),
      this.config.session.idleTtlSeconds,
    );
  }
}

function toIdentityDto(identity: AuthenticatedIdentity): IdentityDto {
  return {
    userId: identity.userId,
    email: identity.email,
    name: identity.name,
    preferredLanguage: identity.preferredLanguage,
    roles: [...identity.roles],
    permissions: [...identity.permissions],
  };
}
