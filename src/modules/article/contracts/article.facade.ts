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
} from './article.dto';
import type { ArticleResult } from './result.dto';

/**
 * A única superfície pública do módulo `article` (`ADR-0004` §1, `ADR-0030` §17).
 *
 * Declarada como `abstract class` para servir de token de injeção (`ADR-0004` §2, §3).
 *
 * Não há aqui operação de edição, submissão, revisão ou transição de estado: o artigo
 * percorre os seus estados pelas verticais de edição e revisão, que esta não implementa
 * (`ADR-0030` §13). O que existe é situação, avaliação auditável e publicação externa.
 */
export abstract class ArticleFacade {
  /** Cria o artigo inicial a partir do fato de criação de equipe. Idempotente. */
  abstract handleTeamCreated(event: TeamCreatedEvent): Promise<void>;

  abstract findSituation(query: ArticleQuery): Promise<ArticleResult<ArticleSituationDto>>;
  /** A situação pela equipe — o caminho que o aluno percorre (RF-ART-001). */
  abstract findSituationOfTeam(
    query: TeamArticleQuery,
  ): Promise<ArticleResult<ArticleSituationDto>>;

  /** Registra ou altera a nota única do artigo. Só o orientador responsável. */
  abstract gradeArticle(command: GradeArticleCommand): Promise<ArticleResult<GradeDto>>;
  abstract gradeMember(command: GradeMemberCommand): Promise<ArticleResult<MemberGradeDto>>;
  abstract listMemberGrades(query: ArticleQuery): Promise<ArticleResult<readonly MemberGradeDto[]>>;

  /**
   * O histórico de avaliações, paginado (`ADR-0030` §18).
   *
   * Sem `userId`, o histórico da nota do artigo; com ele, o da nota individual daquele
   * integrante — inclusive de quem já saiu da equipe (§15).
   */
  abstract listGradeHistory(
    command: ListGradeHistoryCommand,
  ): Promise<ArticleResult<GradeHistoryPageDto | MemberGradeHistoryPageDto>>;

  abstract createPublication(
    command: CreatePublicationCommand,
  ): Promise<ArticleResult<PublicationDto>>;
  abstract listPublications(
    command: ListPublicationsCommand,
  ): Promise<ArticleResult<PublicationPageDto>>;
  abstract updatePublication(
    command: UpdatePublicationCommand,
  ): Promise<ArticleResult<PublicationDto>>;
  abstract removePublication(query: PublicationQuery): Promise<ArticleResult<void>>;

  /** Existência e estado, para o consumidor interno. Não falha por inexistência. */
  abstract stateOf(articleId: string): Promise<ArticleDto | null>;
}
