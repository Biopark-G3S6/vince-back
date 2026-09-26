import type { PageRequest } from '@shared/http/pagination';

import type { Cohort } from '../cohort';
import type { CohortInvitation, Enrollment } from '../enrollment';

export interface CohortRows {
  readonly rows: readonly Cohort[];
  readonly totalItems?: number;
}

export interface EnrollmentRows {
  readonly rows: readonly Enrollment[];
  readonly totalItems?: number;
}

export interface InvitationRows {
  readonly rows: readonly CohortInvitation[];
  readonly totalItems?: number;
}

export abstract class CohortRepository {
  abstract create(cohort: Cohort): Promise<Cohort | null>;
  abstract findById(id: string): Promise<Cohort | null>;
  abstract listByCourse(courseId: string, request: PageRequest): Promise<CohortRows>;
  abstract save(cohort: Cohort): Promise<Cohort | null>;
  abstract setActive(id: string, active: boolean): Promise<Cohort | null>;
  abstract hasProfessor(cohortId: string, userId: string): Promise<boolean>;
  abstract addProfessor(cohortId: string, userId: string, actorId: string): Promise<void>;
  abstract removeProfessor(cohortId: string, userId: string, actorId: string): Promise<void>;
  abstract countProfessorAssignments(userId: string): Promise<number>;
  abstract findActiveEnrollmentByUser(userId: string): Promise<Enrollment | null>;
  abstract createEnrollment(enrollment: Enrollment): Promise<Enrollment | null>;
  abstract findEnrollmentById(id: string): Promise<Enrollment | null>;
  abstract listEnrollments(cohortId: string, request: PageRequest): Promise<EnrollmentRows>;
  abstract consumeInvitationAccepted(input: {
    readonly eventId: string;
    readonly invitationId: string;
    readonly cohortId: string;
    readonly userId: string;
  }): Promise<void>;
  abstract createInvitation(invitation: CohortInvitation): Promise<CohortInvitation | null>;
  abstract findInvitation(invitationId: string): Promise<CohortInvitation | null>;
  abstract listInvitations(cohortId: string, request: PageRequest): Promise<InvitationRows>;
}
