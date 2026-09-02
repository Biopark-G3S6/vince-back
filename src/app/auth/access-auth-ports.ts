import { Injectable } from '@nestjs/common';

import { CredentialVerifier } from '@shared/auth/credential-verifier';
import { IdentityResolver, type AuthenticatedIdentity } from '@shared/auth/identity';

import { AccessFacade } from '@modules/access/contracts/access.facade';

/**
 * A ligação entre os ports de `shared/` e o módulo `access` (decisão D1).
 *
 * Vive **aqui**, no composition root, e não podia viver em outro lugar: `shared/` não
 * importa de `modules/` (`ADR-0009` §7) e o módulo não conhece a borda; `app` é o único
 * que pode importar os dois, e é o que a configuração do ESLint já permitia
 * (`from: 'app', allow: ['app', 'shared', 'module-root', 'contracts']`).
 *
 * O acoplamento é **ao contrato**, não à implementação: o que estes adaptadores conhecem
 * de `access` é a fachada, que é a sua única superfície pública (`ADR-0027` §12).
 */

@Injectable()
export class AccessCredentialVerifier extends CredentialVerifier {
  constructor(private readonly access: AccessFacade) {
    super();
  }

  async verify(email: string, password: string): Promise<string | null> {
    return this.access.verifyCredential({ email, password });
  }
}

@Injectable()
export class AccessIdentityResolver extends IdentityResolver {
  constructor(private readonly access: AccessFacade) {
    super();
  }

  /**
   * O caminho crítico de toda requisição autenticada (`ADR-0014` §9).
   *
   * A fachada resolve com cache invalidado a cada alteração de papel ou de estado (§10),
   * e não por expiração: uma janela de validade seria exatamente o intervalo em que uma
   * permissão revogada continuaria valendo.
   */
  async permissionsOf(userId: string): Promise<readonly string[]> {
    const { permissions } = await this.access.effectivePermissions({ userId });

    return permissions;
  }

  /**
   * `findOwnProfile` recebe o mesmo identificador como ator e como alvo, o que é
   * literalmente verdade: quem consulta a própria identidade é o titular dela. A
   * verificação de titularidade do caso de uso passa, e continua existindo para quando o
   * chamador não for este.
   */
  async identityOf(userId: string): Promise<AuthenticatedIdentity | null> {
    const profile = await this.access.findOwnProfile({ actorId: userId, userId });

    if (!profile.ok) {
      return null;
    }

    const { permissions } = await this.access.effectivePermissions({ userId });

    return {
      userId: profile.value.id,
      email: profile.value.email,
      name: profile.value.name,
      preferredLanguage: profile.value.preferredLanguage,
      roles: profile.value.roleCodes,
      permissions,
    };
  }
}
