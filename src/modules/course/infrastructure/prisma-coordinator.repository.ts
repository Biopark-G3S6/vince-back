import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

import {
  COORDINATOR_AUDIT_OPERATION,
  CoordinatorRepository,
  type CoordinatorAuditEntry,
  type CoordinatorLink,
  type CoordinatorWriteOutcome,
} from '../domain/ports/coordinator-repository';
import { CoursePrisma, type CourseModels } from './course-prisma';

const UNIQUE_VIOLATION = 'P2002';

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

async function record(
  tx: CourseModels,
  courseId: string,
  userId: string,
  actorId: string,
  operation: 'ASSIGNED' | 'REVOKED',
): Promise<void> {
  await tx.courseCoordinatorAudit.create({
    data: { id: uuidv7(), courseId, userId, actorId, operation },
  });
}

@Injectable()
export class PrismaCoordinatorRepository extends CoordinatorRepository {
  constructor(private readonly prisma: CoursePrisma) {
    super();
  }

  async findByCourse(courseId: string): Promise<CoordinatorLink | null> {
    return this.prisma.courseCoordinator.findUnique({
      where: { courseId },
      select: { courseId: true, userId: true },
    });
  }

  async assign(
    courseId: string,
    userId: string,
    actorId: string,
  ): Promise<CoordinatorWriteOutcome> {
    try {
      return await this.prisma.transaction(async (tx) => {
        const existing = await tx.courseCoordinator.findUnique({
          where: { courseId },
          select: { userId: true },
        });

        if (existing !== null) {
          return { changed: false };
        }

        await tx.courseCoordinator.create({ data: { courseId, userId } });
        await record(tx, courseId, userId, actorId, COORDINATOR_AUDIT_OPERATION.ASSIGNED);

        return { changed: true };
      });
    } catch (error) {
      if (isPrismaError(error, UNIQUE_VIOLATION)) {
        const current = await this.findByCourse(courseId);

        return current === null
          ? { changed: false }
          : { changed: false, currentUserId: current.userId };
      }

      throw error;
    }
  }

  async revoke(
    courseId: string,
    userId: string,
    actorId: string,
  ): Promise<CoordinatorWriteOutcome> {
    return this.prisma.transaction(async (tx) => {
      const removed = await tx.courseCoordinator.deleteMany({ where: { courseId, userId } });

      if (removed.count === 0) {
        return { changed: false };
      }

      await record(tx, courseId, userId, actorId, COORDINATOR_AUDIT_OPERATION.REVOKED);

      return { changed: true };
    });
  }

  async countByUser(userId: string): Promise<number> {
    return this.prisma.courseCoordinator.count({ where: { userId } });
  }

  async findAuditByCourse(courseId: string): Promise<readonly CoordinatorAuditEntry[]> {
    const rows = await this.prisma.courseCoordinatorAudit.findMany({
      where: { courseId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        courseId: true,
        userId: true,
        actorId: true,
        operation: true,
        createdAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      courseId: row.courseId,
      userId: row.userId,
      actorId: row.actorId,
      operation: row.operation as 'ASSIGNED' | 'REVOKED',
      at: row.createdAt,
    }));
  }
}
