import type { FieldViolation } from './failure';

export const TEAM_INVITATION_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  REVOKED: 'REVOKED',
} as const;

export type TeamInvitationStatus =
  (typeof TEAM_INVITATION_STATUS)[keyof typeof TEAM_INVITATION_STATUS];

/**
 * O convite de integrante.
 *
 * É entidade **deste** módulo, e não o convite de ingresso de `access` (`ADR-0033` §21):
 * aquele cria conta, este pressupõe conta existente e aluno elegível.
 */
export interface TeamInvitation {
  readonly id: string;
  readonly eventId: string;
  readonly teamId: string;
  readonly userId: string;
  readonly status: TeamInvitationStatus;
  readonly expiresAt: Date;
}

export function violationsOfInvitation(expiresAt: Date | undefined, now: Date): FieldViolation[] {
  if (expiresAt === undefined) {
    return [{ field: 'expiresAt', code: 'REQUIRED' }];
  }
  if (!Number.isFinite(expiresAt.getTime())) {
    return [{ field: 'expiresAt', code: 'MALFORMED' }];
  }
  if (expiresAt.getTime() <= now.getTime()) {
    return [{ field: 'expiresAt', code: 'NOT_IN_FUTURE' }];
  }

  return [];
}

export function invitationOf(
  id: string,
  eventId: string,
  teamId: string,
  userId: string,
  expiresAt: Date,
): TeamInvitation {
  return { id, eventId, teamId, userId, status: TEAM_INVITATION_STATUS.PENDING, expiresAt };
}

/**
 * O convite expirou?
 *
 * A validade é avaliada no **instante do aceite** (`ADR-0033` §11), e não por rotina de
 * varredura: a varredura apenas antecipa limpeza, e entre a sua passagem e o aceite
 * caberia a janela em que o convite vencido ainda seria aceito.
 */
export function isExpired(invitation: TeamInvitation, now: Date): boolean {
  return invitation.expiresAt.getTime() <= now.getTime();
}

export function isPending(invitation: TeamInvitation): boolean {
  return invitation.status === TEAM_INVITATION_STATUS.PENDING;
}
