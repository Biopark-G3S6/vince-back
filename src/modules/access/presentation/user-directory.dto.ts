import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

/** Uma pessoa no diretório. `email`, `active` e `roleCodes` só para quem designa. */
export class DirectoryUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ format: 'email' })
  email?: string;

  @ApiPropertyOptional()
  active?: boolean;

  @ApiPropertyOptional({ type: [String] })
  roleCodes?: string[];

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  institutionId?: string | null;
}

const MAX_IDS = 100;

export const directoryQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  role: z
    .string()
    .regex(/^[A-Z_]+$/)
    .optional(),
  active: z.enum(['true', 'false']).optional(),
  institutionId: z.string().uuid().optional(),
  ids: z
    .string()
    .refine((value) => {
      const ids = splitIds(value);

      return (
        ids.length >= 1 &&
        ids.length <= MAX_IDS &&
        ids.every((id) => z.string().uuid().safeParse(id).success)
      );
    })
    .optional(),
});

/** A lista de `ids` da consulta, separada por vírgula. */
export function splitIds(value: string): string[] {
  return value.split(',').filter((item) => item !== '');
}
