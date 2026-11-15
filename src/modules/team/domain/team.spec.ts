import { describe, expect, it } from 'vitest';

import { hasMemberSlot, hasTeamSlot, teamOf, violationsOfDraft } from './team';

describe('regras de equipe', () => {
  it('exige identificação', () => {
    expect(violationsOfDraft({ identification: '   ' })).toEqual([
      { field: 'identification', code: 'REQUIRED' },
    ]);
    expect(violationsOfDraft({})).toEqual([{ field: 'identification', code: 'REQUIRED' }]);
  });

  it('recusa identificação longa demais', () => {
    expect(violationsOfDraft({ identification: 'x'.repeat(101) })).toEqual([
      { field: 'identification', code: 'TOO_LONG' },
    ]);
  });

  it('apara a identificação, guarda o evento e a instituição, e nasce sem responsável', () => {
    expect(
      teamOf('team-id', 'event-id', 'institution-id', { identification: '  Equipe A  ' }),
    ).toEqual({
      id: 'team-id',
      eventId: 'event-id',
      institutionId: 'institution-id',
      identification: 'Equipe A',
      responsibleAdvisorId: null,
    });
  });

  it('a vaga existe enquanto o uso é menor que o limite', () => {
    expect(hasTeamSlot(3, 4)).toBe(true);
    expect(hasTeamSlot(4, 4)).toBe(false);
    expect(hasMemberSlot(1, 2)).toBe(true);
    expect(hasMemberSlot(2, 2)).toBe(false);
  });
});
