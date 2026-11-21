import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiEnvelope, ApiFailures, ApiPageQuery, ApiPagedEnvelope } from '@shared/http/openapi';
import { pageRequestSchema, toPageRequest } from '@shared/http/pagination';
import { respondWithPage, type EnvelopeResult } from '@shared/http/response-envelope';
import { RequiresPermission } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';

import { TeamFacade } from '../contracts/team.facade';
import {
  InviteMemberRequest,
  MemberResponse,
  TeamInvitationResponse,
  inviteMemberSchema,
} from './team.dto';
import { unwrap } from './result-mapper';

@ApiTags('Convite de equipe')
@Controller('teams/:teamId/invitations')
export class TeamInvitationController {
  constructor(private readonly teams: TeamFacade) {}

  @Post()
  @HttpCode(201)
  @RequiresPermission('TEAM:INVITE_MEMBER')
  @ApiOperation({
    summary: 'Convida um aluno elegível para a equipe',
    description: 'O convite não reserva vaga: as regras são reavaliadas no aceite.',
  })
  @ApiEnvelope(TeamInvitationResponse, { status: 201 })
  @ApiFailures(
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'RESOURCE_NOT_FOUND',
    'STUDENT_NOT_ELIGIBLE',
    'ADVISOR_NOT_ASSIGNED_TO_EVENT',
  )
  async invite(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() body: InviteMemberRequest,
    @CurrentSession() session: Session,
  ): Promise<TeamInvitationResponse> {
    const input = parseOrFail(inviteMemberSchema, body);

    return unwrap(await this.teams.invite({ ...input, actorId: session.state.userId, teamId }));
  }

  @Get()
  @RequiresPermission('TEAM:INVITE_MEMBER')
  @ApiOperation({ summary: 'Lista os convites da equipe' })
  @ApiPageQuery()
  @ApiPagedEnvelope(TeamInvitationResponse)
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND', 'ADVISOR_NOT_ASSIGNED_TO_EVENT')
  async list(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly TeamInvitationResponse[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const page = unwrap(
      await this.teams.listInvitations({ actorId: session.state.userId, teamId, request }),
    );

    return respondWithPage(page.items, page.pagination);
  }
}

/**
 * O aceite e a recusa, fora da rota da equipe.
 *
 * Quem responde é o convidado, e a titularidade é verificada no caso de uso: o convite é
 * endereçado a uma pessoa, e só ela o resolve (`ADR-0014` §12). A rota por identificador
 * de convite é o que permite respondê-lo sem conhecer a equipe de antemão.
 */
@ApiTags('Convite de equipe')
@Controller('team-invitations/:invitationId')
export class TeamInvitationResponseController {
  constructor(private readonly teams: TeamFacade) {}

  @Post('acceptance')
  @HttpCode(201)
  @RequiresPermission('TEAM:JOIN')
  @ApiOperation({ summary: 'Aceita o convite e passa a integrar a equipe' })
  @ApiEnvelope(MemberResponse, { status: 201 })
  @ApiFailures(
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'RESOURCE_NOT_FOUND',
    'INVITATION_EXPIRED',
    'INVITATION_REVOKED',
    'STUDENT_NOT_ELIGIBLE',
    'STUDENT_ALREADY_IN_TEAM',
    'TEAM_SIZE_LIMIT_REACHED',
  )
  async accept(
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentSession() session: Session,
  ): Promise<MemberResponse> {
    return unwrap(
      await this.teams.acceptInvitation({ actorId: session.state.userId, invitationId }),
    );
  }

  @Delete()
  @HttpCode(204)
  @RequiresPermission('TEAM:JOIN')
  @ApiOperation({ summary: 'Recusa o convite, sem efeito sobre a equipe' })
  @ApiNoContentResponse({ description: 'Recusado ou já encerrado.' })
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async decline(
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentSession() session: Session,
  ): Promise<void> {
    unwrap(await this.teams.declineInvitation({ actorId: session.state.userId, invitationId }));
  }
}

/** Os convites recebidos pelo próprio aluno (`team-read-extensions`, RF-EQP-004). */
@ApiTags('Convite de equipe')
@Controller('team-invitations')
export class ReceivedTeamInvitationController {
  constructor(private readonly teams: TeamFacade) {}

  @Get()
  @RequiresPermission('TEAM:JOIN')
  @ApiOperation({ summary: 'Lista os convites de equipe pendentes endereçados ao ator' })
  @ApiPageQuery()
  @ApiPagedEnvelope(TeamInvitationResponse)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED')
  async list(
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly TeamInvitationResponse[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const page = unwrap(
      await this.teams.listReceivedInvitations({ actorId: session.state.userId, request }),
    );

    return respondWithPage(page.items, page.pagination);
  }
}
