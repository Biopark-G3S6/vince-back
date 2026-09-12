import type { Pagination } from './pagination';
import { severityOf, type ResponseCode, type Severity } from './response-code';

/**
 * O envelope único de resposta (`ADR-0025` §3 a §6).
 *
 * `pagination` entrou com a primeira listagem do sistema — a de instituições —, como
 * `ADR-0025` §21 a §25 exigem. Foi acréscimo, e acréscimo não quebra cliente: quem não
 * lista continua recebendo o envelope sem o campo.
 *
 * `pagination` e `errors` são opcionais pelo mesmo motivo: `ADR-0025` §5 proíbe enviá-los
 * nulos, e campo opcional em TypeScript é exatamente "ausente ou presente", nunca
 * "presente e nulo".
 */

/** Um item por campo inválido (`ADR-0025` §16, §17). */
export interface FieldError {
  readonly field: string;
  readonly code: string;
  /**
   * Os valores a interpolar na mensagem traduzida pelo cliente (`ADR-0026` §16).
   * NUNCA o valor submetido pelo usuário (`ADR-0025` §18, `PAD-SEG-025`).
   */
  readonly meta?: Readonly<Record<string, string | number | boolean>>;
}

export interface ResponseStatus {
  readonly code: ResponseCode;
  readonly severity: Severity;
  /**
   * Texto de reserva, exibido só quando o cliente não reconhece o código
   * (`ADR-0025` §10, §12). Omitido por toda esta vertical: `ADR-0026` §13 proíbe a API de
   * devolver texto de exibição, e o cliente reconhece todos os códigos que ela emite.
   */
  readonly message?: string;
}

export interface ResponseEnvelope<T> {
  readonly data: T | null;
  readonly status: ResponseStatus;
  /** Presente exclusivamente em listagem (`ADR-0025` §21). */
  readonly pagination?: Pagination;
  readonly errors?: readonly FieldError[];
}

export function successEnvelope<T>(
  data: T,
  code: ResponseCode = 'SUCCESS',
  pagination?: Pagination,
): ResponseEnvelope<T> {
  const status = { code, severity: severityOf(code) };

  return pagination === undefined ? { data, status } : { data, status, pagination };
}

/** Falha: `data` é nulo (`ADR-0025` §15), e `errors` só existe se houver campos. */
export function failureEnvelope(
  code: ResponseCode,
  errors?: readonly FieldError[],
): ResponseEnvelope<never> {
  const status = { code, severity: severityOf(code) };

  return errors === undefined || errors.length === 0
    ? { data: null, status }
    : { data: null, status, errors };
}

/**
 * O que um controlador devolve quando o código de sucesso não é `SUCCESS`.
 *
 * É classe, e não objeto com um campo mágico, para que o interceptador a reconheça por
 * `instanceof` — inspecionar a forma do valor confundiria um recurso que por acaso
 * tivesse as mesmas chaves com uma instrução de montagem do envelope.
 */
export class EnvelopeResult<T> {
  constructor(
    readonly data: T,
    readonly code: ResponseCode,
    readonly pagination?: Pagination,
  ) {}
}

export function respondWith<T>(data: T, code: ResponseCode): EnvelopeResult<T> {
  return new EnvelopeResult(data, code);
}

/**
 * O que um controlador devolve em listagem: o vetor em `data` (`ADR-0025` §6) e a
 * paginação ao lado dele, nunca dentro (§21, §22).
 */
export function respondWithPage<T>(
  items: readonly T[],
  pagination: Pagination,
): EnvelopeResult<readonly T[]> {
  return new EnvelopeResult(items, 'SUCCESS', pagination);
}
