import type { InvitationPurpose } from '../invitation';

/** O que a emissão grava. O valor entregue ao usuário não está aqui — só a sua derivação. */
export interface NewInvitation {
  readonly id: string;
  readonly userId: string;
  readonly purpose: InvitationPurpose;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

/**
 * Port do convite (`ADR-0027` §5), de que o meio de redefinição de senha é um propósito.
 */
export abstract class InvitationRepository {
  abstract create(invitation: NewInvitation): Promise<void>;

  /**
   * Consome o meio e devolve a conta a que ele pertence, ou `null`.
   *
   * **`null` não distingue** desconhecido, expirado e já utilizado — a spec exige que os
   * três produzam `INVITATION_EXPIRED` sem diferença, e distinguir aqui dentro só criaria
   * a tentação de distinguir lá fora.
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
