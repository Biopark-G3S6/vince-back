/**
 * Os estados do artigo (RF-ART-001 RN1, `ADR-0030` §13).
 *
 * Este módulo **consulta e persiste** o estado, mas não o transiciona: o ciclo
 * `IN_PROGRESS` → `IN_REVIEW`, uma vez por etapa, pertence às verticais de edição e
 * revisão (RN2). O artigo nasce `STARTED` e é só isso que esta vertical produz.
 */
export const ARTICLE_STATUS = {
  STARTED: 'STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_REVIEW: 'IN_REVIEW',
  FINISHED: 'FINISHED',
} as const;

export type ArticleStatus = (typeof ARTICLE_STATUS)[keyof typeof ARTICLE_STATUS];

export interface Article {
  readonly id: string;
  readonly teamId: string;
  readonly eventId: string;
  readonly institutionId: string;
  readonly status: ArticleStatus;
}

export interface ArticleOrigin {
  readonly id: string;
  readonly teamId: string;
  readonly eventId: string;
  readonly institutionId: string;
}

/** O artigo inicial da equipe (RF-EQP-001 RN1, `ADR-0030` §9). */
export function startedArticle(origin: ArticleOrigin): Article {
  return { ...origin, status: ARTICLE_STATUS.STARTED };
}
