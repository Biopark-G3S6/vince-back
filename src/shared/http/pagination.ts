import { z } from 'zod';

/**
 * A paginação de listagem (`ADR-0025` §21 a §25, `ADR-0011` §6, §7).
 *
 * **`hasNext` sem consulta de contagem** (§23): a listagem busca um registro além da
 * página e descarta-o. É o que mantém a contagem de consultas constante em relação à
 * quantidade de registros devolvidos (`ADR-0011` §9) — uma consulta, com um item ou com
 * cem. `totalItems` e `totalPages` custam a segunda consulta, e por isso §24 os condiciona
 * a pedido explícito.
 *
 * **O limite é teto, não sugestão** (§25, `ADR-0011` §7): pedido acima dele é truncado, e
 * a resposta informa o `pageSize` efetivo — o cliente descobre o corte pelo próprio
 * envelope, sem precisar contar o que recebeu.
 */

/** `ADR-0011` §7. Pedido acima disto é truncado, nunca recusado. */
export const MAX_PAGE_SIZE = 100;

export const DEFAULT_PAGE_SIZE = 20;

export const FIRST_PAGE = 1;

/** O que a requisição pediu, já saneado. */
export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
  /** `ADR-0025` §24: o total só é apurado quando pedido. */
  readonly withTotal: boolean;
}

/** O que a resposta informa (`ADR-0025` §22, §24). */
export interface Pagination {
  readonly page: number;
  readonly pageSize: number;
  readonly hasNext: boolean;
  /** Ausentes salvo pedido explícito — nunca nulos (`ADR-0025` §5). */
  readonly totalItems?: number;
  readonly totalPages?: number;
}

/**
 * O esquema dos parâmetros de consulta.
 *
 * `coerce` porque parâmetro de consulta chega sempre como texto. Valor fora de faixa é
 * **saneado**, e não recusado: `page` abaixo da primeira vira a primeira, e `pageSize`
 * acima do teto vira o teto (§25). Recusar com `400` faria da paginação uma armadilha
 * para o cliente que apenas pediu demais.
 */
export const pageRequestSchema = z.object({
  page: z.coerce.number().int().optional(),
  pageSize: z.coerce.number().int().optional(),
  withTotal: z.enum(['true', 'false']).optional(),
});

export type PageRequestInput = z.infer<typeof pageRequestSchema>;

/**
 * Sanea o pedido: primeira página como piso, `MAX_PAGE_SIZE` como teto.
 *
 * A conversão de `withTotal` acontece aqui, e não no esquema: um `transform` faria o tipo
 * de entrada divergir do de saída, e `parseOrFail` exige que coincidam — a borda valida a
 * forma do que chegou, e não produz um valor de outro tipo.
 */
export function toPageRequest(input: PageRequestInput): PageRequest {
  const page = Math.max(FIRST_PAGE, input.page ?? FIRST_PAGE);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE));

  return { page, pageSize, withTotal: input.withTotal === 'true' };
}

/** Quantos registros pular. A página é 1-indexada; o deslocamento, 0. */
export function offsetOf(request: PageRequest): number {
  return (request.page - FIRST_PAGE) * request.pageSize;
}

/**
 * Quantos registros buscar: a página **mais um**, que é o que responde `hasNext` sem
 * contar (`ADR-0025` §23).
 */
export function takeOf(request: PageRequest): number {
  return request.pageSize + 1;
}

/** O resultado da busca de `takeOf(request)` registros, partido em página e transbordo. */
export interface Page<T> {
  readonly items: readonly T[];
  readonly pagination: Pagination;
}

/**
 * Monta a página a partir das linhas buscadas com o registro excedente.
 *
 * `totalItems` entra apenas quando apurado; `totalPages` deriva dele, e vale 1 para
 * coleção vazia — uma primeira página vazia continua sendo uma página.
 */
export function toPage<T>(request: PageRequest, rows: readonly T[], totalItems?: number): Page<T> {
  const hasNext = rows.length > request.pageSize;
  const items = hasNext ? rows.slice(0, request.pageSize) : rows;

  const pagination: Pagination =
    totalItems === undefined
      ? { page: request.page, pageSize: request.pageSize, hasNext }
      : {
          page: request.page,
          pageSize: request.pageSize,
          hasNext,
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / request.pageSize)),
        };

  return { items, pagination };
}
