import { Controller, Delete, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiFailures } from '@shared/http/openapi';
import { RequiresPermission } from '@shared/http/route-access';

import { CohortFacade } from '../contracts/cohort.facade';
import { unwrap } from './result-mapper';

@ApiTags('Turma')
@Controller('cohorts/:cohortId/professors')
export class CohortProfessorController {
  constructor(private readonly cohorts: CohortFacade) {}

  @Post(':userId')
  @HttpCode(204)
  @RequiresPermission('COHORT:ASSIGN_PROFESSOR')
  @ApiOperation({ summary: 'Designa um professor à turma' })
  @ApiNoContentResponse({ description: 'Designado ou já designado.' })
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND', 'VALIDATION_FAILED')
  async assign(
    @Param('cohortId', ParseUUIDPipe) cohortId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentSession() session: Session,
  ): Promise<void> {
    unwrap(
      await this.cohorts.assignProfessor({
        actorId: session.state.userId,
        cohortId,
        userId,
      }),
    );
  }

  @Delete(':userId')
  @HttpCode(204)
  @RequiresPermission('COHORT:REVOKE_PROFESSOR')
  @ApiOperation({ summary: 'Revoga um professor da turma' })
  @ApiNoContentResponse({ description: 'Revogado ou já ausente.' })
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async revoke(
    @Param('cohortId', ParseUUIDPipe) cohortId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentSession() session: Session,
  ): Promise<void> {
    unwrap(
      await this.cohorts.revokeProfessor({
        actorId: session.state.userId,
        cohortId,
        userId,
      }),
    );
  }
}
