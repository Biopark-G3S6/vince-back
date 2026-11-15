import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiEnvelope, ApiFailures, ApiPageQuery, ApiPagedEnvelope } from '@shared/http/openapi';
import { pageRequestSchema, toPageRequest } from '@shared/http/pagination';
import { respondWithPage, type EnvelopeResult } from '@shared/http/response-envelope';
import { AuthenticatedRoute, RequiresPermission } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';
import { ApiFailure } from '@shared/errors/api-failure';
import { NotificationFacade } from '../contracts/notification.facade';
import type { NotificationDto, NotificationPreferenceDto } from '../contracts/notification.dto';

const preferenceSchema = z.object({ type: z.string().trim().min(1).max(80), enabled: z.boolean() });
class NotificationResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty() type!: string;
  @ApiProperty() targetType!: string;
  @ApiProperty({ format: 'uuid' }) targetId!: string;
  @ApiProperty({ type: 'object', additionalProperties: true }) data!: Readonly<
    Record<string, unknown>
  >;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) readAt!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
class PreferenceResponseDto {
  @ApiProperty() type!: string;
  @ApiProperty() enabled!: boolean;
}
class PreferenceListResponseDto {
  @ApiProperty({ type: [PreferenceResponseDto] }) items!: readonly PreferenceResponseDto[];
}
class ReadAllResponseDto {
  @ApiProperty() count!: number;
}
class OperationResponseDto {
  @ApiProperty() ok!: boolean;
}

@ApiTags('Notificações')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationFacade) {}

  @Get()
  @RequiresPermission('NOTIFICATION:READ')
  @ApiOperation({ summary: 'Lista notificações do usuário autenticado' })
  @ApiPageQuery()
  @ApiPagedEnvelope(NotificationResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED')
  async list(
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly NotificationResponseDto[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const unreadOnly = query.unreadOnly === 'true';
    const page = await this.notifications.list({
      userId: session.state.userId,
      request,
      unreadOnly,
    });
    return respondWithPage(page.items.map(toResponse), page.pagination);
  }

  @Get(':notificationId')
  @RequiresPermission('NOTIFICATION:READ')
  @ApiOperation({ summary: 'Abre notificação e marca como lida' })
  @ApiEnvelope(NotificationResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async open(
    @Param('notificationId', ParseUUIDPipe) id: string,
    @CurrentSession() session: Session,
  ): Promise<NotificationResponseDto> {
    const item = await this.notifications.open(session.state.userId, id);
    if (!item) throw new ApiFailure('RESOURCE_NOT_FOUND');
    return toResponse(item);
  }

  @Patch(':notificationId/read')
  @RequiresPermission('NOTIFICATION:MARK_READ')
  @ApiOperation({ summary: 'Marca uma notificação como lida' })
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  @ApiEnvelope(OperationResponseDto)
  async markRead(
    @Param('notificationId', ParseUUIDPipe) id: string,
    @CurrentSession() session: Session,
  ): Promise<{ ok: boolean }> {
    if (!(await this.notifications.markRead(session.state.userId, id)))
      throw new ApiFailure('RESOURCE_NOT_FOUND');
    return { ok: true };
  }

  @Post('read-all')
  @RequiresPermission('NOTIFICATION:MARK_READ')
  @ApiOperation({ summary: 'Marca todas as notificações como lidas' })
  @ApiEnvelope(ReadAllResponseDto)
  async markAllRead(@CurrentSession() session: Session): Promise<ReadAllResponseDto> {
    return { count: await this.notifications.markAllRead(session.state.userId) };
  }

  @Get('preferences/email')
  @AuthenticatedRoute()
  @ApiOperation({ summary: 'Consulta preferências de e-mail do titular' })
  @ApiEnvelope(PreferenceListResponseDto)
  async listPreferences(@CurrentSession() session: Session): Promise<PreferenceListResponseDto> {
    return { items: await this.notifications.listPreferences(session.state.userId) };
  }

  @Put('preferences/email')
  @AuthenticatedRoute()
  @ApiOperation({ summary: 'Ativa ou desativa e-mail para um tipo de notificação' })
  @ApiEnvelope(PreferenceResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'VALIDATION_FAILED')
  async setPreference(
    @Body() body: unknown,
    @CurrentSession() session: Session,
  ): Promise<NotificationPreferenceDto> {
    const input = parseOrFail(preferenceSchema, body);
    return this.notifications.setPreference({ ...input, userId: session.state.userId });
  }
}

function toResponse(row: NotificationDto): NotificationResponseDto {
  return {
    ...row,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
