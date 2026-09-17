import { Module, type DynamicModule, type ModuleMetadata } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { AssignCoordinatorUseCase } from './application/assign-coordinator.use-case';
import { CourseFacadeImpl } from './application/course.facade.impl';
import { CreateCourseUseCase } from './application/create-course.use-case';
import { DeactivateCourseUseCase } from './application/deactivate-course.use-case';
import { FindCourseUseCase } from './application/find-course.use-case';
import { ListCoursesUseCase } from './application/list-courses.use-case';
import { ReadCoordinatorUseCase } from './application/read-coordinator.use-case';
import { ReadCourseStateUseCase } from './application/read-course-state.use-case';
import { RevokeCoordinatorUseCase } from './application/revoke-coordinator.use-case';
import { UpdateCourseUseCase } from './application/update-course.use-case';
import { CourseFacade } from './contracts/course.facade';
import { CoordinatorRepository } from './domain/ports/coordinator-repository';
import { CourseRepository } from './domain/ports/course-repository';
import { CoursePrisma, createCoursePrisma } from './infrastructure/course-prisma';
import { PrismaCoordinatorRepository } from './infrastructure/prisma-coordinator.repository';
import { PrismaCourseRepository } from './infrastructure/prisma-course.repository';
import { CourseController } from './presentation/course.controller';
import { CourseCoordinatorController } from './presentation/course-coordinator.controller';

export interface CourseModuleOptions {
  readonly imports: ModuleMetadata['imports'];
}

/** Composition root da vertical de curso; somente a fachada é exportada. */
@Module({})
export class CourseModule {
  static forRoot(prisma: PrismaClient, options: CourseModuleOptions): DynamicModule {
    return {
      module: CourseModule,
      imports: options.imports,
      controllers: [CourseController, CourseCoordinatorController],
      providers: [
        { provide: CoursePrisma, useValue: createCoursePrisma(prisma) },
        { provide: CourseRepository, useClass: PrismaCourseRepository },
        { provide: CoordinatorRepository, useClass: PrismaCoordinatorRepository },
        CreateCourseUseCase,
        ListCoursesUseCase,
        FindCourseUseCase,
        ReadCourseStateUseCase,
        ReadCoordinatorUseCase,
        UpdateCourseUseCase,
        DeactivateCourseUseCase,
        AssignCoordinatorUseCase,
        RevokeCoordinatorUseCase,
        { provide: CourseFacade, useClass: CourseFacadeImpl },
      ],
      exports: [CourseFacade],
    };
  }
}
