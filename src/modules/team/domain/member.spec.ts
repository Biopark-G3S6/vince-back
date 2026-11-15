import { describe, expect, it } from 'vitest';

import { isActiveMember, memberOf, removed } from './member';

describe('regras de participação', () => {
  const joinedAt = new Date('2026-03-01T00:00:00.000Z');
  const leftAt = new Date('2026-04-01T00:00:00.000Z');

  it('nasce ativa, sem saída registrada', () => {
    const member = memberOf('member-id', 'event-id', 'team-id', 'user-id', joinedAt);

    expect(member).toEqual({
      id: 'member-id',
      eventId: 'event-id',
      teamId: 'team-id',
      userId: 'user-id',
      status: 'ACTIVE',
      joinedAt,
      leftAt: null,
    });
    expect(isActiveMember(member)).toBe(true);
  });

  it('a remoção encerra a participação e preserva a entrada', () => {
    const member = removed(
      memberOf('member-id', 'event-id', 'team-id', 'user-id', joinedAt),
      leftAt,
    );

    expect(member).toMatchObject({ status: 'REMOVED', joinedAt, leftAt });
    expect(isActiveMember(member)).toBe(false);
  });
});
