import { Injectable } from '@nestjs/common';

import { INITIAL_SYSTEM_ADMIN } from '../domain/initial-account';
import { normalizeEmail } from '../domain/user';
import { CreateUserUseCase } from './create-user.use-case';
import { UserRepository } from '../domain/ports/user-repository';

/** O que a carga fez com a conta inicial. `created: false` é reexecução. */
export interface SystemAdminSeedReport {
  readonly id: string;
  readonly created: boolean;
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
  ) {}

  async execute(): Promise<SystemAdminSeedReport> {
    const email = normalizeEmail(INITIAL_SYSTEM_ADMIN.email);
    const existing = await this.users.findByEmail(email);

    if (existing !== null) {
      return { id: existing.id, created: false };
    }

    const created = await this.createUser.execute({
      email,
      name: INITIAL_SYSTEM_ADMIN.name,
      roleCode: INITIAL_SYSTEM_ADMIN.roleCode,
      // Sem vínculo institucional e sem ator: a carga não tem quem a execute.
      institutionId: null,
      actorId: null,
    });

    if (!created.ok) {
      // A conta inicial é declarada aqui e não vem de entrada externa: falha só pode ser
      // defeito de declaração ou corrida com outra carga, e nenhuma das duas é resultado
      // que a carga possa relatar como normal.
      throw new Error(
        `A carga inicial não pôde criar a conta de \`${INITIAL_SYSTEM_ADMIN.roleCode}\`: ` +
          `${created.failure.code}.`,
      );
    }

    return { id: created.value.account.id, created: true };
  }
}
