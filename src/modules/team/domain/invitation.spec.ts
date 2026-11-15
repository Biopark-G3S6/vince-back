import { describe, expect, it } from 'vitest';

import { invitationOf, isExpired, isPending, violationsOfInvitation } from './invitation';

describe('regras de convite de equipe', () => {
  const now = new Date('2026-03-01T00:00:00.000Z');
  const future = new Date('2026-04-01T00:00:00.000Z');

  it('exige prazo de validade no futuro', () => {
    expect(violationsOfInvitation(undefined, now)).toEqual([
      { field: 'expiresAt', code: 'REQUIRED' },
    ]);
    expect(violationsOfInvitation(new Date('2026-02-01T00:00:00.000Z'), now)).toEqual([
      { field: 'expiresAt', code: 'NOT_IN_FUTURE' },
    ]);
    expect(violationsOfInvitation(now, now)).toEqual([
      { field: 'expiresAt', code: 'NOT_IN_FUTURE' },
    ]);
    expect(violationsOfInvitation(future, now)).toEqual([]);
  });

  it('nasce pendente e expira pelo instante consultado', () => {
    const invitation = invitationOf('invitation-id', 'event-id', 'team-id', 'user-id', future);

    expect(isPending(invitation)).toBe(true);
    expect(isExpired(invitation, now)).toBe(false);
    expect(isExpired(invitation, future)).toBe(true);
    expect(isExpired(invitation, new Date('2026-05-01T00:00:00.000Z'))).toBe(true);
  });
});
