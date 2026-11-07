export const MEMBER_STATUS = {
  ACTIVE: 'ACTIVE',
  REMOVED: 'REMOVED',
} as const;

export type MemberStatus = (typeof MEMBER_STATUS)[keyof typeof MEMBER_STATUS];

/**
 * A participação do aluno na equipe.
 *
 * A remoção **encerra** a linha, e não a apaga (`ADR-0033` §9): a contribuição já
 * registrada no artigo aponta para esta participação, e apagá-la deixaria a nota
 * individual sem referente.
 */
export interface TeamMember {
  readonly id: string;
  readonly eventId: string;
  readonly teamId: string;
  readonly userId: string;
  readonly status: MemberStatus;
  readonly joinedAt: Date;
  readonly leftAt: Date | null;
}

export function memberOf(
  id: string,
  eventId: string,
  teamId: string,
  userId: string,
  joinedAt = new Date(),
): TeamMember {
  return {
    id,
    eventId,
    teamId,
    userId,
    status: MEMBER_STATUS.ACTIVE,
    joinedAt,
    leftAt: null,
  };
}

export function removed(member: TeamMember, leftAt = new Date()): TeamMember {
  return { ...member, status: MEMBER_STATUS.REMOVED, leftAt };
}

export function isActiveMember(member: TeamMember): boolean {
  return member.status === MEMBER_STATUS.ACTIVE;
}
