import type { CatalogDeclaration } from '../catalog';

/**
 * O que a carga inicial alterou. Serve ao relato do comando e à verificação de
 * idempotência: reexecução sobre base já carregada devolve tudo em zero.
 */
export interface CatalogReconciliation {
  readonly permissionsCreated: number;
  readonly rolesCreated: number;
  readonly grantsCreated: number;
  readonly grantsRemoved: number;
}

/**
 * Port do domínio para as três tabelas do catálogo.
 *
 * É `abstract class` e não interface porque também é o token de injeção
 * (ADR-0004 §2, §3). A implementação vive em `infrastructure/`.
 */
export abstract class CatalogRepository {
  /**
   * Leva o estado gravado ao estado declarado, reconciliando por código:
   * insere o que falta, remove o vínculo que não conste mais da declaração e nunca
   * reescreve identificador já existente.
   */
  abstract reconcile(catalog: CatalogDeclaration): Promise<CatalogReconciliation>;

  /**
   * União das permissões dos papéis informados, sem repetição. Papel desconhecido não
   * contribui com permissão alguma e não faz a consulta falhar.
   */
  abstract findPermissionsOfRoles(roleCodes: readonly string[]): Promise<readonly string[]>;
}
