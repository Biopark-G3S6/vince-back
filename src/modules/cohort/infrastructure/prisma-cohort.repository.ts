import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

import { offsetOf, takeOf, type PageRequest } from '@shared/http/pagination';

import type { Cohort } from '../domain/cohort';
import type { CohortInvitation, Enrollment } from '../domain/enrollment';
import {
  CohortRepository,
  type CohortRows,
  type EnrollmentRows,
  type InvitationRows,
} from '../domain/ports/cohort-repository';
import { CohortPrisma } from './cohort-prisma';

const UNIQUE_VIOLATION = 'P2002';
const RECORD_NOT_FOUND = 'P2025';

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

const COHORT_COLUMNS = {
  id: true,
  courseId: true,
  identification: true,
  term: true,
  startsAt: true,
  endsAt: true,
  active: true,
} as const;

const ENROLLMENT_COLUMNS = {
  id: true,
  cohortId: true,
  userId: true,
  status: true,
} as const;

const INVITATION_COLUMNS = {
  id: true,
  invitationId: true,
  cohortId: true,
  professorId: true,
} as const;

function toCohort(row: {
  id: string;
  courseId: string;
  identification: string;
  term: string;
  startsAt: Date;
  endsAt: Date;
  active: boolean;
}): Cohort {
  return row;
}

function toEnrollment(row: {
  id: string;
  cohortId: string;
  userId: string;
  status: string;
}): Enrollment {
  return { ...row, status: row.status as Enrollment['status'] };
}

function toInvitation(row: {
  id: string;
  invitationId: string;
  cohortId: string;
  professorId: string;
}): CohortInvitation {
  return row;
}

@Injectable()
export class PrismaCohortRepository extends CohortRepository {
  constructor(private readonly prisma: CohortPrisma) {
    super();
  }

  async create(cohort: Cohort): Promise<Cohort | null> {
    try {
      return toCohort(
        await this.prisma.cohort.create({
          data: {
            id: cohort.id,
            courseId: cohort.courseId,
            identification: cohort.identification,
            term: cohort.term,
            startsAt: cohort.startsAt,
            endsAt: cohort.endsAt,
            active: cohort.active,
          },
          select: COHORT_COLUMNS,
        }),
      );
    } catch (error: unknown) {
      if (isPrismaError(error, UNIQUE_VIOLATION)) {
        return null;
      }

      throw error;
    }
  }

  async findById(id: string): Promise<Cohort | null> {
    const row = await this.prisma.cohort.findUnique({ where: { id }, select: COHORT_COLUMNS });

    return row === null ? null : toCohort(row);
  }

  async listByCourse(courseId: string, request: PageRequest): Promise<CohortRows> {
    const rows = await this.prisma.cohort.findMany({
      where: { courseId },
      select: COHORT_COLUMNS,
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      skip: offsetOf(request),
      take: takeOf(request),
    });
    const cohorts = rows.map(toCohort);

    return request.withTotal
      ? {
          rows: cohorts,
          totalItems: await this.prisma.cohort.count({ where: { courseId } }),
        }
      : { rows: cohorts };
  }

  async save(cohort: Cohort): Promise<Cohort | null> {
    try {
      return toCohort(
        await this.prisma.cohort.update({
          where: { id: cohort.id },
          data: {
            identification: cohort.identification,
            term: cohort.term,
            startsAt: cohort.startsAt,
            endsAt: cohort.endsAt,
          },
          select: COHORT_COLUMNS,
        }),
      );
    } catch (error: unknown) {
      if (isPrismaError(error, RECORD_NOT_FOUND) || isPrismaError(error, UNIQUE_VIOLATION)) {
        return null;
      }

      throw error;
    }
  }

  async setActive(id: string, active: boolean): Promise<Cohort | null> {
    try {
      return toCohort(
        await this.prisma.cohort.update({
          where: { id },
          data: { active },
          select: COHORT_COLUMNS,
        }),
      );
    } catch (error: unknown) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return null;
      }

      throw error;
    }
  }

  async hasProfessor(cohortId: string, userId: string): Promise<boolean> {
    return (
      (await this.prisma.cohortProfessor.findUnique({
        where: { cohortId_userId: { cohortId, userId } },
        select: { cohortId: true },
      })) !== null
    );
  }

  async addProfessor(cohortId: string, userId: string, actorId: string): Promise<void> {
    try {
      await this.prisma.transaction(async (tx) => {
        const created = await tx.cohortProfessor.createMany({
          data: { cohortId, userId },
          skipDuplicates: true,
        });

        if (created.count === 1) {
          await tx.cohortProfessorAudit.create({
            data: {
              id: uuidv7(),
              cohortId,
              userId,
              actorId,
              operation: 'ASSIGNED',
            },
          });
        }
      });
    } catch (error: unknown) {
      if (!isPrismaError(error, UNIQUE_VIOLATION)) {
        throw error;
      }
    }
  }

  async removeProfessor(cohortId: string, userId: string, actorId: string): Promise<void> {
    await this.prisma.transaction(async (tx) => {
      const removed = await tx.cohortProfessor.deleteMany({ where: { cohortId, userId } });

      if (removed.count === 1) {
        await tx.cohortProfessorAudit.create({
          data: {
            id: uuidv7(),
            cohortId,
            userId,
            actorId,
            operation: 'REVOKED',
          },
        });
      }
    });
  }

  async countProfessorAssignments(userId: string): Promise<number> {
    return this.prisma.cohortProfessor.count({ where: { userId } });
  }

  async findActiveEnrollmentByUser(userId: string): Promise<Enrollment | null> {
    const row = await this.prisma.enrollment.findFirst({
      where: { userId, status: 'ACTIVE' },
      select: ENROLLMENT_COLUMNS,
    });

    return row === null ? null : toEnrollment(row);
  }

  async createEnrollment(enrollment: Enrollment): Promise<Enrollment | null> {
    try {
      return toEnrollment(
        await this.prisma.enrollment.create({
          data: {
            id: enrollment.id,
            cohortId: enrollment.cohortId,
            userId: enrollment.userId,
            status: enrollment.status,
          },
          select: ENROLLMENT_COLUMNS,
        }),
      );
    } catch (error: unknown) {
      if (isPrismaError(error, UNIQUE_VIOLATION)) {
        return null;
      }

      throw error;
    }
  }

  async findEnrollmentById(id: string): Promise<Enrollment | null> {
    const row = await this.prisma.enrollment.findUnique({
      where: { id },
      select: ENROLLMENT_COLUMNS,
    });

    return row === null ? null : toEnrollment(row);
  }

  async listEnrollments(cohortId: string, request: PageRequest): Promise<EnrollmentRows> {
    const rows = await this.prisma.enrollment.findMany({
      where: { cohortId },
      select: ENROLLMENT_COLUMNS,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: offsetOf(request),
      take: takeOf(request),
    });
    const enrollments = rows.map(toEnrollment);

    return request.withTotal
      ? {
          rows: enrollments,
          totalItems: await this.prisma.enrollment.count({ where: { cohortId } }),
        }
      : { rows: enrollments };
  }

  async consumeInvitationAccepted(input: {
    readonly eventId: string;
    readonly invitationId: string;
    readonly cohortId: string;
    readonly userId: string;
  }): Promise<void> {
    try {
      await this.prisma.transaction(async (tx) => {
        await tx.processedEvent.create({
          data: { id: input.eventId, eventType: 'InvitationAccepted' },
        });

        await tx.enrollment.create({
          data: {
            id: uuidv7(),
            cohortId: input.cohortId,
            userId: input.userId,
            status: 'ACTIVE',
          },
        });
      });
    } catch (error: unknown) {
      if (isPrismaError(error, UNIQUE_VIOLATION)) {
        return;
      }

      throw error;
    }
  }

  async createInvitation(invitation: CohortInvitation): Promise<CohortInvitation | null> {
    try {
      return toInvitation(
        await this.prisma.cohortInvitation.create({
          data: invitation,
          select: INVITATION_COLUMNS,
        }),
      );
    } catch (error: unknown) {
      if (isPrismaError(error, UNIQUE_VIOLATION)) {
        return null;
      }

      throw error;
    }
  }

  async findInvitation(invitationId: string): Promise<CohortInvitation | null> {
    const row = await this.prisma.cohortInvitation.findUnique({
      where: { invitationId },
      select: INVITATION_COLUMNS,
    });

    return row === null ? null : toInvitation(row);
  }

  async listInvitations(cohortId: string, request: PageRequest): Promise<InvitationRows> {
    const rows = await this.prisma.cohortInvitation.findMany({
      where: { cohortId },
      select: INVITATION_COLUMNS,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: offsetOf(request),
      take: takeOf(request),
    });
    const invitations = rows.map(toInvitation);

    return request.withTotal
      ? {
          rows: invitations,
          totalItems: await this.prisma.cohortInvitation.count({ where: { cohortId } }),
        }
      : { rows: invitations };
  }
}
