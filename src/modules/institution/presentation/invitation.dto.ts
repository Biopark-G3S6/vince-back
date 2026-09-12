import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export class IssueInvitationRequestDto {
  @ApiProperty({ description: 'Papel concedido pela cadeia de designação.' })
  roleCode!: string;

  @ApiPropertyOptional({ nullable: true, format: 'email' })
  targetEmail?: string | null;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  maxUses?: number | null;
}

export class InvitationIssuedResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Endereço opaco que deve ser repassado ao convidado.' })
  url!: string;
}

export class InvitationSummaryResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['DIRECTED', 'OPEN'] })
  form!: 'DIRECTED' | 'OPEN';

  @ApiPropertyOptional({ format: 'email' })
  targetEmail?: string;

  @ApiProperty()
  roleCode!: string;

  @ApiProperty({ format: 'uuid' })
  institutionId!: string;

  @ApiProperty()
  institutionName!: string;

  @ApiProperty()
  state!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  maxUses!: number | null;

  @ApiProperty()
  useCount!: number;
}

export const issueInvitationSchema = z.object({
  roleCode: z.string(),
  targetEmail: z.string().nullable().optional(),
  expiresAt: z.string().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
});
