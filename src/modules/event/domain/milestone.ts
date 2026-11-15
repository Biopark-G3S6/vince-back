import type { FieldViolation } from './failure';

export const MILESTONE_NAME_MAX_LENGTH = 200;

export interface Milestone {
  readonly id: string;
  readonly eventId: string;
  readonly name: string;
  readonly order: number;
  readonly dueAt: Date;
}

export interface MilestoneDraft {
  readonly name?: string;
  readonly order?: number;
  readonly dueAt?: Date;
}

function nameViolation(value: string | undefined, violations: FieldViolation[]): void {
  const normalized = value?.trim() ?? '';

  if (normalized.length === 0) {
    violations.push({ field: 'name', code: 'REQUIRED' });
  } else if (normalized.length > MILESTONE_NAME_MAX_LENGTH) {
    violations.push({ field: 'name', code: 'TOO_LONG' });
  }
}

function orderViolation(value: number | undefined, violations: FieldViolation[]): void {
  if (value === undefined) {
    violations.push({ field: 'order', code: 'REQUIRED' });
  } else if (!Number.isInteger(value) || value <= 0) {
    violations.push({ field: 'order', code: 'NOT_POSITIVE' });
  }
}

function dueAtViolation(value: Date | undefined, violations: FieldViolation[]): void {
  if (value === undefined) {
    violations.push({ field: 'dueAt', code: 'REQUIRED' });
  } else if (!Number.isFinite(value.getTime())) {
    violations.push({ field: 'dueAt', code: 'MALFORMED' });
  }
}

export function violationsOfDraft(draft: MilestoneDraft): FieldViolation[] {
  const violations: FieldViolation[] = [];

  nameViolation(draft.name, violations);
  orderViolation(draft.order, violations);
  dueAtViolation(draft.dueAt, violations);

  return violations;
}

export function violationsOfUpdate(draft: MilestoneDraft): FieldViolation[] {
  const violations: FieldViolation[] = [];

  if (draft.name !== undefined) {
    nameViolation(draft.name, violations);
  }
  if (draft.order !== undefined) {
    orderViolation(draft.order, violations);
  }
  if (draft.dueAt !== undefined) {
    dueAtViolation(draft.dueAt, violations);
  }

  return violations;
}

export function milestoneOf(
  id: string,
  eventId: string,
  draft: Required<MilestoneDraft>,
): Milestone {
  return { id, eventId, name: draft.name.trim(), order: draft.order, dueAt: draft.dueAt };
}

export function withChanges(milestone: Milestone, draft: MilestoneDraft): Milestone {
  return {
    ...milestone,
    name: draft.name?.trim() ?? milestone.name,
    order: draft.order ?? milestone.order,
    dueAt: draft.dueAt ?? milestone.dueAt,
  };
}

/**
 * O cronograma é coerente? (RF-EVT-002 RN2, `ADR-0032` §10.)
 *
 * A conferência é do **conjunto**, e não da etapa que chega: inserir uma etapa no meio da
 * sequência pode quebrar a ordem sem que nada de errado exista na etapa informada. O
 * caso de uso monta o cronograma candidato — com a etapa acrescentada, alterada ou
 * removida — e pergunta por ele.
 *
 * `scheduleConflicts` ordena por `order` e exige que o prazo **cresça estritamente**.
 * Prazo igual ao da etapa precedente é conflito: duas entregas no mesmo instante não
 * estabelecem sequência alguma.
 */
export function scheduleConflicts(milestones: readonly Milestone[]): boolean {
  const ordered = [...milestones].sort((left, right) => left.order - right.order);

  return ordered.some(
    (milestone, index) =>
      index > 0 && milestone.dueAt.getTime() <= (ordered[index - 1] as Milestone).dueAt.getTime(),
  );
}

/**
 * A etapa já iniciada não é removível (RF-EVT-002 E2, `ADR-0032` §18).
 *
 * _Leitura declarada:_ a etapa guarda **prazo**, e não início. "Já iniciou" é lido aqui
 * como "o seu prazo já passou" — a etapa aconteceu, e é a ela que entregas e apontamentos
 * do ciclo de correção se prendem (RF-EVT-002 RN3). A leitura alternativa, "começou quando
 * venceu a etapa anterior", tornaria a primeira etapa imutável no instante seguinte à
 * criação do evento, e o cronograma é justamente o que se ajusta no início do período.
 */
export function hasStarted(milestone: Milestone, now: Date): boolean {
  return milestone.dueAt.getTime() <= now.getTime();
}

/**
 * A etapa corrente: a primeira cujo prazo ainda não passou.
 *
 * `null` quando o cronograma está vazio ou inteiramente vencido — e a ausência é
 * resposta, não falha: um evento sem cronograma é consultável.
 */
export function currentMilestone(milestones: readonly Milestone[], now: Date): Milestone | null {
  const ordered = [...milestones].sort((left, right) => left.order - right.order);

  return ordered.find((milestone) => milestone.dueAt.getTime() > now.getTime()) ?? null;
}
