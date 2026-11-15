import { Injectable } from '@nestjs/common';

import type { Page } from '@shared/http/pagination';

import type {
  CreateTeamCommand,
  EligibleStudentPageDto,
  InvitationResponseCommand,
  InviteMemberCommand,
  JoinTeamCommand,
  ListEligibleStudentsCommand,
  ListMembersCommand,
  ListTeamInvitationsCommand,
  ListReceivedInvitationsCommand,
  MemberRoleCommand,
  ListTeamsCommand,
  MemberCommand,
  MemberDto,
  MemberPageDto,
  TeamAdvisorCommand,
  TeamDto,
  TeamInvitationDto,
  TeamInvitationPageDto,
  TeamMembershipDto,
  TeamPageDto,
  TeamQuery,
  TeamStateDto,
} from '../contracts/team.dto';
import { TeamFacade } from '../contracts/team.facade';
import type { TeamResult } from '../contracts/result.dto';
import type { Result } from '../domain/failure';
import type { TeamInvitation } from '../domain/invitation';
import type { TeamMember } from '../domain/member';
import type { Team } from '../domain/team';
import { AssignTeamAdvisorUseCase } from './assign-team-advisor.use-case';
import { CreateTeamUseCase } from './create-team.use-case';
import { FindTeamUseCase } from './find-team.use-case';
import { JoinTeamUseCase } from './join-team.use-case';
import { ListEligibleStudentsUseCase } from './list-eligible-students.use-case';
import { ListInvitationsUseCase } from './list-invitations.use-case';
import { ListReceivedInvitationsUseCase } from './list-received-invitations.use-case';
import { SetMemberRoleUseCase } from './set-member-role.use-case';
import { ListMembersUseCase } from './list-members.use-case';
import { ListTeamsUseCase } from './list-teams.use-case';
import { InviteMemberUseCase } from './invite-member.use-case';
import { ReadTeamStateUseCase } from './read-team-state.use-case';
import { RemoveMemberUseCase } from './remove-member.use-case';
import { RespondInvitationUseCase } from './respond-invitation.use-case';

function toTeamDto(team: Team): TeamDto {
  return team;
}

function toMemberDto(member: TeamMember): MemberDto {
  return member;
}

function toInvitationDto(invitation: TeamInvitation): TeamInvitationDto {
  return invitation;
}

function toResult<T, U>(result: Result<T>, project: (value: T) => U): TeamResult<U> {
  return result.ok
    ? { ok: true, value: project(result.value) }
    : { ok: false, failure: result.failure };
}

function toVoidResult(result: Result<void>): TeamResult<void> {
  return result.ok ? { ok: true, value: undefined } : { ok: false, failure: result.failure };
}

function toPageOf<T, U>(page: Page<T>, project: (value: T) => U): Page<U> {
  return { ...page, items: page.items.map(project) };
}

@Injectable()
export class TeamFacadeImpl extends TeamFacade {
  constructor(
    private readonly createTeam: CreateTeamUseCase,
    private readonly listTeams: ListTeamsUseCase,
    private readonly findTeam: FindTeamUseCase,
    private readonly joinTeam: JoinTeamUseCase,
    private readonly removeMemberUseCase: RemoveMemberUseCase,
    private readonly listMembersUseCase: ListMembersUseCase,
    private readonly inviteMember: InviteMemberUseCase,
    private readonly respondInvitation: RespondInvitationUseCase,
    private readonly listInvitationsUseCase: ListInvitationsUseCase,
    private readonly listReceivedInvitationsUseCase: ListReceivedInvitationsUseCase,
    private readonly setMemberRoleUseCase: SetMemberRoleUseCase,
    private readonly teamAdvisor: AssignTeamAdvisorUseCase,
    private readonly eligibleStudents: ListEligibleStudentsUseCase,
    private readonly teamState: ReadTeamStateUseCase,
  ) {
    super();
  }

  async create(command: CreateTeamCommand): Promise<TeamResult<TeamDto>> {
    return toResult(await this.createTeam.execute(command), toTeamDto);
  }

  async list(command: ListTeamsCommand): Promise<TeamResult<TeamPageDto>> {
    return toResult(
      await this.listTeams.execute(command.actorId, command.eventId, command.request),
      (page) => toPageOf(page, toTeamDto),
    );
  }

  async findById(query: TeamQuery): Promise<TeamResult<TeamDto>> {
    return toResult(await this.findTeam.execute(query.actorId, query.teamId), toTeamDto);
  }

  async join(command: JoinTeamCommand): Promise<TeamResult<MemberDto>> {
    return toResult(await this.joinTeam.join(command), toMemberDto);
  }

  async assignMember(command: MemberCommand): Promise<TeamResult<MemberDto>> {
    return toResult(await this.joinTeam.assign(command), toMemberDto);
  }

  async removeMember(command: MemberCommand): Promise<TeamResult<void>> {
    return toVoidResult(await this.removeMemberUseCase.execute(command));
  }

  async listMembers(command: ListMembersCommand): Promise<TeamResult<MemberPageDto>> {
    return toResult(
      await this.listMembersUseCase.execute(command.actorId, command.teamId, command.request),
      (page) => toPageOf(page, toMemberDto),
    );
  }

  async invite(command: InviteMemberCommand): Promise<TeamResult<TeamInvitationDto>> {
    return toResult(await this.inviteMember.execute(command), toInvitationDto);
  }

  async acceptInvitation(command: InvitationResponseCommand): Promise<TeamResult<MemberDto>> {
    return toResult(await this.respondInvitation.accept(command), toMemberDto);
  }

  async declineInvitation(command: InvitationResponseCommand): Promise<TeamResult<void>> {
    return toVoidResult(await this.respondInvitation.decline(command));
  }

  async setMemberRole(command: MemberRoleCommand): Promise<TeamResult<MemberDto>> {
    return toResult(await this.setMemberRoleUseCase.execute(command), toMemberDto);
  }

  async listReceivedInvitations(
    command: ListReceivedInvitationsCommand,
  ): Promise<TeamResult<TeamInvitationPageDto>> {
    return toResult(
      await this.listReceivedInvitationsUseCase.execute(command.actorId, command.request),
      (page) => toPageOf(page, toInvitationDto),
    );
  }

  async listInvitations(
    command: ListTeamInvitationsCommand,
  ): Promise<TeamResult<TeamInvitationPageDto>> {
    return toResult(
      await this.listInvitationsUseCase.execute(command.actorId, command.teamId, command.request),
      (page) => toPageOf(page, toInvitationDto),
    );
  }

  async assignAdvisor(command: TeamAdvisorCommand): Promise<TeamResult<void>> {
    return toVoidResult(await this.teamAdvisor.assign(command));
  }

  async revokeAdvisor(command: TeamAdvisorCommand): Promise<TeamResult<void>> {
    return toVoidResult(await this.teamAdvisor.revoke(command));
  }

  async listEligibleStudents(
    command: ListEligibleStudentsCommand,
  ): Promise<TeamResult<EligibleStudentPageDto>> {
    return toResult(
      await this.eligibleStudents.execute(command.actorId, command.eventId, command.request),
      (page) => page,
    );
  }

  async stateOf(teamId: string): Promise<TeamStateDto> {
    return this.teamState.stateOf(teamId);
  }

  async membershipOf(teamId: string, userId: string): Promise<TeamMembershipDto> {
    return this.teamState.membershipOf(teamId, userId);
  }

  async activeMemberIdsOf(teamId: string): Promise<readonly string[]> {
    return this.teamState.activeMemberIdsOf(teamId);
  }
}
