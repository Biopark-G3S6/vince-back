export const ENROLLMENT_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type EnrollmentStatus = (typeof ENROLLMENT_STATUS)[keyof typeof ENROLLMENT_STATUS];

export interface Enrollment {
  readonly id: string;
  readonly cohortId: string;
  readonly userId: string;
  readonly status: EnrollmentStatus;
}

export interface CohortInvitation {
  readonly id: string;
  readonly invitationId: string;
  readonly cohortId: string;
  readonly professorId: string;
}
