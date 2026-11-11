import { Prisma, type PrismaClient } from '@prisma/client';
import {
  AssistanceRepository,
  type ArticleAnalysisRecord,
  type CreateAiConsent,
  type InstitutionAiConsentRecord,
  type SaveArticleAnalysis,
  type UpdateArticleAnalysis,
} from '../domain/ports/assistance-repository';

const OWNED = new Set([
  'institutionAiConsent',
  'articleAnalysis',
  'processedAssistanceEvent',
  'assistanceOutbox',
]);

function scope(prisma: PrismaClient) {
  return prisma.$extends({
    name: 'assistance-scope',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          const name = model.charAt(0).toLowerCase() + model.slice(1);
          if (!OWNED.has(name))
            throw new Error(`O módulo assistance não possui o model ${model} (${operation}).`);
          return query(args);
        },
      },
    },
  });
}

type Scoped = ReturnType<typeof scope>;

export function createAssistanceRepository(prisma: PrismaClient): AssistanceRepository {
  const db = scope(prisma);
  return new PrismaAssistanceRepository(db);
}

class PrismaAssistanceRepository extends AssistanceRepository {
  constructor(private readonly db: Scoped) {
    super();
  }

  async latestConsent(institutionId: string): Promise<InstitutionAiConsentRecord | null> {
    return this.db.institutionAiConsent.findFirst({
      where: { institutionId },
      orderBy: [{ consentedAt: 'desc' }, { id: 'desc' }],
    });
  }

  async activeConsent(institutionId: string): Promise<InstitutionAiConsentRecord | null> {
    return this.db.institutionAiConsent.findFirst({
      where: { institutionId, revokedAt: null },
      orderBy: [{ consentedAt: 'desc' }, { id: 'desc' }],
    });
  }

  async createConsent(data: CreateAiConsent): Promise<InstitutionAiConsentRecord> {
    const now = data.consentedAt;
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.institutionAiConsent.updateMany({
          where: { institutionId: data.institutionId, revokedAt: null },
          data: { revokedAt: now, revokedBy: data.consentedBy },
        });
        return tx.institutionAiConsent.create({ data });
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
        throw error;
      const active = await this.activeConsent(data.institutionId);
      if (active === null) throw error;
      return active;
    }
  }

  async revokeActiveConsent(
    institutionId: string,
    actorId: string,
    at: Date,
  ): Promise<InstitutionAiConsentRecord | null> {
    const active = await this.activeConsent(institutionId);
    if (active === null) return null;
    return this.db.institutionAiConsent.update({
      where: { id: active.id },
      data: { revokedAt: at, revokedBy: actorId },
    });
  }

  async saveAnalysis(data: SaveArticleAnalysis): Promise<void> {
    await this.db.articleAnalysis.create({
      data: {
        id: data.id,
        articleId: data.articleId,
        kind: data.kind,
        requestedBy: data.requestedBy,
        status: data.status,
        ...(data.result === undefined ? {} : { result: data.result as Prisma.InputJsonValue }),
        ...(data.errorCode === undefined ? {} : { errorCode: data.errorCode }),
        ...(data.correlationId === undefined ? {} : { correlationId: data.correlationId }),
      },
    });
  }

  async updateAnalysis(id: string, data: UpdateArticleAnalysis): Promise<void> {
    await this.db.articleAnalysis.update({
      where: { id },
      data: {
        status: data.status,
        ...(data.result === undefined ? {} : { result: data.result as Prisma.InputJsonValue }),
        ...(data.errorCode === undefined ? {} : { errorCode: data.errorCode }),
      },
    });
  }

  async listAnalyses(
    articleId: string,
    actorId: string,
    kind: string,
    take: number,
  ): Promise<readonly ArticleAnalysisRecord[]> {
    const rows = await this.db.articleAnalysis.findMany({
      where: { articleId, requestedBy: actorId, kind, status: 'COMPLETE' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    });
    return rows.flatMap((row) =>
      row.result === null ? [] : [{ id: row.id, createdAt: row.createdAt, result: row.result }],
    );
  }
}
