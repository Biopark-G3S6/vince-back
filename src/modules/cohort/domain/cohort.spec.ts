import { describe, expect, it } from 'vitest';

import { cohortOf, violationsOfDraft, violationsOfUpdate } from './cohort';

describe('regras de turma', () => {
  const startsAt = new Date('2026-02-01T00:00:00.000Z');
  const endsAt = new Date('2026-06-30T00:00:00.000Z');

  it('exige identificação, período e intervalo válido', () => {
    expect(
      violationsOfDraft({
        identification: '',
        term: '',
        startsAt: endsAt,
        endsAt: startsAt,
      }),
    ).toEqual([
      { field: 'identification', code: 'REQUIRED' },
      { field: 'term', code: 'REQUIRED' },
      { field: 'endsAt', code: 'MALFORMED' },
    ]);
  });

  it('normaliza a identificação e preserva a turma ativa', () => {
    expect(
      cohortOf('cohort-id', 'course-id', {
        identification: '  turma a ',
        term: '2026/1',
        startsAt,
        endsAt,
      }),
    ).toEqual({
      id: 'cohort-id',
      courseId: 'course-id',
      identification: 'TURMA A',
      term: '2026/1',
      startsAt,
      endsAt,
      active: true,
    });
  });

  it('valida o intervalo completo ao alterar somente uma data', () => {
    const cohort = cohortOf('cohort-id', 'course-id', {
      identification: 'A',
      term: '2026/1',
      startsAt,
      endsAt,
    });

    expect(violationsOfUpdate({ endsAt: new Date('2026-01-01T00:00:00.000Z') }, cohort)).toEqual([
      { field: 'endsAt', code: 'MALFORMED' },
    ]);
  });
});
