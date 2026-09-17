import { VIOLATION, type FieldViolation } from './failure';

export interface Course {
  readonly id: string;
  readonly institutionId: string;
  readonly name: string;
  readonly identification: string;
  readonly active: boolean;
  readonly coordinatorId: string | null;
}

export interface CourseState {
  readonly exists: boolean;
  readonly active: boolean;
  readonly institutionId: string | null;
}

export interface CourseDraft {
  readonly name?: string;
  readonly identification?: string;
}

export const NAME_MAX_LENGTH = 200;
export const IDENTIFICATION_MAX_LENGTH = 100;

export function normalizeIdentification(raw: string): string {
  return raw.trim().toUpperCase();
}

function validateText(
  field: 'name' | 'identification',
  value: string | undefined,
  maxLength: number,
  into: FieldViolation[],
  normalize: (raw: string) => string,
): void {
  const normalized = normalize(value ?? '');

  if (normalized.length === 0) {
    into.push({ field, code: VIOLATION.REQUIRED });
  } else if (normalized.length > maxLength) {
    into.push({ field, code: VIOLATION.TOO_LONG });
  }
}

export function violationsOfDraft(draft: CourseDraft): FieldViolation[] {
  const violations: FieldViolation[] = [];

  validateText('name', draft.name, NAME_MAX_LENGTH, violations, (value) => value.trim());
  validateText(
    'identification',
    draft.identification,
    IDENTIFICATION_MAX_LENGTH,
    violations,
    normalizeIdentification,
  );

  return violations;
}

export function violationsOfUpdate(draft: CourseDraft): FieldViolation[] {
  const violations: FieldViolation[] = [];

  if (draft.name !== undefined) {
    validateText('name', draft.name, NAME_MAX_LENGTH, violations, (value) => value.trim());
  }

  if (draft.identification !== undefined) {
    validateText(
      'identification',
      draft.identification,
      IDENTIFICATION_MAX_LENGTH,
      violations,
      normalizeIdentification,
    );
  }

  return violations;
}

export function courseOf(id: string, institutionId: string, draft: Required<CourseDraft>): Course {
  return {
    id,
    institutionId,
    name: draft.name.trim(),
    identification: normalizeIdentification(draft.identification),
    active: true,
    coordinatorId: null,
  };
}

export function withChanges(course: Course, draft: CourseDraft): Course {
  return {
    ...course,
    name: draft.name === undefined ? course.name : draft.name.trim(),
    identification:
      draft.identification === undefined
        ? course.identification
        : normalizeIdentification(draft.identification),
  };
}

export function deactivated(course: Course): Course {
  return { ...course, active: false };
}
