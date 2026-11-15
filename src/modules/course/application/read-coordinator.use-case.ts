import { Injectable } from '@nestjs/common';

import { CoordinatorRepository } from '../domain/ports/coordinator-repository';
import { CourseRepository } from '../domain/ports/course-repository';

@Injectable()
export class ReadCoordinatorUseCase {
  constructor(
    private readonly courses: CourseRepository,
    private readonly coordinators: CoordinatorRepository,
  ) {}

  async execute(courseId: string): Promise<string | null> {
    return (await this.courses.findById(courseId))?.coordinatorId ?? null;
  }

  /** O alcance do coordenador: os cursos que ele coordena, em uma consulta. */
  async coursesOf(userId: string): Promise<readonly string[]> {
    return this.coordinators.findByUser(userId);
  }
}
