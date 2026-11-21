import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

export class TeamResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty({ format: 'uuid' })
  institutionId!: string;

  @ApiProperty()
  identification!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'O orientador responsável corrente (RF-EQP-005).',
  })
  responsibleAdvisorId!: string | null;

  @ApiProperty({ description: 'Integrantes ativos; as vagas são o tamanho máximo menos este.' })
  activeMemberCount!: number;
}

export class CreateTeamRequest {
  @ApiProperty()
  identification!: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 300,
    description: 'Título com que o artigo da equipe nasce.',
  })
  articleTitle?: string | null;
}

export class MemberResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  teamId!: string;

  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({
    enum: ['ACTIVE', 'REMOVED'],
    description: 'A remoção encerra a participação; ela não desaparece da equipe.',
  })
  status!: string;

  @ApiProperty({ enum: ['LEADER', 'AUTHOR', 'COAUTHOR'] })
  role!: string;

  @ApiProperty({ format: 'date-time' })
  joinedAt!: Date;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  leftAt!: Date | null;
}

export class TeamInvitationResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  teamId!: string;

  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED'] })
  status!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;
}

export class InviteMemberRequest {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}

/** O identificador do aluno elegível. A consulta devolve identificadores, não perfis. */
export class EligibleStudentResponse {
  @ApiProperty({ format: 'uuid' })
  userId!: string;
}

export class SetMemberRoleRequest {
  @ApiProperty({ enum: ['LEADER', 'AUTHOR', 'COAUTHOR'] })
  role!: string;
}

export const setMemberRoleSchema = z.object({ role: z.enum(['LEADER', 'AUTHOR', 'COAUTHOR']) });

export const createTeamSchema = z.object({
  identification: z.string(),
  articleTitle: z.string().trim().max(300).nullable().optional(),
});

export const inviteMemberSchema = z.object({
  userId: z.string().uuid(),
  expiresAt: z.coerce.date(),
});
