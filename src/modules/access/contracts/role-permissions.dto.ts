/**
 * DTOs da consulta de permissões por papel.
 *
 * Os códigos atravessam a fronteira como texto opaco (ADR-0027 §14): o tipo estreito
 * de `domain/` não sai do módulo, e nenhum tipo do Prisma entra aqui (ADR-0004 §8, §9).
 */

export interface RolePermissionsQuery {
  /** Códigos de papel. Código desconhecido é ignorado, e não produz erro. */
  readonly roleCodes: readonly string[];
}

export interface RolePermissionsResult {
  /** União das permissões dos papéis informados, cada uma uma única vez. */
  readonly permissions: readonly string[];
}
