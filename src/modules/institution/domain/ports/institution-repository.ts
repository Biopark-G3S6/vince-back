import type { PageRequest } from '@shared/http/pagination';

import type { Institution } from '../institution';

/**
 * Port do domínio para a instituição.
 *
 * É `abstract class` e não interface porque também é o token de injeção
 * (`ADR-0004` §2, §3). A implementação vive em `infrastructure/`.
 */

/** Qual restrição única a gravação violou. É o que nomeia o campo na resposta. */
export type UniqueField = 'code' | 'cnpj';

/**
 * O resultado de uma gravação que disputa índice único: a instituição, ou o campo que
 * colidiu.
 *
 * A decisão é do banco, e não de uma consulta prévia: entre consultar e gravar cabe outra
 * gravação, e o índice único é o que de fato arbitra.
 */
export type WriteOutcome =
  | { readonly ok: true; readonly institution: Institution }
  | { readonly ok: false; readonly duplicated: UniqueField };

/** As linhas da página, com o registro excedente que responde `hasNext`. */
export interface InstitutionRows {
  /** Até `pageSize + 1` registros (`ADR-0025` §23). */
  readonly rows: readonly Institution[];
  /** Apurado apenas quando pedido (`ADR-0025` §24). */
  readonly totalItems?: number;
}

/** Existência e estado, para o consumidor interno (`ADR-0028` §21). */
export interface InstitutionState {
  readonly exists: boolean;
  readonly active: boolean;
}

export abstract class InstitutionRepository {
  /** Grava a instituição nova. Devolve o campo que colidiu quando a sigla ou o CNPJ já existem. */
  abstract create(institution: Institution): Promise<WriteOutcome>;

  abstract findById(id: string): Promise<Institution | null>;

  /**
   * A página pedida, **em uma única consulta** — duas quando o total é pedido
   * (`ADR-0011` §9, `ADR-0025` §23, §24). A contagem NÃO varia com a quantidade de
   * registros devolvidos.
   */
  abstract list(request: PageRequest): Promise<InstitutionRows>;

  /** Grava a instituição alterada. `null` quando ela deixou de existir. */
  abstract save(institution: Institution): Promise<WriteOutcome | null>;

  /**
   * Leva a instituição ao estado informado. Devolve `null` quando ela não existe —
   * `RESOURCE_NOT_FOUND` é decisão do caso de uso, não do repositório.
   */
  abstract setActive(id: string, active: boolean): Promise<Institution | null>;

  /**
   * O estado de um conjunto de identificadores, **em uma única consulta**, qualquer que
   * seja a quantidade informada (`ADR-0028` §21, `ADR-0011` §9).
   */
  abstract statesOf(ids: readonly string[]): Promise<ReadonlyMap<string, InstitutionState>>;
}
