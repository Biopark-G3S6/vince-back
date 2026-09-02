import { Body, Controller, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentSession } from '@shared/auth/request-session';
import { SessionStore, type Session } from '@shared/auth/session-store';
import { ApiFailures } from '@shared/http/openapi';
import { AuthenticatedRoute, PublicRoute } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';
import { StructuredLogger } from '@shared/logging/logger';

import { AccessFacade } from '../contracts/access.facade';
import {
  ChangePasswordRequestDto,
  PasswordRecoveryRequestDto,
  ResetPasswordRequestDto,
  changePasswordSchema,
  passwordRecoverySchema,
  resetPasswordSchema,
} from './password.dto';
import { unwrap } from './result-mapper';

/**
 * A senha da conta (RF-ACS-003, RF-ACS-004).
 *
 * **A revogação das sessões acontece aqui**, e não no caso de uso, e a divisão é a de
 * `ADR-0013` §18: sessão é mecanismo transversal de `shared/`, e nenhum módulo a cria, lê
 * ou invalida por conta própria. O módulo altera a credencial; a borda, que é quem conhece
 * o mecanismo, encerra o que a alteração invalidou.
 *
 * A ordem é sempre a mesma: **primeiro a senha, depois as sessões**. Invertê-la derrubaria
 * as sessões de quem, no fim, não conseguiu trocar a senha.
 */
@ApiTags('Senha')
@Controller('password')
export class PasswordController {
  private readonly logger = new StructuredLogger('access');

  constructor(
    private readonly access: AccessFacade,
    private readonly sessions: SessionStore,
  ) {}

  /** RF-ACS-004 por usuário autenticado. Exige a senha atual (RN1). */
  @Put()
  @AuthenticatedRoute()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Altera a própria senha',
    description:
      'Concluída a alteração, as DEMAIS sessões do usuário são encerradas (RN2); a que ' +
      'originou a operação permanece válida.',
  })
  @ApiFailures('AUTHENTICATION_FAILED', 'VALIDATION_FAILED')
  async change(
    @CurrentSession() session: Session,
    @Body() body: ChangePasswordRequestDto,
  ): Promise<void> {
    const command = parseOrFail(changePasswordSchema, body);
    const userId = session.state.userId;

    unwrap(await this.access.changeOwnPassword({ userId, ...command }));

    const revoked = await this.sessions.revokeAllOfUser(userId, session.id);

    this.logger.info('PASSWORD_CHANGED', { userId, revokedSessions: revoked });
  }

  /**
   * RF-ACS-003. **Público**, e a resposta é sempre a mesma (RN2, E1): quem pergunta não
   * descobre se a conta existe — nem pelo corpo, nem pelo status, nem pelo tempo.
   *
   * **O meio de redefinição não chega ao destinatário nesta versão.** O envio depende da
   * capacidade de correio eletrônico, que ainda não existe — lacuna nomeada na proposta.
   * O valor emitido NÃO é devolvido nem registrado em log: fazê-lo entregaria, a quem
   * pedisse, a chave de qualquer conta.
   */
  @Post('recovery')
  @PublicRoute()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Solicita um meio de redefinição de senha',
    description:
      'A resposta é IDÊNTICA para e-mail cadastrado e não cadastrado (RF-ACS-003 RN2). ' +
      'A interface não deve inferir nada dela além de que a solicitação foi recebida.',
  })
  @ApiFailures('VALIDATION_FAILED')
  async requestRecovery(@Body() body: PasswordRecoveryRequestDto): Promise<void> {
    const command = parseOrFail(passwordRecoverySchema, body);

    await this.access.requestPasswordReset({ email: command.email });

    this.logger.info('PASSWORD_RECOVERY_REQUESTED');
  }

  /** RF-ACS-004 por meio de redefinição. Não exige a senha atual (RN1). */
  @Post('reset')
  @PublicRoute()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Define a senha com um meio de redefinição',
    description:
      'Meio desconhecido, expirado ou já utilizado produzem o mesmo INVITATION_EXPIRED. ' +
      'Concluída a operação, TODAS as sessões da conta são encerradas.',
  })
  @ApiFailures('VALIDATION_FAILED', 'INVITATION_EXPIRED')
  async reset(@Body() body: ResetPasswordRequestDto): Promise<void> {
    const command = parseOrFail(resetPasswordSchema, body);

    const { userId } = unwrap(await this.access.resetPassword(command));

    const revoked = await this.sessions.revokeAllOfUser(userId);

    this.logger.info('PASSWORD_RESET', { userId, revokedSessions: revoked });
  }
}
