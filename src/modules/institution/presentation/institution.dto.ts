import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

/** A instituição, como o cliente a recebe (RF-INS-001). */
export class InstitutionDtoResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Razão social ou nome de exibição.' })
  name!: string;

  @ApiProperty({ description: 'Sigla curta, única no sistema. Gravada em caixa alta.' })
  code!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Somente dígitos; a máscara não é gravada.' })
  cnpj!: string | null;

  @ApiPropertyOptional({ nullable: true })
  website!: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'email' })
  contactEmail!: string | null;

  @ApiProperty({ description: 'Instituição inativa não permite a autenticação dos seus usuários.' })
  active!: boolean;
}

export class CreateInstitutionRequestDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  code!: string;

  @ApiPropertyOptional({ nullable: true })
  cnpj?: string | null;

  @ApiPropertyOptional({ nullable: true })
  website?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'email' })
  contactEmail?: string | null;
}

export class UpdateInstitutionRequestDto {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  code?: string;

  @ApiPropertyOptional({ nullable: true })
  cnpj?: string | null;

  @ApiPropertyOptional({ nullable: true })
  website?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'email' })
  contactEmail?: string | null;
}

export class InstitutionAdminRequestDto {
  @ApiProperty({ format: 'uuid', description: 'A conta que passa a administrar a instituição.' })
  userId!: string;
}

/**
 * Comprimento e forma não são conferidos aqui: `presentation/` não conhece `domain/`
 * (`ADR-0003` §7), e a política é de lá. Estes esquemas conferem **tipo**, que é o que a
 * borda precisa para não levar adiante um corpo mal formado.
 */
export const createInstitutionSchema = z.object({
  name: z.string(),
  code: z.string(),
  cnpj: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
});

/**
 * **Sem campo de estado, e a ausência é a regra** (`ADR-0028` §11, RF-INS-001).
 *
 * Diferente do perfil de RF-ACS-005, que declara os campos protegidos para **recusar** a
 * tentativa: aqui a spec pede que o estado apenas permaneça inalterado. Um `active`
 * submetido no corpo não é descrito por este esquema, `z.object` o descarta, e a
 * instituição segue no estado em que estava.
 */
export const updateInstitutionSchema = z.object({
  name: z.string().optional(),
  code: z.string().optional(),
  cnpj: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
});

export const institutionAdminSchema = z.object({
  userId: z.string().uuid(),
});
