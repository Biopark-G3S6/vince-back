import type {
  CourseCoordinatorCommand,
  CourseDto,
  CoursePageDto,
  CourseQuery,
  CourseStateDto,
  CreateCourseCommand,
  ListCoursesCommand,
  UpdateCourseCommand,
} from './course.dto';
import type { CourseResult } from './result.dto';

/** A única superfície pública do módulo `course` (ADR-0004, ADR-0029 §12). */
export abstract class CourseFacade {
  abstract create(command: CreateCourseCommand): Promise<CourseResult<CourseDto>>;
  abstract list(command: ListCoursesCommand): Promise<CourseResult<CoursePageDto>>;
  abstract findById(query: CourseQuery): Promise<CourseResult<CourseDto>>;
  abstract update(command: UpdateCourseCommand): Promise<CourseResult<CourseDto>>;
  abstract deactivate(command: CourseQuery): Promise<CourseResult<CourseDto>>;
  abstract assignCoordinator(command: CourseCoordinatorCommand): Promise<CourseResult<void>>;
  abstract revokeCoordinator(command: CourseCoordinatorCommand): Promise<CourseResult<void>>;

  /** Existência e estado para consumidores como `cohort` e `event`. */
  abstract stateOf(courseId: string): Promise<CourseStateDto>;

  /** Coordenador corrente, ou `null`, para consumidores do escopo do curso. */
  abstract coordinatorOf(courseId: string): Promise<string | null>;
}
