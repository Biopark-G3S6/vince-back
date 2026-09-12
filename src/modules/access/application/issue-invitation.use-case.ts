import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import {
  generateInvitationToken,
  hashInvitationToken,
  INVITATION_OPERATION,
  INVITATION_PURPOSE,
  INVITATION_ROLE_GRANTS,
  violationsOfInvitationDraft,
} from '../domain/invitation';
import { FAILURE, fail, failValidation, ok, VIOLATION, type Result } from '../domain/failure';
import { InvitationRepository } from '../domain/ports/invitation-repository';
import { UserRepository } from '../domain/ports/user-repository';
import { isKnownRole, isWellFormedEmail, normalizeEmail } from '../domain/user';

export interface IssueInvitationInput {
  readonly actorId: string;
  readonly institutionId: string;
  readonly institutionName: string;
  readonly roleCode?: string;
  readonly targetEmail?: string | null;
  readonly expiresAt?: Date;
  readonly maxUses?: number | null;
}

export interface IssuedInvitation {
  readonly id: string;
  readonly url: string;
}

@Injectable()
export class IssueInvitationUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly invitations: InvitationRepository,
  ) {}

  async execute(input: IssueInvitationInput): Promise<Result<IssuedInvitation>> {
    const roleCode = input.roleCode?.trim() ?? '';
    const targetEmail = input.targetEmail === undefined ? null : input.targetEmail;
    const normalizedEmail = targetEmail === null ? null : normalizeEmail(targetEmail);
    const now = new Date();
    const violations = violationsOfInvitationDraft(
      {
        targetEmail: normalizedEmail,
        roleCode,
        institutionId: input.institutionId,
        institutionName: input.institutionName,
        expiresAt: input.expiresAt,
        maxUses: input.maxUses,
      },
      now,
    );

    if (normalizedEmail !== null && !isWellFormedEmail(normalizedEmail)) {
      if (!violations.some((violation) => violation.field === 'targetEmail')) {
        violations.push({ field: 'targetEmail', code: VIOLATION.MALFORMED });
      }
    }

    if (violations.length > 0) {
      return failValidation(violations);
    }

    if (!isKnownRole(roleCode)) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const actor = await this.users.findWithRoles(input.actorId);

    if (actor === null || !actor.account.active) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    const canGrant = actor.roleCodes.some(
      (actorRole) => isKnownRole(actorRole) && INVITATION_ROLE_GRANTS[actorRole].includes(roleCode),
    );

    if (!canGrant) {
      return fail(FAILURE.PERMISSION_DENIED);
    }

    const token = generateInvitationToken();
    const id = uuidv7();
    const created = await this.invitations.createAccountInvitation(
      {
        id,
        purpose: INVITATION_PURPOSE.ACCOUNT_CREATION,
        tokenHash: hashInvitationToken(token),
        targetEmail: normalizedEmail,
        roleCode,
        institutionId: input.institutionId,
        institutionName: input.institutionName.trim(),
        actorId: input.actorId,
        expiresAt: input.expiresAt as Date,
        maxUses: input.maxUses ?? null,
      },
      {
        id: uuidv7(),
        invitationId: id,
        actorId: input.actorId,
        accountId: null,
        roleCode,
        institutionId: input.institutionId,
        institutionName: input.institutionName.trim(),
        operation: INVITATION_OPERATION.ISSUED,
      },
    );

    if (!created) {
      return fail(FAILURE.EMAIL_ALREADY_REGISTERED);
    }

    return ok({ id, url: `/invitations/${token}` });
  }
}
