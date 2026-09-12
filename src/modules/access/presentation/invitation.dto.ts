import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export class InvitationDetailsResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  roleCode!: string;

  @ApiProperty({ format: 'uuid' })
  institutionId!: string;

  @ApiProperty()
  institutionName!: string;

  @ApiPropertyOptional({ format: 'email' })
  targetEmail?: string;
}

export class AcceptInvitationRequestDto {
  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ format: 'email' })
  email?: string;

  @ApiProperty()
  password!: string;
}

export class AcceptedInvitationResponse {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  roleCode!: string;

  @ApiProperty({ format: 'uuid' })
  institutionId!: string;
}

export const acceptInvitationSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
  password: z.string(),
});
