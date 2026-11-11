import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiEnvelope, ApiFailures } from '@shared/http/openapi';
import { RequiresPermission } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';

import { CohortFacade } from '../contracts/cohort.facade';
import { CohortResponse, UpdateCohortRequest, updateCohortSchema } from './cohort.dto';
import { unwrap } from './result-mapper';

@ApiTags('Turma')
@Controller('cohorts')
export class CohortController {
  constructor(private readonly cohorts: CohortFacade) {}

  @Get(':cohortId')
  @RequiresPermission('COHORT:READ')
  @ApiOperation({ summary: 'Consulta uma turma' })
  @ApiEnvelope(CohortResponse)
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async find(
    @Param('cohortId', ParseUUIDPipe) cohortId: string,
    @CurrentSession() session: Session,
  ): Promise<CohortResponse> {
    return unwrap(await this.cohorts.findById({ actorId: session.state.userId, cohortId }));
  }

  @Patch(':cohortId')
  @RequiresPermission('COHORT:UPDATE')
  @ApiOperation({ summary: 'Altera os dados da turma' })
  @ApiEnvelope(CohortResponse)
  @ApiFailures(
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'RESOURCE_NOT_FOUND',
    'COHORT_ALREADY_EXISTS',
  )
  async update(
    @Param('cohortId', ParseUUIDPipe) cohortId: string,
    @Body() body: UpdateCohortRequest,
    @CurrentSession() session: Session,
  ): Promise<CohortResponse> {
    const changes = parseOrFail(updateCohortSchema, body);

    return unwrap(
      await this.cohorts.update({ ...changes, actorId: session.state.userId, cohortId }),
    );
  }

  @Post(':cohortId/deactivation')
  @RequiresPermission('COHORT:DEACTIVATE')
  @ApiOperation({ summary: 'Desativa a turma de forma idempotente' })
  @ApiEnvelope(CohortResponse)
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async deactivate(
    @Param('cohortId', ParseUUIDPipe) cohortId: string,
    @CurrentSession() session: Session,
  ): Promise<CohortResponse> {
    return unwrap(await this.cohorts.deactivate({ actorId: session.state.userId, cohortId }));
  }
}
