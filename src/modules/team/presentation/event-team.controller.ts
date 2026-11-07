import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiEnvelope, ApiFailures, ApiPageQuery, ApiPagedEnvelope } from '@shared/http/openapi';
import { pageRequestSchema, toPageRequest } from '@shared/http/pagination';
import { respondWithPage, type EnvelopeResult } from '@shared/http/response-envelope';
import { RequiresPermission } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';

import { TeamFacade } from '../contracts/team.facade';
import {
  CreateTeamRequest,
  EligibleStudentResponse,
  TeamResponse,
  createTeamSchema,
} from './team.dto';
import { unwrap } from './result-mapper';

@ApiTags('Equipe')
@Controller('events/:eventId/teams')
export class EventTeamController {
  constructor(private readonly teams: TeamFacade) {}

  @Post()
  @HttpCode(201)
  @RequiresPermission('TEAM:CREATE')
  @ApiOperation({ summary: 'Cria uma equipe no evento' })
  @ApiEnvelope(TeamResponse, { status: 201, description: 'Criada, com `Location`.' })
  @ApiFailures(
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'RESOURCE_NOT_FOUND',
    'EVENT_TEAM_LIMIT_REACHED',
    'ADVISOR_NOT_ASSIGNED_TO_EVENT',
  )
  async create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() body: CreateTeamRequest,
    @CurrentSession() session: Session,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TeamResponse> {
    const input = parseOrFail(createTeamSchema, body);
    const team = unwrap(
      await this.teams.create({ ...input, actorId: session.state.userId, eventId }),
    );

    response.setHeader('Location', `/teams/${team.id}`);

    return team;
  }

  @Get()
  @RequiresPermission('TEAM:READ')
  @ApiOperation({ summary: 'Lista as equipes do evento' })
  @ApiPageQuery()
  @ApiPagedEnvelope(TeamResponse)
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async list(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly TeamResponse[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const page = unwrap(await this.teams.list({ actorId: session.state.userId, eventId, request }));

    return respondWithPage(page.items, page.pagination);
  }
}

@ApiTags('Equipe')
@Controller('events/:eventId/eligible-students')
export class EventEligibleStudentController {
  constructor(private readonly teams: TeamFacade) {}

  @Get()
  @RequiresPermission('TEAM:READ')
  @ApiOperation({
    summary: 'Lista os alunos elegíveis do evento que ainda não integram equipe',
    description:
      'O desconto de quem já integra equipe acontece depois da paginação do escopo: ' +
      'uma página pode voltar mais curta que `pageSize`, nunca com aluno errado.',
  })
  @ApiPageQuery()
  @ApiPagedEnvelope(EligibleStudentResponse)
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND', 'ADVISOR_NOT_ASSIGNED_TO_EVENT')
  async list(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly EligibleStudentResponse[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const page = unwrap(
      await this.teams.listEligibleStudents({ actorId: session.state.userId, eventId, request }),
    );

    return respondWithPage(
      page.items.map((userId) => ({ userId })),
      page.pagination,
    );
  }
}
