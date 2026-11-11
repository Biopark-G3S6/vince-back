import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiEnvelope, ApiFailures } from '@shared/http/openapi';
import { RequiresPermission } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';
import { ArticleFacade } from '../contracts/article.facade';
import type { ArticleAssessmentDto, ExternalPublicationDto } from '../contracts/article.dto';
import { unwrap } from './result-mapper';

const scoreSchema = z.object({ score: z.number().finite().min(0).max(10) });
const memberScoreSchema = scoreSchema.extend({ memberId: z.string().uuid() });
const publicationSchema = z.object({
  venueName: z.string().trim().min(1).max(300),
  kind: z.enum(['CONFERENCE', 'JOURNAL', 'OTHER']),
  publicationDate: z.string().datetime(),
  url: z
    .string()
    .url()
    .refine((value) => value.startsWith('http://') || value.startsWith('https://')),
});
const updatePublicationSchema = publicationSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);
class AssessmentResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) articleId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) memberId!: string | null;
  @ApiProperty({ minimum: 0, maximum: 10 }) score!: number;
  @ApiProperty({ format: 'uuid' }) evaluatedBy!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
class PublicationResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) articleId!: string;
  @ApiProperty() venueName!: string;
  @ApiProperty({ enum: ['CONFERENCE', 'JOURNAL', 'OTHER'] }) kind!: string;
  @ApiProperty({ format: 'date-time' }) publicationDate!: string;
  @ApiProperty({ format: 'uri' }) url!: string;
  @ApiProperty({ format: 'uuid' }) createdBy!: string;
  @ApiProperty({ format: 'uuid' }) updatedBy!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
class OperationResponseDto {
  @ApiProperty() ok!: boolean;
}

@ApiTags('Avaliações e publicações')
@Controller('articles/:articleId')
export class AssessmentPublicationController {
  constructor(private readonly articles: ArticleFacade) {}

  @Get('assessments')
  @RequiresPermission('ARTICLE:GRADE')
  @ApiOperation({ summary: 'Consulta o histórico da nota do artigo e das notas individuais' })
  @ApiEnvelope(AssessmentResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async listGrades(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentSession() session: Session,
  ): Promise<readonly AssessmentResponseDto[]> {
    return unwrap(await this.articles.listGrades({ actorId: session.state.userId, articleId })).map(
      toAssessmentResponse,
    );
  }

  @Post('assessments')
  @RequiresPermission('ARTICLE:GRADE')
  @ApiOperation({ summary: 'Registra uma nova nota para o artigo' })
  @ApiEnvelope(AssessmentResponseDto, { status: 201 })
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'RESOURCE_NOT_FOUND',
    'VALIDATION_FAILED',
  )
  async gradeArticle(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Body() body: unknown,
    @CurrentSession() session: Session,
  ): Promise<AssessmentResponseDto> {
    const input = parseOrFail(scoreSchema, body);
    return toAssessmentResponse(
      unwrap(
        await this.articles.recordGrade({
          actorId: session.state.userId,
          articleId,
          score: input.score,
        }),
      ),
    );
  }

  @Post('member-assessments')
  @RequiresPermission('ARTICLE:GRADE_MEMBER')
  @ApiOperation({ summary: 'Registra nota individual de integrante' })
  @ApiEnvelope(AssessmentResponseDto, { status: 201 })
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'RESOURCE_NOT_FOUND',
    'VALIDATION_FAILED',
  )
  async gradeMember(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Body() body: unknown,
    @CurrentSession() session: Session,
  ): Promise<AssessmentResponseDto> {
    const input = parseOrFail(memberScoreSchema, body);
    return toAssessmentResponse(
      unwrap(
        await this.articles.recordGrade({
          actorId: session.state.userId,
          articleId,
          score: input.score,
          memberId: input.memberId,
        }),
      ),
    );
  }

  @Get('publications')
  @RequiresPermission('PUBLICATION:READ')
  @ApiOperation({ summary: 'Lista registros de publicação externa' })
  @ApiEnvelope(PublicationResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async listPublications(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentSession() session: Session,
  ): Promise<readonly PublicationResponseDto[]> {
    return unwrap(
      await this.articles.listPublications({ actorId: session.state.userId, articleId }),
    ).map(toPublicationResponse);
  }

  @Post('publications')
  @RequiresPermission('PUBLICATION:CREATE')
  @ApiOperation({ summary: 'Registra publicação em evento ou periódico externo' })
  @ApiEnvelope(PublicationResponseDto, { status: 201 })
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'RESOURCE_NOT_FOUND',
    'VALIDATION_FAILED',
  )
  async createPublication(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Body() body: unknown,
    @CurrentSession() session: Session,
  ): Promise<PublicationResponseDto> {
    const input = parseOrFail(publicationSchema, body);
    return toPublicationResponse(
      unwrap(
        await this.articles.createPublication({
          ...input,
          actorId: session.state.userId,
          articleId,
          publicationDate: new Date(input.publicationDate),
        }),
      ),
    );
  }

  @Patch('publications/:publicationId')
  @RequiresPermission('PUBLICATION:UPDATE')
  @ApiOperation({ summary: 'Atualiza registro de publicação externa' })
  @ApiEnvelope(PublicationResponseDto)
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'RESOURCE_NOT_FOUND',
    'VALIDATION_FAILED',
  )
  async updatePublication(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('publicationId', ParseUUIDPipe) publicationId: string,
    @Body() body: unknown,
    @CurrentSession() session: Session,
  ): Promise<PublicationResponseDto> {
    const input = parseOrFail(updatePublicationSchema, body);
    return toPublicationResponse(
      unwrap(
        await this.articles.updatePublication({
          ...input,
          actorId: session.state.userId,
          articleId,
          publicationId,
          publicationDate: input.publicationDate ? new Date(input.publicationDate) : undefined,
        }),
      ),
    );
  }

  @Delete('publications/:publicationId')
  @RequiresPermission('PUBLICATION:DELETE')
  @ApiOperation({ summary: 'Remove registro de publicação externa' })
  @ApiEnvelope(OperationResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async deletePublication(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('publicationId', ParseUUIDPipe) publicationId: string,
    @CurrentSession() session: Session,
  ): Promise<OperationResponseDto> {
    unwrap(
      await this.articles.deletePublication({
        actorId: session.state.userId,
        articleId,
        publicationId,
      }),
    );
    return { ok: true };
  }
}

function toAssessmentResponse(value: ArticleAssessmentDto): AssessmentResponseDto {
  return { ...value, createdAt: value.createdAt.toISOString() };
}
function toPublicationResponse(value: ExternalPublicationDto): PublicationResponseDto {
  return {
    ...value,
    publicationDate: value.publicationDate.toISOString(),
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}
