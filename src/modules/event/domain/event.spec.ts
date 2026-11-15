import { describe, expect, it } from 'vitest';

import {
  EVENT_SCOPE,
  cancelled,
  eventOf,
  isActive,
  isEventScopeType,
  violationsOfDraft,
  violationsOfUpdate,
  withChanges,
  type Event,
} from './event';

const ORIGIN = {
  id: 'event-id',
  institutionId: 'institution-id',
  courseId: 'course-id',
  scopeType: EVENT_SCOPE.COHORT,
  scopeId: 'cohort-id',
  ownerId: 'owner-id',
} as const;

const DRAFT = {
  title: '  Congresso interno  ',
  theme: 'Tema',
  researchProblem: 'Problema',
  objectives: 'Objetivos',
  maxTeams: 10,
  maxTeamSize: 5,
} as const;

function eventWithUsage(teamsInUse: number, largestTeamSize: number): Event {
  return { ...eventOf(ORIGIN, DRAFT), teamsInUse, largestTeamSize };
}

describe('regras de evento', () => {
  it('exige texto e limites positivos', () => {
    expect(
      violationsOfDraft({
        title: '',
        theme: '   ',
        researchProblem: 'Problema',
        objectives: 'Objetivos',
        maxTeams: 0,
        maxTeamSize: -1,
      }),
    ).toEqual([
      { field: 'title', code: 'REQUIRED' },
      { field: 'theme', code: 'REQUIRED' },
      { field: 'maxTeams', code: 'NOT_POSITIVE' },
      { field: 'maxTeamSize', code: 'NOT_POSITIVE' },
    ]);
  });

  it('recusa limite ausente e limite fracionário', () => {
    expect(violationsOfDraft({ ...DRAFT, maxTeams: undefined, maxTeamSize: 2.5 })).toEqual([
      { field: 'maxTeams', code: 'REQUIRED' },
      { field: 'maxTeamSize', code: 'NOT_POSITIVE' },
    ]);
  });

  it('nasce ativo, sem uso e com o texto aparado', () => {
    expect(eventOf(ORIGIN, DRAFT)).toEqual({
      ...ORIGIN,
      title: 'Congresso interno',
      theme: 'Tema',
      researchProblem: 'Problema',
      objectives: 'Objetivos',
      maxTeams: 10,
      maxTeamSize: 5,
      teamsInUse: 0,
      largestTeamSize: 0,
      status: 'ACTIVE',
    });
  });

  it('recusa reduzir o limite abaixo do uso projetado', () => {
    const event = eventWithUsage(4, 3);

    expect(violationsOfUpdate({ maxTeams: 3, maxTeamSize: 2 }, event)).toEqual([
      { field: 'maxTeams', code: 'BELOW_USAGE' },
      { field: 'maxTeamSize', code: 'BELOW_USAGE' },
    ]);
  });

  it('aceita reduzir até o uso corrente, e não abaixo dele', () => {
    const event = eventWithUsage(4, 3);

    expect(violationsOfUpdate({ maxTeams: 4, maxTeamSize: 3 }, event)).toEqual([]);
  });

  it('não confere o campo que a alteração não informou', () => {
    const event = eventWithUsage(4, 3);

    expect(violationsOfUpdate({ title: 'Outro título' }, event)).toEqual([]);
  });

  it('preserva escopo e ancestralidade na alteração', () => {
    const event = eventOf(ORIGIN, DRAFT);
    const changed = withChanges(event, { title: ' Novo ', maxTeams: 20 });

    expect(changed).toMatchObject({
      scopeType: EVENT_SCOPE.COHORT,
      scopeId: 'cohort-id',
      institutionId: 'institution-id',
      courseId: 'course-id',
      title: 'Novo',
      maxTeams: 20,
      maxTeamSize: 5,
    });
  });

  it('cancela sem apagar o evento', () => {
    const event = eventOf(ORIGIN, DRAFT);
    const dead = cancelled(event);

    expect(isActive(event)).toBe(true);
    expect(isActive(dead)).toBe(false);
    expect(dead.title).toBe(event.title);
  });

  it('reconhece apenas os três tipos de escopo', () => {
    expect(['INSTITUTION', 'COURSE', 'COHORT'].every(isEventScopeType)).toBe(true);
    expect(isEventScopeType('TEAM')).toBe(false);
  });
});
