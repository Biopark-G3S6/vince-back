import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import {
  AUDIT_OPERATION,
  RoleAssignmentAuditRepository,
  RoleAssignmentRepository,
  type AuditOperation,
  type RoleAssignmentAuditEntry,
  type RoleAssignmentOutcome,
} from '../domain/ports/role-assignment-repository';
import { AccessPrisma, type AccessModels } from './access-prisma';

const UNCHANGED: RoleAssignmentOutcome = { changed: false };
const CHANGED: RoleAssignmentOutcome = { changed: true };

/** O papel, pelo código. `null` quando o código não corresponde a papel gravado. */
async function roleByCode(
  tx: AccessModels,
  code: string,
): Promise<{ id: string; code: string } | null> {
  return tx.role.findUnique({ where: { code }, select: { id: true, code: true } });
}

async function record(
  tx: AccessModels,
  actorId: string | null,
  subjectId: string,
  role: { id: string; code: string },
  operation: AuditOperation,
): Promise<void> {
  await tx.roleAssignmentAudit.create({
    data: {
      id: uuidv7(),
      actorId,
      subjectId,
      roleId: role.id,
      roleCode: role.code,
      operation,
    },
  });
}

/**
 * Atribuição e revogação de papel, com a trilha gravada na mesma transação
 * (decisão D4, `ADR-0019` §1).
 *
 * A transação única é o que garante o cenário "Falha não deixa rastro parcial": não
 * existe instante em que o vínculo exista sem o seu registro, nem o contrário.
 *
 * A idempotência é decidida pelo estado gravado, dentro da transação — e não por consulta
 * anterior a ela, que outra transação poderia invalidar no intervalo.
 */
@Injectable()
export class PrismaRoleAssignmentRepository extends RoleAssignmentRepository {
  constructor(private readonly prisma: AccessPrisma) {
    super();
  }

  async assign(
    actorId: string | null,
    subjectId: string,
    roleCode: string,
  ): Promise<RoleAssignmentOutcome> {
    return this.prisma.transaction(async (tx) => {
      const role = await roleByCode(tx, roleCode);

      if (role === null) {
        return UNCHANGED;
      }

      const existing = await tx.userRole.findUnique({
        where: { userId_roleId: { userId: subjectId, roleId: role.id } },
        select: { userId: true },
      });

      if (existing !== null) {
        return UNCHANGED;
      }

      await tx.userRole.create({ data: { userId: subjectId, roleId: role.id } });
      await record(tx, actorId, subjectId, role, AUDIT_OPERATION.ASSIGNED);

      return CHANGED;
    });
  }

  async revoke(
    actorId: string | null,
    subjectId: string,
    roleCode: string,
  ): Promise<RoleAssignmentOutcome> {
    return this.prisma.transaction(async (tx) => {
      const role = await roleByCode(tx, roleCode);

      if (role === null) {
        return UNCHANGED;
      }

      // `deleteMany` e não `delete`: remover o que não existe não é erro aqui, é a
      // própria idempotência, e `delete` a transformaria em exceção a tratar.
      const removed = await tx.userRole.deleteMany({
        where: { userId: subjectId, roleId: role.id },
      });

      if (removed.count === 0) {
        return UNCHANGED;
      }

      await record(tx, actorId, subjectId, role, AUDIT_OPERATION.REVOKED);

      return CHANGED;
    });
  }

  /** Uma consulta, qualquer que seja a quantidade de papéis (`ADR-0011` §9). */
  async rolesOf(subjectId: string): Promise<readonly string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: { userId: subjectId },
      select: { role: { select: { code: true } } },
    });

    return rows.map((row) => row.role.code);
  }
}

/**
 * Leitura da trilha — e nada além de leitura.
 *
 * Esta classe não tem, e não deve ganhar, método que altere ou remova registro: a trilha
 * é imutável (`ADR-0014` §18, `ADR-0027` §5). O acréscimo acontece dentro da transação de
 * `PrismaRoleAssignmentRepository`, que é o único ponto do módulo que escreve nela.
 */
@Injectable()
export class PrismaRoleAssignmentAuditRepository extends RoleAssignmentAuditRepository {
  constructor(private readonly prisma: AccessPrisma) {
    super();
  }

  async findBySubject(subjectId: string): Promise<readonly RoleAssignmentAuditEntry[]> {
    const rows = await this.prisma.roleAssignmentAudit.findMany({
      where: { subjectId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        actorId: true,
        subjectId: true,
        roleCode: true,
        operation: true,
        createdAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      subjectId: row.subjectId,
      roleCode: row.roleCode,
      operation: row.operation as AuditOperation,
      at: row.createdAt,
    }));
  }
}
