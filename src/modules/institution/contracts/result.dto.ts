/**
 * O resultado de uma operação da fachada: o valor, ou a falha classificada.
 *
 * A falha atravessa a fronteira como **texto opaco** (`ADR-0028` §23): o tipo estreito de
 * `domain/` não sai do módulo, e `contracts/` não pode importar `domain/`.
 *
 * Os códigos são os do catálogo da URS §2.4 — `VALIDATION_FAILED`, `PERMISSION_DENIED`,
 * `RESOURCE_NOT_FOUND`, `INSTITUTION_INACTIVE` —, estáveis e independentes de idioma
 * (`ADR-0025` §7).
 */

/** Um item por campo inválido (`ADR-0025` §16, §17). */
export interface FieldViolationDto {
  readonly field: string;
  readonly code: string;
}

export interface FailureDto {
  readonly code: string;
  /**
   * Presente apenas na falha de validação. NÃO contém o valor submetido
   * (`ADR-0025` §18, `PAD-SEG-025`).
   */
  readonly fields?: readonly FieldViolationDto[];
}

export type InstitutionResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly failure: FailureDto };
