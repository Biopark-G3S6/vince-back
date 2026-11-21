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
import { ApiFailures, ApiPageQuery, ApiPagedEnvelope } from '@shared/http/openapi';
import { pageRequestSchema, toPageRequest } from '@shared/http/pagination';
import { respondWithPage, type EnvelopeResult } from '@shared/http/response-envelope';
import { RequiresPermission } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';

import { CohortFacade } from '../contracts/cohort.facade';
import { CohortProfessorResponse } from './cohort.dto';
import { unwrap } from './result-mapper';

@ApiTags('Turma')
@Controller('cohorts/:cohortId/professors')
export class CohortProfessorController {
  constructor(private readonly cohorts: CohortFacade) {}

  @Get()
  @RequiresPermission('COHORT:READ')
  @ApiOperation({ summary: 'Lista os professores designados à turma' })
  @ApiPageQuery()
  @ApiPagedEnvelope(CohortProfessorResponse)
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async list(
    @Param('cohortId', ParseUUIDPipe) cohortId: string,
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly CohortProfessorResponse[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const page = unwrap(
      await this.cohorts.listProfessors({ actorId: session.state.userId, cohortId, request }),
    );

    return respondWithPage(
      page.items.map((item) => ({ cohortId: item.cohortId, userId: item.userId })),
      page.pagination,
    );
  }

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
