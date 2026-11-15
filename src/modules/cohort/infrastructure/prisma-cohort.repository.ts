import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

import { offsetOf, takeOf, type PageRequest } from '@shared/http/pagination';

import type { Cohort } from '../domain/cohort';
import { ENROLLMENT_STATUS, type CohortInvitation, type Enrollment } from '../domain/enrollment';
import {
  CohortRepository,
  type CohortLink,
  type CohortLinkTarget,
  type CohortScope,
  type CohortScopeTarget,
  type StudentRows,
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

  async listByCourseForMember(
    courseId: string,
    userId: string,
    request: PageRequest,
  ): Promise<CohortRows> {
    const where = {
      courseId,
      OR: [
        { professors: { some: { userId } } },
        { enrollments: { some: { userId, status: ENROLLMENT_STATUS.ACTIVE } } },
      ],
    };
    const rows = await this.prisma.cohort.findMany({
      where,
      select: COHORT_COLUMNS,
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      skip: offsetOf(request),
      take: takeOf(request),
    });
    const cohorts = rows.map(toCohort);

    return request.withTotal
      ? { rows: cohorts, totalItems: await this.prisma.cohort.count({ where }) }
      : { rows: cohorts };
  }

  async isMember(cohortId: string, userId: string): Promise<boolean> {
    const [professor, enrollment] = await Promise.all([
      this.prisma.cohortProfessor.count({ where: { cohortId, userId } }),
      this.prisma.enrollment.count({
        where: { cohortId, userId, status: ENROLLMENT_STATUS.ACTIVE },
      }),
    ]);

    return professor + enrollment > 0;
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

  async listProfessors(
    cohortId: string,
    request: PageRequest,
  ): Promise<{ readonly rows: readonly string[]; readonly totalItems?: number }> {
    const rows = await this.prisma.cohortProfessor.findMany({
      where: { cohortId },
      select: { userId: true },
      orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
      skip: offsetOf(request),
      take: takeOf(request),
    });
    const ids = rows.map((row) => row.userId);

    return request.withTotal
      ? { rows: ids, totalItems: await this.prisma.cohortProfessor.count({ where: { cohortId } }) }
      : { rows: ids };
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

  /**
   * Os dois vínculos, em duas consultas.
   *
   * Conjunto vazio de usuários não vai ao banco: `in: []` devolveria nada e a ida seria
   * desperdício. Alvo ausente — nem turma, nem curso — também não: perguntar "quem tem
   * vínculo com coisa alguma" não tem resposta útil, e devolver a tabela inteira seria o
   * oposto do que se pediu.
   */
  async linksOf(target: CohortLinkTarget): Promise<ReadonlyMap<string, CohortLink>> {
    const userIds = [...target.userIds];
    const scope =
      target.cohortId === undefined
        ? target.courseId === undefined
          ? null
          : { cohort: { courseId: target.courseId } }
        : { cohortId: target.cohortId };

    if (userIds.length === 0 || scope === null) {
      return new Map();
    }

    const [enrollments, professors] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { userId: { in: userIds }, status: 'ACTIVE', ...scope },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.cohortProfessor.findMany({
        where: { userId: { in: userIds }, ...scope },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    const enrolled = new Set(enrollments.map((row) => row.userId));
    const assigned = new Set(professors.map((row) => row.userId));
    const links = new Map<string, CohortLink>();

    for (const userId of new Set([...enrolled, ...assigned])) {
      links.set(userId, { enrolled: enrolled.has(userId), professor: assigned.has(userId) });
    }

    return links;
  }

  /**
   * Os vínculos do usuário, com o curso de cada turma.
   *
   * Só matrícula **ativa** conta: a matrícula encerrada preserva histórico, e não dá
   * alcance a evento algum. A designação de professor não tem estado — existe ou não.
   */
  async scopesOf(userId: string): Promise<readonly CohortScope[]> {
    const [enrollments, assignments] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { cohortId: true, cohort: { select: { courseId: true } } },
      }),
      this.prisma.cohortProfessor.findMany({
        where: { userId },
        select: { cohortId: true, cohort: { select: { courseId: true } } },
      }),
    ]);

    const scopes = new Map<string, CohortScope>();

    for (const row of enrollments) {
      scopes.set(row.cohortId, {
        cohortId: row.cohortId,
        courseId: row.cohort.courseId,
        enrolled: true,
        professor: false,
      });
    }

    for (const row of assignments) {
      const found = scopes.get(row.cohortId);

      scopes.set(row.cohortId, {
        cohortId: row.cohortId,
        courseId: row.cohort.courseId,
        enrolled: found?.enrolled ?? false,
        professor: true,
      });
    }

    return [...scopes.values()];
  }

  /**
   * Os alunos matriculados no alvo, uma página por consulta.
   *
   * `distinct` sobre o usuário porque o alvo por curso pode alcançar mais de uma turma do
   * mesmo aluno; a ordem é por identificador, porque paginação sem ordem total devolve a
   * mesma linha em duas páginas.
   */
  async studentsOf(target: CohortScopeTarget, request: PageRequest): Promise<StudentRows> {
    const scope =
      target.cohortId === undefined
        ? target.courseId === undefined
          ? null
          : { cohort: { courseId: target.courseId } }
        : { cohortId: target.cohortId };

    if (scope === null) {
      return { rows: [] };
    }

    const where = { status: 'ACTIVE', ...scope } as const;
    const rows = await this.prisma.enrollment.findMany({
      where,
      select: { userId: true },
      distinct: ['userId'],
      orderBy: { userId: 'asc' },
      skip: offsetOf(request),
      take: takeOf(request),
    });
    const ids = rows.map((row) => row.userId);

    return request.withTotal
      ? {
          rows: ids,
          totalItems: (
            await this.prisma.enrollment.findMany({
              where,
              select: { userId: true },
              distinct: ['userId'],
            })
          ).length,
        }
      : { rows: ids };
  }
}
