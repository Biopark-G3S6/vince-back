import { Injectable } from '@nestjs/common';

import type { Page } from '@shared/http/pagination';

import type {
  AdvisorCommand,
  AdvisorPageDto,
  CreateEventCommand,
  CreateMilestoneCommand,
  EligibilityQuery,
  EligibleStudentQuery,
  EventDto,
  EventPageDto,
  EventQuery,
  EventStateDto,
  ListAdvisorsCommand,
  ListEventsCommand,
  ListMilestonesCommand,
  MilestoneDto,
  MilestonePageDto,
  MilestoneQuery,
  TeamUsageEvent,
  UpdateEventCommand,
  UpdateMilestoneCommand,
} from '../contracts/event.dto';
import { EventFacade } from '../contracts/event.facade';
import type { EventResult } from '../contracts/result.dto';
import type { Event } from '../domain/event';
import type { Result } from '../domain/failure';
import type { Milestone } from '../domain/milestone';
import { AssignAdvisorUseCase } from './assign-advisor.use-case';
import { CancelEventUseCase } from './cancel-event.use-case';
import { ConsumeTeamUsageUseCase } from './consume-team-usage.use-case';
import { CreateEventUseCase } from './create-event.use-case';
import { CreateMilestoneUseCase } from './create-milestone.use-case';
import { FindEventUseCase } from './find-event.use-case';
import { ListAdvisorsUseCase } from './list-advisors.use-case';
import { ListEligibleStudentsUseCase } from './list-eligible-students.use-case';
import { ListEventsUseCase } from './list-events.use-case';
import { ListMilestonesUseCase } from './list-milestones.use-case';
import { ReadEventStateUseCase } from './read-event-state.use-case';
import { RemoveMilestoneUseCase } from './remove-milestone.use-case';
import { RevokeAdvisorUseCase } from './revoke-advisor.use-case';
import { UpdateEventUseCase } from './update-event.use-case';
import { UpdateMilestoneUseCase } from './update-milestone.use-case';

/**
 * A projeção da entidade no DTO.
 *
 * O uso projetado — `teamsInUse` e `largestTeamSize` — **não** atravessa a fronteira: é
 * estado interno de uma decisão de recusa, e publicá-lo convidaria o cliente a tratá-lo
 * como contagem de equipes, que ele não é (`ADR-0032` §17).
 */
function toEventDto(event: Event): EventDto {
  return {
    id: event.id,
    institutionId: event.institutionId,
    courseId: event.courseId,
    scopeType: event.scopeType,
    scopeId: event.scopeId,
    ownerId: event.ownerId,
    title: event.title,
    theme: event.theme,
    researchProblem: event.researchProblem,
    objectives: event.objectives,
    maxTeams: event.maxTeams,
    maxTeamSize: event.maxTeamSize,
    status: event.status,
  };
}

function toMilestoneDto(milestone: Milestone): MilestoneDto {
  return milestone;
}

function toResult<T, U>(result: Result<T>, project: (value: T) => U): EventResult<U> {
  return result.ok
    ? { ok: true, value: project(result.value) }
    : { ok: false, failure: result.failure };
}

function toVoidResult(result: Result<void>): EventResult<void> {
  return result.ok ? { ok: true, value: undefined } : { ok: false, failure: result.failure };
}

@Injectable()
export class EventFacadeImpl extends EventFacade {
  constructor(
    private readonly createEvent: CreateEventUseCase,
    private readonly listEvents: ListEventsUseCase,
    private readonly findEvent: FindEventUseCase,
    private readonly updateEvent: UpdateEventUseCase,
    private readonly cancelEvent: CancelEventUseCase,
    private readonly createMilestoneUseCase: CreateMilestoneUseCase,
    private readonly listMilestonesUseCase: ListMilestonesUseCase,
    private readonly updateMilestoneUseCase: UpdateMilestoneUseCase,
    private readonly removeMilestoneUseCase: RemoveMilestoneUseCase,
    private readonly assignAdvisorUseCase: AssignAdvisorUseCase,
    private readonly revokeAdvisorUseCase: RevokeAdvisorUseCase,
    private readonly listAdvisorsUseCase: ListAdvisorsUseCase,
    private readonly eventState: ReadEventStateUseCase,
    private readonly consumeTeamUsage: ConsumeTeamUsageUseCase,
    private readonly listEligibleStudents: ListEligibleStudentsUseCase,
  ) {
    super();
  }

  async create(command: CreateEventCommand): Promise<EventResult<EventDto>> {
    return toResult(await this.createEvent.execute(command), toEventDto);
  }

  async list(command: ListEventsCommand): Promise<EventResult<EventPageDto>> {
    return toResult(await this.listEvents.execute(command.actorId, command.request), (page) => ({
      ...page,
      items: page.items.map(toEventDto),
    }));
  }

  async findById(query: EventQuery): Promise<EventResult<EventDto>> {
    return toResult(await this.findEvent.execute(query.actorId, query.eventId), toEventDto);
  }

  async update(command: UpdateEventCommand): Promise<EventResult<EventDto>> {
    return toResult(await this.updateEvent.execute(command), toEventDto);
  }

  async cancel(query: EventQuery): Promise<EventResult<EventDto>> {
    return toResult(await this.cancelEvent.execute(query.actorId, query.eventId), toEventDto);
  }

  async createMilestone(command: CreateMilestoneCommand): Promise<EventResult<MilestoneDto>> {
    return toResult(await this.createMilestoneUseCase.execute(command), toMilestoneDto);
  }

  async listMilestones(command: ListMilestonesCommand): Promise<EventResult<MilestonePageDto>> {
    return toResult(
      await this.listMilestonesUseCase.execute(command.actorId, command.eventId, command.request),
      (page) => ({ ...page, items: page.items.map(toMilestoneDto) }),
    );
  }

  async updateMilestone(command: UpdateMilestoneCommand): Promise<EventResult<MilestoneDto>> {
    return toResult(await this.updateMilestoneUseCase.execute(command), toMilestoneDto);
  }

  async removeMilestone(query: MilestoneQuery): Promise<EventResult<void>> {
    return toVoidResult(await this.removeMilestoneUseCase.execute(query));
  }

  async assignAdvisor(command: AdvisorCommand): Promise<EventResult<void>> {
    return toVoidResult(await this.assignAdvisorUseCase.execute(command));
  }

  async revokeAdvisor(command: AdvisorCommand): Promise<EventResult<void>> {
    return toVoidResult(await this.revokeAdvisorUseCase.execute(command));
  }

  async listAdvisors(command: ListAdvisorsCommand): Promise<EventResult<AdvisorPageDto>> {
    return toResult(
      await this.listAdvisorsUseCase.execute(command.actorId, command.eventId, command.request),
      (page) => ({
        ...page,
        items: page.items.map((userId) => ({ eventId: command.eventId, userId })),
      }),
    );
  }

  async stateOf(eventId: string): Promise<EventStateDto> {
    return this.eventState.stateOf(eventId);
  }

  async isAdvisor(eventId: string, userId: string): Promise<boolean> {
    return this.eventState.isAdvisor(eventId, userId);
  }

  async advisedEventIdsOf(userId: string): Promise<readonly string[]> {
    return this.eventState.advisedEventIdsOf(userId);
  }

  async isScopeOwner(eventId: string, userId: string): Promise<boolean> {
    return this.eventState.isScopeOwner(eventId, userId);
  }

  async eligibilityOf(query: EligibilityQuery): Promise<ReadonlyMap<string, boolean>> {
    return this.eventState.eligibilityOf(query.eventId, query.userIds);
  }

  async eligibleStudentsOf(query: EligibleStudentQuery): Promise<Page<string>> {
    return this.listEligibleStudents.execute(query);
  }

  async currentMilestoneOf(eventId: string): Promise<MilestoneDto | null> {
    const milestone = await this.eventState.currentMilestoneOf(eventId);

    return milestone === null ? null : toMilestoneDto(milestone);
  }

  async handleTeamUsage(event: TeamUsageEvent): Promise<void> {
    await this.consumeTeamUsage.execute(event);
  }
}
