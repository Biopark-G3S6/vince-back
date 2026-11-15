import {
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
import { MemberResponse } from './team.dto';
import { unwrap } from './result-mapper';

/**
 * O ingresso por conta própria, em rota separada da designação.
 *
 * São atos distintos com permissões distintas — `TEAM:JOIN` é do aluno, e
 * `TEAM:ASSIGN_MEMBER` é do orientador —, e a rota do ingresso não aceita identificador
 * de usuário justamente para que ninguém ingresse em nome de outro.
 */
@ApiTags('Integrante da equipe')
@Controller('teams/:teamId/membership')
export class TeamMembershipController {
  constructor(private readonly teams: TeamFacade) {}

  @Post()
  @HttpCode(201)
  @RequiresPermission('TEAM:JOIN')
  @ApiOperation({ summary: 'Ingressa na equipe por conta própria' })
  @ApiEnvelope(MemberResponse, { status: 201 })
  @ApiFailures(
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'RESOURCE_NOT_FOUND',
    'STUDENT_NOT_ELIGIBLE',
    'STUDENT_ALREADY_IN_TEAM',
    'TEAM_SIZE_LIMIT_REACHED',
  )
  async join(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentSession() session: Session,
  ): Promise<MemberResponse> {
    return unwrap(await this.teams.join({ actorId: session.state.userId, teamId }));
  }
}

@ApiTags('Integrante da equipe')
@Controller('teams/:teamId/members')
export class TeamMemberController {
  constructor(private readonly teams: TeamFacade) {}

  @Post(':userId')
  @HttpCode(201)
  @RequiresPermission('TEAM:ASSIGN_MEMBER')
  @ApiOperation({ summary: 'Designa um aluno elegível à equipe' })
  @ApiEnvelope(MemberResponse, { status: 201 })
  @ApiFailures(
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'RESOURCE_NOT_FOUND',
    'STUDENT_NOT_ELIGIBLE',
    'STUDENT_ALREADY_IN_TEAM',
    'TEAM_SIZE_LIMIT_REACHED',
    'ADVISOR_NOT_ASSIGNED_TO_EVENT',
  )
  async assign(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentSession() session: Session,
  ): Promise<MemberResponse> {
    return unwrap(await this.teams.assignMember({ actorId: session.state.userId, teamId, userId }));
  }

  @Delete(':userId')
  @HttpCode(204)
  @RequiresPermission('TEAM:REMOVE_MEMBER')
  @ApiOperation({
    summary: 'Remove um integrante da equipe',
    description: 'Encerra a participação; a contribuição já registrada é preservada.',
  })
  @ApiNoContentResponse({ description: 'Removido ou já ausente.' })
  @ApiFailures(
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'RESOURCE_NOT_FOUND',
    'ADVISOR_NOT_ASSIGNED_TO_EVENT',
  )
  async remove(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentSession() session: Session,
  ): Promise<void> {
    unwrap(await this.teams.removeMember({ actorId: session.state.userId, teamId, userId }));
  }

  @Get()
  @RequiresPermission('TEAM:READ')
  @ApiOperation({ summary: 'Lista os integrantes da equipe, inclusive os que saíram' })
  @ApiPageQuery()
  @ApiPagedEnvelope(MemberResponse)
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async list(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly MemberResponse[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const page = unwrap(
      await this.teams.listMembers({ actorId: session.state.userId, teamId, request }),
    );

    return respondWithPage(page.items, page.pagination);
  }
}
