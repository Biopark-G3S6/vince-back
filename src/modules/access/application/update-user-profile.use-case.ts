import { Injectable } from '@nestjs/common';

import { FAILURE, fail, failValidation, ok, type Result } from '../domain/failure';
import { UserRepository, type UserAccountWithRoles } from '../domain/ports/user-repository';
import { acceptsLanguage, violationsOfProfileUpdate, withProfile } from '../domain/user';

/**
 * O que a atualização recebe. Os campos protegidos entram declarados de propósito: sem
 * eles, a tentativa de alterá-los seria silenciosamente ignorada, e a spec exige que
 * seja recusada.
 */
export interface UpdateUserProfileInput {
  readonly actorId: string;
  readonly userId: string;
  readonly name?: string;
  readonly expertiseArea?: string | null;
  readonly preferredLanguage?: string | null;
  readonly email?: string;
  readonly roleCode?: string;
  readonly institutionId?: string | null;
  readonly active?: boolean;
}

/**
 * Atualização do perfil próprio (RF-ACS-005, RF-INT-001).
 *
 * A ordem das verificações é parte da regra, e não detalhe:
 *
 *   1. titularidade — quem não é o titular não altera nada, nem descobre o que existe;
 *   2. campo protegido — a tentativa recusa a operação **inteira**, e não apenas o campo,
 *      porque a spec exige que nenhum campo do perfil seja alterado;
 *   3. validação dos campos alteráveis;
 *   4. idioma, que tem código próprio no catálogo.
 *
 * Alterar o e-mail, os papéis ou os vínculos recusa com `PERMISSION_DENIED`, e não com
 * `VALIDATION_FAILED` (RF-ACS-005 E2, RN1): o campo existe e o valor pode até ser
 * válido — o que falta é autoridade.
 */
@Injectable()
export class UpdateUserProfileUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(input: UpdateUserProfileInput): Promise<Result<UserAccountWithRoles>> {
    if (input.actorId !== input.userId) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    if (
      input.email !== undefined ||
      input.roleCode !== undefined ||
      input.institutionId !== undefined ||
      input.active !== undefined
    ) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    const violations = violationsOfProfileUpdate(input);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    if (input.preferredLanguage !== undefined && !acceptsLanguage(input.preferredLanguage)) {
      return fail(FAILURE.LANGUAGE_NOT_SUPPORTED);
    }

    const found = await this.users.findWithRoles(input.userId);

    if (found === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const saved = await this.users.saveProfile(withProfile(found.account, input));

    return saved === null
      ? fail(FAILURE.RESOURCE_NOT_FOUND)
      : ok({ account: saved, roleCodes: found.roleCodes });
  }
}
