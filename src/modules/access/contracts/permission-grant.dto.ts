import type { Page, PageRequest } from '@shared/http/pagination';

/** Uma concessão direta ativa (RF-ACS-006, RF-ACS-008). */
export interface PermissionGrantDto {
  readonly id: string;
  readonly beneficiaryId: string;
  readonly granterId: string;
  readonly permission: string;
  readonly grantedAt: Date;
  readonly validUntil: Date | null;
}

export interface GrantPermissionCommand {
  readonly actorId: string;
  readonly beneficiaryId: string;
  readonly permission: string;
  readonly validUntil?: Date | null;
}

export interface RevokePermissionGrantCommand {
  readonly actorId: string;
  readonly grantId: string;
}

export interface ListPermissionGrantsQuery {
  readonly actorId: string;
  readonly request: PageRequest;
  readonly beneficiaryId?: string;
  readonly granterId?: string;
}

export type PermissionGrantPage = Page<PermissionGrantDto>;
