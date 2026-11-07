import type { FieldViolation } from './failure';

export const PUBLICATION_VENUE_MAX_LENGTH = 300;

/**
 * O tipo de veículo (RF-ART-004).
 *
 * Dois valores, e não um texto livre: a URS reconhece "evento científico ou periódico
 * externo", e o relatório de produção (`RF-ACP-005`) consolida por essa distinção. O que
 * o módulo **não** mantém é catálogo de veículos (RN1, `ADR-0030` §16).
 */
export const PUBLICATION_KIND = {
  EVENT: 'EVENT',
  JOURNAL: 'JOURNAL',
} as const;

export type PublicationKind = (typeof PUBLICATION_KIND)[keyof typeof PUBLICATION_KIND];

export interface Publication {
  readonly id: string;
  readonly articleId: string;
  readonly venue: string;
  readonly kind: PublicationKind;
  readonly publishedAt: Date;
  readonly url: string;
  readonly authorId: string;
}

export interface PublicationDraft {
  readonly venue?: string;
  readonly kind?: string;
  readonly publishedAt?: Date;
  readonly url?: string;
}

export function isPublicationKind(value: string): value is PublicationKind {
  return value === PUBLICATION_KIND.EVENT || value === PUBLICATION_KIND.JOURNAL;
}

/**
 * O endereço é válido (RF-ART-004 E1)?
 *
 * Validação de **forma**, não de existência: o módulo não acessa o endereço, e `ADR-0030`
 * §16 o proíbe de verificar a publicação em serviço externo. Só `http` e `https` entram —
 * um `javascript:` bem formado é URL válida e não é endereço de publicação.
 */
function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0;
  } catch {
    return false;
  }
}

function textViolation(
  field: 'venue',
  value: string | undefined,
  violations: FieldViolation[],
): void {
  const normalized = value?.trim() ?? '';

  if (normalized.length === 0) {
    violations.push({ field, code: 'REQUIRED' });
  } else if (normalized.length > PUBLICATION_VENUE_MAX_LENGTH) {
    violations.push({ field, code: 'TOO_LONG' });
  }
}

export function violationsOfDraft(draft: PublicationDraft): FieldViolation[] {
  const violations: FieldViolation[] = [];

  textViolation('venue', draft.venue, violations);

  if (draft.kind === undefined) {
    violations.push({ field: 'kind', code: 'REQUIRED' });
  } else if (!isPublicationKind(draft.kind)) {
    violations.push({ field: 'kind', code: 'UNSUPPORTED' });
  }

  if (draft.publishedAt === undefined) {
    violations.push({ field: 'publishedAt', code: 'REQUIRED' });
  } else if (!Number.isFinite(draft.publishedAt.getTime())) {
    violations.push({ field: 'publishedAt', code: 'MALFORMED' });
  }

  if (draft.url === undefined) {
    violations.push({ field: 'url', code: 'REQUIRED' });
  } else if (!isValidUrl(draft.url)) {
    violations.push({ field: 'url', code: 'MALFORMED' });
  }

  return violations;
}

export function violationsOfUpdate(draft: PublicationDraft): FieldViolation[] {
  const violations: FieldViolation[] = [];

  if (draft.venue !== undefined) {
    textViolation('venue', draft.venue, violations);
  }
  if (draft.kind !== undefined && !isPublicationKind(draft.kind)) {
    violations.push({ field: 'kind', code: 'UNSUPPORTED' });
  }
  if (draft.publishedAt !== undefined && !Number.isFinite(draft.publishedAt.getTime())) {
    violations.push({ field: 'publishedAt', code: 'MALFORMED' });
  }
  if (draft.url !== undefined && !isValidUrl(draft.url)) {
    violations.push({ field: 'url', code: 'MALFORMED' });
  }

  return violations;
}

export function publicationOf(
  id: string,
  articleId: string,
  authorId: string,
  draft: Required<PublicationDraft>,
): Publication {
  return {
    id,
    articleId,
    authorId,
    venue: draft.venue.trim(),
    kind: draft.kind as PublicationKind,
    publishedAt: draft.publishedAt,
    url: draft.url.trim(),
  };
}

export function withChanges(publication: Publication, draft: PublicationDraft): Publication {
  return {
    ...publication,
    venue: draft.venue?.trim() ?? publication.venue,
    kind: draft.kind === undefined ? publication.kind : (draft.kind as PublicationKind),
    publishedAt: draft.publishedAt ?? publication.publishedAt,
    url: draft.url?.trim() ?? publication.url,
  };
}
