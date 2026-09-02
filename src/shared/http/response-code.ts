/**
 * O catálogo de códigos de resposta, em ponto único (`ADR-0025` §20, `PAD-REQ-008`).
 *
 * A fonte é a **URS §2.4**. Este arquivo é a cópia executável dela: o código, a
 * severidade que `ADR-0025` §9 exige e o status HTTP de `ADR-0025` §29. A URS continua
 * sendo a origem — código sem requisito ou regra de negócio que o origine não entra aqui.
 *
 * `SUCCESS` e `INTERNAL_ERROR` são as duas entradas que não nascem de requisito
 * funcional: nascem de `ADR-0025` §4, §9 e §29, que obrigam **toda** resposta a ter
 * `status`, a severidade `success` a existir e a falha inesperada a responder `500` com
 * envelope. Sem elas, nem o sucesso nem o erro interno teriam código, e o cliente não
 * teria o que traduzir. Foram acrescentadas à URS §2.4 junto com esta vertical.
 *
 * **A semântica de um código publicado não muda** (`ADR-0025` §8): significado novo exige
 * código novo. Alterar uma linha abaixo é alterar o contrato de todo cliente.
 */

export type Severity = 'success' | 'warning' | 'error';

interface CodeDeclaration {
  readonly severity: Severity;
  /** O status HTTP de `ADR-0025` §29 que este código sempre produz. */
  readonly httpStatus: number;
}

/**
 * O catálogo. A chave é o código; ela é o próprio valor devolvido em `status.code`.
 *
 * A ordem é a da URS §2.4, para que a conferência entre as duas cópias seja leitura
 * lado a lado, e não busca.
 */
export const RESPONSE_CODE_CATALOG = {
  SUCCESS: { severity: 'success', httpStatus: 200 },
  INTERNAL_ERROR: { severity: 'error', httpStatus: 500 },

  AUTHENTICATION_FAILED: { severity: 'error', httpStatus: 401 },
  INSTITUTION_INACTIVE: { severity: 'error', httpStatus: 422 },
  VALIDATION_FAILED: { severity: 'error', httpStatus: 400 },
  PERMISSION_DENIED: { severity: 'error', httpStatus: 403 },
  RESOURCE_NOT_FOUND: { severity: 'error', httpStatus: 404 },
  EMAIL_ALREADY_REGISTERED: { severity: 'error', httpStatus: 409 },
  INVITATION_EXPIRED: { severity: 'error', httpStatus: 422 },
  INVITATION_REVOKED: { severity: 'error', httpStatus: 422 },
  STUDENT_ALREADY_ENROLLED: { severity: 'error', httpStatus: 409 },
  COORDINATOR_ALREADY_ASSIGNED: { severity: 'error', httpStatus: 409 },
  EVENT_SCOPE_NOT_ALLOWED: { severity: 'error', httpStatus: 422 },
  EVENT_TEAM_LIMIT_REACHED: { severity: 'error', httpStatus: 422 },
  TEAM_SIZE_LIMIT_REACHED: { severity: 'error', httpStatus: 422 },
  STUDENT_ALREADY_IN_TEAM: { severity: 'error', httpStatus: 409 },
  STUDENT_NOT_ELIGIBLE: { severity: 'error', httpStatus: 422 },
  ADVISOR_NOT_ASSIGNED_TO_EVENT: { severity: 'error', httpStatus: 422 },
  MILESTONE_DATE_CONFLICT: { severity: 'error', httpStatus: 409 },
  GRANT_NOT_HELD_BY_GRANTER: { severity: 'error', httpStatus: 422 },
  SELF_GRANT_NOT_ALLOWED: { severity: 'error', httpStatus: 422 },
  LANGUAGE_NOT_SUPPORTED: { severity: 'error', httpStatus: 422 },
  TEMPLATE_ALREADY_FIXED: { severity: 'error', httpStatus: 409 },
  ARTICLE_LOCKED_FOR_REVIEW: { severity: 'error', httpStatus: 409 },
  ARTICLE_ALREADY_FINISHED: { severity: 'error', httpStatus: 409 },
  ARTICLE_NOT_IN_REVIEW: { severity: 'error', httpStatus: 422 },
  REFERENCE_IN_USE: { severity: 'error', httpStatus: 409 },
  FILE_FORMAT_NOT_SUPPORTED: { severity: 'error', httpStatus: 422 },
  FILE_TOO_LARGE: { severity: 'error', httpStatus: 422 },
  SUBMISSION_ALREADY_MADE: { severity: 'error', httpStatus: 409 },
  MILESTONE_NOT_OPEN: { severity: 'error', httpStatus: 422 },
  MILESTONE_DEADLINE_PASSED: { severity: 'error', httpStatus: 422 },
  MILESTONE_PENDING: { severity: 'error', httpStatus: 422 },
  REVIEW_ALREADY_STARTED: { severity: 'error', httpStatus: 409 },
  REMARK_ALREADY_CLOSED: { severity: 'error', httpStatus: 409 },
  REMARK_PENDING: { severity: 'error', httpStatus: 422 },
  AI_CONSENT_REQUIRED: { severity: 'error', httpStatus: 422 },
  REPORT_NOT_READY: { severity: 'error', httpStatus: 422 },
} as const satisfies Readonly<Record<string, CodeDeclaration>>;

export type ResponseCode = keyof typeof RESPONSE_CODE_CATALOG;

/** Os códigos, na ordem da URS §2.4. */
export const RESPONSE_CODES = Object.keys(RESPONSE_CODE_CATALOG) as readonly ResponseCode[];

export function severityOf(code: ResponseCode): Severity {
  return RESPONSE_CODE_CATALOG[code].severity;
}

export function httpStatusOf(code: ResponseCode): number {
  return RESPONSE_CODE_CATALOG[code].httpStatus;
}

export function isKnownResponseCode(code: string): code is ResponseCode {
  return Object.hasOwn(RESPONSE_CODE_CATALOG, code);
}

/**
 * O vocabulário do detalhamento por campo (`ADR-0025` §17).
 *
 * É mais fino que o do catálogo: a URS §2.4 cataloga o código **da resposta**, e cada
 * item de `errors` carrega o seu próprio código, que diz o que há de errado com aquele
 * campo. Ele também precisa de chave no catálogo de tradução do cliente.
 */
export const FIELD_VIOLATION = {
  REQUIRED: 'REQUIRED',
  MALFORMED: 'MALFORMED',
  TOO_SHORT: 'TOO_SHORT',
  TOO_LONG: 'TOO_LONG',
  NOT_EDITABLE: 'NOT_EDITABLE',
  INCORRECT: 'INCORRECT',
} as const;

export type FieldViolationCode = (typeof FIELD_VIOLATION)[keyof typeof FIELD_VIOLATION];
