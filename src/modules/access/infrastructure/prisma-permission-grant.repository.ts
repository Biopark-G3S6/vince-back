import { Injectable } from '@nestjs/common';

import { offsetOf, takeOf, toPage, type Page, type PageRequest } from '@shared/http/pagination';

import {
  PermissionGrantRepository,
  type GrantedPermissions,
  type NewPermissionGrant,
  type PermissionGrantFilters,
  type PermissionGrantRecord,
} from '../domain/ports/permission-grant-repository';
import { AccessPrisma } from './access-prisma';

/** Ativa: não revogada e sem prazo, ou com prazo ainda por vencer (`ADR-0014` §19). */
function activeAt(now: Date) {
  return {
    revokedAt: null,
    OR: [{ validUntil: null }, { validUntil: { gt: now } }],
  };
}

const GRANT_SELECT = {
  id: true,
  granterId: true,
  beneficiaryId: true,
  institutionId: true,
  validUntil: true,
  createdAt: true,
  permission: { select: { code: true } },
} as const;

function toRecord(row: {
  id: string;
  granterId: string;
  beneficiaryId: string;
  institutionId: string;
  validUntil: Date | null;
  createdAt: Date;
  permission: { code: string };
}): PermissionGrantRecord {
  return {
    id: row.id,
    granterId: row.granterId,
    beneficiaryId: row.beneficiaryId,
    institutionId: row.institutionId,
    permissionCode: row.permission.code,
    validUntil: row.validUntil,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class PrismaPermissionGrantRepository extends PermissionGrantRepository {
  constructor(private readonly prisma: AccessPrisma) {
    super();
  }

  async create(grant: NewPermissionGrant): Promise<PermissionGrantRecord | 'UNKNOWN_PERMISSION'> {
    const permission = await this.prisma.permission.findUnique({
      where: { code: grant.permissionCode },
      select: { id: true },
    });

    if (permission === null) {
      return 'UNKNOWN_PERMISSION';
    }

    const row = await this.prisma.permissionGrant.create({
      data: {
        id: grant.id,
        granterId: grant.granterId,
        beneficiaryId: grant.beneficiaryId,
        institutionId: grant.institutionId,
        permissionId: permission.id,
        validUntil: grant.validUntil,
      },
      select: GRANT_SELECT,
    });

    return toRecord(row);
  }

  async revoke(
    id: string,
    institutionId: string,
    actorId: string,
    now: Date,
  ): Promise<string | null> {
    // Uma única escrita condicionada: a revogação concorrente da mesma concessão encontra
    // `revoked_at` já preenchido e não altera nada — a trilha registra um só autor.
    const revoked = await this.prisma.permissionGrant.updateMany({
      where: { id, institutionId, ...activeAt(now) },
      data: { revokedAt: now, revokedBy: actorId },
    });

    if (revoked.count === 0) {
      return null;
    }

    const row = await this.prisma.permissionGrant.findUniqueOrThrow({
      where: { id },
      select: { beneficiaryId: true },
    });

    return row.beneficiaryId;
  }

  async listActive(
    filters: PermissionGrantFilters,
    request: PageRequest,
    now: Date,
  ): Promise<Page<PermissionGrantRecord>> {
    const where = {
      institutionId: filters.institutionId,
      ...(filters.beneficiaryId === undefined ? {} : { beneficiaryId: filters.beneficiaryId }),
      ...(filters.granterId === undefined ? {} : { granterId: filters.granterId }),
      ...activeAt(now),
    };
    const rows = await this.prisma.permissionGrant.findMany({
      where,
      select: GRANT_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: offsetOf(request),
      take: takeOf(request),
    });
    const total = request.withTotal
      ? await this.prisma.permissionGrant.count({ where })
      : undefined;

    return toPage(request, rows.map(toRecord), total);
  }

  async grantedTo(userId: string, now: Date): Promise<GrantedPermissions> {
    const rows = await this.prisma.permissionGrant.findMany({
      where: { beneficiaryId: userId, ...activeAt(now) },
      select: { validUntil: true, permission: { select: { code: true } } },
    });
    const expiries = rows
      .map((row) => row.validUntil)
      .filter((value): value is Date => value !== null)
      .sort((a, b) => a.getTime() - b.getTime());

    return {
      permissions: rows.map((row) => row.permission.code),
      earliestExpiry: expiries[0] ?? null,
    };
  }
}
