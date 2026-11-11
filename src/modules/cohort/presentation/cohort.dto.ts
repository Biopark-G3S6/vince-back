import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export class CohortResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  courseId!: string;

  @ApiProperty()
  identification!: string;

  @ApiProperty()
  term!: string;

  @ApiProperty({ format: 'date-time' })
  startsAt!: Date;

  @ApiProperty({ format: 'date-time' })
  endsAt!: Date;

  @ApiProperty()
  active!: boolean;
}

export class CreateCohortRequest {
  @ApiProperty()
  identification!: string;

  @ApiProperty()
  term!: string;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;
}

export class UpdateCohortRequest {
  @ApiPropertyOptional()
  identification?: string;

  @ApiPropertyOptional()
  term?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  startsAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  endsAt?: string;
}

export class ProfessorRequest {
  @ApiProperty({ format: 'uuid' })
  userId!: string;
}

export class EnrollStudentRequest {
  @ApiProperty()
  name!: string;

  @ApiProperty({ format: 'email' })
  email!: string;
}

export class EnrollmentResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  cohortId!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  status!: string;
}

export class InvitationResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  invitationId!: string;

  @ApiProperty({ format: 'uuid' })
  cohortId!: string;

  @ApiProperty({ format: 'uuid' })
  professorId!: string;

  @ApiPropertyOptional()
  url?: string;
}

export class IssueInvitationRequest {
  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}

export const createCohortSchema = z.object({
  identification: z.string(),
  term: z.string(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});

export const updateCohortSchema = z.object({
  identification: z.string().optional(),
  term: z.string().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
});

export const professorSchema = z.object({ userId: z.string().uuid() });

export const enrollStudentSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

export const issueInvitationSchema = z.object({ expiresAt: z.coerce.date() });
