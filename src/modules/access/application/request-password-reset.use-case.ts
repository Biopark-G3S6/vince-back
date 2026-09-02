import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import {
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiresAt,
  INVITATION_PURPOSE,
} from '../domain/invitation';
import { CredentialSettings } from '../domain/ports/credential-settings';
import { InvitationRepository } from '../domain/ports/invitation-repository';
import { PasswordHasher } from '../domain/ports/password-hasher';
import { UserRepository } from '../domain/ports/user-repository';
import { normalizeEmail } from '../domain/user';

/**
 * A solicitação de recuperação de acesso (RF-ACS-003).
 *
 * **Não revela se a conta existe** (RN2, E1), e a não revelação é de conteúdo *e* de
 * tempo. O conteúdo é responsabilidade de quem chama, que responde igual nos dois casos;
 * o tempo é responsabilidade daqui, e é por isso que o custo de uma derivação é gasto
 * **antes** de qualquer decisão (decisão D6). Sem esse piso, a diferença entre gravar um
 * convite e não gravar nada seria mensurável, e o endpoint viraria oráculo de contas.
 *
 * **O envio da mensagem não entra nesta mudança** e é a lacuna nomeada da proposta:
 * depende de correio eletrônico, que depende de outbox, relay, fila e catálogo de
 * mensagens — nada disso existe. O meio de redefinição é criado, consumido e expirado
 * corretamente, e **não chega ao destinatário**. Quem chama recebe o valor em texto puro
 * porque é a vertical de notificação que o entregará; ele NÃO DEVE ser devolvido em
 * resposta HTTP nem escrito em log.
 */
@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly invitations: InvitationRepository,
    private readonly hasher: PasswordHasher,
    private readonly settings: CredentialSettings,
  ) {}

  async execute(
    email: string,
  ): Promise<{ readonly token: string; readonly userId: string } | null> {
    const account = await this.users.findByEmail(normalizeEmail(email));
    const token = generateInvitationToken();

    await this.hasher.verifyAgainstReference(token);

    // Conta desativada não recebe meio de redefinição: ela não autenticaria de todo modo
    // (RF-ACS-001 E2), e emitir um seria abrir via de entrada para conta fechada.
    if (account === null || !account.active) {
      return null;
    }

    const now = new Date();

    await this.invitations.invalidateOutstanding(
      account.id,
      INVITATION_PURPOSE.PASSWORD_RESET,
      now,
    );

    await this.invitations.create({
      id: uuidv7(),
      userId: account.id,
      purpose: INVITATION_PURPOSE.PASSWORD_RESET,
      tokenHash: hashInvitationToken(token),
      expiresAt: invitationExpiresAt(now, this.settings.passwordResetTtlSeconds),
    });

    return { token, userId: account.id };
  }
}
