import type { PageRequest } from '@shared/http/pagination';

import type {
  InvitationOperation,
  InvitationPurpose,
  InvitationRecord,
  InvitationState,
} from '../invitation';
import type { UserAccount } from '../user';
import type { UserAccountWithRoles } from './user-repository';

/** O que a emissão grava. O valor entregue ao usuário não está aqui — só a sua derivação. */
export interface NewInvitation {
  readonly id: string;
  readonly userId?: string;
  readonly purpose: InvitationPurpose;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly targetEmail?: string | null;
  readonly roleCode?: string | null;
  readonly institutionId?: string | null;
  readonly institutionName?: string | null;
  readonly actorId?: string | null;
  readonly maxUses?: number | null;
}

export interface NewInvitationAudit {
  readonly id: string;
  readonly invitationId: string;
  readonly actorId: string | null;
  readonly accountId: string | null;
  readonly roleCode: string;
  readonly institutionId: string;
  readonly institutionName: string;
  readonly operation: InvitationOperation;
}

export interface InvitationRows {
  readonly rows: readonly (InvitationRecord & { readonly state: InvitationState })[];
  readonly totalItems?: number;
}

export interface AccountCreationInput {
  readonly tokenHash: string;
  readonly now: Date;
  readonly account: UserAccount;
  readonly roleCode: string;
  readonly passwordHash: string;
  readonly actorId: string | null;
}

export type AccountCreationOutcome =
  | { readonly ok: true; readonly account: UserAccountWithRoles }
  | { readonly ok: false; readonly reason: 'EXPIRED' | 'REVOKED' | 'LIMIT_REACHED' }
  | { readonly ok: false; readonly reason: 'EMAIL_ALREADY_REGISTERED' };

/**
 * Port do convite (`ADR-0027` §5), de que o meio de redefinição de senha é um propósito.
 */
export abstract class InvitationRepository {
  abstract create(invitation: NewInvitation): Promise<void>;

  abstract createAccountInvitation(
    invitation: NewInvitation,
    audit: NewInvitationAudit,
  ): Promise<boolean>;

  abstract findForAcceptance(tokenHash: string): Promise<InvitationRecord | null>;

  abstract findPublic(tokenHash: string, now: Date): Promise<InvitationRecord | null>;

  abstract acceptAccountCreation(input: AccountCreationInput): Promise<AccountCreationOutcome>;

  abstract listAccountInvitations(
    institutionId: string,
    request: PageRequest,
  ): Promise<InvitationRows>;

  abstract revokeAccountInvitation(
    institutionId: string,
    invitationId: string,
    actorId: string,
    now: Date,
  ): Promise<void>;

  /**
   * Consome o meio e devolve a conta a que ele pertence, ou `null`.
   *
   * **`null` não distingue** desconhecido, expirado e já utilizado para redefinição de senha.
   * Convites de criação usam as operações específicas abaixo, que preservam a distinção exigida
   * entre revogado e esgotado na aceitação.
   *
   * O consumo é **uma operação**, e é o que garante o uso único: duas requisições
   * simultâneas com o mesmo meio disputam a mesma condição `usedAt IS NULL`, e o banco
   * decide. Ler e depois gravar deixaria a janela entre as duas.
   */
  abstract consume(
    tokenHash: string,
    purpose: InvitationPurpose,
    now: Date,
  ): Promise<string | null>;

  /**
   * Invalida os meios ainda vivos daquele propósito para a conta.
   *
   * A emissão de um meio novo derruba os anteriores: acumular meios válidos multiplica,
   * sem ganho algum, as vias de entrada abertas na conta.
   */
  abstract invalidateOutstanding(
    userId: string,
    purpose: InvitationPurpose,
    now: Date,
  ): Promise<void>;
}
