import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiEnvelope, ApiFailures, ApiPageQuery, ApiPagedEnvelope } from '@shared/http/openapi';
import { pageRequestSchema, toPageRequest } from '@shared/http/pagination';
import { respondWithPage, type EnvelopeResult } from '@shared/http/response-envelope';
import { RequiresPermission } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';

import { EventFacade } from '../contracts/event.facade';
import {
  CreateMilestoneRequest,
  MilestoneResponse,
  UpdateMilestoneRequest,
  createMilestoneSchema,
  updateMilestoneSchema,
} from './event.dto';
import { unwrap } from './result-mapper';

@ApiTags('Cronograma do evento')
@Controller('events/:eventId/milestones')
export class EventMilestoneController {
  constructor(private readonly events: EventFacade) {}

  @Post()
  @HttpCode(201)
  @RequiresPermission('MILESTONE:CREATE')
  @ApiOperation({ summary: 'Acrescenta uma etapa ao cronograma' })
  @ApiEnvelope(MilestoneResponse, { status: 201, description: 'Criada, com `Location`.' })
  @ApiFailures(
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'RESOURCE_NOT_FOUND',
    'MILESTONE_DATE_CONFLICT',
  )
  async create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() body: CreateMilestoneRequest,
    @CurrentSession() session: Session,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MilestoneResponse> {
    const input = parseOrFail(createMilestoneSchema, body);
    const milestone = unwrap(
      await this.events.createMilestone({ ...input, actorId: session.state.userId, eventId }),
    );

    response.setHeader('Location', `/events/${eventId}/milestones/${milestone.id}`);

    return milestone;
  }

  @Get()
  @RequiresPermission('MILESTONE:READ')
  @ApiOperation({ summary: 'Lista o cronograma do evento' })
  @ApiPageQuery()
  @ApiPagedEnvelope(MilestoneResponse)
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async list(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly MilestoneResponse[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const page = unwrap(
      await this.events.listMilestones({ actorId: session.state.userId, eventId, request }),
    );

    return respondWithPage(page.items, page.pagination);
  }

  @Patch(':milestoneId')
  @RequiresPermission('MILESTONE:UPDATE')
  @ApiOperation({ summary: 'Altera uma etapa do cronograma' })
  @ApiEnvelope(MilestoneResponse)
  @ApiFailures(
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'RESOURCE_NOT_FOUND',
    'MILESTONE_DATE_CONFLICT',
  )
  async update(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() body: UpdateMilestoneRequest,
    @CurrentSession() session: Session,
  ): Promise<MilestoneResponse> {
    const changes = parseOrFail(updateMilestoneSchema, body);

    return unwrap(
      await this.events.updateMilestone({
        ...changes,
        actorId: session.state.userId,
        eventId,
        milestoneId,
      }),
    );
  }

  @Delete(':milestoneId')
  @HttpCode(204)
  @RequiresPermission('MILESTONE:DELETE')
  @ApiOperation({ summary: 'Remove uma etapa que ainda não iniciou' })
  @ApiNoContentResponse({ description: 'Removida.' })
  @ApiFailures('PERMISSION_DENIED', 'VALIDATION_FAILED', 'RESOURCE_NOT_FOUND')
  async remove(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @CurrentSession() session: Session,
  ): Promise<void> {
    unwrap(
      await this.events.removeMilestone({
        actorId: session.state.userId,
        eventId,
        milestoneId,
      }),
    );
  }
}
