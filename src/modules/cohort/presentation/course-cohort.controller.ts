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
import { respondWithPage, type EnvelopeResult } from '@shared/http/response-envelope';
import { RequiresPermission } from '@shared/http/route-access';
import { pageRequestSchema, toPageRequest } from '@shared/http/pagination';
import { parseOrFail } from '@shared/http/validation';

import { CohortFacade } from '../contracts/cohort.facade';
import { CohortResponse, CreateCohortRequest, createCohortSchema } from './cohort.dto';
import { unwrap } from './result-mapper';

@ApiTags('Turma')
@Controller('courses/:courseId/cohorts')
export class CourseCohortController {
  constructor(private readonly cohorts: CohortFacade) {}

  @Post()
  @HttpCode(201)
  @RequiresPermission('COHORT:CREATE')
  @ApiOperation({ summary: 'Cadastra uma turma no curso' })
  @ApiEnvelope(CohortResponse, { status: 201, description: 'Criada, com `Location`.' })
  @ApiFailures(
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'RESOURCE_NOT_FOUND',
    'COHORT_ALREADY_EXISTS',
  )
  async create(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() body: CreateCohortRequest,
    @CurrentSession() session: Session,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CohortResponse> {
    const input = parseOrFail(createCohortSchema, body);
    const cohort = unwrap(
      await this.cohorts.create({ ...input, courseId, actorId: session.state.userId }),
    );

    response.setHeader('Location', `/cohorts/${cohort.id}`);

    return cohort;
  }

  @Get()
  @RequiresPermission('COHORT:READ')
  @ApiOperation({ summary: 'Lista as turmas do curso' })
  @ApiPageQuery()
  @ApiPagedEnvelope(CohortResponse)
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async list(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly CohortResponse[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const page = unwrap(
      await this.cohorts.list({ actorId: session.state.userId, courseId, request }),
    );

    return respondWithPage(page.items, page.pagination);
  }
}
