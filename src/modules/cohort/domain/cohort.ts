import type { FieldViolation } from './failure';

export const COHORT_IDENTIFICATION_MAX_LENGTH = 100;
export const COHORT_TERM_MAX_LENGTH = 100;

export interface Cohort {
  readonly id: string;
  readonly courseId: string;
  readonly identification: string;
  readonly term: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly active: boolean;
}

export interface CohortDraft {
  readonly identification?: string;
  readonly term?: string;
  readonly startsAt?: Date;
  readonly endsAt?: Date;
}

function textViolation(
  field: 'identification' | 'term',
  value: string | undefined,
  maxLength: number,
  violations: FieldViolation[],
): void {
  const normalized = value?.trim() ?? '';

  if (normalized.length === 0) {
    violations.push({ field, code: 'REQUIRED' });
  } else if (normalized.length > maxLength) {
    violations.push({ field, code: 'TOO_LONG' });
  }
}

function dateViolation(
  field: 'startsAt' | 'endsAt',
  value: Date | undefined,
  violations: FieldViolation[],
): void {
  if (value === undefined || !Number.isFinite(value.getTime())) {
    violations.push({ field, code: value === undefined ? 'REQUIRED' : 'MALFORMED' });
  }
}

export function violationsOfDraft(draft: CohortDraft): FieldViolation[] {
  const violations: FieldViolation[] = [];

  textViolation(
    'identification',
    draft.identification,
    COHORT_IDENTIFICATION_MAX_LENGTH,
    violations,
  );
  textViolation('term', draft.term, COHORT_TERM_MAX_LENGTH, violations);
  dateViolation('startsAt', draft.startsAt, violations);
  dateViolation('endsAt', draft.endsAt, violations);

  if (
    draft.startsAt !== undefined &&
    draft.endsAt !== undefined &&
    Number.isFinite(draft.startsAt.getTime()) &&
    Number.isFinite(draft.endsAt.getTime()) &&
    draft.endsAt.getTime() < draft.startsAt.getTime()
  ) {
    violations.push({ field: 'endsAt', code: 'MALFORMED' });
  }

  return violations;
}

export function violationsOfUpdate(draft: CohortDraft, current: Cohort): FieldViolation[] {
  const candidate = {
    identification: draft.identification ?? current.identification,
    term: draft.term ?? current.term,
    startsAt: draft.startsAt ?? current.startsAt,
    endsAt: draft.endsAt ?? current.endsAt,
  };
  const violations: FieldViolation[] = [];

  if (draft.identification !== undefined) {
    textViolation(
      'identification',
      candidate.identification,
      COHORT_IDENTIFICATION_MAX_LENGTH,
      violations,
    );
  }
  if (draft.term !== undefined) {
    textViolation('term', candidate.term, COHORT_TERM_MAX_LENGTH, violations);
  }
  if (draft.startsAt !== undefined) {
    dateViolation('startsAt', candidate.startsAt, violations);
  }
  if (draft.endsAt !== undefined) {
    dateViolation('endsAt', candidate.endsAt, violations);
  }
  if (candidate.endsAt.getTime() < candidate.startsAt.getTime()) {
    violations.push({ field: 'endsAt', code: 'MALFORMED' });
  }

  return violations;
}

export function cohortOf(id: string, courseId: string, draft: Required<CohortDraft>): Cohort {
  return {
    id,
    courseId,
    identification: draft.identification.trim().toUpperCase(),
    term: draft.term.trim(),
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    active: true,
  };
}

export function withChanges(cohort: Cohort, draft: CohortDraft): Cohort {
  return {
    ...cohort,
    identification:
      draft.identification === undefined
        ? cohort.identification
        : draft.identification.trim().toUpperCase(),
    term: draft.term === undefined ? cohort.term : draft.term.trim(),
    startsAt: draft.startsAt ?? cohort.startsAt,
    endsAt: draft.endsAt ?? cohort.endsAt,
  };
}

export function deactivated(cohort: Cohort): Cohort {
  return { ...cohort, active: false };
}
