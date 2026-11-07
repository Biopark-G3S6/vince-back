import { Injectable } from '@nestjs/common';

import type {
  ArticleDto,
  ArticleQuery,
  ArticleSituationDto,
  CreatePublicationCommand,
  GradeArticleCommand,
  GradeDto,
  GradeHistoryPageDto,
  GradeMemberCommand,
  ListGradeHistoryCommand,
  ListPublicationsCommand,
  MemberGradeDto,
  MemberGradeHistoryPageDto,
  PublicationDto,
  PublicationPageDto,
  PublicationQuery,
  TeamArticleQuery,
  TeamCreatedEvent,
  UpdatePublicationCommand,
} from '../contracts/article.dto';
import { ArticleFacade } from '../contracts/article.facade';
import type { ArticleResult } from '../contracts/result.dto';
import type { Result } from '../domain/failure';
import type { Grade, MemberGrade } from '../domain/grade';
import type { Publication } from '../domain/publication';
import { ArticleRepository } from '../domain/ports/article-repository';
import { ConsumeTeamCreatedUseCase } from './consume-team-created.use-case';
import { FindSituationUseCase } from './find-situation.use-case';
import { GradeArticleUseCase } from './grade-article.use-case';
import { ListGradesUseCase } from './list-grades.use-case';
import { ManagePublicationUseCase } from './manage-publication.use-case';

function toGradeDto(grade: Grade): GradeDto {
  return grade;
}

function toMemberGradeDto(grade: MemberGrade): MemberGradeDto {
  return grade;
}

function toPublicationDto(publication: Publication): PublicationDto {
  return publication;
}

function toResult<T, U>(result: Result<T>, project: (value: T) => U): ArticleResult<U> {
  return result.ok
    ? { ok: true, value: project(result.value) }
    : { ok: false, failure: result.failure };
}

function toVoidResult(result: Result<void>): ArticleResult<void> {
  return result.ok ? { ok: true, value: undefined } : { ok: false, failure: result.failure };
}

@Injectable()
export class ArticleFacadeImpl extends ArticleFacade {
  constructor(
    private readonly articles: ArticleRepository,
    private readonly consumeTeamCreated: ConsumeTeamCreatedUseCase,
    private readonly situation: FindSituationUseCase,
    private readonly gradeUseCase: GradeArticleUseCase,
    private readonly listGrades: ListGradesUseCase,
    private readonly publications: ManagePublicationUseCase,
  ) {
    super();
  }

  async handleTeamCreated(event: TeamCreatedEvent): Promise<void> {
    await this.consumeTeamCreated.execute(event);
  }

  async findSituationOfTeam(query: TeamArticleQuery): Promise<ArticleResult<ArticleSituationDto>> {
    return toResult(
      await this.situation.byTeam(query.actorId, query.teamId),
      (situation) => situation,
    );
  }

  async findSituation(query: ArticleQuery): Promise<ArticleResult<ArticleSituationDto>> {
    return toResult(
      await this.situation.byId(query.actorId, query.articleId),
      (situation) => situation,
    );
  }

  async gradeArticle(command: GradeArticleCommand): Promise<ArticleResult<GradeDto>> {
    return toResult(await this.gradeUseCase.gradeArticle(command), toGradeDto);
  }

  async gradeMember(command: GradeMemberCommand): Promise<ArticleResult<MemberGradeDto>> {
    return toResult(await this.gradeUseCase.gradeMember(command), toMemberGradeDto);
  }

  async listMemberGrades(query: ArticleQuery): Promise<ArticleResult<readonly MemberGradeDto[]>> {
    return toResult(await this.listGrades.memberGrades(query.actorId, query.articleId), (grades) =>
      grades.map(toMemberGradeDto),
    );
  }

  async listGradeHistory(
    command: ListGradeHistoryCommand,
  ): Promise<ArticleResult<GradeHistoryPageDto | MemberGradeHistoryPageDto>> {
    return toResult(
      await this.listGrades.history(
        command.actorId,
        command.articleId,
        command.request,
        command.userId,
      ),
      (page) => page,
    );
  }

  async createPublication(
    command: CreatePublicationCommand,
  ): Promise<ArticleResult<PublicationDto>> {
    return toResult(await this.publications.create(command), toPublicationDto);
  }

  async listPublications(
    command: ListPublicationsCommand,
  ): Promise<ArticleResult<PublicationPageDto>> {
    return toResult(
      await this.publications.list(command.actorId, command.articleId, command.request),
      (page) => ({ ...page, items: page.items.map(toPublicationDto) }),
    );
  }

  async updatePublication(
    command: UpdatePublicationCommand,
  ): Promise<ArticleResult<PublicationDto>> {
    return toResult(await this.publications.update(command), toPublicationDto);
  }

  async removePublication(query: PublicationQuery): Promise<ArticleResult<void>> {
    return toVoidResult(await this.publications.remove(query));
  }

  /**
   * O artigo, sem verificação de alcance.
   *
   * É a operação de consumidor interno: quem chama é outro caso de uso, que já verificou
   * a sua autorização. `null` para artigo inexistente — ausência é resposta, não falha.
   */
  async stateOf(articleId: string): Promise<ArticleDto | null> {
    return this.articles.findById(articleId);
  }
}
