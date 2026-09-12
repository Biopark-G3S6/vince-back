import { Injectable } from '@nestjs/common';

import { INITIAL_SYSTEM_ADMIN } from '../domain/initial-account';
import { normalizeEmail } from '../domain/user';
import { CreateUserUseCase } from './create-user.use-case';
import { UserRepository } from '../domain/ports/user-repository';
import { CredentialRepository } from '../domain/ports/credential-repository';
import { RequestPasswordResetUseCase } from './request-password-reset.use-case';

/** O que a carga fez com a conta inicial. `created: false` é reexecução. */
export interface SystemAdminSeedReport {
  readonly id: string;
  readonly created: boolean;
  readonly passwordResetUrl?: string;
}

/**
 * Carga inicial da conta de `SYSTEM_ADMIN` (URS §1.4.1, item 1).
 *
 * **Idempotente pelo e-mail**, e não por identificador fixo: o e-mail é o identificador
 * único global do sistema, e a chave primária é UUIDv7 gerado na criação
 * (`ADR-0018` §9, §10). Reencontrar o e-mail preserva o identificador já gravado, que é o
 * que o cenário "Reexecução da carga" exige.
 *
 * Precisa que o catálogo já esteja carregado: sem a linha de `role`, não há papel a
 * vincular (`ADR-0027`, implicação 4).
 */
@Injectable()
export class SeedSystemAdminUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly createUser: CreateUserUseCase,
    private readonly credentials: CredentialRepository,
    private readonly requestPasswordReset: RequestPasswordResetUseCase,
  ) {}

  async execute(): Promise<SystemAdminSeedReport> {
    const email = normalizeEmail(INITIAL_SYSTEM_ADMIN.email);
    const existing = await this.users.findByEmail(email);

    let accountId: string;
    let created: boolean;

    if (existing !== null) {
      accountId = existing.id;
      created = false;
    } else {
      const createdAccount = await this.createUser.execute({
        email,
        name: INITIAL_SYSTEM_ADMIN.name,
        roleCode: INITIAL_SYSTEM_ADMIN.roleCode,
        // Sem vínculo institucional e sem ator: a carga não tem quem a execute.
        institutionId: null,
        actorId: null,
      });

      if (!createdAccount.ok) {
        throw new Error(
          `A carga inicial não pôde criar a conta de \`${INITIAL_SYSTEM_ADMIN.roleCode}\`: ` +
            `${createdAccount.failure.code}.`,
        );
      }

      accountId = createdAccount.value.account.id;
      created = true;
    }

    if ((await this.credentials.findHash(accountId)) === null) {
      const issued = await this.requestPasswordReset.execute(email);

      if (issued === null) {
        throw new Error('A carga inicial não pôde emitir o meio de definição de senha.');
      }

      return {
        id: accountId,
        created,
        passwordResetUrl: `/password/reset?token=${issued.token}`,
      };
    }

    return { id: accountId, created };
  }
}
