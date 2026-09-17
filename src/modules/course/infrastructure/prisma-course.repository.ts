import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { offsetOf, takeOf, type PageRequest } from '@shared/http/pagination';

import type { Course } from '../domain/course';
import { CourseRepository, type CourseRows } from '../domain/ports/course-repository';
import { CoursePrisma } from './course-prisma';

const RECORD_NOT_FOUND = 'P2025';

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function toCourse(row: CourseRow): Course {
  return {
    id: row.id,
    institutionId: row.institutionId,
    name: row.name,
    identification: row.identification,
    active: row.active,
    coordinatorId: row.coordinator?.userId ?? null,
  };
}

interface CourseRow {
  id: string;
  institutionId: string;
  name: string;
  identification: string;
  active: boolean;
  coordinator: { userId: string } | null;
}

const COURSE_COLUMNS = {
  id: true,
  institutionId: true,
  name: true,
  identification: true,
  active: true,
  coordinator: { select: { userId: true } },
} as const;

const LIST_ORDER = [{ name: 'asc' as const }, { id: 'asc' as const }];

@Injectable()
export class PrismaCourseRepository extends CourseRepository {
  constructor(private readonly prisma: CoursePrisma) {
    super();
  }

  async create(course: Course): Promise<Course> {
    const row = await this.prisma.course.create({
      data: {
        id: course.id,
        institutionId: course.institutionId,
        name: course.name,
        identification: course.identification,
        active: course.active,
      },
      select: COURSE_COLUMNS,
    });

    return toCourse(row);
  }

  async findById(id: string): Promise<Course | null> {
    const row = await this.prisma.course.findUnique({ where: { id }, select: COURSE_COLUMNS });

    return row === null ? null : toCourse(row);
  }

  async list(institutionId: string, request: PageRequest): Promise<CourseRows> {
    const rows = await this.prisma.course.findMany({
      where: { institutionId },
      select: COURSE_COLUMNS,
      orderBy: LIST_ORDER,
      skip: offsetOf(request),
      take: takeOf(request),
    });
    const courses = rows.map(toCourse);

    return request.withTotal
      ? { rows: courses, totalItems: await this.prisma.course.count({ where: { institutionId } }) }
      : { rows: courses };
  }

  async save(course: Course): Promise<Course | null> {
    try {
      const row = await this.prisma.course.update({
        where: { id: course.id },
        data: { name: course.name, identification: course.identification },
        select: COURSE_COLUMNS,
      });

      return toCourse(row);
    } catch (error) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return null;
      }

      throw error;
    }
  }

  async setActive(id: string, active: boolean): Promise<Course | null> {
    try {
      const row = await this.prisma.course.update({
        where: { id },
        data: { active },
        select: COURSE_COLUMNS,
      });

      return toCourse(row);
    } catch (error) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return null;
      }

      throw error;
    }
  }
}
