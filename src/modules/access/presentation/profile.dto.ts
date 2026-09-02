import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

/** O perfil do titular (RF-ACS-005). */
export class UserProfileDtoResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Área de atuação ou pesquisa (RN2).' })
  expertiseArea!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Etiqueta BCP 47 (RF-INT-001).' })
  preferredLanguage!: string | null;

  @ApiProperty()
  active!: boolean;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  institutionId!: string | null;

  @ApiProperty({ type: [String] })
  roleCodes!: string[];
}

export class UpdateProfileRequestDto {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  expertiseArea?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Etiqueta BCP 47 dos idiomas suportados.' })
  preferredLanguage?: string | null;
}

/**
 * O esquema aceita os campos **protegidos** — e-mail, papel, vínculo, estado — de
 * propósito. RF-ACS-005 E2 exige que a tentativa de alterá-los seja **recusada** com
 * `PERMISSION_DENIED`; descartá-los aqui os ignoraria em silêncio, que é o comportamento
 * que a regra proíbe. Quem decide é o caso de uso.
 *
 * Comprimento e forma não são conferidos aqui: `presentation/` não conhece `domain/`
 * (`ADR-0003` §7), e a política é de lá. Este esquema confere **tipo**, que é o que a
 * borda precisa para não levar adiante um corpo mal formado.
 */
export const updateProfileSchema = z.object({
  name: z.string().optional(),
  expertiseArea: z.string().nullable().optional(),
  preferredLanguage: z.string().nullable().optional(),
  email: z.string().optional(),
  roleCode: z.string().optional(),
  institutionId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});
