import type { PageRequest } from '@shared/http/pagination';

import type { Article } from '../article';
import type { Grade, MemberGrade } from '../grade';
import type { Publication } from '../publication';

export interface GradeHistoryRows {
  readonly rows: readonly Grade[];
  readonly totalItems?: number;
}

export interface MemberGradeHistoryRows {
  readonly rows: readonly MemberGrade[];
  readonly totalItems?: number;
}

export interface PublicationRows {
  readonly rows: readonly Publication[];
  readonly totalItems?: number;
}

export abstract class ArticleRepository {
  /**
   * Cria o artigo inicial, uma vez só.
   *
   * Devolve o artigo existente quando a equipe já tem um: a decisão é do índice único
   * sobre `team_id`, e não de uma consulta prévia — entre consultar e gravar cabe a
   * reentrega do mesmo fato (`ADR-0030` §9, §11).
   */
  abstract createForTeam(article: Article, factId: string, factType: string): Promise<Article>;

  abstract findById(id: string): Promise<Article | null>;
  abstract findByTeam(teamId: string): Promise<Article | null>;

  abstract findGrade(articleId: string): Promise<Grade | null>;
  /**
   * Grava a nota corrente e a sua linha histórica na **mesma** transação
   * (`ADR-0030` §8). O histórico é append-only: nada aqui altera linha anterior.
   */
  abstract saveGrade(articleId: string, grade: Grade): Promise<Grade>;
  abstract listGradeHistory(articleId: string, request: PageRequest): Promise<GradeHistoryRows>;

  abstract findMemberGrade(articleId: string, userId: string): Promise<MemberGrade | null>;
  abstract listMemberGrades(articleId: string): Promise<readonly MemberGrade[]>;
  abstract saveMemberGrade(articleId: string, grade: MemberGrade): Promise<MemberGrade>;
  abstract listMemberGradeHistory(
    articleId: string,
    userId: string,
    request: PageRequest,
  ): Promise<MemberGradeHistoryRows>;

  abstract createPublication(publication: Publication): Promise<Publication>;
  abstract findPublication(id: string): Promise<Publication | null>;
  abstract listPublications(articleId: string, request: PageRequest): Promise<PublicationRows>;
  abstract savePublication(publication: Publication): Promise<Publication | null>;
  abstract deletePublication(id: string): Promise<boolean>;
}
