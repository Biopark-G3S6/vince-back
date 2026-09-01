import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { FAILURE, fail, failValidation, ok, type Result } from '../domain/failure';
import { UserRepository, type UserAccountWithRoles } from '../domain/ports/user-repository';
import {
  acceptsLanguage,
  isKnownRole,
  normalizeEmail,
  normalizeOptionalText,
  violationsOfDraft,
  type UserAccount,
} from '../domain/user';

/** O que a criação recebe dos fluxos internos, antes de qualquer validação. */
export interface CreateUserInput {
  readonly email?: string;
  readonly name?: string;
  readonly roleCode?: string;
  readonly institutionId?: string | null;
  readonly expertiseArea?: string | null;
  readonly preferredLanguage?: string | null;
  readonly actorId?: string | null;
}

/**
 * Criação de conta pelos fluxos internos (RF-TUR-003, RF-TUR-005, carga inicial).
 *
 * Uma classe, um método público de execução (`ADR-0003` §8).
 *
 * A conta nasce **ativa e sem credencial definida**: a senha é dado de autenticação e
 * nasce em `add-session-authentication`. O identificador é UUIDv7 gerado pela aplicação
 * (`ADR-0018` §9, §10).
 *
 * Não invalida cache: o identificador é recém-gerado e nunca foi apurado antes, e a
 * apuração não guarda resultado de conta inexistente justamente para que isso valha.
 */
@Injectable()
export class CreateUserUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(input: CreateUserInput): Promise<Result<UserAccountWithRoles>> {
    const roleCode = input.roleCode?.trim() ?? '';

    const violations = violationsOfDraft({
      email: input.email,
      name: input.name,
      expertiseArea: input.expertiseArea,
      institutionId: input.institutionId,
      role: roleCode,
    });

    if (violations.length > 0) {
      return failValidation(violations);
    }

    // Papel informado mas inexistente é recurso que não existe, e não campo malformado:
    // `RESOURCE_NOT_FOUND`, como na atribuição de papel.
    if (!isKnownRole(roleCode)) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    if (!acceptsLanguage(input.preferredLanguage)) {
      return fail(FAILURE.LANGUAGE_NOT_SUPPORTED);
    }

    const account: UserAccount = {
      id: uuidv7(),
      email: normalizeEmail(input.email ?? ''),
      name: (input.name ?? '').trim(),
      expertiseArea: normalizeOptionalText(input.expertiseArea),
      preferredLanguage: normalizeOptionalText(input.preferredLanguage),
      active: true,
      institutionId: normalizeOptionalText(input.institutionId),
    };

    const created = await this.users.create({
      account,
      roleCode,
      actorId: normalizeOptionalText(input.actorId),
    });

    // `null` significa e-mail já registrado. Quem decide é o índice único, e não uma
    // consulta prévia: entre consultar e gravar cabe outra criação, e a corrida entre as
    // duas só o banco arbitra.
    return created === null ? fail(FAILURE.EMAIL_ALREADY_REGISTERED) : ok(created);
  }
}
