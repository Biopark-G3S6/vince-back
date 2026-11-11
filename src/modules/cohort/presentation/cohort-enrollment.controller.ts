import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiEnvelope, ApiFailures, ApiPageQuery, ApiPagedEnvelope } from '@shared/http/openapi';
import { respondWithPage, type EnvelopeResult } from '@shared/http/response-envelope';
import { pageRequestSchema, toPageRequest } from '@shared/http/pagination';
import { RequiresPermission } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';

import { CohortFacade } from '../contracts/cohort.facade';
import type { EnrollmentDto } from '../contracts/cohort.dto';
import { EnrollmentResponse, EnrollStudentRequest, enrollStudentSchema } from './cohort.dto';
import { unwrap } from './result-mapper';

@ApiTags('Matrícula')
@Controller('cohorts/:cohortId/enrollments')
export class CohortEnrollmentController {
  constructor(private readonly cohorts: CohortFacade) {}

  @Post()
  @HttpCode(201)
  @RequiresPermission('ENROLLMENT:CREATE')
  @ApiOperation({ summary: 'Cadastra e matricula um aluno' })
  @ApiEnvelope(EnrollmentResponse, { status: 201 })
  @ApiFailures(
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'EMAIL_ALREADY_REGISTERED',
    'STUDENT_ALREADY_ENROLLED',
  )
  async enroll(
    @Param('cohortId', ParseUUIDPipe) cohortId: string,
    @Body() body: EnrollStudentRequest,
    @CurrentSession() session: Session,
  ): Promise<EnrollmentResponse> {
    const input = parseOrFail(enrollStudentSchema, body);

    return unwrap(await this.cohorts.enroll({ ...input, actorId: session.state.userId, cohortId }));
  }

  @Get()
  @RequiresPermission('ENROLLMENT:READ')
  @ApiOperation({ summary: 'Lista as matrículas da turma' })
  @ApiPageQuery()
  @ApiPagedEnvelope(EnrollmentResponse)
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async list(
    @Param('cohortId', ParseUUIDPipe) cohortId: string,
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly EnrollmentDto[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const page = unwrap(
      await this.cohorts.listEnrollments({ actorId: session.state.userId, cohortId, request }),
    );

    return respondWithPage(page.items, page.pagination);
  }
}
