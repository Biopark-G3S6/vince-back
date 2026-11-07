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

import { ArticleFacade } from '../contracts/article.facade';
import {
  CreatePublicationRequest,
  PublicationResponse,
  UpdatePublicationRequest,
  createPublicationSchema,
  updatePublicationSchema,
} from './article.dto';
import { unwrap } from './result-mapper';

@ApiTags('Publicação externa')
@Controller('articles/:articleId/publications')
export class PublicationController {
  constructor(private readonly articles: ArticleFacade) {}

  @Post()
  @HttpCode(201)
  @RequiresPermission('PUBLICATION:CREATE')
  @ApiOperation({
    summary: 'Registra uma publicação externa do artigo',
    description:
      'Registro manual e descritivo: o sistema não mantém catálogo de veículos nem ' +
      'verifica o endereço informado.',
  })
  @ApiEnvelope(PublicationResponse, { status: 201, description: 'Criada, com `Location`.' })
  @ApiFailures('PERMISSION_DENIED', 'VALIDATION_FAILED', 'RESOURCE_NOT_FOUND')
  async create(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Body() body: CreatePublicationRequest,
    @CurrentSession() session: Session,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicationResponse> {
    const input = parseOrFail(createPublicationSchema, body);
    const publication = unwrap(
      await this.articles.createPublication({
        ...input,
        actorId: session.state.userId,
        articleId,
      }),
    );

    response.setHeader('Location', `/articles/${articleId}/publications/${publication.id}`);

    return publication;
  }

  @Get()
  @RequiresPermission('PUBLICATION:READ')
  @ApiOperation({ summary: 'Lista as publicações externas do artigo' })
  @ApiPageQuery()
  @ApiPagedEnvelope(PublicationResponse)
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async list(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly PublicationResponse[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const page = unwrap(
      await this.articles.listPublications({ actorId: session.state.userId, articleId, request }),
    );

    return respondWithPage(page.items, page.pagination);
  }

  @Patch(':publicationId')
  @RequiresPermission('PUBLICATION:UPDATE')
  @ApiOperation({ summary: 'Altera o registro de publicação externa' })
  @ApiEnvelope(PublicationResponse)
  @ApiFailures('PERMISSION_DENIED', 'VALIDATION_FAILED', 'RESOURCE_NOT_FOUND')
  async update(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('publicationId', ParseUUIDPipe) publicationId: string,
    @Body() body: UpdatePublicationRequest,
    @CurrentSession() session: Session,
  ): Promise<PublicationResponse> {
    const changes = parseOrFail(updatePublicationSchema, body);

    return unwrap(
      await this.articles.updatePublication({
        ...changes,
        actorId: session.state.userId,
        articleId,
        publicationId,
      }),
    );
  }

  @Delete(':publicationId')
  @HttpCode(204)
  @RequiresPermission('PUBLICATION:DELETE')
  @ApiOperation({ summary: 'Remove o registro de publicação externa' })
  @ApiNoContentResponse({ description: 'Removido.' })
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async remove(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('publicationId', ParseUUIDPipe) publicationId: string,
    @CurrentSession() session: Session,
  ): Promise<void> {
    unwrap(
      await this.articles.removePublication({
        actorId: session.state.userId,
        articleId,
        publicationId,
      }),
    );
  }
}
