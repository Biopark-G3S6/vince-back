import { Injectable } from '@nestjs/common';

import { VIOLATION, failValidation, ok, type FieldViolation, type Result } from '../domain/failure';
import { violationsOfPassword } from '../domain/password';
import { CredentialRepository } from '../domain/ports/credential-repository';
import { PasswordHasher } from '../domain/ports/password-hasher';

/**
 * A alteração de senha por usuário autenticado (RF-ACS-004 RN1).
 *
 * Exige a senha atual, e a exigência não é cerimônia: sem ela, uma sessão sequestrada por
 * alguns segundos vira acesso permanente à conta.
 *
 * Senha atual ausente e senha atual incorreta produzem **ambas** `VALIDATION_FAILED`
 * (RF-ACS-004 E2), e não `AUTHENTICATION_FAILED`: quem chama já está autenticado — o que
 * falhou foi o campo.
 *
 * O encerramento das demais sessões (RN2) **não acontece aqui**: sessão é mecanismo
 * transversal de `shared/`, e `ADR-0013` §18 proíbe módulo de manipulá-la. Quem a encerra
 * é a borda, depois de esta operação concluir.
 */
@Injectable()
export class ChangePasswordUseCase {
  constructor(
    private readonly credentials: CredentialRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(
    userId: string,
    currentPassword: string | undefined,
    newPassword: string | undefined,
  ): Promise<Result<void>> {
    const violations: FieldViolation[] = [];

    if (currentPassword === undefined || currentPassword.length === 0) {
      violations.push({ field: 'currentPassword', code: VIOLATION.REQUIRED });
    }

    violations.push(...violationsOfPassword(newPassword, 'newPassword'));

    if (violations.length > 0 || currentPassword === undefined || newPassword === undefined) {
      return failValidation(violations);
    }

    const hash = await this.credentials.findHash(userId);

    // Conta sem senha definida não altera senha: ela **define** a primeira, e a via para
    // isso é o meio de redefinição (RF-ACS-004 RN1). Ainda assim deriva, pelo tempo.
    const matches =
      hash === null
        ? await this.hasher.verifyAgainstReference(currentPassword)
        : await this.hasher.verify(hash, currentPassword);

    if (!matches) {
      return failValidation([{ field: 'currentPassword', code: VIOLATION.INCORRECT }]);
    }

    await this.credentials.save(userId, await this.hasher.hash(newPassword));

    return ok(undefined);
  }
}
