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
  Put,
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

import type {
  ArticleCitationDto,
  ArticleDto,
  ArticleReferenceDto,
  ArticleRemarkDto,
  ArticleSubmissionDto,
  ArticleVersionDto,
  ExportedArticleDto,
  FormatReportDto,
  JsonValue,
  SubmissionComparisonDto,
  TemplateDto,
  TemplateSelectionDto,
} from '../contracts/article.dto';
import { ArticleFacade } from '../contracts/article.facade';
import {
  ArticleResponseDto,
  CitationRequestDto,
  CitationResponseDto,
  ComparisonResponseDto,
  ContentRequestDto,
  CreateTemplateRequestDto,
  DecisionReasonRequestDto,
  DecideRemarkRequestDto,
  ExportedArticleResponseDto,
  FormatReportResponseDto,
  FormatRequestDto,
  ImportRequestDto,
  PresenceResponseDto,
  PresenceRequestDto,
  ReferenceRequestDto,
  ReferenceResponseDto,
  RemarkRequestDto,
  RemarkResponseDto,
  SelectTemplateRequestDto,
  SubmissionResponseDto,
  TemplateResponseDto,
  TemplateSelectionResponseDto,
  UpdateRemarkRequestDto,
  UpdateTemplateRequestDto,
  VersionResponseDto,
  citationSchema,
  contentSchema,
  decisionReasonSchema,
  createTemplateSchema,
  decideRemarkSchema,
  formatSchema,
  importSchema,
  presenceSchema,
  referenceSchema,
  remarkSchema,
  selectTemplateSchema,
  updateRemarkSchema,
  updateTemplateSchema,
} from './article.dto';
import { unwrap } from './result-mapper';

@ApiTags('Artigo')
@Controller()
export class ArticleController {
  constructor(private readonly articles: ArticleFacade) {}

  @Post('article-templates')
  @HttpCode(201)
  @RequiresPermission('TEMPLATE:CREATE')
  @ApiOperation({ summary: 'Cria template de artigo com a primeira versão' })
  @ApiEnvelope(TemplateResponseDto, { status: 201 })
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'VALIDATION_FAILED')
  async createTemplate(
    @Body() body: CreateTemplateRequestDto,
    @CurrentSession() session: Session,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TemplateResponseDto> {
    const input = parseOrFail(createTemplateSchema, body);
    const template = unwrap(
      await this.articles.createTemplate({
        ...input,
        actorId: session.state.userId,
        content: input.content as JsonValue,
      }),
    );

    response.setHeader('Location', `/article-templates/${template.id}`);

    return toTemplateResponse(template);
  }

  @Get('article-templates')
  @RequiresPermission('TEMPLATE:READ')
  @ApiOperation({ summary: 'Lista templates disponíveis na instituição do ator' })
  @ApiPageQuery()
  @ApiPagedEnvelope(TemplateResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'INSTITUTION_INACTIVE')
  async listTemplates(
    @Query() query: Record<string, unknown>,
    @CurrentSession() session: Session,
  ): Promise<EnvelopeResult<readonly TemplateResponseDto[]>> {
    const request = toPageRequest(parseOrFail(pageRequestSchema, query));
    const courseId = typeof query.courseId === 'string' ? query.courseId : undefined;
    const includeInactive = query.includeInactive === 'true';
    const page = unwrap(
      await this.articles.listTemplates({
        actorId: session.state.userId,
        request,
        courseId,
        includeInactive,
      }),
    );

    return respondWithPage(page.items.map(toTemplateResponse), page.pagination);
  }

  @Get('article-templates/:templateId')
  @RequiresPermission('TEMPLATE:READ')
  @ApiOperation({ summary: 'Consulta template de artigo' })
  @ApiEnvelope(TemplateResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async findTemplate(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @CurrentSession() session: Session,
  ): Promise<TemplateResponseDto> {
    return toTemplateResponse(
      unwrap(await this.articles.findTemplate({ actorId: session.state.userId, templateId })),
    );
  }

  @Patch('article-templates/:templateId')
  @RequiresPermission('TEMPLATE:UPDATE')
  @ApiOperation({ summary: 'Altera metadados e, se houver conteúdo, cria nova versão do template' })
  @ApiEnvelope(TemplateResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'VALIDATION_FAILED')
  async updateTemplate(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() body: UpdateTemplateRequestDto,
    @CurrentSession() session: Session,
  ): Promise<TemplateResponseDto> {
    const input = parseOrFail(updateTemplateSchema, body);

    return toTemplateResponse(
      unwrap(
        await this.articles.updateTemplate({
          ...input,
          actorId: session.state.userId,
          templateId,
          content: input.content as JsonValue | undefined,
        }),
      ),
    );
  }

  @Post('article-templates/:templateId/deactivation')
  @RequiresPermission('TEMPLATE:DEACTIVATE')
  @ApiOperation({ summary: 'Desativa template sem afetar eventos que já congelaram uma versão' })
  @ApiEnvelope(TemplateResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async deactivateTemplate(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @CurrentSession() session: Session,
  ): Promise<TemplateResponseDto> {
    return toTemplateResponse(
      unwrap(await this.articles.deactivateTemplate({ actorId: session.state.userId, templateId })),
    );
  }

  @Post('article-template-selections')
  @HttpCode(201)
  @RequiresPermission('TEMPLATE:READ')
  @ApiOperation({ summary: 'Congela a versão do template selecionada para um evento' })
  @ApiEnvelope(TemplateSelectionResponseDto, { status: 201 })
  @ApiFailures('AUTHENTICATION_FAILED', 'RESOURCE_NOT_FOUND', 'TEMPLATE_ALREADY_FIXED')
  async selectTemplate(
    @Body() body: SelectTemplateRequestDto,
    @CurrentSession() session: Session,
  ): Promise<TemplateSelectionResponseDto> {
    const input = parseOrFail(selectTemplateSchema, body);

    return toSelectionResponse(
      unwrap(await this.articles.selectTemplate({ ...input, actorId: session.state.userId })),
    );
  }

  @Get('articles/:articleId')
  @RequiresPermission('ARTICLE:READ')
  @ApiOperation({ summary: 'Consulta o artigo estruturado e seu estado' })
  @ApiEnvelope(ArticleResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'RESOURCE_NOT_FOUND')
  async findArticle(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentSession() session: Session,
  ): Promise<ArticleResponseDto> {
    return toArticleResponse(
      unwrap(await this.articles.findArticle({ actorId: session.state.userId, articleId })),
    );
  }

  @Put('articles/:articleId/content')
  @RequiresPermission('ARTICLE:EDIT')
  @ApiOperation({ summary: 'Preserva alteração do conteúdo estruturado do artigo' })
  @ApiEnvelope(ArticleResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'RESOURCE_NOT_FOUND', 'ARTICLE_LOCKED_FOR_REVIEW')
  async saveContent(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Body() body: ContentRequestDto,
    @CurrentSession() session: Session,
  ): Promise<ArticleResponseDto> {
    const input = parseOrFail(contentSchema, body);

    return toArticleResponse(
      unwrap(
        await this.articles.saveContent({
          actorId: session.state.userId,
          articleId,
          content: input.content as JsonValue,
          baseVersionId: input.baseVersionId,
        }),
      ),
    );
  }

  @Post('articles/:articleId/presence')
  @RequiresPermission('ARTICLE:EDIT')
  @ApiOperation({ summary: 'Atualiza presença/cursor de coedição do integrante' })
  @ApiEnvelope(PresenceResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'RESOURCE_NOT_FOUND', 'ARTICLE_LOCKED_FOR_REVIEW')
  async markPresence(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Body() body: PresenceRequestDto,
    @CurrentSession() session: Session,
  ): Promise<readonly PresenceResponseDto[]> {
    const input = parseOrFail(presenceSchema, body);

    return unwrap(
      await this.articles.markPresence({
        actorId: session.state.userId,
        articleId,
        cursor: input.cursor as JsonValue,
      }),
    ).map(toPresenceResponse);
  }

  @Post('articles/:articleId/references')
  @HttpCode(201)
  @RequiresPermission('REFERENCE:CREATE')
  @ApiOperation({ summary: 'Cadastra referência bibliográfica estruturada' })
  @ApiEnvelope(ReferenceResponseDto, { status: 201 })
  @ApiFailures('AUTHENTICATION_FAILED', 'VALIDATION_FAILED', 'ARTICLE_LOCKED_FOR_REVIEW')
  async createReference(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Body() body: ReferenceRequestDto,
    @CurrentSession() session: Session,
  ): Promise<ReferenceResponseDto> {
    const input = parseOrFail(referenceSchema, body);

    return toReferenceResponse(
      unwrap(
        await this.articles.createReference({
          ...input,
          actorId: session.state.userId,
          articleId,
          authors: input.authors as JsonValue,
        }),
      ),
    );
  }

  @Get('articles/:articleId/references')
  @RequiresPermission('REFERENCE:READ')
  @ApiOperation({ summary: 'Lista referências bibliográficas do artigo' })
  @ApiEnvelope(ReferenceResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'RESOURCE_NOT_FOUND')
  async listReferences(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentSession() session: Session,
  ): Promise<readonly ReferenceResponseDto[]> {
    return unwrap(
      await this.articles.listReferences({ actorId: session.state.userId, articleId }),
    ).map(toReferenceResponse);
  }

  @Patch('articles/:articleId/references/:referenceId')
  @RequiresPermission('REFERENCE:UPDATE')
  @ApiOperation({ summary: 'Altera referência bibliográfica estruturada' })
  @ApiEnvelope(ReferenceResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'RESOURCE_NOT_FOUND', 'ARTICLE_LOCKED_FOR_REVIEW')
  async updateReference(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('referenceId', ParseUUIDPipe) referenceId: string,
    @Body() body: ReferenceRequestDto,
    @CurrentSession() session: Session,
  ): Promise<ReferenceResponseDto> {
    const input = parseOrFail(referenceSchema.partial(), body);

    return toReferenceResponse(
      unwrap(
        await this.articles.updateReference({
          ...input,
          actorId: session.state.userId,
          articleId,
          referenceId,
          authors: input.authors as JsonValue | undefined,
        }),
      ),
    );
  }

  @Delete('articles/:articleId/references/:referenceId')
  @HttpCode(204)
  @RequiresPermission('REFERENCE:DELETE')
  @ApiOperation({ summary: 'Remove referência não citada' })
  @ApiFailures('AUTHENTICATION_FAILED', 'RESOURCE_NOT_FOUND', 'REFERENCE_IN_USE')
  async deleteReference(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('referenceId', ParseUUIDPipe) referenceId: string,
    @CurrentSession() session: Session,
  ): Promise<void> {
    unwrap(
      await this.articles.deleteReference({
        actorId: session.state.userId,
        articleId,
        referenceId,
      }),
    );
  }

  @Post('articles/:articleId/references/:referenceId/citations')
  @HttpCode(201)
  @RequiresPermission('REFERENCE:CITE')
  @ApiOperation({ summary: 'Insere citação vinculada à referência' })
  @ApiEnvelope(CitationResponseDto, { status: 201 })
  @ApiFailures('AUTHENTICATION_FAILED', 'RESOURCE_NOT_FOUND', 'ARTICLE_LOCKED_FOR_REVIEW')
  async citeReference(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('referenceId', ParseUUIDPipe) referenceId: string,
    @Body() body: CitationRequestDto,
    @CurrentSession() session: Session,
  ): Promise<CitationResponseDto> {
    const input = parseOrFail(citationSchema, body);

    return toCitationResponse(
      unwrap(
        await this.articles.citeReference({
          ...input,
          actorId: session.state.userId,
          articleId,
          referenceId,
          locator: input.locator as JsonValue | null | undefined,
        }),
      ),
    );
  }

  @Post('articles/:articleId/formatting')
  @RequiresPermission('ARTICLE:FORMAT')
  @ApiOperation({ summary: 'Aplica a norma ABNT ao artigo ou seleção informada' })
  @ApiEnvelope(FormatReportResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'ARTICLE_LOCKED_FOR_REVIEW')
  async format(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Body() body: FormatRequestDto,
    @CurrentSession() session: Session,
  ): Promise<FormatReportResponseDto> {
    const input = parseOrFail(formatSchema, body);

    return toFormatResponse(
      unwrap(
        await this.articles.applyFormat({
          actorId: session.state.userId,
          articleId,
          target: input.target as JsonValue | null | undefined,
        }),
      ),
    );
  }

  @Post('articles/:articleId/imports')
  @RequiresPermission('ARTICLE:IMPORT')
  @ApiOperation({
    summary: 'Importa conteúdo DOCX já convertido pelo cliente/serviço de conversão',
  })
  @ApiEnvelope(ArticleResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'FILE_FORMAT_NOT_SUPPORTED', 'FILE_TOO_LARGE')
  async importArticle(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Body() body: ImportRequestDto,
    @CurrentSession() session: Session,
  ): Promise<ArticleResponseDto> {
    const input = parseOrFail(importSchema, body);

    return toArticleResponse(
      unwrap(
        await this.articles.importArticle({
          ...input,
          actorId: session.state.userId,
          articleId,
          content: input.content as JsonValue,
          metadata: input.metadata as JsonValue | undefined,
        }),
      ),
    );
  }

  @Get('articles/:articleId/export')
  @RequiresPermission('ARTICLE:EXPORT')
  @ApiOperation({ summary: 'Exporta artigo em DOCX ou PDF lógico' })
  @ApiEnvelope(ExportedArticleResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'RESOURCE_NOT_FOUND')
  async exportArticle(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Query('format') format: 'DOCX' | 'PDF' | undefined,
    @CurrentSession() session: Session,
  ): Promise<ExportedArticleResponseDto> {
    return toExportResponse(
      unwrap(
        await this.articles.exportArticle({
          actorId: session.state.userId,
          articleId,
          format: format ?? 'DOCX',
        }),
      ),
    );
  }

  @Get('articles/:articleId/history')
  @RequiresPermission('ARTICLE:READ_HISTORY')
  @ApiOperation({ summary: 'Consulta histórico de versões do artigo' })
  @ApiEnvelope(VersionResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'RESOURCE_NOT_FOUND')
  async listHistory(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentSession() session: Session,
  ): Promise<readonly VersionResponseDto[]> {
    return unwrap(
      await this.articles.listHistory({ actorId: session.state.userId, articleId }),
    ).map(toVersionResponse);
  }

  @Post('articles/:articleId/history/:versionId/restoration')
  @RequiresPermission('ARTICLE:RESTORE_VERSION')
  @ApiOperation({ summary: 'Restaura versão anterior criando novo estado do artigo' })
  @ApiEnvelope(ArticleResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'ARTICLE_LOCKED_FOR_REVIEW')
  async restoreVersion(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentSession() session: Session,
  ): Promise<ArticleResponseDto> {
    return toArticleResponse(
      unwrap(
        await this.articles.restoreVersion({ actorId: session.state.userId, articleId, versionId }),
      ),
    );
  }

  @Post('articles/:articleId/submissions')
  @RequiresPermission('SUBMISSION:CREATE')
  @ApiOperation({ summary: 'Entrega a versão da etapa corrente' })
  @ApiEnvelope(SubmissionResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'SUBMISSION_ALREADY_MADE', 'MILESTONE_NOT_OPEN')
  async submit(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentSession() session: Session,
  ): Promise<SubmissionResponseDto> {
    return toSubmissionResponse(
      unwrap(await this.articles.submit({ actorId: session.state.userId, articleId })),
    );
  }

  @Get('articles/:articleId/submissions')
  @RequiresPermission('SUBMISSION:READ')
  @ApiOperation({ summary: 'Lista entregas imutáveis do artigo' })
  @ApiEnvelope(SubmissionResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'RESOURCE_NOT_FOUND')
  async listSubmissions(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentSession() session: Session,
  ): Promise<readonly SubmissionResponseDto[]> {
    return unwrap(
      await this.articles.listSubmissions({ actorId: session.state.userId, articleId }),
    ).map(toSubmissionResponse);
  }

  @Delete('articles/:articleId/submissions/:submissionId')
  @RequiresPermission('SUBMISSION:REVOKE')
  @ApiOperation({ summary: 'Desfaz entrega antes do prazo e antes de correção' })
  @ApiEnvelope(ArticleResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'REVIEW_ALREADY_STARTED', 'MILESTONE_DEADLINE_PASSED')
  async revokeSubmission(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @CurrentSession() session: Session,
  ): Promise<ArticleResponseDto> {
    return toArticleResponse(
      unwrap(
        await this.articles.revokeSubmission({
          actorId: session.state.userId,
          articleId,
          submissionId,
        }),
      ),
    );
  }

  @Get('articles/:articleId/submissions/:submissionId/comparison')
  @RequiresPermission('SUBMISSION:COMPARE')
  @ApiOperation({ summary: 'Compara entrega com a anterior' })
  @ApiEnvelope(ComparisonResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'RESOURCE_NOT_FOUND')
  async compareSubmission(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @CurrentSession() session: Session,
  ): Promise<ComparisonResponseDto> {
    return toComparisonResponse(
      unwrap(
        await this.articles.compareSubmission({
          actorId: session.state.userId,
          articleId,
          submissionId,
        }),
      ),
    );
  }

  @Post('articles/:articleId/submissions/:submissionId/remarks')
  @HttpCode(201)
  @RequiresPermission('REMARK:CREATE')
  @ApiOperation({ summary: 'Registra apontamento ancorado na versão entregue' })
  @ApiEnvelope(RemarkResponseDto, { status: 201 })
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'ARTICLE_NOT_IN_REVIEW')
  async createRemark(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() body: RemarkRequestDto,
    @CurrentSession() session: Session,
  ): Promise<RemarkResponseDto> {
    const input = parseOrFail(remarkSchema, body);

    return toRemarkResponse(
      unwrap(
        await this.articles.createRemark({
          actorId: session.state.userId,
          articleId,
          submissionId,
          anchor: input.anchor as JsonValue,
          originalText: input.originalText,
          body: input.body,
        }),
      ),
    );
  }

  @Get('articles/:articleId/remarks')
  @RequiresPermission('REMARK:READ')
  @ApiOperation({ summary: 'Lista apontamentos visíveis ao ator' })
  @ApiEnvelope(RemarkResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'RESOURCE_NOT_FOUND')
  async listRemarks(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentSession() session: Session,
  ): Promise<readonly RemarkResponseDto[]> {
    return unwrap(
      await this.articles.listRemarks({ actorId: session.state.userId, articleId }),
    ).map(toRemarkResponse);
  }

  @Get('articles/:articleId/remarks/:remarkId')
  @RequiresPermission('REMARK:READ')
  @ApiOperation({ summary: 'Consulta apontamento na origem e no estado atual' })
  @ApiEnvelope(RemarkResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'RESOURCE_NOT_FOUND')
  async findRemark(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('remarkId', ParseUUIDPipe) remarkId: string,
    @CurrentSession() session: Session,
  ): Promise<RemarkResponseDto> {
    return toRemarkResponse(
      unwrap(
        await this.articles.findRemark({ actorId: session.state.userId, articleId, remarkId }),
      ),
    );
  }

  @Patch('articles/:articleId/remarks/:remarkId')
  @RequiresPermission('REMARK:UPDATE')
  @ApiOperation({ summary: 'Altera texto de apontamento ainda aberto' })
  @ApiEnvelope(RemarkResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'ARTICLE_NOT_IN_REVIEW', 'REMARK_ALREADY_CLOSED')
  async updateRemark(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('remarkId', ParseUUIDPipe) remarkId: string,
    @Body() body: UpdateRemarkRequestDto,
    @CurrentSession() session: Session,
  ): Promise<RemarkResponseDto> {
    const input = parseOrFail(updateRemarkSchema, body);

    return toRemarkResponse(
      unwrap(
        await this.articles.updateRemark({
          actorId: session.state.userId,
          articleId,
          remarkId,
          body: input.body,
        }),
      ),
    );
  }

  @Post('articles/:articleId/return')
  @RequiresPermission('ARTICLE:RETURN')
  @ApiOperation({ summary: 'Devolve artigo à equipe e publica os apontamentos da etapa' })
  @ApiEnvelope(ArticleResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'PERMISSION_DENIED', 'ARTICLE_NOT_IN_REVIEW')
  async returnArticle(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentSession() session: Session,
  ): Promise<ArticleResponseDto> {
    return toArticleResponse(
      unwrap(await this.articles.returnArticle({ actorId: session.state.userId, articleId })),
    );
  }

  @Post('articles/:articleId/remarks/:remarkId/addressing')
  @RequiresPermission('REMARK:ADDRESS')
  @ApiOperation({ summary: 'Marca apontamento como atendido pela equipe' })
  @ApiEnvelope(RemarkResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'ARTICLE_LOCKED_FOR_REVIEW', 'REMARK_ALREADY_CLOSED')
  async addressRemark(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('remarkId', ParseUUIDPipe) remarkId: string,
    @CurrentSession() session: Session,
  ): Promise<RemarkResponseDto> {
    return toRemarkResponse(
      unwrap(
        await this.articles.addressRemark({ actorId: session.state.userId, articleId, remarkId }),
      ),
    );
  }

  @Delete('articles/:articleId/remarks/:remarkId/addressing')
  @RequiresPermission('REMARK:ADDRESS')
  @ApiOperation({ summary: 'Desmarca apontamento atendido enquanto o artigo está editável' })
  @ApiEnvelope(RemarkResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'ARTICLE_LOCKED_FOR_REVIEW')
  async reopenAddressedRemark(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('remarkId', ParseUUIDPipe) remarkId: string,
    @CurrentSession() session: Session,
  ): Promise<RemarkResponseDto> {
    return toRemarkResponse(
      unwrap(
        await this.articles.reopenAddressedRemark({
          actorId: session.state.userId,
          articleId,
          remarkId,
        }),
      ),
    );
  }

  @Post('articles/:articleId/remarks/:remarkId/decision')
  @RequiresPermission('REMARK:RESOLVE')
  @ApiOperation({ summary: 'Valida, reabre ou dispensa apontamento durante a correção' })
  @ApiEnvelope(RemarkResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'ARTICLE_NOT_IN_REVIEW', 'REMARK_ALREADY_CLOSED')
  async decideRemark(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('remarkId', ParseUUIDPipe) remarkId: string,
    @Body() body: DecideRemarkRequestDto,
    @CurrentSession() session: Session,
  ): Promise<RemarkResponseDto> {
    const input = parseOrFail(decideRemarkSchema, body);

    return toRemarkResponse(
      unwrap(
        await this.articles.decideRemark({
          actorId: session.state.userId,
          articleId,
          remarkId,
          decision: input.decision,
          reason: input.reason,
        }),
      ),
    );
  }

  @Post('articles/:articleId/remarks/:remarkId/resolution')
  @RequiresPermission('REMARK:RESOLVE')
  @ApiOperation({ summary: 'Valida correção e encerra apontamento como resolvido' })
  @ApiEnvelope(RemarkResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'ARTICLE_NOT_IN_REVIEW', 'REMARK_ALREADY_CLOSED')
  async resolveRemark(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('remarkId', ParseUUIDPipe) remarkId: string,
    @Body() body: DecisionReasonRequestDto,
    @CurrentSession() session: Session,
  ): Promise<RemarkResponseDto> {
    const input = parseOrFail(decisionReasonSchema, body);

    return toRemarkResponse(
      unwrap(
        await this.articles.decideRemark({
          actorId: session.state.userId,
          articleId,
          remarkId,
          decision: 'RESOLVED',
          reason: input.reason,
        }),
      ),
    );
  }

  @Post('articles/:articleId/remarks/:remarkId/reopening')
  @RequiresPermission('REMARK:REOPEN')
  @ApiOperation({ summary: 'Reabre apontamento para a etapa seguinte' })
  @ApiEnvelope(RemarkResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'ARTICLE_NOT_IN_REVIEW', 'REMARK_ALREADY_CLOSED')
  async reopenRemark(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('remarkId', ParseUUIDPipe) remarkId: string,
    @Body() body: DecisionReasonRequestDto,
    @CurrentSession() session: Session,
  ): Promise<RemarkResponseDto> {
    const input = parseOrFail(decisionReasonSchema, body);

    return toRemarkResponse(
      unwrap(
        await this.articles.decideRemark({
          actorId: session.state.userId,
          articleId,
          remarkId,
          decision: 'OPEN',
          reason: input.reason,
        }),
      ),
    );
  }

  @Post('articles/:articleId/remarks/:remarkId/dismissal')
  @RequiresPermission('REMARK:DISMISS')
  @ApiOperation({ summary: 'Dispensa apontamento sem exigir nova correção' })
  @ApiEnvelope(RemarkResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'ARTICLE_NOT_IN_REVIEW', 'REMARK_ALREADY_CLOSED')
  async dismissRemark(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('remarkId', ParseUUIDPipe) remarkId: string,
    @Body() body: DecisionReasonRequestDto,
    @CurrentSession() session: Session,
  ): Promise<RemarkResponseDto> {
    const input = parseOrFail(decisionReasonSchema, body);

    return toRemarkResponse(
      unwrap(
        await this.articles.decideRemark({
          actorId: session.state.userId,
          articleId,
          remarkId,
          decision: 'DISMISSED',
          reason: input.reason,
        }),
      ),
    );
  }

  @Post('articles/:articleId/conclusion')
  @RequiresPermission('ARTICLE:CONCLUDE')
  @ApiOperation({ summary: 'Conclui o artigo após a última correção' })
  @ApiEnvelope(ArticleResponseDto)
  @ApiFailures('AUTHENTICATION_FAILED', 'MILESTONE_PENDING', 'REMARK_PENDING')
  async conclude(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentSession() session: Session,
  ): Promise<ArticleResponseDto> {
    return toArticleResponse(
      unwrap(await this.articles.conclude({ actorId: session.state.userId, articleId })),
    );
  }
}

function toTemplateResponse(template: TemplateDto): TemplateResponseDto {
  return {
    id: template.id,
    institutionId: template.institutionId,
    courseId: template.courseId,
    name: template.name,
    description: template.description,
    active: template.active,
    currentVersionNumber: template.currentVersionNumber,
    currentVersionId: template.currentVersionId,
    content: template.content,
  };
}

function toSelectionResponse(selection: TemplateSelectionDto): TemplateSelectionResponseDto {
  return {
    id: selection.id,
    eventId: selection.eventId,
    institutionId: selection.institutionId,
    courseId: selection.courseId,
    templateId: selection.templateId,
    templateVersionId: selection.templateVersionId,
    createdAt: selection.createdAt.toISOString(),
  };
}

function toArticleResponse(article: ArticleDto): ArticleResponseDto {
  return {
    id: article.id,
    institutionId: article.institutionId,
    courseId: article.courseId,
    eventId: article.eventId,
    teamId: article.teamId,
    advisorId: article.advisorId,
    memberIds: [...article.memberIds],
    status: article.status,
    currentMilestoneId: article.currentMilestoneId,
    currentMilestoneOrder: article.currentMilestoneOrder,
    currentMilestoneDeadline: article.currentMilestoneDeadline?.toISOString() ?? null,
    content: article.content,
    formatProfile: article.formatProfile,
  };
}

function toReferenceResponse(reference: ArticleReferenceDto): ReferenceResponseDto {
  return {
    id: reference.id,
    articleId: reference.articleId,
    type: reference.type,
    authors: reference.authors,
    title: reference.title,
    year: reference.year,
    vehicle: reference.vehicle,
    doi: reference.doi,
    url: reference.url,
  };
}

function toCitationResponse(citation: ArticleCitationDto): CitationResponseDto {
  return {
    id: citation.id,
    articleId: citation.articleId,
    referenceId: citation.referenceId,
    kind: citation.kind,
    locator: citation.locator,
    page: citation.page,
  };
}

function toPresenceResponse(presence: {
  readonly articleId: string;
  readonly userId: string;
  readonly cursor: JsonValue;
  readonly updatedAt: Date;
}): PresenceResponseDto {
  return {
    articleId: presence.articleId,
    userId: presence.userId,
    cursor: presence.cursor,
    updatedAt: presence.updatedAt.toISOString(),
  };
}

function toFormatResponse(report: FormatReportDto): FormatReportResponseDto {
  return {
    article: toArticleResponse(report.article),
    changed: report.changed,
    norm: report.norm,
    changes: [...report.changes],
  };
}

function toExportResponse(exported: ExportedArticleDto): ExportedArticleResponseDto {
  return {
    articleId: exported.articleId,
    format: exported.format,
    fileName: exported.fileName,
    content: exported.content,
    generatedAt: exported.generatedAt.toISOString(),
  };
}

function toVersionResponse(version: ArticleVersionDto): VersionResponseDto {
  return {
    id: version.id,
    kind: version.kind,
    content: version.content,
    authorId: version.authorId,
    metadata: version.metadata,
    createdAt: version.createdAt.toISOString(),
  };
}

function toSubmissionResponse(submission: ArticleSubmissionDto): SubmissionResponseDto {
  return {
    id: submission.id,
    articleId: submission.articleId,
    milestoneId: submission.milestoneId,
    milestoneOrder: submission.milestoneOrder,
    automatic: submission.automatic,
    submittedBy: submission.submittedBy,
    createdAt: submission.createdAt.toISOString(),
  };
}

function toRemarkResponse(remark: ArticleRemarkDto): RemarkResponseDto {
  return {
    id: remark.id,
    articleId: remark.articleId,
    submissionId: remark.submissionId,
    status: remark.status,
    anchor: remark.anchor,
    originalText: remark.originalText,
    currentText: remark.currentText,
    body: remark.body,
    visibleToTeam: remark.visibleToTeam,
  };
}

function toComparisonResponse(comparison: SubmissionComparisonDto): ComparisonResponseDto {
  return {
    submission: toSubmissionResponse(comparison.submission),
    previousSubmission:
      comparison.previousSubmission === null
        ? null
        : toSubmissionResponse(comparison.previousSubmission),
    differences: [...comparison.differences],
  };
}
