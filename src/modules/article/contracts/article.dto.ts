/**
 * DTOs do artigo.
 *
 * Nenhum tipo do Prisma entra aqui (`ADR-0004` §8, §9, `ADR-0030` §17): equipe, evento,
 * usuário e instituição atravessam a fronteira como texto, e a nota, como número.
 */
import type { Page, PageRequest } from '@shared/http/pagination';

export interface ArticleDto {
  readonly id: string;
  readonly teamId: string;
  readonly eventId: string;
  readonly institutionId: string;
  readonly status: string;
}

/** A situação do artigo: o estado e a etapa corrente do cronograma (RF-ART-001). */
export interface ArticleSituationDto {
  readonly article: ArticleDto;
  readonly currentMilestone: {
    readonly id: string;
    readonly name: string;
    readonly order: number;
    readonly dueAt: Date;
  } | null;
  readonly grade: GradeDto | null;
}

export interface GradeDto {
  readonly value: number;
  readonly authorId: string;
  readonly recordedAt: Date;
}

export interface MemberGradeDto extends GradeDto {
  readonly userId: string;
  readonly memberActive: boolean;
}

export interface ArticleQuery {
  readonly actorId: string;
  readonly articleId: string;
}

export interface TeamArticleQuery {
  readonly actorId: string;
  readonly teamId: string;
}

export interface GradeArticleCommand extends ArticleQuery {
  readonly value: number;
}

export interface GradeMemberCommand extends ArticleQuery {
  readonly userId: string;
  readonly value: number;
}

export interface ListGradeHistoryCommand extends ArticleQuery {
  readonly userId?: string;
  readonly request: PageRequest;
}

export interface PublicationDto {
  readonly id: string;
  readonly articleId: string;
  readonly venue: string;
  readonly kind: string;
  readonly publishedAt: Date;
  readonly url: string;
  readonly authorId: string;
}

export interface CreatePublicationCommand extends ArticleQuery {
  readonly venue: string;
  readonly kind: string;
  readonly publishedAt: Date;
  readonly url: string;
}

export interface UpdatePublicationCommand extends ArticleQuery {
  readonly publicationId: string;
  readonly venue?: string;
  readonly kind?: string;
  readonly publishedAt?: Date;
  readonly url?: string;
}

export interface PublicationQuery extends ArticleQuery {
  readonly publicationId: string;
}

export interface ListPublicationsCommand extends ArticleQuery {
  readonly request: PageRequest;
}

/** O fato de criação de equipe, consumido para criar o artigo (`ADR-0030` §9). */
export interface TeamCreatedEvent {
  readonly factId: string;
  readonly teamId: string;
  readonly eventId: string;
  readonly institutionId: string;
  readonly occurredAt: Date;
}

export type GradeHistoryPageDto = Page<GradeDto>;
export type MemberGradeHistoryPageDto = Page<MemberGradeDto>;
export type PublicationPageDto = Page<PublicationDto>;
