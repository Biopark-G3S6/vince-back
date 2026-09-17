import type { PageRequest, Page } from '@shared/http/pagination';

export interface CourseDto {
  readonly id: string;
  readonly institutionId: string;
  readonly name: string;
  readonly identification: string;
  readonly active: boolean;
  readonly coordinatorId: string | null;
}

export interface CreateCourseCommand {
  readonly actorId: string;
  readonly name: string;
  readonly identification: string;
}

export interface CourseQuery {
  readonly actorId: string;
  readonly courseId: string;
}

export interface ListCoursesCommand {
  readonly actorId: string;
  readonly request: PageRequest;
}

export interface UpdateCourseCommand {
  readonly actorId: string;
  readonly courseId: string;
  readonly name?: string;
  readonly identification?: string;
}

export interface CourseCoordinatorCommand {
  readonly actorId: string;
  readonly courseId: string;
  readonly userId: string;
}

export interface CourseStateDto {
  readonly exists: boolean;
  readonly active: boolean;
  readonly institutionId: string | null;
}

export type CoursePageDto = Page<CourseDto>;
