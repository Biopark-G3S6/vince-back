import { describe, expect, it } from 'vitest';

import {
  currentMilestone,
  hasStarted,
  milestoneOf,
  scheduleConflicts,
  violationsOfDraft,
  violationsOfUpdate,
  type Milestone,
} from './milestone';

function milestone(order: number, iso: string): Milestone {
  return milestoneOf(`milestone-${order}`, 'event-id', {
    name: `Etapa ${order}`,
    order,
    dueAt: new Date(iso),
  });
}

describe('regras de etapa do cronograma', () => {
  const first = milestone(1, '2026-03-01T00:00:00.000Z');
  const second = milestone(2, '2026-04-01T00:00:00.000Z');
  const third = milestone(3, '2026-05-01T00:00:00.000Z');

  it('exige nome, ordem positiva e prazo', () => {
    expect(violationsOfDraft({ name: ' ', order: 0, dueAt: undefined })).toEqual([
      { field: 'name', code: 'REQUIRED' },
      { field: 'order', code: 'NOT_POSITIVE' },
      { field: 'dueAt', code: 'REQUIRED' },
    ]);
  });

  it('não confere o campo que a alteração não informou', () => {
    expect(violationsOfUpdate({ name: 'Nova etapa' })).toEqual([]);
  });

  it('aceita cronograma com prazos crescentes na ordem', () => {
    expect(scheduleConflicts([third, first, second])).toBe(false);
  });

  it('recusa prazo anterior ao da etapa precedente', () => {
    const outOfOrder = milestone(3, '2026-03-15T00:00:00.000Z');

    expect(scheduleConflicts([first, second, outOfOrder])).toBe(true);
  });

  it('recusa prazo igual ao da etapa precedente', () => {
    const tied = milestone(3, '2026-04-01T00:00:00.000Z');

    expect(scheduleConflicts([first, second, tied])).toBe(true);
  });

  it('não vê conflito em cronograma vazio nem de etapa única', () => {
    expect(scheduleConflicts([])).toBe(false);
    expect(scheduleConflicts([second])).toBe(false);
  });

  it('considera iniciada a etapa cujo prazo já passou', () => {
    const now = new Date('2026-03-15T00:00:00.000Z');

    expect(hasStarted(first, now)).toBe(true);
    expect(hasStarted(second, now)).toBe(false);
  });

  it('aponta como corrente a primeira etapa ainda não vencida', () => {
    const now = new Date('2026-03-15T00:00:00.000Z');

    expect(currentMilestone([third, first, second], now)?.id).toBe(second.id);
  });

  it('não tem etapa corrente quando o cronograma venceu por inteiro', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');

    expect(currentMilestone([first, second, third], now)).toBeNull();
    expect(currentMilestone([], now)).toBeNull();
  });
});
