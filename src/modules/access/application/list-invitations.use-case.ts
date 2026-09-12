import { Injectable } from '@nestjs/common';

import type { Page, PageRequest } from '@shared/http/pagination';
import { toPage } from '@shared/http/pagination';

import {
  invitationFormOf,
  invitationStateOf,
  INVITATION_PURPOSE,
  type InvitationState,
} from '../domain/invitation';
import { InvitationRepository } from '../domain/ports/invitation-repository';

export interface ListInvitationsInput {
  readonly institutionId: string;
  readonly request: PageRequest;
}

export interface InvitationListItem {
  readonly id: string;
  readonly form: 'DIRECTED' | 'OPEN';
  readonly targetEmail?: string;
  readonly roleCode: string;
  readonly institutionId: string;
  readonly institutionName: string;
  readonly state: InvitationState;
  readonly expiresAt: Date;
  readonly maxUses: number | null;
  readonly useCount: number;
}

@Injectable()
export class ListInvitationsUseCase {
  constructor(private readonly invitations: InvitationRepository) {}

  async execute(input: ListInvitationsInput): Promise<Page<InvitationListItem>> {
    const rows = await this.invitations.listAccountInvitations(input.institutionId, input.request);
    const items = rows.rows
      .filter(
        (row) =>
          row.purpose === INVITATION_PURPOSE.ACCOUNT_CREATION &&
          row.roleCode !== null &&
          row.institutionId !== null &&
          row.institutionName !== null,
      )
      .map((row) => ({
        id: row.id,
        form: invitationFormOf(row.targetEmail),
        ...(row.targetEmail === null ? {} : { targetEmail: row.targetEmail }),
        roleCode: row.roleCode as string,
        institutionId: row.institutionId as string,
        institutionName: row.institutionName as string,
        state: invitationStateOf(row, new Date()),
        expiresAt: row.expiresAt,
        maxUses: row.maxUses,
        useCount: row.useCount,
      }));

    return toPage(input.request, items, rows.totalItems);
  }
}
