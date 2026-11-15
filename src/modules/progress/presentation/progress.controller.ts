import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { ApiFailure } from '@shared/errors/api-failure';
import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiEnvelope, ApiFailures, ApiPageQuery, ApiPagedEnvelope } from '@shared/http/openapi';
import { pageRequestSchema, toPageRequest } from '@shared/http/pagination';
import { respondWithPage, type EnvelopeResult } from '@shared/http/response-envelope';
import { RequiresPermission } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';
import type {
  ContributionDto,
  CourseProgressSnapshot,
  ProgressReportDto,
  ProgressTeamDto,
  RiskSignalDto,
} from '../contracts/progress.dto';
import { ProgressFacade } from '../contracts/progress.facade';

const reportSchema = z
  .object({ periodStart: z.string().datetime(), periodEnd: z.string().datetime() })
  .refine((value) => new Date(value.periodStart) < new Date(value.periodEnd), {
    path: ['periodEnd'],
    message: 'INVALID_RANGE',
  });
class TeamResponseDto {
  @ApiProperty({ format: 'uuid' }) articleId!: string;
  @ApiProperty({ format: 'uuid' }) institutionId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) courseId!: string | null;
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ format: 'uuid' }) teamId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) advisorId!: string | null;
  @ApiProperty({ type: [String] }) memberIds!: readonly string[];
  @ApiProperty() status!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) currentMilestoneId!: string | null;
  @ApiProperty({ nullable: true }) currentMilestoneOrder!: number | null;
  @ApiProperty({ format: 'date-time', nullable: true }) currentMilestoneDeadline!: string | null;
  @ApiProperty({ nullable: true }) lastMilestoneOrder!: number | null;
  @ApiProperty({ nullable: true }) latestSubmissionAutomatic!: boolean | null;
  @ApiProperty({ format: 'date-time', nullable: true }) latestSubmissionAt!: string | null;
  @ApiProperty() pendingRemarkCount!: number;
  @ApiProperty({ format: 'date-time' }) lastEditedAt!: string;
  @ApiProperty() consecutiveAutomaticSubmissions!: number;
  @ApiProperty({ type: [String] }) editedMemberIds!: readonly string[];
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty() elapsedSinceEditSeconds!: number;
  @ApiProperty({ type: [String] }) activeRisks!: readonly string[];
}
class EventSummaryDto {
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty() teamCount!: number;
  @ApiProperty() deliveredCurrentMilestoneCount!: number;
  @ApiProperty() activeSignalTeamCount!: number;
  @ApiProperty() finishedArticleCount!: number;
}
class CourseDashboardResponseDto {
  @ApiProperty({ type: [EventSummaryDto] }) events!: readonly EventSummaryDto[];
  @ApiProperty({ type: 'array', items: { type: 'object' }, additionalProperties: false })
  teams!: unknown;
}
class RiskResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) articleId!: string;
  @ApiProperty({ format: 'uuid' }) teamId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) courseId!: string | null;
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty() condition!: string;
  @ApiProperty() active!: boolean;
  @ApiProperty({ format: 'date-time' }) activatedAt!: string;
  @ApiProperty({ format: 'date-time' }) lastObservedAt!: string;
  @ApiProperty({ format: 'date-time', nullable: true }) clearedAt!: string | null;
}
class ContributionResponseDto {
  @ApiProperty({ format: 'uuid' }) articleId!: string;
  @ApiProperty({ type: [Object] }) members!: readonly unknown[];
  @ApiProperty() volumeIsNotContributionMeasure!: true;
  @ApiProperty() note!: string;
  @ApiProperty() sufficientHistory!: boolean;
}
class ReportResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) courseId!: string;
  @ApiProperty({ format: 'date-time' }) periodStart!: string;
  @ApiProperty({ format: 'date-time' }) periodEnd!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: 'object', additionalProperties: true }) data!: Readonly<
    Record<string, unknown>
  >;
}

@ApiTags('Acompanhamento e relatórios')
@Controller()
export class ProgressController {
  constructor(private readonly progress: ProgressFacade) {}

  @Get('progress/advisor')
  @RequiresPermission('PROGRESS:READ')
  @ApiOperation({ summary: 'Acompanha artigos sob orientação do usuário' })
  @ApiPageQuery()
  @ApiPagedEnvelope(TeamResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'INSTITUTION_INACTIVE')
  async advisor(
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly ProgressTeamDto[]>> {
    const input = toPageRequest(parseOrFail(pageRequestSchema, query));
    const result = await this.progress.advisorDashboard({
      actorId: session.state.userId,
      request: input,
      status: typeof query.status === 'string' ? query.status : undefined,
      riskOnly: query.riskOnly === 'true',
    });
    return respondWithPage(result.items, result.pagination);
  }

  @Get('courses/:courseId/progress')
  @RequiresPermission('PROGRESS:READ')
  @ApiOperation({ summary: 'Acompanha eventos e equipes do curso coordenado' })
  @ApiPageQuery()
  @ApiEnvelope(CourseDashboardResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async course(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<CourseProgressSnapshot> {
    return this.progress.courseDashboard({
      actorId: session.state.userId,
      courseId,
      request: toPageRequest(parseOrFail(pageRequestSchema, query)),
      eventId: typeof query.eventId === 'string' ? query.eventId : undefined,
    });
  }

  @Get('progress/risk-signals')
  @RequiresPermission('RISK_SIGNAL:READ')
  @ApiOperation({ summary: 'Lista sinais de risco ativos nos vínculos do usuário' })
  @ApiEnvelope(RiskResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async risks(
    @Query('courseId') courseId: string | undefined,
    @CurrentSession() session: Session,
  ): Promise<readonly RiskSignalDto[]> {
    return this.progress.risks(session.state.userId, courseId);
  }

  @Get('articles/:articleId/contributions')
  @RequiresPermission('CONTRIBUTION:READ')
  @ApiOperation({ summary: 'Consulta contribuições objetivas de integrantes para o orientador' })
  @ApiEnvelope(ContributionResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async contribution(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentSession() session: Session,
  ): Promise<ContributionDto> {
    return this.progress.contribution(session.state.userId, articleId);
  }

  @Post('courses/:courseId/reports')
  @RequiresPermission('REPORT:GENERATE')
  @ApiOperation({ summary: 'Gera relatório de produção registrado para curso e período' })
  @ApiEnvelope(ReportResponseDto, { status: 201 })
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'RESOURCE_NOT_FOUND',
    'VALIDATION_FAILED',
    'REPORT_NOT_READY',
  )
  async generateReport(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() body: unknown,
    @CurrentSession() session: Session,
  ): Promise<ReportResponseDto> {
    const input = parseOrFail(reportSchema, body);
    return toReport(
      await this.progress.generateReport({
        actorId: session.state.userId,
        courseId,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
      }),
    );
  }

  @Get('reports/:reportId')
  @RequiresPermission('REPORT:READ')
  @ApiOperation({ summary: 'Consulta relatório existente' })
  @ApiEnvelope(ReportResponseDto)
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'RESOURCE_NOT_FOUND',
    'REPORT_NOT_READY',
  )
  async report(
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @CurrentSession() session: Session,
  ): Promise<ReportResponseDto> {
    return toReport(await this.progress.findReport(session.state.userId, reportId));
  }

  @Get('reports/:reportId/export')
  @RequiresPermission('REPORT:EXPORT')
  @ApiOperation({ summary: 'Exporta o mesmo conteúdo do relatório em JSON ou CSV' })
  @ApiProduces('application/json', 'text/csv')
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'RESOURCE_NOT_FOUND',
    'REPORT_NOT_READY',
    'VALIDATION_FAILED',
  )
  async export(
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Query('format') format: string | undefined,
    @CurrentSession() session: Session,
    @Res() response: Response,
  ): Promise<void> {
    if (format !== 'JSON' && format !== 'CSV') throw new ApiFailure('VALIDATION_FAILED');
    const file = await this.progress.exportReport(session.state.userId, reportId, format);
    response.setHeader('content-type', file.contentType);
    response.setHeader('content-disposition', `attachment; filename="${file.fileName}"`);
    response.status(200).send(file.body);
  }
}

function toReport(value: ProgressReportDto): ReportResponseDto {
  return {
    ...value,
    periodStart: value.periodStart.toISOString(),
    periodEnd: value.periodEnd.toISOString(),
    createdAt: value.createdAt.toISOString(),
  };
}
