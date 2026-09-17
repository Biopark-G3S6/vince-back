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

import type { CourseDto } from '../contracts/course.dto';
import { CourseFacade } from '../contracts/course.facade';
import {
  CourseDtoResponse,
  CreateCourseRequestDto,
  UpdateCourseRequestDto,
  createCourseSchema,
  updateCourseSchema,
} from './course.dto';
import { unwrap } from './result-mapper';

@ApiTags('Curso')
@Controller('courses')
export class CourseController {
  constructor(private readonly courses: CourseFacade) {}

  @Post()
  @HttpCode(201)
  @RequiresPermission('COURSE:CREATE')
  @ApiOperation({ summary: 'Cadastra um curso na instituição do ator' })
  @ApiEnvelope(CourseDtoResponse, { status: 201, description: 'Criado, com `Location`.' })
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'INSTITUTION_INACTIVE',
  )
  async create(
    @Body() body: CreateCourseRequestDto,
    @CurrentSession() session: Session,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CourseDtoResponse> {
    const input = parseOrFail(createCourseSchema, body);
    const course = unwrap(await this.courses.create({ ...input, actorId: session.state.userId }));

    response.setHeader('Location', `/courses/${course.id}`);

    return toResponse(course);
  }

  @Get()
  @RequiresPermission('COURSE:READ')
  @ApiOperation({ summary: 'Lista os cursos da instituição do ator, paginado' })
  @ApiPageQuery()
  @ApiPagedEnvelope(CourseDtoResponse)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'INSTITUTION_INACTIVE')
  async list(
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly CourseDtoResponse[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const page = unwrap(await this.courses.list({ actorId: session.state.userId, request }));

    return respondWithPage(page.items.map(toResponse), page.pagination);
  }

  @Get(':courseId')
  @RequiresPermission('COURSE:READ')
  @ApiOperation({ summary: 'Consulta um curso no escopo da instituição do ator' })
  @ApiEnvelope(CourseDtoResponse)
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'RESOURCE_NOT_FOUND',
    'INSTITUTION_INACTIVE',
  )
  async find(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentSession() session: Session,
  ): Promise<CourseDtoResponse> {
    return toResponse(
      unwrap(await this.courses.findById({ actorId: session.state.userId, courseId })),
    );
  }

  @Patch(':courseId')
  @RequiresPermission('COURSE:UPDATE')
  @ApiOperation({ summary: 'Altera nome ou identificação do curso' })
  @ApiEnvelope(CourseDtoResponse)
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'RESOURCE_NOT_FOUND',
    'INSTITUTION_INACTIVE',
  )
  async update(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() body: UpdateCourseRequestDto,
    @CurrentSession() session: Session,
  ): Promise<CourseDtoResponse> {
    const changes = parseOrFail(updateCourseSchema, body);

    return toResponse(
      unwrap(await this.courses.update({ ...changes, actorId: session.state.userId, courseId })),
    );
  }

  @Post(':courseId/deactivation')
  @RequiresPermission('COURSE:DEACTIVATE')
  @ApiOperation({ summary: 'Desativa o curso de forma idempotente' })
  @ApiEnvelope(CourseDtoResponse)
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'RESOURCE_NOT_FOUND',
    'INSTITUTION_INACTIVE',
  )
  async deactivate(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentSession() session: Session,
  ): Promise<CourseDtoResponse> {
    return toResponse(
      unwrap(await this.courses.deactivate({ actorId: session.state.userId, courseId })),
    );
  }
}

function toResponse(course: CourseDto): CourseDtoResponse {
  return {
    id: course.id,
    institutionId: course.institutionId,
    name: course.name,
    identification: course.identification,
    active: course.active,
    coordinatorId: course.coordinatorId,
  };
}
