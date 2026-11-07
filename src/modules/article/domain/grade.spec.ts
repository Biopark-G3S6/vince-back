import { describe, expect, it } from 'vitest';

import { GRADE_MAX, GRADE_MIN, violationsOfGrade } from './grade';

describe('regras de nota', () => {
  it('aceita os extremos da faixa e as duas casas decimais', () => {
    for (const value of [GRADE_MIN, GRADE_MAX, 7.5, 8.25, 0.01]) {
      expect(violationsOfGrade(value)).toEqual([]);
    }
  });

  it('recusa nota ausente', () => {
    expect(violationsOfGrade(undefined)).toEqual([{ field: 'value', code: 'REQUIRED' }]);
  });

  it('recusa nota fora da faixa', () => {
    expect(violationsOfGrade(-0.5)).toEqual([{ field: 'value', code: 'OUT_OF_RANGE' }]);
    expect(violationsOfGrade(10.5)).toEqual([{ field: 'value', code: 'OUT_OF_RANGE' }]);
  });

  it('recusa precisão além da escala', () => {
    expect(violationsOfGrade(7.123)).toEqual([{ field: 'value', code: 'TOO_PRECISE' }]);
  });

  it('recusa o que não é número', () => {
    expect(violationsOfGrade(Number.NaN)).toEqual([{ field: 'value', code: 'MALFORMED' }]);
    expect(violationsOfGrade(Number.POSITIVE_INFINITY)).toEqual([
      { field: 'value', code: 'MALFORMED' },
    ]);
  });
});
