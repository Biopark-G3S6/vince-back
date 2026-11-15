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
import { pageRequestSchema, toPageRequest } from '@shared/http/pagination';
import { respondWithPage, type EnvelopeResult } from '@shared/http/response-envelope';
import { RequiresPermission } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';

import { EventFacade } from '../contracts/event.facade';
import {
  CreateEventRequest,
  EventResponse,
  UpdateEventRequest,
  createEventSchema,
  updateEventSchema,
} from './event.dto';
import { unwrap } from './result-mapper';

@ApiTags('Evento')
@Controller('events')
export class EventController {
  constructor(private readonly events: EventFacade) {}

  @Post()
  @HttpCode(201)
  @RequiresPermission('EVENT:CREATE')
  @ApiOperation({ summary: 'Cria um evento no escopo informado' })
  @ApiEnvelope(EventResponse, { status: 201, description: 'Criado, com `Location`.' })
  @ApiFailures(
    'PERMISSION_DENIED',
    'VALIDATION_FAILED',
    'RESOURCE_NOT_FOUND',
    'EVENT_SCOPE_NOT_ALLOWED',
  )
  async create(
    @Body() body: CreateEventRequest,
    @CurrentSession() session: Session,
    @Res({ passthrough: true }) response: Response,
  ): Promise<EventResponse> {
    const input = parseOrFail(createEventSchema, body);
    const event = unwrap(await this.events.create({ ...input, actorId: session.state.userId }));

    response.setHeader('Location', `/events/${event.id}`);

    return event;
  }

  @Get()
  @RequiresPermission('EVENT:READ')
  @ApiOperation({ summary: 'Lista os eventos alcançados pelos vínculos do ator' })
  @ApiPageQuery()
  @ApiPagedEnvelope(EventResponse)
  @ApiFailures('PERMISSION_DENIED')
  async list(
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly EventResponse[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const page = unwrap(await this.events.list({ actorId: session.state.userId, request }));

    return respondWithPage(page.items, page.pagination);
  }

  @Get(':eventId')
  @RequiresPermission('EVENT:READ')
  @ApiOperation({ summary: 'Consulta um evento' })
  @ApiEnvelope(EventResponse)
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async find(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentSession() session: Session,
  ): Promise<EventResponse> {
    return unwrap(await this.events.findById({ actorId: session.state.userId, eventId }));
  }

  @Patch(':eventId')
  @RequiresPermission('EVENT:UPDATE')
  @ApiOperation({ summary: 'Altera os dados e os limites do evento' })
  @ApiEnvelope(EventResponse)
  @ApiFailures('PERMISSION_DENIED', 'VALIDATION_FAILED', 'RESOURCE_NOT_FOUND')
  async update(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() body: UpdateEventRequest,
    @CurrentSession() session: Session,
  ): Promise<EventResponse> {
    const changes = parseOrFail(updateEventSchema, body);

    return unwrap(await this.events.update({ ...changes, actorId: session.state.userId, eventId }));
  }

  @Post(':eventId/cancellation')
  // Nada é criado: o `201` que o Nest dá a todo `POST` divergiria do `200` que o
  // envelope declara em OpenAPI e que `ADR-0025` §29 atribui ao código `SUCCESS`.
  @HttpCode(200)
  @RequiresPermission('EVENT:CANCEL')
  @ApiOperation({ summary: 'Cancela o evento de forma idempotente' })
  @ApiEnvelope(EventResponse)
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async cancel(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentSession() session: Session,
  ): Promise<EventResponse> {
    return unwrap(await this.events.cancel({ actorId: session.state.userId, eventId }));
  }
}
