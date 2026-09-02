import { Injectable } from '@nestjs/common';

import { CredentialRepository } from '../domain/ports/credential-repository';
import { PasswordHasher } from '../domain/ports/password-hasher';
import { UserRepository } from '../domain/ports/user-repository';
import { normalizeEmail } from '../domain/user';

/**
 * A verificação da credencial de autenticação (RF-ACS-001).
 *
 * **Devolve o identificador da conta, ou `null`** — e `null` é a única resposta negativa
 * que existe. Conta inexistente, senha errada, conta desativada e conta sem senha definida
 * são o mesmo `null`, porque RF-ACS-001 E1 e E2 exigem resposta indistinguível e a spec
 * estende a exigência à conta sem senha.
 *
 * **A indistinguibilidade é também de tempo** (decisão D6). O método deriva **exatamente
 * uma vez** em todos os caminhos: quando não há conta ou não há senha definida, deriva
 * contra a referência. Sair antes economizaria o trabalho e entregaria, pelo relógio, a
 * existência da conta — que é a informação que o texto da resposta se esforça por esconder.
 *
 * Repare que a verificação de `active` acontece **depois** da derivação, e não antes: é a
 * mesma razão. A ordem aqui não é estilo.
 */
@Injectable()
export class VerifyCredentialUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly credentials: CredentialRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(email: string, password: string): Promise<string | null> {
    const account = await this.users.findByEmail(normalizeEmail(email));
    const hash = account === null ? null : await this.credentials.findHash(account.id);

    const matches =
      hash === null
        ? await this.hasher.verifyAgainstReference(password)
        : await this.hasher.verify(hash, password);

    if (account === null || !account.active || !matches) {
      return null;
    }

    return account.id;
  }
}
