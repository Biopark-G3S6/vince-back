import type { Page, PageRequest } from '@shared/http/pagination';

export interface IssueInvitationCommand {
  readonly actorId: string;
  readonly institutionId: string;
  readonly roleCode?: string;
  readonly targetEmail?: string | null;
  readonly expiresAt?: Date;
  readonly maxUses?: number | null;
}

export interface InvitationIssuedDto {
  readonly id: string;
  readonly url: string;
}

export interface ListInvitationsCommand {
  readonly actorId: string;
  readonly institutionId: string;
  readonly request: PageRequest;
}

export interface InvitationSummaryDto {
  readonly id: string;
  readonly form: 'DIRECTED' | 'OPEN';
  readonly targetEmail?: string;
  readonly roleCode: string;
  readonly institutionId: string;
  readonly institutionName: string;
  readonly state: string;
  readonly expiresAt: Date;
  readonly maxUses: number | null;
  readonly useCount: number;
}

export type InvitationPageDto = Page<InvitationSummaryDto>;

export interface RevokeInvitationCommand {
  readonly actorId: string;
  readonly institutionId: string;
  readonly invitationId: string;
}
