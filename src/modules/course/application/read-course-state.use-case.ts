import { Injectable } from '@nestjs/common';

import type { CourseState } from '../domain/course';
import { CourseRepository } from '../domain/ports/course-repository';

@Injectable()
export class ReadCourseStateUseCase {
  constructor(private readonly courses: CourseRepository) {}

  async execute(courseId: string): Promise<CourseState> {
    const course = await this.courses.findById(courseId);

    return course === null
      ? { exists: false, active: false, institutionId: null }
      : { exists: true, active: course.active, institutionId: course.institutionId };
  }
}
