import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiEnvelope, ApiFailures, ApiPageQuery, ApiPagedEnvelope } from '@shared/http/openapi';
import { pageRequestSchema, toPageRequest } from '@shared/http/pagination';
import { respondWithPage, type EnvelopeResult } from '@shared/http/response-envelope';
import { RequiresPermission } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';

import { CohortFacade } from '../contracts/cohort.facade';
import { CohortResponse, UpdateCohortRequest, updateCohortSchema } from './cohort.dto';
import { unwrap } from './result-mapper';

@ApiTags('Turma')
@Controller('cohorts')
export class CohortController {
  constructor(private readonly cohorts: CohortFacade) {}

  @Get()
  @RequiresPermission('COHORT:READ')
  @ApiOperation({
    summary: 'Lista as turmas que o ator lê, paginado',
    description:
      'As turmas dos cursos que o ator coordena, aquelas em que é professor designado e a da ' +
      'sua matrícula ativa, numa única consulta (cohort-listing).',
  })
  @ApiPageQuery()
  @ApiPagedEnvelope(CohortResponse)
  @ApiFailures('PERMISSION_DENIED', 'VALIDATION_FAILED')
  async listReadable(
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly CohortResponse[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const page = await this.cohorts.listReadable({ actorId: session.state.userId, request });

    return respondWithPage(page.items, page.pagination);
  }

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
  // Nada é criado: sem isto, o `201` do Nest divergiria do `200` declarado pelo
  // envelope em OpenAPI (`ADR-0025` §29).
  @HttpCode(200)
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
