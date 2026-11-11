import type {
  CohortDto,
  CohortInvitationDto,
  CohortInvitationPageDto,
  CohortPageDto,
  CohortQuery,
  CreateCohortCommand,
  EnrollmentCommand,
  EnrollmentDto,
  EnrollmentPageDto,
  IssueCohortInvitationCommand,
  ListCohortInvitationsCommand,
  ListCohortsCommand,
  ListEnrollmentsCommand,
  ProfessorCommand,
  RevokeCohortInvitationCommand,
  UpdateCohortCommand,
} from './cohort.dto';
import type { CohortResult } from './result.dto';

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

export abstract class CohortFacade {
  abstract create(command: CreateCohortCommand): Promise<CohortResult<CohortDto>>;
  abstract list(command: ListCohortsCommand): Promise<CohortResult<CohortPageDto>>;
  abstract findById(query: CohortQuery): Promise<CohortResult<CohortDto>>;
  abstract update(command: UpdateCohortCommand): Promise<CohortResult<CohortDto>>;
  abstract deactivate(query: CohortQuery): Promise<CohortResult<CohortDto>>;
  abstract assignProfessor(command: ProfessorCommand): Promise<CohortResult<void>>;
  abstract revokeProfessor(command: ProfessorCommand): Promise<CohortResult<void>>;
  abstract enroll(command: EnrollmentCommand): Promise<CohortResult<EnrollmentDto>>;
  abstract listEnrollments(
    command: ListEnrollmentsCommand,
  ): Promise<CohortResult<EnrollmentPageDto>>;
  abstract issueInvitation(
    command: IssueCohortInvitationCommand,
  ): Promise<CohortResult<CohortInvitationDto>>;
  abstract listInvitations(
    command: ListCohortInvitationsCommand,
  ): Promise<CohortResult<CohortInvitationPageDto>>;
  abstract revokeInvitation(command: RevokeCohortInvitationCommand): Promise<CohortResult<void>>;
  abstract handleInvitationAccepted(event: InvitationAcceptedEvent): Promise<void>;
}
