export const TEAM_ADVISOR_STATUS = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
} as const;

export type TeamAdvisorStatus = (typeof TEAM_ADVISOR_STATUS)[keyof typeof TEAM_ADVISOR_STATUS];

/**
 * O orientador **responsável** pela equipe (RF-EQP-005).
 *
 * Distinto do orientador do evento, que `event` possui: a responsabilidade direta nomeia
 * quem avalia o artigo da equipe, e não restringe o alcance dos demais orientadores
 * (RN1).
 */
export interface TeamAdvisor {
  readonly id: string;
  readonly teamId: string;
  readonly userId: string;
  readonly status: TeamAdvisorStatus;
  readonly revokedAt: Date | null;
}

export function advisorOf(id: string, teamId: string, userId: string): TeamAdvisor {
  return { id, teamId, userId, status: TEAM_ADVISOR_STATUS.ACTIVE, revokedAt: null };
}
