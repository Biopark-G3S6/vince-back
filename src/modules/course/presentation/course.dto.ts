import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export class CourseDtoResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  institutionId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  identification!: string;

  @ApiProperty()
  active!: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  coordinatorId!: string | null;
}

export class CreateCourseRequestDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  identification!: string;
}

export class UpdateCourseRequestDto {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  identification?: string;
}

export class CourseCoordinatorRequestDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;
}

export const createCourseSchema = z.object({
  name: z.string(),
  identification: z.string(),
});

export const updateCourseSchema = z.object({
  name: z.string().optional(),
  identification: z.string().optional(),
});

export const courseCoordinatorSchema = z.object({ userId: z.string().uuid() });
