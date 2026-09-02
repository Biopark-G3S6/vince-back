import { Injectable } from '@nestjs/common';

import {
  FAILURE,
  VIOLATION,
  fail,
  failValidation,
  ok,
  type FieldViolation,
  type Result,
} from '../domain/failure';
import { hashInvitationToken, INVITATION_PURPOSE } from '../domain/invitation';
import { violationsOfPassword } from '../domain/password';
import { CredentialRepository } from '../domain/ports/credential-repository';
import { InvitationRepository } from '../domain/ports/invitation-repository';
import { PasswordHasher } from '../domain/ports/password-hasher';

/**
 * A definição de senha por meio de redefinição (RF-ACS-004 RN1, RF-ACS-003).
 *
 * **Não exige a senha atual**: quem chega por aqui é justamente quem não a tem. É por isso
 * que o meio é de uso único e tem prazo — ele é, enquanto vale, equivalente à senha.
 *
 * Meio desconhecido, expirado e já utilizado produzem o mesmo `INVITATION_EXPIRED`
 * (RF-ACS-003 E2, RF-ACS-004 E3), sem distinção: distinguir "não existe" de "expirou"
 * transformaria o endpoint em confirmador de meios válidos.
 *
 * A validação da política vem **antes** do consumo, e a ordem importa: senha fora da
 * política com meio válido devolve `VALIDATION_FAILED` **sem queimar o meio**, e a pessoa
 * tenta de novo com o mesmo link em vez de pedir outro.
 */
@Injectable()
export class ResetPasswordUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly credentials: CredentialRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(
    token: string | undefined,
    password: string | undefined,
  ): Promise<Result<{ readonly userId: string }>> {
    const violations: FieldViolation[] = [];

    if (token === undefined || token.length === 0) {
      violations.push({ field: 'token', code: VIOLATION.REQUIRED });
    }

    violations.push(...violationsOfPassword(password, 'password'));

    if (violations.length > 0 || token === undefined || password === undefined) {
      return failValidation(violations);
    }

    const userId = await this.invitations.consume(
      hashInvitationToken(token),
      INVITATION_PURPOSE.PASSWORD_RESET,
      new Date(),
    );

    if (userId === null) {
      return fail(FAILURE.INVITATION_EXPIRED);
    }

    await this.credentials.save(userId, await this.hasher.hash(password));

    return ok({ userId });
  }
}
