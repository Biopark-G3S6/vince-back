import type { Page, PageRequest } from '@shared/http/pagination';

export interface CohortDto {
  readonly id: string;
  readonly courseId: string;
  readonly identification: string;
  readonly term: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly active: boolean;
}

export interface CreateCohortCommand {
  readonly actorId: string;
  readonly courseId: string;
  readonly identification: string;
  readonly term: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
}

export interface ListCohortsCommand {
  readonly actorId: string;
  readonly courseId: string;
  readonly request: PageRequest;
}

export interface CohortQuery {
  readonly actorId: string;
  readonly cohortId: string;
}

export interface UpdateCohortCommand extends CohortQuery {
  readonly identification?: string;
  readonly term?: string;
  readonly startsAt?: Date;
  readonly endsAt?: Date;
}

export interface ProfessorCommand extends CohortQuery {
  readonly userId: string;
}

export interface EnrollmentCommand extends CohortQuery {
  readonly name: string;
  readonly email: string;
}

export interface EnrollmentDto {
  readonly id: string;
  readonly cohortId: string;
  readonly userId: string;
  readonly status: string;
}

export interface ListEnrollmentsCommand extends CohortQuery {
  readonly request: PageRequest;
}

export interface IssueCohortInvitationCommand extends CohortQuery {
  readonly expiresAt: Date;
}

export interface CohortInvitationDto {
  readonly id: string;
  readonly invitationId: string;
  readonly cohortId: string;
  readonly professorId: string;
  readonly url?: string;
}

export interface ListCohortInvitationsCommand extends CohortQuery {
  readonly request: PageRequest;
}

export interface RevokeCohortInvitationCommand extends CohortQuery {
  readonly invitationId: string;
}

export type CohortPageDto = Page<CohortDto>;
export type EnrollmentPageDto = Page<EnrollmentDto>;
export type CohortInvitationPageDto = Page<CohortInvitationDto>;
