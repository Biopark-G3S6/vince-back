import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiFailures } from '@shared/http/openapi';
import { RequiresPermission } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';

import { CourseFacade } from '../contracts/course.facade';
import { CourseCoordinatorRequestDto, courseCoordinatorSchema } from './course.dto';
import { unwrap } from './result-mapper';

@ApiTags('Curso')
@Controller('courses/:courseId/coordinator')
export class CourseCoordinatorController {
  constructor(private readonly courses: CourseFacade) {}

  @Post()
  @HttpCode(204)
  @RequiresPermission('COURSE:ASSIGN_COORDINATOR')
  @ApiOperation({ summary: 'Designa o coordenador corrente do curso' })
  @ApiNoContentResponse({ description: 'Designado, ou a designação já existia.' })
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'RESOURCE_NOT_FOUND',
    'VALIDATION_FAILED',
    'COORDINATOR_ALREADY_ASSIGNED',
    'INSTITUTION_INACTIVE',
  )
  async assign(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() body: CourseCoordinatorRequestDto,
    @CurrentSession() session: Session,
  ): Promise<void> {
    const { userId } = parseOrFail(courseCoordinatorSchema, body);

    unwrap(
      await this.courses.assignCoordinator({ actorId: session.state.userId, courseId, userId }),
    );
  }

  @Delete(':userId')
  @HttpCode(204)
  @RequiresPermission('COURSE:REVOKE_COORDINATOR')
  @ApiOperation({ summary: 'Revoga o coordenador do curso' })
  @ApiNoContentResponse({ description: 'Revogado, ou não havia vínculo corrente.' })
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'RESOURCE_NOT_FOUND',
    'INSTITUTION_INACTIVE',
  )
  async revoke(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentSession() session: Session,
  ): Promise<void> {
    unwrap(
      await this.courses.revokeCoordinator({ actorId: session.state.userId, courseId, userId }),
    );
  }
}
