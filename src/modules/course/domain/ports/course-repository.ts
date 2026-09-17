import type { PageRequest } from '@shared/http/pagination';

import type { Course } from '../course';

export interface CourseRows {
  readonly rows: readonly Course[];
  readonly totalItems?: number;
}

export abstract class CourseRepository {
  abstract create(course: Course): Promise<Course>;
  abstract findById(id: string): Promise<Course | null>;
  abstract list(institutionId: string, request: PageRequest): Promise<CourseRows>;
  abstract save(course: Course): Promise<Course | null>;
  abstract setActive(id: string, active: boolean): Promise<Course | null>;
}
