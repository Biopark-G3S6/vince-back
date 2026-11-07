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

import { EventFacade } from '../contracts/event.facade';
import { AdvisorResponse } from './event.dto';
import { unwrap } from './result-mapper';

@ApiTags('Orientação do evento')
@Controller('events/:eventId/advisors')
export class EventAdvisorController {
  constructor(private readonly events: EventFacade) {}

  @Post(':userId')
  @HttpCode(204)
  @RequiresPermission('EVENT:ASSIGN_ADVISOR')
  @ApiOperation({ summary: 'Designa um professor elegível como orientador do evento' })
  @ApiNoContentResponse({ description: 'Designado ou já designado.' })
  @ApiFailures(
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'RESOURCE_NOT_FOUND',
    'STUDENT_NOT_ELIGIBLE',
  )
  async assign(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentSession() session: Session,
  ): Promise<void> {
    unwrap(await this.events.assignAdvisor({ actorId: session.state.userId, eventId, userId }));
  }

  @Delete(':userId')
  @HttpCode(204)
  @RequiresPermission('EVENT:REVOKE_ADVISOR')
  @ApiOperation({ summary: 'Revoga a orientação do professor no evento' })
  @ApiNoContentResponse({ description: 'Revogada ou já ausente.' })
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async revoke(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentSession() session: Session,
  ): Promise<void> {
    unwrap(await this.events.revokeAdvisor({ actorId: session.state.userId, eventId, userId }));
  }

  @Get()
  @RequiresPermission('EVENT:READ')
  @ApiOperation({ summary: 'Lista os orientadores designados ao evento' })
  @ApiPageQuery()
  @ApiPagedEnvelope(AdvisorResponse)
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async list(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly AdvisorResponse[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const page = unwrap(
      await this.events.listAdvisors({ actorId: session.state.userId, eventId, request }),
    );

    return respondWithPage(page.items, page.pagination);
  }
}
