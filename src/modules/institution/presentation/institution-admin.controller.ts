import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiFailures } from '@shared/http/openapi';
import { RequiresPermission } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';

import { InstitutionFacade } from '../contracts/institution.facade';
import { InstitutionAdminRequestDto, institutionAdminSchema } from './institution.dto';
import { unwrap } from './result-mapper';

/**
 * A designação de administrador institucional (RF-INS-002).
 *
 * É o **primeiro elo da cadeia de designação da URS**: o `SYSTEM_ADMIN` designa o
 * administrador institucional, que designará o coordenador, que designará o professor.
 *
 * As duas rotas devolvem `204` (`ADR-0025` §28), e não o vínculo criado: ambas são
 * idempotentes, e o corpo de uma designação repetida seria indistinguível do de uma nova —
 * um recurso devolvido sugeriria criação onde nada mudou.
 *
 * O ator vem **da sessão**, e alimenta a trilha de auditoria da atribuição de papel
 * (`ADR-0014` §18). Nunca do corpo: quem designa é quem está autenticado.
 */
@ApiTags('Instituição')
@Controller('institutions/:institutionId/admins')
export class InstitutionAdminController {
  constructor(private readonly institutions: InstitutionFacade) {}

  @Post()
  @HttpCode(204)
  @RequiresPermission('INSTITUTION:ASSIGN_ADMIN')
  @ApiOperation({
    summary: 'Designa um usuário como administrador da instituição',
    description:
      'Idempotente (RF-INS-002 E1). A instituição admite mais de um administrador ' +
      'ativo (RN1). Instituição inativa recusa; usuário inexistente ou desativado ' +
      'recusa com RESOURCE_NOT_FOUND.',
  })
  @ApiNoContentResponse({ description: 'Designado, ou já designado.' })
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'RESOURCE_NOT_FOUND',
    'INSTITUTION_INACTIVE',
  )
  async assign(
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
    @Body() body: InstitutionAdminRequestDto,
    @CurrentSession() session: Session,
  ): Promise<void> {
    const { userId } = parseOrFail(institutionAdminSchema, body);

    unwrap(
      await this.institutions.assignAdmin({
        institutionId,
        userId,
        actorId: session.state.userId,
      }),
    );
  }

  @Delete(':userId')
  @HttpCode(204)
  @RequiresPermission('INSTITUTION:REVOKE_ADMIN')
  @ApiOperation({
    summary: 'Revoga o vínculo de administrador',
    description:
      'Idempotente. O papel INSTITUTION_ADMIN é removido apenas quando não resta outro ' +
      'vínculo que o justifique (RF-INS-002 RN3).',
  })
  @ApiNoContentResponse({ description: 'Revogado, ou já não havia vínculo.' })
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async revoke(
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentSession() session: Session,
  ): Promise<void> {
    unwrap(
      await this.institutions.revokeAdmin({
        institutionId,
        userId,
        actorId: session.state.userId,
      }),
    );
  }
}
