import { Injectable } from '@nestjs/common';

import type {
  CourseCoordinatorCommand,
  CourseDto,
  CoursePageDto,
  CourseQuery,
  CourseStateDto,
  CreateCourseCommand,
  ListCoursesCommand,
  UpdateCourseCommand,
} from '../contracts/course.dto';
import { CourseFacade } from '../contracts/course.facade';
import type { CourseResult } from '../contracts/result.dto';
import type { Course } from '../domain/course';
import type { Result } from '../domain/failure';
import { AssignCoordinatorUseCase } from './assign-coordinator.use-case';
import { CreateCourseUseCase } from './create-course.use-case';
import { DeactivateCourseUseCase } from './deactivate-course.use-case';
import { FindCourseUseCase } from './find-course.use-case';
import { ListCoursesUseCase } from './list-courses.use-case';
import { ReadCoordinatorUseCase } from './read-coordinator.use-case';
import { ReadCourseStateUseCase } from './read-course-state.use-case';
import { RevokeCoordinatorUseCase } from './revoke-coordinator.use-case';
import { UpdateCourseUseCase } from './update-course.use-case';

function toDto(course: Course): CourseDto {
  return {
    id: course.id,
    institutionId: course.institutionId,
    name: course.name,
    identification: course.identification,
    active: course.active,
    coordinatorId: course.coordinatorId,
  };
}

function toResult<T, U>(result: Result<T>, project: (value: T) => U): CourseResult<U> {
  return result.ok
    ? { ok: true, value: project(result.value) }
    : { ok: false, failure: result.failure };
}

function toVoidResult(result: Result<void>): CourseResult<void> {
  return result.ok ? { ok: true, value: undefined } : { ok: false, failure: result.failure };
}

@Injectable()
export class CourseFacadeImpl extends CourseFacade {
  constructor(
    private readonly createCourse: CreateCourseUseCase,
    private readonly listCourses: ListCoursesUseCase,
    private readonly findCourse: FindCourseUseCase,
    private readonly updateCourse: UpdateCourseUseCase,
    private readonly deactivateCourse: DeactivateCourseUseCase,
    private readonly assignCoordinatorUseCase: AssignCoordinatorUseCase,
    private readonly revokeCoordinatorUseCase: RevokeCoordinatorUseCase,
    private readonly readCourseState: ReadCourseStateUseCase,
    private readonly readCoordinator: ReadCoordinatorUseCase,
  ) {
    super();
  }

  async create(command: CreateCourseCommand): Promise<CourseResult<CourseDto>> {
    return toResult(await this.createCourse.execute(command), toDto);
  }

  async list(command: ListCoursesCommand): Promise<CourseResult<CoursePageDto>> {
    const result = await this.listCourses.execute(command.actorId, command.request);

    return result.ok
      ? { ok: true, value: { ...result.value, items: result.value.items.map(toDto) } }
      : result;
  }

  async findById(query: CourseQuery): Promise<CourseResult<CourseDto>> {
    return toResult(await this.findCourse.execute(query.actorId, query.courseId), toDto);
  }

  async update(command: UpdateCourseCommand): Promise<CourseResult<CourseDto>> {
    return toResult(await this.updateCourse.execute(command), toDto);
  }

  async deactivate(command: CourseQuery): Promise<CourseResult<CourseDto>> {
    return toResult(await this.deactivateCourse.execute(command.actorId, command.courseId), toDto);
  }

  async assignCoordinator(command: CourseCoordinatorCommand): Promise<CourseResult<void>> {
    return toVoidResult(
      await this.assignCoordinatorUseCase.execute(
        command.actorId,
        command.courseId,
        command.userId,
      ),
    );
  }

  async revokeCoordinator(command: CourseCoordinatorCommand): Promise<CourseResult<void>> {
    return toVoidResult(
      await this.revokeCoordinatorUseCase.execute(
        command.actorId,
        command.courseId,
        command.userId,
      ),
    );
  }

  async stateOf(courseId: string): Promise<CourseStateDto> {
    return this.readCourseState.execute(courseId);
  }

  async coordinatorOf(courseId: string): Promise<string | null> {
    return this.readCoordinator.execute(courseId);
  }
}
