import { Injectable } from '@nestjs/common';

import { ApiFailure } from '../errors/api-failure';
import { StructuredLogger } from '../logging/logger';
import { CredentialVerifier } from './credential-verifier';
import { IdentityResolver, type AuthenticatedIdentity } from './identity';
import { InstitutionAccess } from './institution-access';
import { SessionStore, type Session, type SessionOrigin } from './session-store';

/**
 * O estabelecimento da sessão (RF-ACS-001, `ADR-0013`).
 *
 * **Regeneração do identificador** (`ADR-0013` §12): a sessão que a requisição portava é
 * destruída antes de a nova nascer. É o que impede a fixação de sessão — um atacante que
 * consiga plantar um identificador no navegador da vítima antes da entrada não fica com
 * ele válido depois dela.
 *
 * **Indistinguibilidade** (RF-ACS-001 E1, E2): senha errada, conta inexistente, conta
 * desativada e conta sem senha definida produzem a mesma resposta. O tempo também precisa
 * ser o mesmo, e essa metade é obrigação de quem implementa `CredentialVerifier`
 * (decisão D6).
 *
 * **`INSTITUTION_INACTIVE` só depois da credencial** (RF-ACS-001 E3, RF-INS-001 RN2,
 * `ADR-0028` §15): a ordem inversa transformaria o código de resposta em oráculo —
 * bastaria tentar um e-mail qualquer para descobrir se existe conta e a que instituição
 * ela pertence. Conceder a distinção a quem já provou a credencial não vaza nada.
 */
@Injectable()
export class AuthenticationService {
  private readonly logger = new StructuredLogger('shared');

  constructor(
    private readonly credentials: CredentialVerifier,
    private readonly identities: IdentityResolver,
    private readonly sessions: SessionStore,
    private readonly institutions: InstitutionAccess,
  ) {}

  async authenticate(
    email: string,
    password: string,
    origin: SessionOrigin,
    previousSessionId: string | null,
  ): Promise<{ readonly session: Session; readonly identity: AuthenticatedIdentity }> {
    const userId = await this.credentials.verify(email, password);

    if (userId === null) {
      this.logger.info('AUTHENTICATION_FAILED', { responseCode: 'AUTHENTICATION_FAILED' });

      throw new ApiFailure('AUTHENTICATION_FAILED');
    }

    // A credencial já foi provada. **Só agora** o motivo da recusa pode ser específico
    // sem virar oráculo de existência de conta.
    if (!(await this.institutions.allows(userId))) {
      this.logger.info('INSTITUTION_INACTIVE', { userId, responseCode: 'INSTITUTION_INACTIVE' });

      throw new ApiFailure('INSTITUTION_INACTIVE');
    }

    const identity = await this.identities.identityOf(userId);

    if (identity === null) {
      throw new ApiFailure('AUTHENTICATION_FAILED');
    }

    // A anterior cai antes de a nova existir: se a criação falhar, o usuário fica sem
    // sessão alguma, que é o estado seguro.
    if (previousSessionId !== null) {
      await this.sessions.destroy(previousSessionId);
    }

    const session = await this.sessions.create(userId, origin);

    this.logger.info('SESSION_ESTABLISHED', { userId, sessionId: session.id });

    return { session, identity };
  }

  /** Idempotente: encerrar sessão inexistente ou já expirada conclui bem (RF-ACS-002 E1). */
  async endSession(sessionId: string | null): Promise<void> {
    if (sessionId === null) {
      return;
    }

    await this.sessions.destroy(sessionId);

    this.logger.info('SESSION_ENDED', { sessionId });
  }

  async identityOf(userId: string): Promise<AuthenticatedIdentity> {
    const identity = await this.identities.identityOf(userId);

    if (identity === null) {
      throw new ApiFailure('AUTHENTICATION_FAILED');
    }

    return identity;
  }
}
