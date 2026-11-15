import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiEnvelope, ApiFailures } from '@shared/http/openapi';
import { RequiresPermission } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';
import { AssistanceFacade } from '../contracts/assistance.facade';
import type {
  AiConsentDto,
  AuthorshipSignalDto,
  ComplianceReportDto,
  SimilarityReportDto,
} from '../contracts/assistance.dto';

const consentSchema = z.object({ consented: z.boolean() });
class ConsentResponseDto {
  @ApiProperty({ format: 'uuid' }) institutionId!: string;
  @ApiProperty() consented!: boolean;
  @ApiProperty({ format: 'uuid', nullable: true }) consentedBy!: string | null;
  @ApiProperty({ format: 'date-time', nullable: true }) consentedAt!: string | null;
  @ApiProperty({ format: 'date-time', nullable: true }) revokedAt!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true }) revokedBy!: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true }) configuration!: unknown;
}
class ComplianceIssueResponseDto {
  @ApiProperty() code!: string;
  @ApiProperty({ enum: ['FORMATTING', 'STRUCTURE', 'REFERENCES'] }) category!: string;
  @ApiProperty({ enum: ['ERROR', 'RECOMMENDATION', 'UNVERIFIED'] }) severity!: string;
  @ApiProperty({ nullable: true }) path!: string | null;
  @ApiPropertyOptional({ format: 'uuid' }) referenceId?: string;
  @ApiPropertyOptional() evidence?: string;
}
class ComplianceResponseDto {
  @ApiProperty({ format: 'uuid' }) analysisId!: string;
  @ApiProperty({ format: 'uuid' }) articleId!: string;
  @ApiProperty() norm!: string;
  @ApiProperty() checkedAt!: string;
  @ApiProperty({ nullable: true }) conformant!: boolean | null;
  @ApiProperty({ type: [ComplianceIssueResponseDto] })
  issues!: readonly ComplianceIssueResponseDto[];
}
class SimilarityResponseDto {
  @ApiProperty({ format: 'uuid' }) analysisId!: string;
  @ApiProperty({ format: 'uuid' }) articleId!: string;
  @ApiProperty() checkedAt!: string;
  @ApiProperty() corpusSize!: number;
  @ApiProperty() insufficientCorpus!: boolean;
  @ApiProperty({ type: [Object] }) matches!: readonly unknown[];
}
class AnalysisHistoryItemResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: 'object', additionalProperties: true }) result!: Readonly<
    Record<string, unknown>
  >;
}
class AnalysisHistoryResponseDto {
  @ApiProperty({ type: [AnalysisHistoryItemResponseDto] })
  items!: readonly AnalysisHistoryItemResponseDto[];
}
class AuthorshipResponseDto {
  @ApiProperty({ format: 'uuid' }) articleId!: string;
  @ApiProperty() sufficientHistory!: boolean;
  @ApiProperty({ type: [Object] }) timeline!: readonly unknown[];
  @ApiProperty({ type: [Object] }) largeInsertions!: readonly unknown[];
  @ApiProperty({ type: [Object] }) sessions!: readonly unknown[];
  @ApiProperty({ type: [Object] }) authorship!: readonly unknown[];
  @ApiProperty({ type: [Object] }) importMetadata!: readonly unknown[];
  @ApiProperty() statement!: string;
}
class SummaryResponseDto {
  @ApiProperty({ format: 'uuid' }) articleId!: string;
  @ApiProperty({ format: 'uuid' }) analysisId!: string;
  @ApiProperty({ type: 'object', additionalProperties: true }) result!: Readonly<
    Record<string, unknown>
  >;
}

@ApiTags('Assistência automatizada')
@Controller()
export class AssistanceController {
  constructor(private readonly assistance: AssistanceFacade) {}

  @Get('institutions/:institutionId/ai-consent')
  @RequiresPermission('INSTITUTION:CONSENT_AI')
  @ApiOperation({
    summary: 'Consulta declaração e consentimento institucional de processamento por IA',
  })
  @ApiEnvelope(ConsentResponseDto)
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'RESOURCE_NOT_FOUND',
    'INSTITUTION_INACTIVE',
  )
  async consent(
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
    @CurrentSession() session: Session,
  ): Promise<ConsentResponseDto> {
    return toConsent(await this.assistance.consent(session.state.userId, institutionId));
  }

  @Put('institutions/:institutionId/ai-consent')
  @RequiresPermission('INSTITUTION:CONSENT_AI')
  @ApiOperation({ summary: 'Registra ou revoga consentimento institucional de IA' })
  @ApiEnvelope(ConsentResponseDto)
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'RESOURCE_NOT_FOUND',
    'INSTITUTION_INACTIVE',
    'VALIDATION_FAILED',
    'AI_SERVICE_UNAVAILABLE',
  )
  async setConsent(
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
    @Body() body: unknown,
    @CurrentSession() session: Session,
  ): Promise<ConsentResponseDto> {
    const input = parseOrFail(consentSchema, body);
    return toConsent(
      await this.assistance.setConsent(session.state.userId, institutionId, input.consented),
    );
  }

  @Post('articles/:articleId/assistance/summary')
  @RequiresPermission('AI_SUMMARY:READ')
  @ApiOperation({
    summary: 'Gera resumo externo das alterações para o orientador durante a correção',
  })
  @ApiEnvelope(SummaryResponseDto)
  @ApiFailures(
    'AUTHENTICATION_FAILED',
    'PERMISSION_DENIED',
    'RESOURCE_NOT_FOUND',
    'ARTICLE_NOT_IN_REVIEW',
    'AI_CONSENT_REQUIRED',
    'AI_SERVICE_UNAVAILABLE',
    'REPORT_NOT_READY',
  )
  async summary(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentSession() session: Session,
  ): Promise<Readonly<Record<string, unknown>>> {
    return this.assistance.summary(session.state.userId, articleId);
  }

  @Post('articles/:articleId/compliance-checks')
  @RequiresPermission('COMPLIANCE_CHECK:REQUEST')
  @ApiOperation({ summary: 'Verifica localmente formatação, estrutura e referências ABNT' })
  @ApiEnvelope(ComplianceResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async compliance(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentSession() session: Session,
  ): Promise<ComplianceReportDto> {
    return this.assistance.checkCompliance(session.state.userId, articleId);
  }

  @Get('articles/:articleId/compliance-checks')
  @RequiresPermission('COMPLIANCE_CHECK:READ')
  @ApiOperation({
    summary: 'Consulta verificações de conformidade solicitadas pelo próprio usuário',
  })
  @ApiEnvelope(AnalysisHistoryResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async complianceHistory(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentSession() session: Session,
  ): Promise<AnalysisHistoryResponseDto> {
    return {
      items: (await this.assistance.complianceHistory(session.state.userId, articleId)).map(
        (row) => ({ ...row, createdAt: row.createdAt.toISOString() }),
      ),
    };
  }

  @Post('articles/:articleId/similarity-checks')
  @RequiresPermission('SIMILARITY_CHECK:REQUEST')
  @ApiOperation({ summary: 'Compara o texto com o acervo interno da plataforma' })
  @ApiEnvelope(SimilarityResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async similarity(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentSession() session: Session,
  ): Promise<SimilarityReportDto> {
    return this.assistance.checkSimilarity(session.state.userId, articleId);
  }

  @Get('articles/:articleId/similarity-checks')
  @RequiresPermission('SIMILARITY_CHECK:READ')
  @ApiOperation({
    summary: 'Consulta verificações de similaridade solicitadas pelo próprio usuário',
  })
  @ApiEnvelope(AnalysisHistoryResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async similarityHistory(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentSession() session: Session,
  ): Promise<AnalysisHistoryResponseDto> {
    return {
      items: (await this.assistance.similarityHistory(session.state.userId, articleId)).map(
        (row) => ({ ...row, createdAt: row.createdAt.toISOString() }),
      ),
    };
  }

  @Get('articles/:articleId/authorship-signals')
  @RequiresPermission('AUTHORSHIP_SIGNAL:READ')
  @ApiOperation({
    summary: 'Consulta fatos objetivos do histórico, sem inferência de autoria por IA',
  })
  @ApiEnvelope(AuthorshipResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async authorship(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentSession() session: Session,
  ): Promise<AuthorshipSignalDto> {
    return this.assistance.authorship(session.state.userId, articleId);
  }
}

function toConsent(value: AiConsentDto): ConsentResponseDto {
  return {
    institutionId: value.institutionId,
    consented: value.consented,
    consentedBy: value.consentedBy,
    consentedAt: value.consentedAt?.toISOString() ?? null,
    revokedAt: value.revokedAt?.toISOString() ?? null,
    revokedBy: value.revokedBy,
    configuration: value.configuration,
  };
}
