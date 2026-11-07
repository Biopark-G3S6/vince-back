import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * A faixa de nota e os tipos de veículo, para a especificação OpenAPI.
 *
 * A autoridade sobre os dois é o domínio, e a restrição de verificação da migração é quem
 * os impõe no banco. A borda não pode importar de `domain` (`ADR-0003` §5), e repetir aqui
 * os limites é o preço — menor do que abrir a fronteira para que a documentação os leia.
 */
const GRADE_MIN = 0;
const GRADE_MAX = 10;
const PUBLICATION_KINDS = ['EVENT', 'JOURNAL'] as const;

export class ArticleResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  teamId!: string;

  @ApiProperty({ format: 'uuid' })
  eventId!: string;

  @ApiProperty({ format: 'uuid' })
  institutionId!: string;

  @ApiProperty({ enum: ['STARTED', 'IN_PROGRESS', 'IN_REVIEW', 'FINISHED'] })
  status!: string;
}

export class MilestoneSummaryResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  order!: number;

  @ApiProperty({ format: 'date-time' })
  dueAt!: Date;
}

export class GradeResponse {
  @ApiProperty({ minimum: GRADE_MIN, maximum: GRADE_MAX })
  value!: number;

  @ApiProperty({ format: 'uuid', description: 'Quem registrou a avaliação.' })
  authorId!: string;

  @ApiProperty({ format: 'date-time' })
  recordedAt!: Date;
}

export class MemberGradeResponse extends GradeResponse {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ description: 'A participação estava ativa quando a nota foi registrada.' })
  memberActive!: boolean;
}

/** A situação do artigo: estado, etapa corrente e nota corrente (RF-ART-001). */
export class ArticleSituationResponse {
  @ApiProperty({ type: ArticleResponse })
  article!: ArticleResponse;

  @ApiPropertyOptional({ type: MilestoneSummaryResponse, nullable: true })
  currentMilestone!: MilestoneSummaryResponse | null;

  @ApiPropertyOptional({ type: GradeResponse, nullable: true })
  grade!: GradeResponse | null;
}

export class GradeRequest {
  @ApiProperty({ minimum: GRADE_MIN, maximum: GRADE_MAX })
  value!: number;
}

export class PublicationResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  articleId!: string;

  @ApiProperty({ description: 'O nome do evento científico ou do periódico.' })
  venue!: string;

  @ApiProperty({ enum: PUBLICATION_KINDS })
  kind!: string;

  @ApiProperty({ format: 'date-time' })
  publishedAt!: Date;

  @ApiProperty({ format: 'uri' })
  url!: string;

  @ApiProperty({ format: 'uuid' })
  authorId!: string;
}

export class CreatePublicationRequest {
  @ApiProperty()
  venue!: string;

  @ApiProperty({ enum: PUBLICATION_KINDS })
  kind!: string;

  @ApiProperty({ format: 'date-time' })
  publishedAt!: string;

  @ApiProperty({ format: 'uri' })
  url!: string;
}

export class UpdatePublicationRequest {
  @ApiPropertyOptional()
  venue?: string;

  @ApiPropertyOptional({ enum: PUBLICATION_KINDS })
  kind?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  publishedAt?: string;

  @ApiPropertyOptional({ format: 'uri' })
  url?: string;
}

export const gradeSchema = z.object({ value: z.number() });

export const createPublicationSchema = z.object({
  venue: z.string(),
  kind: z.string(),
  publishedAt: z.coerce.date(),
  url: z.string(),
});

export const updatePublicationSchema = z.object({
  venue: z.string().optional(),
  kind: z.string().optional(),
  publishedAt: z.coerce.date().optional(),
  url: z.string().optional(),
});
