import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

/** Uma concessão direta ativa (RF-ACS-006, RF-ACS-008). */
export class PermissionGrantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  beneficiaryId!: string;

  @ApiProperty({ format: 'uuid' })
  granterId!: string;

  @ApiProperty({ description: 'Código do catálogo, no formato `RECURSO:AÇÃO`.' })
  permission!: string;

  @ApiProperty({ format: 'date-time' })
  grantedAt!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  validUntil!: string | null;
}

export class GrantPermissionRequestDto {
  @ApiProperty({ format: 'uuid' })
  beneficiaryId!: string;

  @ApiProperty({ example: 'ARTICLE:GRADE' })
  permission!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true, description: 'Prazo opcional.' })
  validUntil?: string | null;
}

export const grantPermissionSchema = z.object({
  beneficiaryId: z.string().uuid(),
  permission: z.string().regex(/^[A-Z_]+:[A-Z_]+$/),
  validUntil: z.string().datetime({ offset: true }).nullable().optional(),
});

export const listPermissionGrantsSchema = z.object({
  beneficiaryId: z.string().uuid().optional(),
  granterId: z.string().uuid().optional(),
});
