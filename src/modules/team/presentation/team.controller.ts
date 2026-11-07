import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiEnvelope, ApiFailures } from '@shared/http/openapi';
import { RequiresPermission } from '@shared/http/route-access';

import { TeamFacade } from '../contracts/team.facade';
import { TeamResponse } from './team.dto';
import { unwrap } from './result-mapper';

@ApiTags('Equipe')
@Controller('teams')
export class TeamController {
  constructor(private readonly teams: TeamFacade) {}

  @Get(':teamId')
  @RequiresPermission('TEAM:READ')
  @ApiOperation({ summary: 'Consulta uma equipe' })
  @ApiEnvelope(TeamResponse)
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async find(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentSession() session: Session,
  ): Promise<TeamResponse> {
    return unwrap(await this.teams.findById({ actorId: session.state.userId, teamId }));
  }
}
