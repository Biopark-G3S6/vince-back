import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

import { offsetOf, takeOf, type PageRequest } from '@shared/http/pagination';

import type { Article, ArticleStatus } from '../domain/article';
import type { Grade, MemberGrade } from '../domain/grade';
import {
  ArticleRepository,
  type GradeHistoryRows,
  type MemberGradeHistoryRows,
  type PublicationRows,
} from '../domain/ports/article-repository';
import type { Publication, PublicationKind } from '../domain/publication';
import { ArticlePrisma } from './article-prisma';

const UNIQUE_VIOLATION = 'P2002';
const RECORD_NOT_FOUND = 'P2025';

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

const ARTICLE_COLUMNS = {
  id: true,
  teamId: true,
  eventId: true,
  institutionId: true,
  status: true,
} as const;

const PUBLICATION_COLUMNS = {
  id: true,
  articleId: true,
  venue: true,
  kind: true,
  publishedAt: true,
  url: true,
  authorId: true,
} as const;

function toArticle(row: {
  id: string;
  teamId: string;
  eventId: string;
  institutionId: string;
  status: string;
}): Article {
  return { ...row, status: row.status as ArticleStatus };
}

/**
 * A nota atravessa a fronteira como **número**.
 *
 * O banco a guarda em `DECIMAL(5,2)` porque dinheiro e nota não são ponto flutuante; o
 * domínio a trata como número porque a faixa é de 0 a 10 com duas casas, e nessa escala
 * nenhuma operação do módulo perde precisão — não há soma, média nem acumulação aqui.
 */
function toNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

function toPublication(row: {
  id: string;
  articleId: string;
  venue: string;
  kind: string;
  publishedAt: Date;
  url: string;
  authorId: string;
}): Publication {
  return { ...row, kind: row.kind as PublicationKind };
}

@Injectable()
export class PrismaArticleRepository extends ArticleRepository {
  constructor(private readonly prisma: ArticlePrisma) {
    super();
  }

  /**
   * A criação idempotente do artigo inicial.
   *
   * O registro do fato consumido e a criação acontecem na mesma transação. A violação de
   * unicidade — do fato já processado ou do artigo da equipe — é **sucesso** do caso
   * repetido: devolve-se o artigo que já existe (`ADR-0030` §9, §11).
   */
  async createForTeam(article: Article, factId: string, factType: string): Promise<Article> {
    try {
      return await this.prisma.transaction(async (tx) => {
        if (factId.length > 0) {
          await tx.articleProcessedEvent.create({ data: { id: factId, eventType: factType } });
        }

        return toArticle(
          await tx.article.create({
            data: {
              id: article.id,
              teamId: article.teamId,
              eventId: article.eventId,
              institutionId: article.institutionId,
              status: article.status,
            },
            select: ARTICLE_COLUMNS,
          }),
        );
      });
    } catch (error: unknown) {
      if (isPrismaError(error, UNIQUE_VIOLATION)) {
        const existing = await this.findByTeam(article.teamId);

        if (existing !== null) {
          return existing;
        }
      }

      throw error;
    }
  }

  async findById(id: string): Promise<Article | null> {
    const row = await this.prisma.article.findUnique({ where: { id }, select: ARTICLE_COLUMNS });

    return row === null ? null : toArticle(row);
  }

  async findByTeam(teamId: string): Promise<Article | null> {
    const row = await this.prisma.article.findUnique({
      where: { teamId },
      select: ARTICLE_COLUMNS,
    });

    return row === null ? null : toArticle(row);
  }

  async findGrade(articleId: string): Promise<Grade | null> {
    const row = await this.prisma.grade.findUnique({
      where: { articleId },
      select: { value: true, authorId: true, updatedAt: true },
    });

    return row === null
      ? null
      : { value: toNumber(row.value), authorId: row.authorId, recordedAt: row.updatedAt };
  }

  /**
   * A nota corrente e a sua linha histórica, na mesma transação (`ADR-0030` §8).
   *
   * `upsert` na visão corrente, `create` no histórico: a primeira é substituída, o
   * segundo só cresce. É essa assimetria que preserva autor e instante de cada versão.
   */
  async saveGrade(articleId: string, grade: Grade): Promise<Grade> {
    return this.prisma.transaction(async (tx) => {
      await tx.articleGrade.upsert({
        where: { articleId },
        create: { articleId, value: grade.value, authorId: grade.authorId },
        update: { value: grade.value, authorId: grade.authorId },
      });

      await tx.articleGradeHistory.create({
        data: {
          id: uuidv7(),
          articleId,
          value: grade.value,
          authorId: grade.authorId,
          recordedAt: grade.recordedAt,
        },
      });

      return grade;
    });
  }

  async listGradeHistory(articleId: string, request: PageRequest): Promise<GradeHistoryRows> {
    const rows = await this.prisma.gradeHistory.findMany({
      where: { articleId },
      select: { value: true, authorId: true, recordedAt: true },
      orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
      skip: offsetOf(request),
      take: takeOf(request),
    });
    const history = rows.map((row) => ({
      value: toNumber(row.value),
      authorId: row.authorId,
      recordedAt: row.recordedAt,
    }));

    return request.withTotal
      ? {
          rows: history,
          totalItems: await this.prisma.gradeHistory.count({ where: { articleId } }),
        }
      : { rows: history };
  }

  async findMemberGrade(articleId: string, userId: string): Promise<MemberGrade | null> {
    const row = await this.prisma.memberGrade.findUnique({
      where: { articleId_userId: { articleId, userId } },
      select: { userId: true, value: true, authorId: true, updatedAt: true },
    });

    if (row === null) {
      return null;
    }

    const snapshot = await this.prisma.memberGradeHistory.findFirst({
      where: { articleId, userId },
      select: { memberActive: true },
      orderBy: { recordedAt: 'desc' },
    });

    return {
      userId: row.userId,
      value: toNumber(row.value),
      authorId: row.authorId,
      recordedAt: row.updatedAt,
      memberActive: snapshot?.memberActive ?? false,
    };
  }

  /**
   * As notas individuais correntes.
   *
   * Sem paginação, e deliberadamente: a quantidade é limitada pelo tamanho máximo da
   * equipe, que o evento declara — cota natural (`ADR-0011` §6). O instantâneo da
   * participação vem da linha histórica mais recente de cada integrante, em **uma**
   * consulta para todos.
   */
  async listMemberGrades(articleId: string): Promise<readonly MemberGrade[]> {
    const [current, history] = await Promise.all([
      this.prisma.memberGrade.findMany({
        where: { articleId },
        select: { userId: true, value: true, authorId: true, updatedAt: true },
        orderBy: { userId: 'asc' },
      }),
      this.prisma.memberGradeHistory.findMany({
        where: { articleId },
        select: { userId: true, memberActive: true, recordedAt: true },
        orderBy: { recordedAt: 'desc' },
      }),
    ]);
    const latest = new Map<string, boolean>();

    for (const row of history) {
      if (!latest.has(row.userId)) {
        latest.set(row.userId, row.memberActive);
      }
    }

    return current.map((row) => ({
      userId: row.userId,
      value: toNumber(row.value),
      authorId: row.authorId,
      recordedAt: row.updatedAt,
      memberActive: latest.get(row.userId) ?? false,
    }));
  }

  async saveMemberGrade(articleId: string, grade: MemberGrade): Promise<MemberGrade> {
    return this.prisma.transaction(async (tx) => {
      await tx.memberGrade.upsert({
        where: { articleId_userId: { articleId, userId: grade.userId } },
        create: {
          id: uuidv7(),
          articleId,
          userId: grade.userId,
          value: grade.value,
          authorId: grade.authorId,
        },
        update: { value: grade.value, authorId: grade.authorId },
      });

      await tx.memberGradeHistory.create({
        data: {
          id: uuidv7(),
          articleId,
          userId: grade.userId,
          value: grade.value,
          authorId: grade.authorId,
          memberActive: grade.memberActive,
          recordedAt: grade.recordedAt,
        },
      });

      return grade;
    });
  }

  async listMemberGradeHistory(
    articleId: string,
    userId: string,
    request: PageRequest,
  ): Promise<MemberGradeHistoryRows> {
    const where = { articleId, userId } as const;
    const rows = await this.prisma.memberGradeHistory.findMany({
      where,
      select: {
        userId: true,
        value: true,
        authorId: true,
        memberActive: true,
        recordedAt: true,
      },
      orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
      skip: offsetOf(request),
      take: takeOf(request),
    });
    const history = rows.map((row) => ({
      userId: row.userId,
      value: toNumber(row.value),
      authorId: row.authorId,
      memberActive: row.memberActive,
      recordedAt: row.recordedAt,
    }));

    return request.withTotal
      ? { rows: history, totalItems: await this.prisma.memberGradeHistory.count({ where }) }
      : { rows: history };
  }

  async createPublication(publication: Publication): Promise<Publication> {
    return toPublication(
      await this.prisma.publication.create({
        data: {
          id: publication.id,
          articleId: publication.articleId,
          venue: publication.venue,
          kind: publication.kind,
          publishedAt: publication.publishedAt,
          url: publication.url,
          authorId: publication.authorId,
        },
        select: PUBLICATION_COLUMNS,
      }),
    );
  }

  async findPublication(id: string): Promise<Publication | null> {
    const row = await this.prisma.publication.findUnique({
      where: { id },
      select: PUBLICATION_COLUMNS,
    });

    return row === null ? null : toPublication(row);
  }

  async listPublications(articleId: string, request: PageRequest): Promise<PublicationRows> {
    const rows = await this.prisma.publication.findMany({
      where: { articleId },
      select: PUBLICATION_COLUMNS,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      skip: offsetOf(request),
      take: takeOf(request),
    });
    const publications = rows.map(toPublication);

    return request.withTotal
      ? {
          rows: publications,
          totalItems: await this.prisma.publication.count({ where: { articleId } }),
        }
      : { rows: publications };
  }

  async savePublication(publication: Publication): Promise<Publication | null> {
    try {
      return toPublication(
        await this.prisma.publication.update({
          where: { id: publication.id },
          data: {
            venue: publication.venue,
            kind: publication.kind,
            publishedAt: publication.publishedAt,
            url: publication.url,
          },
          select: PUBLICATION_COLUMNS,
        }),
      );
    } catch (error: unknown) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return null;
      }

      throw error;
    }
  }

  async deletePublication(id: string): Promise<boolean> {
    const removed = await this.prisma.publication.deleteMany({ where: { id } });

    return removed.count === 1;
  }
}
