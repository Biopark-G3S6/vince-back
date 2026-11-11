import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { ApiFailure } from '@shared/errors/api-failure';
import { interval, from, Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { z } from 'zod';
import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiEnvelope, ApiFailures, ApiPageQuery, ApiPagedEnvelope } from '@shared/http/openapi';
import { pageRequestSchema, toPageRequest } from '@shared/http/pagination';
import { respondWithPage, type EnvelopeResult } from '@shared/http/response-envelope';
import { RequiresPermission } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';
import type { DiscussionMessageDto } from '../contracts/discussion.dto';
import { DiscussionFacade } from '../contracts/discussion.facade';

const messageSchema = z.object({
  body: z.string().trim().min(1).max(10000),
  replyToId: z.string().uuid().optional(),
  remarkId: z.string().uuid().optional(),
});
class MessageResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) articleId!: string;
  @ApiProperty({ format: 'uuid' }) teamId!: string;
  @ApiProperty({ format: 'uuid' }) authorId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) rootId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) remarkId!: string | null;
  @ApiProperty({ nullable: true }) body!: string | null;
  @ApiProperty() deleted!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
class OperationResponseDto {
  @ApiProperty() ok!: boolean;
}

@ApiTags('Discussão')
@Controller('articles/:articleId/discussion/messages')
export class DiscussionController {
  constructor(private readonly discussion: DiscussionFacade) {}

  @Get()
  @RequiresPermission('MESSAGE:READ')
  @ApiOperation({ summary: 'Lista mensagens da discussão contínua do artigo' })
  @ApiPageQuery()
  @ApiPagedEnvelope(MessageResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async list(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly MessageResponseDto[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const page = await this.discussion.list({ actorId: session.state.userId, articleId, request });
    return respondWithPage(page.items.map(toResponse), page.pagination);
  }

  @Post()
  @RequiresPermission('MESSAGE:CREATE')
  @ApiOperation({ summary: 'Publica mensagem, resposta ou resposta referenciada a apontamento' })
  @ApiEnvelope(MessageResponseDto, { status: 201 })
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'RESOURCE_NOT_FOUND',
    'VALIDATION_FAILED',
  )
  async publish(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Body() body: unknown,
    @CurrentSession() session: Session,
  ): Promise<MessageResponseDto> {
    const input = parseOrFail(messageSchema, body);
    return toResponse(
      await this.discussion.publish({ ...input, articleId, actorId: session.state.userId }),
    );
  }

  @Delete(':messageId')
  @RequiresPermission('MESSAGE:DELETE')
  @ApiOperation({ summary: 'Exclui logicamente a própria mensagem' })
  @ApiEnvelope(OperationResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async remove(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @CurrentSession() session: Session,
  ): Promise<OperationResponseDto> {
    if (!(await this.discussion.remove(session.state.userId, articleId, messageId)))
      throw new ApiFailure('RESOURCE_NOT_FOUND');
    return { ok: true };
  }

  @Sse('stream')
  @RequiresPermission('MESSAGE:READ')
  @ApiOperation({ summary: 'Acompanha mensagens com reconexão pelo último id recebido' })
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  stream(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Headers('last-event-id') lastEventId: string | undefined,
    @Query('after') after: string | undefined,
    @CurrentSession() session: Session,
  ): Observable<MessageEvent> {
    let cursor = lastEventId ?? after;
    return interval(1000).pipe(
      concatMap(() => from(this.discussion.after(session.state.userId, articleId, cursor))),
      concatMap((messages) =>
        from(
          messages.map((row) => {
            cursor = row.id;
            return { id: row.id, type: 'message', data: toResponse(row) };
          }),
        ),
      ),
    );
  }
}

@ApiTags('Discussão')
@Controller('articles/:articleId/remarks/:remarkId/discussion-messages')
export class RemarkDiscussionController {
  constructor(private readonly discussion: DiscussionFacade) {}

  @Get()
  @RequiresPermission('MESSAGE:READ')
  @ApiOperation({ summary: 'Navega do apontamento devolvido para as mensagens associadas' })
  @ApiEnvelope(MessageResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async list(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('remarkId', ParseUUIDPipe) remarkId: string,
    @CurrentSession() session: Session,
  ): Promise<readonly MessageResponseDto[]> {
    return (await this.discussion.forRemark(session.state.userId, articleId, remarkId)).map(
      toResponse,
    );
  }
}

function toResponse(row: DiscussionMessageDto): MessageResponseDto {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
