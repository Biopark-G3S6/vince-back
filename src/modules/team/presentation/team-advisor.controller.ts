import { Controller, Delete, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiFailures } from '@shared/http/openapi';
import { RequiresPermission } from '@shared/http/route-access';

import { TeamFacade } from '../contracts/team.facade';
import { unwrap } from './result-mapper';

@ApiTags('Orientação da equipe')
@Controller('teams/:teamId/advisor')
export class TeamAdvisorController {
  constructor(private readonly teams: TeamFacade) {}

  @Post(':userId')
  @HttpCode(204)
  @RequiresPermission('TEAM:ASSIGN_ADVISOR')
  @ApiOperation({
    summary: 'Nomeia o orientador responsável pela equipe',
    description: 'Substitui o responsável anterior; o nomeado precisa orientar o evento.',
  })
  @ApiNoContentResponse({ description: 'Nomeado ou já responsável.' })
  @ApiFailures(
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'RESOURCE_NOT_FOUND',
    'ADVISOR_NOT_ASSIGNED_TO_EVENT',
  )
  async assign(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentSession() session: Session,
  ): Promise<void> {
    unwrap(await this.teams.assignAdvisor({ actorId: session.state.userId, teamId, userId }));
  }

  @Delete(':userId')
  @HttpCode(204)
  @RequiresPermission('TEAM:REVOKE_ADVISOR')
  @ApiOperation({ summary: 'Revoga a responsabilidade do orientador sobre a equipe' })
  @ApiNoContentResponse({ description: 'Revogada ou já ausente.' })
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async revoke(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentSession() session: Session,
  ): Promise<void> {
    unwrap(await this.teams.revokeAdvisor({ actorId: session.state.userId, teamId, userId }));
  }
}
