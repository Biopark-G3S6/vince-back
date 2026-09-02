import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

import { PASSWORD_POLICY } from '../application/password-policy';

/**
 * Os DTOs da senha.
 *
 * A política aparece na especificação — é dela que o cliente deriva a validação que faz
 * antes de submeter —, mas **quem a aplica é o caso de uso**: validação de cliente é
 * conveniência, nunca garantia.
 */

export class ChangePasswordRequestDto {
  @ApiProperty({ format: 'password', description: 'Exigida por RF-ACS-004 RN1.' })
  currentPassword!: string;

  @ApiProperty({
    format: 'password',
    minLength: PASSWORD_POLICY.minLength,
    maxLength: PASSWORD_POLICY.maxLength,
  })
  newPassword!: string;
}

export class PasswordRecoveryRequestDto {
  @ApiProperty({ format: 'email' })
  email!: string;
}

export class ResetPasswordRequestDto {
  @ApiProperty({ description: 'O meio de redefinição recebido por correio eletrônico.' })
  token!: string;

  @ApiProperty({
    format: 'password',
    minLength: PASSWORD_POLICY.minLength,
    maxLength: PASSWORD_POLICY.maxLength,
  })
  password!: string;
}

/**
 * Os esquemas conferem **tipo**, e deixam a política ao caso de uso.
 *
 * `.optional()` em campo obrigatório é deliberado: a ausência precisa chegar ao caso de
 * uso para virar `VALIDATION_FAILED` apontando o campo (RF-ACS-004 E2), e não uma recusa
 * genérica de corpo malformado.
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
});

export const passwordRecoverySchema = z.object({
  email: z.string().trim().min(1).max(254),
});

export const resetPasswordSchema = z.object({
  token: z.string().optional(),
  password: z.string().optional(),
});
