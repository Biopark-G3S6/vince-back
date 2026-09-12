import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import {
  hashInvitationToken,
  invitationStateOf,
  INVITATION_PURPOSE,
  INVITATION_STATE,
} from '../domain/invitation';
import { FAILURE, fail, failValidation, ok, VIOLATION, type Result } from '../domain/failure';
import { violationsOfPassword } from '../domain/password';
import { InvitationRepository } from '../domain/ports/invitation-repository';
import { PasswordHasher } from '../domain/ports/password-hasher';
import {
  isWellFormedEmail,
  normalizeEmail,
  violationsOfDraft,
  type UserAccount,
} from '../domain/user';

export interface AcceptInvitationInput {
  readonly token: string;
  readonly name?: string;
  readonly email?: string;
  readonly password?: string;
}

export interface AcceptedInvitation {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly roleCode: string;
  readonly institutionId: string;
}

@Injectable()
export class AcceptInvitationUseCase {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(input: AcceptInvitationInput): Promise<Result<AcceptedInvitation>> {
    const invitation = await this.invitations.findForAcceptance(hashInvitationToken(input.token));

    if (invitation === null || invitation.purpose !== INVITATION_PURPOSE.ACCOUNT_CREATION) {
      return fail(FAILURE.INVITATION_EXPIRED);
    }

    const state = invitationStateOf(invitation, new Date());

    if (state === INVITATION_STATE.REVOKED) {
      return fail(FAILURE.INVITATION_REVOKED);
    }

    if (state === INVITATION_STATE.EXPIRED || state === INVITATION_STATE.EXHAUSTED) {
      return fail(
        state === INVITATION_STATE.EXHAUSTED && invitation.maxUses !== null
          ? FAILURE.INVITATION_LIMIT_REACHED
          : FAILURE.INVITATION_EXPIRED,
      );
    }

    const email = invitation.targetEmail ?? normalizeEmail(input.email ?? '');
    const violations = violationsOfDraft({
      email,
      name: input.name,
      role: invitation.roleCode ?? undefined,
      institutionId: invitation.institutionId,
    });

    if (invitation.targetEmail === null && !isWellFormedEmail(email)) {
      // `violationsOfDraft` already reports this for the empty and malformed cases; this
      // branch keeps the rule explicit for the open form without echoing the address.
      if (!violations.some((violation) => violation.field === 'email')) {
        violations.push({ field: 'email', code: VIOLATION.MALFORMED });
      }
    }

    violations.push(...violationsOfPassword(input.password));

    if (
      violations.length > 0 ||
      input.password === undefined ||
      invitation.roleCode === null ||
      invitation.institutionId === null
    ) {
      return failValidation(violations);
    }

    const account: UserAccount = {
      id: uuidv7(),
      email,
      name: input.name?.trim() ?? '',
      expertiseArea: null,
      preferredLanguage: null,
      active: true,
      institutionId: invitation.institutionId,
    };
    const outcome = await this.invitations.acceptAccountCreation({
      tokenHash: hashInvitationToken(input.token),
      now: new Date(),
      account,
      roleCode: invitation.roleCode,
      passwordHash: await this.hasher.hash(input.password),
      actorId: null,
    });

    if (!outcome.ok) {
      switch (outcome.reason) {
        case 'EMAIL_ALREADY_REGISTERED':
          return fail(FAILURE.EMAIL_ALREADY_REGISTERED);
        case 'REVOKED':
          return fail(FAILURE.INVITATION_REVOKED);
        case 'LIMIT_REACHED':
          return fail(FAILURE.INVITATION_LIMIT_REACHED);
        case 'EXPIRED':
          return fail(FAILURE.INVITATION_EXPIRED);
      }
    }

    return ok({
      userId: outcome.account.account.id,
      email: outcome.account.account.email,
      name: outcome.account.account.name,
      roleCode: invitation.roleCode,
      institutionId: invitation.institutionId,
    });
  }
}
