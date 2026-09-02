import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

import { EMAIL_MAX_LENGTH } from './credential-limits';

/**
 * Os DTOs da autenticação e a sua validação.
 *
 * As duas metades ficam lado a lado de propósito: a classe é o que a especificação OpenAPI
 * publica — e de que o cliente deriva os seus tipos (`ADR-0017` §2) —, e o esquema é o que
 * o servidor de fato aceita. Separá-las em arquivos distintos é como uma passa a mentir
 * sobre a outra.
 */

export class AuthenticateRequestDto {
  @ApiProperty({ format: 'email', maxLength: EMAIL_MAX_LENGTH })
  email!: string;

  @ApiProperty({ format: 'password' })
  password!: string;
}

/**
 * A senha é validada **só quanto à presença** na autenticação: a política de comprimento
 * vale na definição e na alteração (RF-ACS-004 E1), e aplicá-la aqui recusaria, com
 * `VALIDATION_FAILED`, a senha legítima de quem a definiu antes de a política mudar — e
 * de quebra distinguiria, pelo código devolvido, senha curta de senha errada.
 */
export const authenticateSchema = z.object({
  email: z.string().trim().min(1).max(EMAIL_MAX_LENGTH),
  password: z.string().min(1),
});

export class IdentityDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Etiqueta BCP 47. Nula quando o usuário nunca escolheu: o cliente infere do ' +
      'navegador e recai no padrão (ADR-0026 §26).',
  })
  preferredLanguage!: string | null;

  @ApiProperty({ type: [String], description: 'Códigos de papel (URS §1.4).' })
  roles!: string[];

  @ApiProperty({
    type: [String],
    description:
      'Permissões efetivas, EXCLUSIVAMENTE para compor a interface (ADR-0013 §20). ' +
      'A ausência de uma permissão aqui não é o obstáculo à ação: o servidor verifica ' +
      'de novo, a cada requisição.',
  })
  permissions!: string[];
}
