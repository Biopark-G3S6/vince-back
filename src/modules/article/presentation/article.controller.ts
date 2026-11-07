import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentSession } from '@shared/auth/request-session';
import type { Session } from '@shared/auth/session-store';
import { ApiEnvelope, ApiFailures } from '@shared/http/openapi';
import { RequiresPermission } from '@shared/http/route-access';
import { parseOrFail } from '@shared/http/validation';

import { ArticleFacade } from '../contracts/article.facade';
import {
  ArticleSituationResponse,
  GradeRequest,
  GradeResponse,
  MemberGradeResponse,
  gradeSchema,
} from './article.dto';
import { unwrap } from './result-mapper';

@ApiTags('Artigo')
@Controller('articles')
export class ArticleController {
  constructor(private readonly articles: ArticleFacade) {}

  @Get(':articleId')
  @RequiresPermission('ARTICLE:READ')
  @ApiOperation({ summary: 'Consulta o artigo, o seu estado e a etapa corrente' })
  @ApiEnvelope(ArticleSituationResponse)
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async find(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentSession() session: Session,
  ): Promise<ArticleSituationResponse> {
    return unwrap(await this.articles.findSituation({ actorId: session.state.userId, articleId }));
  }

  @Put(':articleId/grade')
  @RequiresPermission('ARTICLE:GRADE')
  @ApiOperation({
    summary: 'Registra ou altera a nota do artigo',
    description: 'Somente o orientador responsável. A alteração preserva o histórico.',
  })
  @ApiEnvelope(GradeResponse)
  @ApiFailures('PERMISSION_DENIED', 'VALIDATION_FAILED', 'RESOURCE_NOT_FOUND')
  async grade(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Body() body: GradeRequest,
    @CurrentSession() session: Session,
  ): Promise<GradeResponse> {
    const input = parseOrFail(gradeSchema, body);

    return unwrap(
      await this.articles.gradeArticle({ ...input, actorId: session.state.userId, articleId }),
    );
  }

  @Get(':articleId/member-grades')
  @RequiresPermission('ARTICLE:READ')
  @ApiOperation({
    summary: 'Lista as notas individuais correntes',
    description:
      'Inclui a nota de quem já saiu da equipe: a remoção não apaga avaliação. ' +
      'Não é paginada porque o tamanho da equipe é limitado pelo evento.',
  })
  @ApiEnvelope(MemberGradeResponse)
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async memberGrades(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @CurrentSession() session: Session,
  ): Promise<readonly MemberGradeResponse[]> {
    return unwrap(
      await this.articles.listMemberGrades({ actorId: session.state.userId, articleId }),
    );
  }

  @Put(':articleId/member-grades/:userId')
  @RequiresPermission('ARTICLE:GRADE_MEMBER')
  @ApiOperation({
    summary: 'Registra ou altera a nota individual de um integrante',
    description: 'Somente o orientador responsável. Valores independentes entre integrantes.',
  })
  @ApiEnvelope(MemberGradeResponse)
  @ApiFailures('PERMISSION_DENIED', 'VALIDATION_FAILED', 'RESOURCE_NOT_FOUND')
  async gradeMember(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: GradeRequest,
    @CurrentSession() session: Session,
  ): Promise<MemberGradeResponse> {
    const input = parseOrFail(gradeSchema, body);

    return unwrap(
      await this.articles.gradeMember({
        ...input,
        actorId: session.state.userId,
        articleId,
        userId,
      }),
    );
  }
}

/**
 * A situação pela equipe — o caminho que o aluno percorre (RF-ART-001, fluxo principal).
 *
 * A rota vive neste módulo porque o artigo é dele: `ADR-0006` não deixaria `team`
 * devolver artigo, e um redirecionamento obrigaria o cliente a duas requisições para
 * saber o que uma responde.
 */
@ApiTags('Artigo')
@Controller('teams/:teamId/article')
export class TeamArticleController {
  constructor(private readonly articles: ArticleFacade) {}

  @Get()
  @RequiresPermission('ARTICLE:READ')
  @ApiOperation({ summary: 'Consulta o artigo da equipe' })
  @ApiEnvelope(ArticleSituationResponse)
  @ApiFailures('PERMISSION_DENIED', 'RESOURCE_NOT_FOUND')
  async find(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentSession() session: Session,
  ): Promise<ArticleSituationResponse> {
    return unwrap(
      await this.articles.findSituationOfTeam({ actorId: session.state.userId, teamId }),
    );
  }
}
