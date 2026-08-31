import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import type { CatalogDeclaration } from '../domain/catalog';
import { CatalogRepository, type CatalogReconciliation } from '../domain/ports/catalog-repository';
import { AccessPrisma } from './access-prisma';

/** Chave de um vínculo papel–permissão, para comparação de conjuntos em memória. */
function linkKey(roleId: string, permissionId: string): string {
  return `${roleId} ${permissionId}`;
}

function requireId(index: ReadonlyMap<string, string>, code: string, kind: string): string {
  const id = index.get(code);

  if (id === undefined) {
    throw new Error(`${kind} \`${code}\` não foi registrado antes de ser referenciado.`);
  }

  return id;
}

@Injectable()
export class PrismaCatalogRepository extends CatalogRepository {
  constructor(private readonly prisma: AccessPrisma) {
    super();
  }

  /**
   * Reconciliação por identificador natural (`code`), em uma única transação.
   *
   * O número de consultas é constante, quaisquer que sejam o tamanho do catálogo e a
   * quantidade de papéis (ADR-0011 §9, §13).
   */
  async reconcile(catalog: CatalogDeclaration): Promise<CatalogReconciliation> {
    return this.prisma.transaction(async (tx) => {
      const storedPermissions = await tx.permission.findMany({ select: { id: true, code: true } });
      const permissionId = new Map(storedPermissions.map((row) => [row.code, row.id]));

      const newPermissions = catalog.permissions
        .filter((code) => !permissionId.has(code))
        .map((code) => ({ id: uuidv7(), code }));

      for (const permission of newPermissions) {
        permissionId.set(permission.code, permission.id);
      }

      if (newPermissions.length > 0) {
        await tx.permission.createMany({ data: newPermissions });
      }

      const storedRoles = await tx.role.findMany({ select: { id: true, code: true } });
      const roleId = new Map(storedRoles.map((row) => [row.code, row.id]));

      const newRoles = catalog.roles
        .filter((role) => !roleId.has(role.code))
        .map((role) => ({ id: uuidv7(), code: role.code }));

      for (const role of newRoles) {
        roleId.set(role.code, role.id);
      }

      if (newRoles.length > 0) {
        await tx.role.createMany({ data: newRoles });
      }

      const declaredLinks = catalog.roles.flatMap((role) =>
        role.permissions.map((code) => ({
          roleId: requireId(roleId, role.code, 'Papel'),
          permissionId: requireId(permissionId, code, 'Permissão'),
        })),
      );

      const declaredKeys = new Set(
        declaredLinks.map((link) => linkKey(link.roleId, link.permissionId)),
      );

      const storedLinks = await tx.rolePermission.findMany({
        select: { roleId: true, permissionId: true },
      });
      const storedKeys = new Set(
        storedLinks.map((link) => linkKey(link.roleId, link.permissionId)),
      );

      const surplus = storedLinks.filter(
        (link) => !declaredKeys.has(linkKey(link.roleId, link.permissionId)),
      );
      const missing = declaredLinks.filter(
        (link) => !storedKeys.has(linkKey(link.roleId, link.permissionId)),
      );

      // Retirar uma permissão da composição de um papel precisa surtir efeito na
      // reexecução; a permissão em si permanece no catálogo.
      if (surplus.length > 0) {
        await tx.rolePermission.deleteMany({
          where: {
            OR: surplus.map((link) => ({
              roleId: link.roleId,
              permissionId: link.permissionId,
            })),
          },
        });
      }

      if (missing.length > 0) {
        await tx.rolePermission.createMany({ data: missing });
      }

      return {
        permissionsCreated: newPermissions.length,
        rolesCreated: newRoles.length,
        grantsCreated: missing.length,
        grantsRemoved: surplus.length,
      };
    });
  }

  /** Uma consulta, qualquer que seja a quantidade de papéis informados (ADR-0011 §9). */
  async findPermissionsOfRoles(roleCodes: readonly string[]): Promise<readonly string[]> {
    const rows = await this.prisma.rolePermission.findMany({
      where: { role: { code: { in: [...roleCodes] } } },
      select: { permission: { select: { code: true } } },
    });

    return [...new Set(rows.map((row) => row.permission.code))];
  }
}
