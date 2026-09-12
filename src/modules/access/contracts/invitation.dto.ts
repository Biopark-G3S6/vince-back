import type { Page, PageRequest } from '@shared/http/pagination';

export interface IssueInvitationCommand {
  readonly actorId: string;
  readonly institutionId: string;
  readonly institutionName: string;
  readonly roleCode?: string;
  readonly targetEmail?: string | null;
  readonly expiresAt?: Date;
  readonly maxUses?: number | null;
}

export interface InvitationIssued {
  readonly id: string;
  readonly url: string;
}

export interface InvitationDetails {
  readonly id: string;
  readonly roleCode: string;
  readonly institutionId: string;
  readonly institutionName: string;
  readonly targetEmail?: string;
}

export interface AcceptInvitationCommand {
  readonly token: string;
  readonly name?: string;
  readonly email?: string;
  readonly password?: string;
}

export interface AcceptInvitationResult {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly roleCode: string;
  readonly institutionId: string;
}

export interface ListInvitationsQuery {
  readonly institutionId: string;
  readonly request: PageRequest;
}

export interface InvitationSummary {
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

export type InvitationPage = Page<InvitationSummary>;

export interface RevokeInvitationCommand {
  readonly actorId: string;
  readonly institutionId: string;
  readonly invitationId: string;
}
