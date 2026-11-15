import type { FieldViolation } from './failure';

export const EVENT_TITLE_MAX_LENGTH = 200;
export const EVENT_THEME_MAX_LENGTH = 200;
export const EVENT_TEXT_MAX_LENGTH = 4000;

/**
 * O escopo do evento (`ADR-0032` §8).
 *
 * É o par tipo + identificador, e não três entidades: o ciclo de vida, o cronograma e a
 * autorização do evento são os mesmos nos três casos, e o que muda é apenas de quem se
 * pergunta pelo alvo e pela elegibilidade.
 */
export const EVENT_SCOPE = {
  INSTITUTION: 'INSTITUTION',
  COURSE: 'COURSE',
  COHORT: 'COHORT',
} as const;

export type EventScopeType = (typeof EVENT_SCOPE)[keyof typeof EVENT_SCOPE];

export const EVENT_STATUS = {
  ACTIVE: 'ACTIVE',
  CANCELLED: 'CANCELLED',
} as const;

export type EventStatus = (typeof EVENT_STATUS)[keyof typeof EVENT_STATUS];

export function isEventScopeType(value: string): value is EventScopeType {
  return (
    value === EVENT_SCOPE.INSTITUTION ||
    value === EVENT_SCOPE.COURSE ||
    value === EVENT_SCOPE.COHORT
  );
}

export interface Event {
  readonly id: string;
  readonly institutionId: string;
  /** Ancestralidade derivada do alvo (`ADR-0032` §9). Nula no escopo institucional. */
  readonly courseId: string | null;
  readonly scopeType: EventScopeType;
  readonly scopeId: string;
  readonly ownerId: string;
  readonly title: string;
  readonly theme: string;
  readonly researchProblem: string;
  readonly objectives: string;
  readonly maxTeams: number;
  readonly maxTeamSize: number;
  /** Projeção alimentada pelos fatos de `team` (`ADR-0032` §16), não guarda do limite. */
  readonly teamsInUse: number;
  readonly largestTeamSize: number;
  readonly status: EventStatus;
}

export interface EventDraft {
  readonly title?: string;
  readonly theme?: string;
  readonly researchProblem?: string;
  readonly objectives?: string;
  readonly maxTeams?: number;
  readonly maxTeamSize?: number;
}

type TextField = 'title' | 'theme' | 'researchProblem' | 'objectives';
type LimitField = 'maxTeams' | 'maxTeamSize';

const TEXT_LIMITS: Readonly<Record<TextField, number>> = {
  title: EVENT_TITLE_MAX_LENGTH,
  theme: EVENT_THEME_MAX_LENGTH,
  researchProblem: EVENT_TEXT_MAX_LENGTH,
  objectives: EVENT_TEXT_MAX_LENGTH,
};

const TEXT_FIELDS: readonly TextField[] = ['title', 'theme', 'researchProblem', 'objectives'];

function textViolation(
  field: TextField,
  value: string | undefined,
  violations: FieldViolation[],
): void {
  const normalized = value?.trim() ?? '';

  if (normalized.length === 0) {
    violations.push({ field, code: 'REQUIRED' });
  } else if (normalized.length > TEXT_LIMITS[field]) {
    violations.push({ field, code: 'TOO_LONG' });
  }
}

/**
 * O limite ausente, zero, negativo ou fracionário é o mesmo caso para a URS
 * (RF-EVT-001 E3): `VALIDATION_FAILED`. O código do campo é que distingue.
 */
function limitViolation(
  field: LimitField,
  value: number | undefined,
  violations: FieldViolation[],
): void {
  if (value === undefined) {
    violations.push({ field, code: 'REQUIRED' });
  } else if (!Number.isInteger(value) || value <= 0) {
    violations.push({ field, code: 'NOT_POSITIVE' });
  }
}

export function violationsOfDraft(draft: EventDraft): FieldViolation[] {
  const violations: FieldViolation[] = [];

  for (const field of TEXT_FIELDS) {
    textViolation(field, draft[field], violations);
  }

  limitViolation('maxTeams', draft.maxTeams, violations);
  limitViolation('maxTeamSize', draft.maxTeamSize, violations);

  return violations;
}

/**
 * A alteração (RF-EVT-001 E4).
 *
 * Só o campo informado é conferido — ausência significa "permanece" —, e a redução abaixo
 * do uso projetado é recusada. A projeção pode estar defasada; a guarda definitiva do
 * limite é a escrita condicional de quem possui a equipe (`ADR-0032` §17).
 */
export function violationsOfUpdate(draft: EventDraft, current: Event): FieldViolation[] {
  const violations: FieldViolation[] = [];

  for (const field of TEXT_FIELDS) {
    if (draft[field] !== undefined) {
      textViolation(field, draft[field], violations);
    }
  }

  if (draft.maxTeams !== undefined) {
    limitViolation('maxTeams', draft.maxTeams, violations);

    if (Number.isInteger(draft.maxTeams) && draft.maxTeams < current.teamsInUse) {
      violations.push({ field: 'maxTeams', code: 'BELOW_USAGE' });
    }
  }

  if (draft.maxTeamSize !== undefined) {
    limitViolation('maxTeamSize', draft.maxTeamSize, violations);

    if (Number.isInteger(draft.maxTeamSize) && draft.maxTeamSize < current.largestTeamSize) {
      violations.push({ field: 'maxTeamSize', code: 'BELOW_USAGE' });
    }
  }

  return violations;
}

export interface EventOrigin {
  readonly id: string;
  readonly institutionId: string;
  readonly courseId: string | null;
  readonly scopeType: EventScopeType;
  readonly scopeId: string;
  readonly ownerId: string;
}

export function eventOf(origin: EventOrigin, draft: Required<EventDraft>): Event {
  return {
    ...origin,
    title: draft.title.trim(),
    theme: draft.theme.trim(),
    researchProblem: draft.researchProblem.trim(),
    objectives: draft.objectives.trim(),
    maxTeams: draft.maxTeams,
    maxTeamSize: draft.maxTeamSize,
    teamsInUse: 0,
    largestTeamSize: 0,
    status: EVENT_STATUS.ACTIVE,
  };
}

export function withChanges(event: Event, draft: EventDraft): Event {
  return {
    ...event,
    title: draft.title?.trim() ?? event.title,
    theme: draft.theme?.trim() ?? event.theme,
    researchProblem: draft.researchProblem?.trim() ?? event.researchProblem,
    objectives: draft.objectives?.trim() ?? event.objectives,
    maxTeams: draft.maxTeams ?? event.maxTeams,
    maxTeamSize: draft.maxTeamSize ?? event.maxTeamSize,
  };
}

export function cancelled(event: Event): Event {
  return { ...event, status: EVENT_STATUS.CANCELLED };
}

export function isActive(event: Event): boolean {
  return event.status === EVENT_STATUS.ACTIVE;
}
