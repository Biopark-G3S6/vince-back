import { Injectable } from '@nestjs/common';

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
} from '../contracts/cohort.dto';
import { CohortFacade, type InvitationAcceptedEvent } from '../contracts/cohort.facade';
import type { CohortResult } from '../contracts/result.dto';
import type { Cohort } from '../domain/cohort';
import type { Enrollment } from '../domain/enrollment';
import type { Result } from '../domain/failure';
import { AssignProfessorUseCase } from './assign-professor.use-case';
import { ConsumeInvitationAcceptedUseCase } from './consume-invitation-accepted.use-case';
import { CreateCohortUseCase } from './create-cohort.use-case';
import { DeactivateCohortUseCase } from './deactivate-cohort.use-case';
import { EnrollStudentUseCase } from './enroll-student.use-case';
import { FindCohortUseCase } from './find-cohort.use-case';
import { IssueInvitationUseCase } from './issue-invitation.use-case';
import { ListCohortsUseCase } from './list-cohorts.use-case';
import { ListEnrollmentsUseCase } from './list-enrollments.use-case';
import { ListInvitationsUseCase } from './list-invitations.use-case';
import { RevokeInvitationUseCase } from './revoke-invitation.use-case';
import { RevokeProfessorUseCase } from './revoke-professor.use-case';
import { UpdateCohortUseCase } from './update-cohort.use-case';

function toCohortDto(cohort: Cohort): CohortDto {
  return cohort;
}

function toEnrollmentDto(enrollment: Enrollment): EnrollmentDto {
  return enrollment;
}

function toResult<T, U>(result: Result<T>, project: (value: T) => U): CohortResult<U> {
  return result.ok
    ? { ok: true, value: project(result.value) }
    : { ok: false, failure: result.failure };
}

function toVoidResult(result: Result<void>): CohortResult<void> {
  return result.ok ? { ok: true, value: undefined } : { ok: false, failure: result.failure };
}

@Injectable()
export class CohortFacadeImpl extends CohortFacade {
  constructor(
    private readonly createCohort: CreateCohortUseCase,
    private readonly listCohorts: ListCohortsUseCase,
    private readonly findCohort: FindCohortUseCase,
    private readonly updateCohort: UpdateCohortUseCase,
    private readonly deactivateCohort: DeactivateCohortUseCase,
    private readonly assignProfessorUseCase: AssignProfessorUseCase,
    private readonly revokeProfessorUseCase: RevokeProfessorUseCase,
    private readonly enrollStudent: EnrollStudentUseCase,
    private readonly listEnrollmentsUseCase: ListEnrollmentsUseCase,
    private readonly issueInvitationUseCase: IssueInvitationUseCase,
    private readonly listInvitationsUseCase: ListInvitationsUseCase,
    private readonly revokeInvitationUseCase: RevokeInvitationUseCase,
    private readonly consumeInvitationAccepted: ConsumeInvitationAcceptedUseCase,
  ) {
    super();
  }

  async create(command: CreateCohortCommand): Promise<CohortResult<CohortDto>> {
    return toResult(await this.createCohort.execute(command), toCohortDto);
  }

  async list(command: ListCohortsCommand): Promise<CohortResult<CohortPageDto>> {
    return toResult(
      await this.listCohorts.execute(command.actorId, command.courseId, command.request),
      (page) => ({
        ...page,
        items: page.items.map(toCohortDto),
      }),
    );
  }

  async findById(query: CohortQuery): Promise<CohortResult<CohortDto>> {
    return toResult(await this.findCohort.execute(query.actorId, query.cohortId), toCohortDto);
  }

  async update(command: UpdateCohortCommand): Promise<CohortResult<CohortDto>> {
    return toResult(await this.updateCohort.execute(command), toCohortDto);
  }

  async deactivate(query: CohortQuery): Promise<CohortResult<CohortDto>> {
    return toResult(
      await this.deactivateCohort.execute(query.actorId, query.cohortId),
      toCohortDto,
    );
  }

  async assignProfessor(command: ProfessorCommand): Promise<CohortResult<void>> {
    return toVoidResult(await this.assignProfessorUseCase.execute(command));
  }

  async revokeProfessor(command: ProfessorCommand): Promise<CohortResult<void>> {
    return toVoidResult(await this.revokeProfessorUseCase.execute(command));
  }

  async enroll(command: EnrollmentCommand): Promise<CohortResult<EnrollmentDto>> {
    return toResult(await this.enrollStudent.execute(command), toEnrollmentDto);
  }

  async listEnrollments(command: ListEnrollmentsCommand): Promise<CohortResult<EnrollmentPageDto>> {
    return toResult(
      await this.listEnrollmentsUseCase.execute(command.actorId, command.cohortId, command.request),
      (page) => ({ ...page, items: page.items.map(toEnrollmentDto) }),
    );
  }

  async issueInvitation(
    command: IssueCohortInvitationCommand,
  ): Promise<CohortResult<CohortInvitationDto>> {
    return toResult(await this.issueInvitationUseCase.execute(command), (invitation) => invitation);
  }

  async listInvitations(
    command: ListCohortInvitationsCommand,
  ): Promise<CohortResult<CohortInvitationPageDto>> {
    return toResult(
      await this.listInvitationsUseCase.execute(command.actorId, command.cohortId, command.request),
      (page) => page,
    );
  }

  async revokeInvitation(command: RevokeCohortInvitationCommand): Promise<CohortResult<void>> {
    return toVoidResult(await this.revokeInvitationUseCase.execute(command));
  }

  async handleInvitationAccepted(event: InvitationAcceptedEvent): Promise<void> {
    await this.consumeInvitationAccepted.execute(event);
  }
}
