import { Prisma, type PrismaClient } from '@prisma/client';
import {
  ProgressRepository,
  type CreateProgressReport,
  type ProgressReportRecord,
  type RiskSignalRecord,
  type UpsertRiskSignal,
} from '../domain/ports/progress-repository';

const OWNED = new Set(['riskSignal', 'progressReport', 'processedProgressEvent', 'progressOutbox']);

function scope(prisma: PrismaClient) {
  return prisma.$extends({
    name: 'progress-scope',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          const name = model.charAt(0).toLowerCase() + model.slice(1);
          if (!OWNED.has(name))
            throw new Error(`O módulo progress não possui o model ${model} (${operation}).`);
          return query(args);
        },
      },
    },
  });
}

type Scoped = ReturnType<typeof scope>;

export function createProgressRepository(prisma: PrismaClient): ProgressRepository {
  return new PrismaProgressRepository(scope(prisma));
}

class PrismaProgressRepository extends ProgressRepository {
  constructor(private readonly db: Scoped) {
    super();
  }

  async activeSignals(articleIds: readonly string[]): Promise<readonly RiskSignalRecord[]> {
    if (articleIds.length === 0) return [];
    return this.db.riskSignal.findMany({
      where: { articleId: { in: [...articleIds] }, active: true },
      orderBy: [{ activatedAt: 'desc' }, { id: 'asc' }],
    });
  }

  async signalsForTeams(teamIds: readonly string[]): Promise<readonly RiskSignalRecord[]> {
    if (teamIds.length === 0) return [];
    return this.db.riskSignal.findMany({ where: { teamId: { in: [...teamIds] } } });
  }

  async upsertSignal(data: UpsertRiskSignal): Promise<void> {
    await this.db.riskSignal.upsert({
      where: { teamId_condition: { teamId: data.teamId, condition: data.condition } },
      create: {
        id: data.id,
        articleId: data.articleId,
        teamId: data.teamId,
        courseId: data.courseId,
        eventId: data.eventId,
        condition: data.condition,
        activationEventId: data.activationEventId,
        active: true,
        activatedAt: data.activatedAt,
        lastObservedAt: data.lastObservedAt,
      },
      update: {
        articleId: data.articleId,
        courseId: data.courseId,
        eventId: data.eventId,
        active: true,
        lastObservedAt: data.lastObservedAt,
        clearedAt: null,
        ...(data.wasActive
          ? {}
          : { activationEventId: data.activationEventId, activatedAt: data.activatedAt }),
      },
    });
  }

  async deactivateSignal(id: string, at: Date): Promise<void> {
    await this.db.riskSignal.update({
      where: { id },
      data: { active: false, clearedAt: at, lastObservedAt: at },
    });
  }

  async createReport(data: CreateProgressReport): Promise<ProgressReportRecord> {
    return this.db.progressReport.create({
      data: { ...data, data: data.data as Prisma.InputJsonValue },
      select: {
        id: true,
        courseId: true,
        periodStart: true,
        periodEnd: true,
        createdAt: true,
        status: true,
        data: true,
      },
    });
  }

  async findReport(id: string): Promise<ProgressReportRecord | null> {
    return this.db.progressReport.findUnique({
      where: { id },
      select: {
        id: true,
        courseId: true,
        periodStart: true,
        periodEnd: true,
        createdAt: true,
        status: true,
        data: true,
      },
    });
  }
}
