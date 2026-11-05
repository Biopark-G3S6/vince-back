import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { offsetOf, takeOf, toPage, type Page, type PageRequest } from '@shared/http/pagination';

import {
  ARTICLE_STATUS,
  REMARK_STATUS,
  type Article,
  type ArticleCitation,
  type ArticlePresence,
  type ArticleReference,
  type ArticleRemark,
  type ArticleSubmission,
  type ArticleVersion,
  type JsonValue,
  type RemarkStatus,
  type Template,
  type TemplateSelection,
} from '../domain/article';
import {
  ArticleRepository,
  type ArticleCreateData,
  type CitationData,
  type ReferenceData,
  type RemarkData,
  type SubmissionData,
  type TemplateCreateData,
  type TemplateUpdateData,
  type VersionData,
} from '../domain/ports/article-repository';
import { ArticlePrisma } from './article-prisma';

const UNIQUE_CONSTRAINT = 'P2002';
const RECORD_NOT_FOUND = 'P2025';

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function asInput(value: JsonValue): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function asJson(value: Prisma.JsonValue): JsonValue {
  return value as JsonValue;
}

@Injectable()
export class PrismaArticleRepository extends ArticleRepository {
  constructor(private readonly prisma: ArticlePrisma) {
    super();
  }

  async createTemplate(data: TemplateCreateData): Promise<Template> {
    const row = await this.prisma.transaction(async (tx) => {
      await tx.articleTemplate.create({
        data: {
          id: data.id,
          institutionId: data.institutionId,
          courseId: data.courseId,
          name: data.name,
          description: data.description,
          currentVersionNumber: 1,
          createdBy: data.actorId,
        },
      });

      await tx.articleTemplateVersion.create({
        data: {
          id: data.versionId,
          templateId: data.id,
          versionNumber: 1,
          content: asInput(data.content),
          createdBy: data.actorId,
        },
      });

      return tx.articleTemplate.findUniqueOrThrow({
        where: { id: data.id },
        include: TEMPLATE_INCLUDE,
      });
    });

    return toTemplate(row);
  }

  async listTemplates(
    institutionId: string,
    request: PageRequest,
    filters: { readonly courseId?: string; readonly includeInactive: boolean },
  ): Promise<Page<Template>> {
    const where = {
      institutionId,
      ...(filters.includeInactive ? {} : { active: true }),
      ...(filters.courseId === undefined
        ? {}
        : { OR: [{ courseId: null }, { courseId: filters.courseId }] }),
    };
    const rows = await this.prisma.articleTemplate.findMany({
      where,
      include: TEMPLATE_INCLUDE,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: offsetOf(request),
      take: takeOf(request),
    });
    const total = request.withTotal
      ? await this.prisma.articleTemplate.count({ where })
      : undefined;

    return toPage(request, rows.map(toTemplate), total);
  }

  async findTemplate(id: string): Promise<Template | null> {
    const row = await this.prisma.articleTemplate.findUnique({
      where: { id },
      include: TEMPLATE_INCLUDE,
    });

    return row === null ? null : toTemplate(row);
  }

  async updateTemplate(data: TemplateUpdateData): Promise<Template | null> {
    try {
      const row = await this.prisma.transaction(async (tx) => {
        const template = await tx.articleTemplate.findUniqueOrThrow({
          where: { id: data.id },
          select: { currentVersionNumber: true },
        });
        const nextVersion = template.currentVersionNumber + (data.content === undefined ? 0 : 1);

        if (data.content !== undefined && data.versionId !== undefined) {
          await tx.articleTemplateVersion.create({
            data: {
              id: data.versionId,
              templateId: data.id,
              versionNumber: nextVersion,
              content: asInput(data.content),
              createdBy: data.actorId,
            },
          });
        }

        return tx.articleTemplate.update({
          where: { id: data.id },
          data: {
            ...(data.name === undefined ? {} : { name: data.name }),
            ...(data.description === undefined ? {} : { description: data.description }),
            ...(data.courseId === undefined ? {} : { courseId: data.courseId }),
            ...(data.content === undefined ? {} : { currentVersionNumber: nextVersion }),
          },
          include: TEMPLATE_INCLUDE,
        });
      });

      return toTemplate(row);
    } catch (error) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return null;
      }

      throw error;
    }
  }

  async setTemplateActive(id: string, active: boolean): Promise<Template | null> {
    try {
      const row = await this.prisma.articleTemplate.update({
        where: { id },
        data: { active },
        include: TEMPLATE_INCLUDE,
      });

      return toTemplate(row);
    } catch (error) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return null;
      }

      throw error;
    }
  }

  async createSelection(data: {
    readonly id: string;
    readonly eventId: string;
    readonly institutionId: string;
    readonly courseId: string | null;
    readonly templateId: string | null;
    readonly templateVersionId: string | null;
    readonly actorId: string;
  }): Promise<TemplateSelection | 'ALREADY_EXISTS'> {
    try {
      const row = await this.prisma.articleTemplateSelection.create({
        data: {
          id: data.id,
          eventId: data.eventId,
          institutionId: data.institutionId,
          courseId: data.courseId,
          templateId: data.templateId,
          templateVersionId: data.templateVersionId,
          selectedBy: data.actorId,
        },
      });

      return toSelection(row);
    } catch (error) {
      if (isPrismaError(error, UNIQUE_CONSTRAINT)) {
        return 'ALREADY_EXISTS';
      }

      throw error;
    }
  }

  async createArticle(data: ArticleCreateData): Promise<Article> {
    const row = await this.prisma.article.create({
      data: {
        id: data.id,
        institutionId: data.institutionId,
        courseId: data.courseId,
        eventId: data.eventId,
        teamId: data.teamId,
        advisorId: data.advisorId,
        memberIds: [...data.memberIds],
        status: ARTICLE_STATUS.STARTED,
        currentMilestoneId: data.currentMilestoneId,
        currentMilestoneOrder: data.currentMilestoneOrder,
        currentMilestoneDeadline: data.currentMilestoneDeadline,
        lastMilestoneOrder: data.lastMilestoneOrder,
        templateVersionId: data.templateVersionId,
        content: asInput(data.content),
        formatProfile: asInput({ norm: 'ABNT' }),
      },
    });

    return toArticle(row);
  }

  async findArticle(id: string): Promise<Article | null> {
    const row = await this.prisma.article.findUnique({ where: { id } });

    return row === null ? null : toArticle(row);
  }

  async saveArticleContent(
    id: string,
    content: JsonValue,
    status: Article['status'],
  ): Promise<Article | null> {
    try {
      const row = await this.prisma.article.update({
        where: { id },
        data: { content: asInput(content), status },
      });

      return toArticle(row);
    } catch (error) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return null;
      }

      throw error;
    }
  }

  async updateArticleStatus(id: string, status: Article['status']): Promise<Article | null> {
    try {
      const row = await this.prisma.article.update({ where: { id }, data: { status } });

      return toArticle(row);
    } catch (error) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return null;
      }

      throw error;
    }
  }

  async upsertPresence(
    articleId: string,
    userId: string,
    cursor: JsonValue,
  ): Promise<readonly ArticlePresence[]> {
    await this.prisma.articlePresence.upsert({
      where: { articleId_userId: { articleId, userId } },
      update: { cursor: asInput(cursor) },
      create: { articleId, userId, cursor: asInput(cursor) },
    });
    const rows = await this.prisma.articlePresence.findMany({
      where: { articleId },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return rows.map(toPresence);
  }

  async createReference(data: ReferenceData): Promise<ArticleReference> {
    const row = await this.prisma.articleReference.create({ data: referenceCreateData(data) });

    return toReference(row);
  }

  async listReferences(articleId: string): Promise<readonly ArticleReference[]> {
    const rows = await this.prisma.articleReference.findMany({
      where: { articleId },
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
    });

    return rows.map(toReference);
  }

  async findReference(articleId: string, referenceId: string): Promise<ArticleReference | null> {
    const row = await this.prisma.articleReference.findFirst({
      where: { id: referenceId, articleId },
    });

    return row === null ? null : toReference(row);
  }

  async updateReference(
    data: Partial<ReferenceData> & { readonly id: string; readonly articleId: string },
  ): Promise<ArticleReference | null> {
    try {
      const row = await this.prisma.articleReference.update({
        where: { id: data.id, articleId: data.articleId },
        data: {
          ...(data.type === undefined ? {} : { type: data.type }),
          ...(data.authors === undefined ? {} : { authors: asInput(data.authors) }),
          ...(data.title === undefined ? {} : { title: data.title }),
          ...(data.year === undefined ? {} : { year: data.year }),
          ...(data.vehicle === undefined ? {} : { vehicle: data.vehicle }),
          ...(data.edition === undefined ? {} : { edition: data.edition }),
          ...(data.place === undefined ? {} : { place: data.place }),
          ...(data.publisher === undefined ? {} : { publisher: data.publisher }),
          ...(data.pages === undefined ? {} : { pages: data.pages }),
          ...(data.doi === undefined ? {} : { doi: data.doi }),
          ...(data.url === undefined ? {} : { url: data.url }),
        },
      });

      return toReference(row);
    } catch (error) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return null;
      }

      throw error;
    }
  }

  async deleteReference(articleId: string, referenceId: string): Promise<boolean> {
    try {
      await this.prisma.articleReference.delete({ where: { id: referenceId, articleId } });

      return true;
    } catch (error) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return false;
      }

      throw error;
    }
  }

  async referenceHasCitations(articleId: string, referenceId: string): Promise<boolean> {
    return (
      (await this.prisma.articleCitation.count({ where: { articleId, referenceId }, take: 1 })) > 0
    );
  }

  async createCitation(data: CitationData): Promise<ArticleCitation> {
    const row = await this.prisma.articleCitation.create({
      data: {
        id: data.id,
        articleId: data.articleId,
        referenceId: data.referenceId,
        kind: data.kind,
        locator: data.locator === null ? Prisma.JsonNull : asInput(data.locator),
        page: data.page,
        createdBy: data.actorId,
      },
    });

    return toCitation(row);
  }

  async createVersion(data: VersionData): Promise<ArticleVersion> {
    const row = await this.prisma.articleVersion.create({
      data: {
        id: data.id,
        articleId: data.articleId,
        kind: data.kind,
        content: asInput(data.content),
        authorId: data.authorId,
        metadata: asInput(data.metadata),
      },
    });

    return toVersion(row);
  }

  async listVersions(articleId: string): Promise<readonly ArticleVersion[]> {
    const rows = await this.prisma.articleVersion.findMany({
      where: { articleId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return rows.map(toVersion);
  }

  async findVersion(articleId: string, versionId: string): Promise<ArticleVersion | null> {
    const row = await this.prisma.articleVersion.findFirst({
      where: { id: versionId, articleId },
    });

    return row === null ? null : toVersion(row);
  }

  async createSubmission(data: SubmissionData): Promise<ArticleSubmission | 'ALREADY_EXISTS'> {
    try {
      const row = await this.prisma.articleSubmission.create({
        data: {
          id: data.id,
          articleId: data.articleId,
          milestoneId: data.milestoneId,
          milestoneOrder: data.milestoneOrder,
          content: asInput(data.content),
          submittedBy: data.submittedBy,
          automatic: data.automatic,
        },
      });

      return toSubmission(row);
    } catch (error) {
      if (isPrismaError(error, UNIQUE_CONSTRAINT)) {
        return 'ALREADY_EXISTS';
      }

      throw error;
    }
  }

  async listSubmissions(articleId: string): Promise<readonly ArticleSubmission[]> {
    const rows = await this.prisma.articleSubmission.findMany({
      where: { articleId, revokedAt: null },
      orderBy: [{ milestoneOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map(toSubmission);
  }

  async findSubmission(articleId: string, submissionId: string): Promise<ArticleSubmission | null> {
    const row = await this.prisma.articleSubmission.findFirst({
      where: { id: submissionId, articleId, revokedAt: null },
    });

    return row === null ? null : toSubmission(row);
  }

  async deleteSubmission(articleId: string, submissionId: string): Promise<boolean> {
    try {
      await this.prisma.articleSubmission.delete({ where: { id: submissionId, articleId } });

      return true;
    } catch (error) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return false;
      }

      throw error;
    }
  }

  async createRemark(data: RemarkData): Promise<ArticleRemark> {
    const row = await this.prisma.articleRemark.create({
      data: {
        id: data.id,
        articleId: data.articleId,
        submissionId: data.submissionId,
        status: REMARK_STATUS.OPEN,
        anchor: asInput(data.anchor),
        originalText: data.originalText,
        currentText: data.currentText,
        body: data.body,
        createdBy: data.actorId,
      },
    });

    return toRemark(row);
  }

  async listRemarks(articleId: string): Promise<readonly ArticleRemark[]> {
    const rows = await this.prisma.articleRemark.findMany({
      where: { articleId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return rows.map(toRemark);
  }

  async findRemark(articleId: string, remarkId: string): Promise<ArticleRemark | null> {
    const row = await this.prisma.articleRemark.findFirst({ where: { id: remarkId, articleId } });

    return row === null ? null : toRemark(row);
  }

  async updateRemarkBody(
    articleId: string,
    remarkId: string,
    body: string,
  ): Promise<ArticleRemark | null> {
    try {
      const row = await this.prisma.articleRemark.update({
        where: { id: remarkId, articleId },
        data: { body },
      });

      return toRemark(row);
    } catch (error) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return null;
      }

      throw error;
    }
  }

  async revealRemarks(articleId: string): Promise<void> {
    await this.prisma.articleRemark.updateMany({
      where: { articleId },
      data: { visibleToTeam: true },
    });
  }

  async setRemarkStatus(
    articleId: string,
    remarkId: string,
    status: RemarkStatus,
    actorId: string,
    reason?: string | null,
  ): Promise<ArticleRemark | null> {
    const closed = status === REMARK_STATUS.RESOLVED || status === REMARK_STATUS.DISMISSED;

    try {
      const row = await this.prisma.articleRemark.update({
        where: { id: remarkId, articleId },
        data:
          status === REMARK_STATUS.ADDRESSED
            ? { status, addressedBy: actorId, addressedAt: new Date() }
            : {
                status,
                ...(closed
                  ? { decidedBy: actorId, decidedAt: new Date(), decisionReason: reason ?? null }
                  : { decidedBy: null, decidedAt: null, decisionReason: reason ?? null }),
              },
      });

      return toRemark(row);
    } catch (error) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return null;
      }

      throw error;
    }
  }

  async hasOpenRemarks(articleId: string): Promise<boolean> {
    return (
      (await this.prisma.articleRemark.count({
        where: { articleId, status: { in: [REMARK_STATUS.OPEN, REMARK_STATUS.ADDRESSED] } },
        take: 1,
      })) > 0
    );
  }

  async hasRemarksForSubmission(submissionId: string): Promise<boolean> {
    return (await this.prisma.articleRemark.count({ where: { submissionId }, take: 1 })) > 0;
  }
}

const TEMPLATE_INCLUDE = {
  versions: {
    orderBy: { versionNumber: 'desc' as const },
    take: 1,
  },
} as const;

interface TemplateRow {
  id: string;
  institutionId: string;
  courseId: string | null;
  name: string;
  description: string | null;
  active: boolean;
  currentVersionNumber: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  versions: readonly {
    id: string;
    content: Prisma.JsonValue;
  }[];
}

function toTemplate(row: TemplateRow): Template {
  const current = row.versions[0];

  if (current === undefined) {
    throw new Error(`Template ${row.id} sem versão corrente.`);
  }

  return {
    id: row.id,
    institutionId: row.institutionId,
    courseId: row.courseId,
    name: row.name,
    description: row.description,
    active: row.active,
    currentVersionNumber: row.currentVersionNumber,
    currentVersionId: current.id,
    content: asJson(current.content),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSelection(row: {
  id: string;
  eventId: string;
  institutionId: string;
  courseId: string | null;
  templateId: string | null;
  templateVersionId: string | null;
  selectedBy: string;
  createdAt: Date;
}): TemplateSelection {
  return { ...row };
}

function toArticle(row: {
  id: string;
  institutionId: string;
  courseId: string | null;
  eventId: string;
  teamId: string;
  advisorId: string | null;
  memberIds: string[];
  status: string;
  currentMilestoneId: string | null;
  currentMilestoneOrder: number | null;
  currentMilestoneDeadline: Date | null;
  lastMilestoneOrder: number | null;
  templateVersionId: string | null;
  content: Prisma.JsonValue;
  formatProfile: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): Article {
  return {
    ...row,
    memberIds: row.memberIds,
    status: row.status as Article['status'],
    content: asJson(row.content),
    formatProfile: asJson(row.formatProfile),
  };
}

function referenceCreateData(data: ReferenceData) {
  return {
    id: data.id,
    articleId: data.articleId,
    type: data.type,
    authors: asInput(data.authors),
    title: data.title,
    year: data.year,
    vehicle: data.vehicle,
    edition: data.edition,
    place: data.place,
    publisher: data.publisher,
    pages: data.pages,
    doi: data.doi,
    url: data.url,
    createdBy: data.actorId,
  };
}

function toReference(row: {
  id: string;
  articleId: string;
  type: string;
  authors: Prisma.JsonValue;
  title: string;
  year: number | null;
  vehicle: string | null;
  edition: string | null;
  place: string | null;
  publisher: string | null;
  pages: string | null;
  doi: string | null;
  url: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): ArticleReference {
  return { ...row, authors: asJson(row.authors) };
}

function toCitation(row: {
  id: string;
  articleId: string;
  referenceId: string;
  kind: string;
  locator: Prisma.JsonValue | null;
  page: string | null;
  createdBy: string;
  createdAt: Date;
}): ArticleCitation {
  return { ...row, locator: row.locator === null ? null : asJson(row.locator) };
}

function toVersion(row: {
  id: string;
  articleId: string;
  kind: string;
  content: Prisma.JsonValue;
  authorId: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}): ArticleVersion {
  return {
    ...row,
    kind: row.kind as ArticleVersion['kind'],
    content: asJson(row.content),
    metadata: asJson(row.metadata),
  };
}

function toSubmission(row: {
  id: string;
  articleId: string;
  milestoneId: string;
  milestoneOrder: number;
  content: Prisma.JsonValue;
  submittedBy: string | null;
  automatic: boolean;
  revokedAt: Date | null;
  createdAt: Date;
}): ArticleSubmission {
  return { ...row, content: asJson(row.content) };
}

function toRemark(row: {
  id: string;
  articleId: string;
  submissionId: string;
  status: string;
  anchor: Prisma.JsonValue;
  originalText: string;
  currentText: string | null;
  body: string;
  visibleToTeam: boolean;
  createdBy: string;
  addressedBy: string | null;
  addressedAt: Date | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  decisionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ArticleRemark {
  return { ...row, status: row.status as RemarkStatus, anchor: asJson(row.anchor) };
}

function toPresence(row: {
  articleId: string;
  userId: string;
  cursor: Prisma.JsonValue;
  updatedAt: Date;
}): ArticlePresence {
  return { ...row, cursor: asJson(row.cursor) };
}
