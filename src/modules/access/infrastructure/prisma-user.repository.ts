import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

import { AUDIT_OPERATION } from '../domain/ports/role-assignment-repository';
import {
  UserRepository,
  type NewUserAccount,
  type UserAccountWithRoles,
} from '../domain/ports/user-repository';
import type { UserAccount } from '../domain/user';
import { AccessPrisma } from './access-prisma';

/** Violação de restrição única — aqui, sempre o índice do e-mail. */
const UNIQUE_VIOLATION = 'P2002';

/** Registro exigido pela operação não foi encontrado. */
const RECORD_NOT_FOUND = 'P2025';

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

/** A linha do Prisma, projetada na entidade de domínio. */
interface UserRow {
  id: string;
  email: string;
  name: string;
  expertiseArea: string | null;
  preferredLanguage: string | null;
  active: boolean;
  institutionId: string | null;
}

function toAccount(row: UserRow): UserAccount {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    expertiseArea: row.expertiseArea,
    preferredLanguage: row.preferredLanguage,
    active: row.active,
    institutionId: row.institutionId,
  };
}

/** As colunas que compõem a entidade. Declaradas uma vez: `select` é contrato. */
const ACCOUNT_COLUMNS = {
  id: true,
  email: true,
  name: true,
  expertiseArea: true,
  preferredLanguage: true,
  active: true,
  institutionId: true,
} as const;

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: AccessPrisma) {
    super();
  }

  /**
   * Conta, vínculo com o papel inicial e registro de auditoria, em uma transação
   * (`ADR-0019` §1): a conta não existe sem o papel que a criação declarou, e a trilha
   * não fica órfã de nenhum dos dois.
   */
  async create(user: NewUserAccount): Promise<UserAccountWithRoles | null> {
    try {
      return await this.prisma.transaction(async (tx) => {
        const role = await tx.role.findUnique({
          where: { code: user.roleCode },
          select: { id: true, code: true },
        });

        if (role === null) {
          // O papel é um dos cinco — o caso de uso já verificou —, então a sua ausência
          // no banco é ambiente sem carga inicial, e não entrada inválida.
          throw new Error(
            `O papel \`${user.roleCode}\` não está no banco. Execute \`pnpm run db:seed\` ` +
              '(ADR-0027, implicação 4).',
          );
        }

        const created = await tx.user.create({
          data: {
            id: user.account.id,
            email: user.account.email,
            name: user.account.name,
            expertiseArea: user.account.expertiseArea,
            preferredLanguage: user.account.preferredLanguage,
            active: user.account.active,
            institutionId: user.account.institutionId,
          },
          select: ACCOUNT_COLUMNS,
        });

        await tx.userRole.create({ data: { userId: created.id, roleId: role.id } });

        await tx.roleAssignmentAudit.create({
          data: {
            id: uuidv7(),
            actorId: user.actorId,
            subjectId: created.id,
            roleId: role.id,
            roleCode: role.code,
            operation: AUDIT_OPERATION.ASSIGNED,
          },
        });

        return { account: toAccount(created), roleCodes: [role.code] };
      });
    } catch (error: unknown) {
      if (isPrismaError(error, UNIQUE_VIOLATION)) {
        return null;
      }

      throw error;
    }
  }

  async findWithRoles(id: string): Promise<UserAccountWithRoles | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: { ...ACCOUNT_COLUMNS, roles: { select: { role: { select: { code: true } } } } },
    });

    if (row === null) {
      return null;
    }

    return {
      account: toAccount(row),
      roleCodes: row.roles.map((link) => link.role.code),
    };
  }

  async findByEmail(email: string): Promise<UserAccount | null> {
    const row = await this.prisma.user.findUnique({
      where: { email },
      select: ACCOUNT_COLUMNS,
    });

    return row === null ? null : toAccount(row);
  }

  async saveProfile(account: UserAccount): Promise<UserAccount | null> {
    try {
      const row = await this.prisma.user.update({
        where: { id: account.id },
        data: {
          name: account.name,
          expertiseArea: account.expertiseArea,
          preferredLanguage: account.preferredLanguage,
        },
        select: ACCOUNT_COLUMNS,
      });

      return toAccount(row);
    } catch (error: unknown) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return null;
      }

      throw error;
    }
  }

  async setActive(id: string, active: boolean): Promise<UserAccount | null> {
    try {
      const row = await this.prisma.user.update({
        where: { id },
        data: { active },
        select: ACCOUNT_COLUMNS,
      });

      return toAccount(row);
    } catch (error: unknown) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return null;
      }

      throw error;
    }
  }
}
