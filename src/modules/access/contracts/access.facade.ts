import type { RolePermissionsQuery, RolePermissionsResult } from './role-permissions.dto';

/**
 * A única superfície pública do módulo `access` (ADR-0004 §1, ADR-0027 §12).
 *
 * Declarada como `abstract class` para servir de token de injeção (ADR-0004 §2, §3).
 * Não expõe operação de escrita sobre papel, permissão ou composição: o catálogo é
 * imutável em tempo de execução e só muda por carga inicial (ADR-0027 §13).
 */
export abstract class AccessFacade {
  abstract permissionsOfRoles(query: RolePermissionsQuery): Promise<RolePermissionsResult>;
}
