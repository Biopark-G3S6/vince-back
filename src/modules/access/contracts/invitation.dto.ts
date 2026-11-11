import type { Page, PageRequest } from '@shared/http/pagination';

export interface IssueInvitationCommand {
  readonly actorId: string;
  readonly institutionId: string;
  readonly institutionName: string;
  readonly roleCode?: string;
  readonly targetEmail?: string | null;
  readonly expiresAt?: Date;
  readonly maxUses?: number | null;
  /** Contexto opaco validado pelo módulo emissor. */
  readonly scopeType?: string | null;
  readonly scopeId?: string | null;
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

/** Fato publicado depois da criação de uma conta por convite. */
export interface InvitationAcceptedEvent {
  readonly eventId: string;
  readonly invitationId: string;
  readonly userId: string;
  readonly roleCode: string;
  readonly institutionId: string;
  readonly scopeType: string | null;
  readonly scopeId: string | null;
  readonly occurredAt: Date;
}

export interface ListInvitationsQuery {
  readonly institutionId: string;
  readonly request: PageRequest;
  readonly scopeType?: string | null;
  readonly scopeId?: string | null;
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
  readonly scopeType: string | null;
  readonly scopeId: string | null;
}

export type InvitationPage = Page<InvitationSummary>;

export interface RevokeInvitationCommand {
  readonly actorId: string;
  readonly institutionId: string;
  readonly invitationId: string;
}
