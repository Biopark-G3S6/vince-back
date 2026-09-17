import { Injectable } from '@nestjs/common';

import { CourseRepository } from '../domain/ports/course-repository';

@Injectable()
export class ReadCoordinatorUseCase {
  constructor(private readonly courses: CourseRepository) {}

  async execute(courseId: string): Promise<string | null> {
    return (await this.courses.findById(courseId))?.coordinatorId ?? null;
  }
}
