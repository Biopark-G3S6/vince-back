import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

import { offsetOf, takeOf, type PageRequest } from '@shared/http/pagination';

import {
  invitationStateOf,
  INVITATION_OPERATION,
  INVITATION_PURPOSE,
  INVITATION_STATE,
  type InvitationRecord,
} from '../domain/invitation';
import { InvitationRepository, type NewInvitation } from '../domain/ports/invitation-repository';
import type {
  AccountCreationInput,
  AccountCreationOutcome,
  InvitationRows,
  NewInvitationAudit,
} from '../domain/ports/invitation-repository';
import { AUDIT_OPERATION } from '../domain/ports/role-assignment-repository';
import { AccessPrisma } from './access-prisma';

const UNIQUE_VIOLATION = 'P2002';

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

const INVITATION_COLUMNS = {
  id: true,
  userId: true,
  purpose: true,
  targetEmail: true,
  roleCode: true,
  institutionId: true,
  institutionName: true,
  actorId: true,
  expiresAt: true,
  maxUses: true,
  useCount: true,
  usedAt: true,
  revokedAt: true,
} as const;

type InvitationRow = {
  id: string;
  userId: string | null;
  purpose: string;
  targetEmail: string | null;
  roleCode: string | null;
  institutionId: string | null;
  institutionName: string | null;
  actorId: string | null;
  expiresAt: Date;
  maxUses: number | null;
  useCount: number;
  usedAt: Date | null;
  revokedAt: Date | null;
};

function toInvitation(row: InvitationRow): InvitationRecord {
  return {
    id: row.id,
    purpose: row.purpose as InvitationRecord['purpose'],
    targetEmail: row.targetEmail,
    roleCode: row.roleCode,
    institutionId: row.institutionId,
    institutionName: row.institutionName,
    actorId: row.actorId,
    expiresAt: row.expiresAt,
    maxUses: row.maxUses,
    useCount: row.useCount,
    usedAt: row.usedAt,
    revokedAt: row.revokedAt,
  };
}

@Injectable()
export class PrismaInvitationRepository extends InvitationRepository {
  constructor(private readonly prisma: AccessPrisma) {
    super();
  }

  async create(invitation: NewInvitation): Promise<void> {
    await this.prisma.invitation.create({
      data: {
        id: invitation.id,
        userId: invitation.userId ?? null,
        purpose: invitation.purpose,
        tokenHash: invitation.tokenHash,
        targetEmail: invitation.targetEmail ?? null,
        roleCode: invitation.roleCode ?? null,
        institutionId: invitation.institutionId ?? null,
        institutionName: invitation.institutionName ?? null,
        actorId: invitation.actorId ?? null,
        expiresAt: invitation.expiresAt,
        maxUses: invitation.maxUses ?? null,
      },
    });
  }

  async createAccountInvitation(
    invitation: NewInvitation,
    audit: NewInvitationAudit,
  ): Promise<boolean> {
    try {
      await this.prisma.transaction(async (tx) => {
        if (invitation.targetEmail !== null && invitation.targetEmail !== undefined) {
          const existing = await tx.user.findUnique({
            where: { email: invitation.targetEmail },
            select: { id: true },
          });

          if (existing !== null) {
            throw new DuplicateEmailError();
          }
        }

        await tx.invitation.create({
          data: {
            id: invitation.id,
            purpose: invitation.purpose,
            tokenHash: invitation.tokenHash,
            targetEmail: invitation.targetEmail ?? null,
            roleCode: invitation.roleCode ?? null,
            institutionId: invitation.institutionId ?? null,
            institutionName: invitation.institutionName ?? null,
            actorId: invitation.actorId ?? null,
            expiresAt: invitation.expiresAt,
            maxUses: invitation.maxUses ?? null,
          },
        });

        await tx.invitationAudit.create({ data: audit });
      });

      return true;
    } catch (error: unknown) {
      if (error instanceof DuplicateEmailError || isPrismaError(error, UNIQUE_VIOLATION)) {
        return false;
      }

      throw error;
    }
  }

  async findForAcceptance(tokenHash: string): Promise<InvitationRecord | null> {
    const row = await this.prisma.invitation.findUnique({
      where: { tokenHash },
      select: INVITATION_COLUMNS,
    });

    return row === null ? null : toInvitation(row);
  }

  async findPublic(tokenHash: string, now: Date): Promise<InvitationRecord | null> {
    const row = await this.findForAcceptance(tokenHash);

    if (row === null || row.purpose !== INVITATION_PURPOSE.ACCOUNT_CREATION) {
      return null;
    }

    return invitationStateOf(row, now) === INVITATION_STATE.ACTIVE ? row : null;
  }

  async acceptAccountCreation(input: AccountCreationInput): Promise<AccountCreationOutcome> {
    try {
      return await this.prisma.transaction(async (tx) => {
        while (true) {
          const row = await tx.invitation.findUnique({
            where: { tokenHash: input.tokenHash },
            select: INVITATION_COLUMNS,
          });

          if (row === null || row.purpose !== INVITATION_PURPOSE.ACCOUNT_CREATION) {
            return { ok: false, reason: 'EXPIRED' };
          }

          const invitation = toInvitation(row);
          const state = invitationStateOf(invitation, input.now);

          if (state !== INVITATION_STATE.ACTIVE) {
            return unavailable(invitation, input.now);
          }

          const claim =
            invitation.targetEmail === null
              ? await tx.invitation.updateMany({
                  where: {
                    id: invitation.id,
                    purpose: INVITATION_PURPOSE.ACCOUNT_CREATION,
                    useCount: invitation.useCount,
                    revokedAt: null,
                    expiresAt: { gt: input.now },
                  },
                  data: { useCount: { increment: 1 } },
                })
              : await tx.invitation.updateMany({
                  where: {
                    id: invitation.id,
                    purpose: INVITATION_PURPOSE.ACCOUNT_CREATION,
                    usedAt: null,
                    revokedAt: null,
                    expiresAt: { gt: input.now },
                  },
                  data: { usedAt: input.now },
                });

          if (claim.count === 0) {
            continue;
          }

          const role = await tx.role.findUnique({
            where: { code: input.roleCode },
            select: { id: true, code: true },
          });

          if (role === null) {
            throw new Error(`O papel \`${input.roleCode}\` não está no catálogo carregado.`);
          }

          const created = await tx.user.create({
            data: {
              id: input.account.id,
              email: input.account.email,
              name: input.account.name,
              expertiseArea: input.account.expertiseArea,
              preferredLanguage: input.account.preferredLanguage,
              active: input.account.active,
              institutionId: input.account.institutionId,
            },
            select: {
              id: true,
              email: true,
              name: true,
              expertiseArea: true,
              preferredLanguage: true,
              active: true,
              institutionId: true,
            },
          });

          await tx.userRole.create({ data: { userId: created.id, roleId: role.id } });
          await tx.passwordCredential.create({
            data: { userId: created.id, hash: input.passwordHash },
          });
          await tx.roleAssignmentAudit.create({
            data: {
              id: uuidv7(),
              actorId: input.actorId,
              subjectId: created.id,
              roleId: role.id,
              roleCode: role.code,
              operation: AUDIT_OPERATION.ASSIGNED,
            },
          });
          await tx.invitationAudit.create({
            data: {
              id: uuidv7(),
              invitationId: invitation.id,
              actorId: input.actorId,
              accountId: created.id,
              roleCode: role.code,
              institutionId: invitation.institutionId as string,
              institutionName: invitation.institutionName as string,
              operation: INVITATION_OPERATION.ACCEPTED,
            },
          });

          return {
            ok: true,
            account: {
              account: {
                id: created.id,
                email: created.email,
                name: created.name,
                expertiseArea: created.expertiseArea,
                preferredLanguage: created.preferredLanguage,
                active: created.active,
                institutionId: created.institutionId,
              },
              roleCodes: [role.code],
            },
          };
        }
      });
    } catch (error: unknown) {
      if (error instanceof DuplicateEmailError || isPrismaError(error, UNIQUE_VIOLATION)) {
        return { ok: false, reason: 'EMAIL_ALREADY_REGISTERED' };
      }

      throw error;
    }
  }

  async listAccountInvitations(
    institutionId: string,
    request: PageRequest,
  ): Promise<InvitationRows> {
    const rows = await this.prisma.invitation.findMany({
      where: { institutionId, purpose: INVITATION_PURPOSE.ACCOUNT_CREATION },
      select: INVITATION_COLUMNS,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: offsetOf(request),
      take: takeOf(request),
    });
    const invitations = rows.map((row) => ({
      ...toInvitation(row),
      state: invitationStateOf(toInvitation(row), new Date()),
    }));

    return request.withTotal
      ? {
          rows: invitations,
          totalItems: await this.prisma.invitation.count({
            where: { institutionId, purpose: INVITATION_PURPOSE.ACCOUNT_CREATION },
          }),
        }
      : { rows: invitations };
  }

  async revokeAccountInvitation(
    institutionId: string,
    invitationId: string,
    actorId: string,
    now: Date,
  ): Promise<void> {
    await this.prisma.transaction(async (tx) => {
      const invitation = await tx.invitation.findFirst({
        where: { id: invitationId, institutionId, purpose: INVITATION_PURPOSE.ACCOUNT_CREATION },
        select: INVITATION_COLUMNS,
      });

      if (invitation === null) {
        return;
      }

      const updated = await tx.invitation.updateMany({
        where: {
          id: invitationId,
          institutionId,
          purpose: INVITATION_PURPOSE.ACCOUNT_CREATION,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });

      if (updated.count === 0) {
        return;
      }

      await tx.invitationAudit.create({
        data: {
          id: uuidv7(),
          invitationId,
          actorId,
          accountId: null,
          roleCode: invitation.roleCode as string,
          institutionId,
          institutionName: invitation.institutionName as string,
          operation: INVITATION_OPERATION.REVOKED,
        },
      });
    });
  }

  async consume(
    tokenHash: string,
    purpose: InvitationRecord['purpose'],
    now: Date,
  ): Promise<string | null> {
    const row = await this.prisma.invitation.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, purpose: true },
    });

    if (row === null || row.purpose !== purpose || row.userId === null) {
      return null;
    }

    const { count } = await this.prisma.invitation.updateMany({
      where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });

    return count === 1 ? row.userId : null;
  }

  async invalidateOutstanding(
    userId: string,
    purpose: InvitationRecord['purpose'],
    now: Date,
  ): Promise<void> {
    await this.prisma.invitation.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: now },
    });
  }
}

class DuplicateEmailError extends Error {}

function unavailable(
  invitation: InvitationRecord,
  now: Date,
): Exclude<AccountCreationOutcome, { readonly ok: true }> {
  if (invitation.revokedAt !== null) {
    return { ok: false, reason: 'REVOKED' };
  }

  if (
    invitation.maxUses !== null &&
    invitation.useCount >= invitation.maxUses &&
    invitation.expiresAt.getTime() > now.getTime()
  ) {
    return { ok: false, reason: 'LIMIT_REACHED' };
  }

  return { ok: false, reason: 'EXPIRED' };
}
