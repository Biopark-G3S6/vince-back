import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Os tipos de escopo, para a especificação OpenAPI.
 *
 * A autoridade sobre o conjunto é o domínio (`isEventScopeType`), e a restrição de
 * verificação da migração é quem o impõe no banco. A borda não pode importar de `domain`
 * (`ADR-0003` §5), e repetir aqui os três literais é o preço — menor do que abrir a
 * fronteira para que a documentação os leia.
 */
const SCOPE_TYPES = ['INSTITUTION', 'COURSE', 'COHORT'] as const;

export class EventResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  institutionId!: string;

  @ApiProperty({ format: 'uuid', nullable: true, description: 'Nulo no escopo institucional.' })
  courseId!: string | null;

  @ApiProperty({ enum: SCOPE_TYPES })
  scopeType!: string;

  @ApiProperty({ format: 'uuid', description: 'O alvo do escopo: turma, curso ou instituição.' })
  scopeId!: string;

  @ApiProperty({ format: 'uuid' })
  ownerId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  theme!: string;

  @ApiProperty()
  researchProblem!: string;

  @ApiProperty()
  objectives!: string;

  @ApiProperty({ description: 'Quantidade máxima de equipes do evento.' })
  maxTeams!: number;

  @ApiProperty({ description: 'Tamanho máximo de cada equipe.' })
  maxTeamSize!: number;

  @ApiProperty({ enum: ['ACTIVE', 'CANCELLED'] })
  status!: string;
}

export class CreateEventRequest {
  @ApiProperty({ enum: SCOPE_TYPES })
  scopeType!: string;

  @ApiProperty({ format: 'uuid' })
  scopeId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  theme!: string;

  @ApiProperty()
  researchProblem!: string;

  @ApiProperty()
  objectives!: string;

  @ApiProperty()
  maxTeams!: number;

  @ApiProperty()
  maxTeamSize!: number;
}

export class UpdateEventRequest {
  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  theme?: string;

  @ApiPropertyOptional()
  researchProblem?: string;

  @ApiPropertyOptional()
  objectives?: string;

  @ApiPropertyOptional()
  maxTeams?: number;

  @ApiPropertyOptional()
  maxTeamSize?: number;
}

export class MilestoneResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'A posição da etapa na sequência de entregas.' })
  order!: number;

  @ApiProperty({ format: 'date-time' })
  dueAt!: Date;
}

export class CreateMilestoneRequest {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  order!: number;

  @ApiProperty({ format: 'date-time' })
  dueAt!: string;
}

export class UpdateMilestoneRequest {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  order?: number;

  @ApiPropertyOptional({ format: 'date-time' })
  dueAt?: string;
}

export class AdvisorResponse {
  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;
}

export const createEventSchema = z.object({
  scopeType: z.string(),
  scopeId: z.string().uuid(),
  title: z.string(),
  theme: z.string(),
  researchProblem: z.string(),
  objectives: z.string(),
  maxTeams: z.number(),
  maxTeamSize: z.number(),
});

export const updateEventSchema = z.object({
  title: z.string().optional(),
  theme: z.string().optional(),
  researchProblem: z.string().optional(),
  objectives: z.string().optional(),
  maxTeams: z.number().optional(),
  maxTeamSize: z.number().optional(),
});

export const createMilestoneSchema = z.object({
  name: z.string(),
  order: z.number(),
  dueAt: z.coerce.date(),
});

export const updateMilestoneSchema = z.object({
  name: z.string().optional(),
  order: z.number().optional(),
  dueAt: z.coerce.date().optional(),
});
