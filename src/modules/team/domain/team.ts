import type { FieldViolation } from './failure';

export const TEAM_IDENTIFICATION_MAX_LENGTH = 100;

export interface Team {
  readonly id: string;
  readonly eventId: string;
  readonly institutionId: string;
  readonly identification: string;
  /** O orientador responsável corrente (RF-EQP-005), ou `null`. */
  readonly responsibleAdvisorId: string | null;
}

export interface TeamDraft {
  readonly identification?: string;
}

export function violationsOfDraft(draft: TeamDraft): FieldViolation[] {
  const normalized = draft.identification?.trim() ?? '';

  if (normalized.length === 0) {
    return [{ field: 'identification', code: 'REQUIRED' }];
  }
  if (normalized.length > TEAM_IDENTIFICATION_MAX_LENGTH) {
    return [{ field: 'identification', code: 'TOO_LONG' }];
  }

  return [];
}

export function teamOf(
  id: string,
  eventId: string,
  institutionId: string,
  draft: Required<TeamDraft>,
): Team {
  return {
    id,
    eventId,
    institutionId,
    identification: draft.identification.trim(),
    // A equipe nasce sem responsável: a designação é do dono do escopo (RF-EQP-005).
    responsibleAdvisorId: null,
  };
}

/**
 * A vaga de equipe no evento.
 *
 * Função, e não método: a decisão é do evento, cujos limites este módulo apenas recebe.
 * A conferência definitiva acontece **dentro** da transação de escrita (`ADR-0033` §14) —
 * esta função é a regra, não a garantia.
 */
export function hasTeamSlot(teamsInUse: number, maxTeams: number): boolean {
  return teamsInUse < maxTeams;
}

export function hasMemberSlot(membersInUse: number, maxTeamSize: number): boolean {
  return membersInUse < maxTeamSize;
}
