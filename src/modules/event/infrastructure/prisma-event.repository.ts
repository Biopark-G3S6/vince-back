import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

import { offsetOf, takeOf, type PageRequest } from '@shared/http/pagination';

import type { Event, EventScopeType, EventStatus } from '../domain/event';
import type { Milestone } from '../domain/milestone';
import {
  EventRepository,
  type AdvisorRows,
  type EventReach,
  type EventRows,
  type TeamUsageFact,
} from '../domain/ports/event-repository';
import { EventPrisma } from './event-prisma';

const UNIQUE_VIOLATION = 'P2002';
const RECORD_NOT_FOUND = 'P2025';

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

/** As colunas que compõem a entidade. Declaradas uma vez: `select` é contrato. */
const EVENT_COLUMNS = {
  id: true,
  institutionId: true,
  courseId: true,
  scopeType: true,
  scopeId: true,
  ownerId: true,
  title: true,
  theme: true,
  researchProblem: true,
  objectives: true,
  maxTeams: true,
  maxTeamSize: true,
  teamsInUse: true,
  largestTeamSize: true,
  status: true,
} as const;

const MILESTONE_COLUMNS = {
  id: true,
  eventId: true,
  name: true,
  order: true,
  dueAt: true,
} as const;

interface EventRow {
  id: string;
  institutionId: string;
  courseId: string | null;
  scopeType: string;
  scopeId: string;
  ownerId: string;
  title: string;
  theme: string;
  researchProblem: string;
  objectives: string;
  maxTeams: number;
  maxTeamSize: number;
  teamsInUse: number;
  largestTeamSize: number;
  status: string;
}

/**
 * A linha, projetada na entidade.
 *
 * `scopeType` e `status` são texto no banco por `ADR-0018` §19, e a restrição de
 * verificação da migração é que garante o conjunto — a conversão aqui apenas reconhece o
 * que o banco já não deixa divergir.
 */
function toEvent(row: EventRow): Event {
  return {
    ...row,
    scopeType: row.scopeType as EventScopeType,
    status: row.status as EventStatus,
  };
}

function toMilestone(row: {
  id: string;
  eventId: string;
  name: string;
  order: number;
  dueAt: Date;
}): Milestone {
  return row;
}

/**
 * O predicado do alcance (`ADR-0032` §21).
 *
 * As quatro dimensões se somam em um único `OR`: uma consulta, qualquer que seja a
 * quantidade de vínculos do ator (`ADR-0011` §9). Alcance inteiramente vazio produz
 * `OR: []`, que no Prisma não casa com linha alguma — e é exatamente a resposta certa
 * para quem não tem vínculo nenhum.
 */
function reachWhere(reach: EventReach): Prisma.EventWhereInput {
  const clauses: Prisma.EventWhereInput[] = reach.scopes.map((scope) => ({
    scopeType: scope.scopeType,
    scopeId: scope.scopeId,
  }));

  if (reach.courseIds.length > 0) {
    clauses.push({ courseId: { in: [...reach.courseIds] } });
  }
  if (reach.institutionIds.length > 0) {
    clauses.push({ institutionId: { in: [...reach.institutionIds] } });
  }
  if (reach.ownerId !== undefined) {
    clauses.push({ ownerId: reach.ownerId });
  }
  if (reach.advisorId !== undefined) {
    clauses.push({ advisors: { some: { userId: reach.advisorId } } });
  }

  return { OR: clauses };
}

@Injectable()
export class PrismaEventRepository extends EventRepository {
  constructor(private readonly prisma: EventPrisma) {
    super();
  }

  async create(event: Event): Promise<Event> {
    return toEvent(
      await this.prisma.event.create({
        data: {
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
        },
        select: EVENT_COLUMNS,
      }),
    );
  }

  async findById(id: string): Promise<Event | null> {
    const row = await this.prisma.event.findUnique({ where: { id }, select: EVENT_COLUMNS });

    return row === null ? null : toEvent(row);
  }

  async findReachable(id: string, reach: EventReach): Promise<Event | null> {
    const row = await this.prisma.event.findFirst({
      where: { id, ...reachWhere(reach) },
      select: EVENT_COLUMNS,
    });

    return row === null ? null : toEvent(row);
  }

  async listReachable(reach: EventReach, request: PageRequest): Promise<EventRows> {
    const where = reachWhere(reach);
    const rows = await this.prisma.event.findMany({
      where,
      select: EVENT_COLUMNS,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: offsetOf(request),
      take: takeOf(request),
    });
    const events = rows.map(toEvent);

    return request.withTotal
      ? { rows: events, totalItems: await this.prisma.event.count({ where }) }
      : { rows: events };
  }

  async save(event: Event): Promise<Event | null> {
    try {
      return toEvent(
        await this.prisma.event.update({
          where: { id: event.id },
          data: {
            title: event.title,
            theme: event.theme,
            researchProblem: event.researchProblem,
            objectives: event.objectives,
            maxTeams: event.maxTeams,
            maxTeamSize: event.maxTeamSize,
          },
          select: EVENT_COLUMNS,
        }),
      );
    } catch (error: unknown) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return null;
      }

      throw error;
    }
  }

  async setStatus(id: string, status: EventStatus): Promise<Event | null> {
    try {
      return toEvent(
        await this.prisma.event.update({
          where: { id },
          data: { status },
          select: EVENT_COLUMNS,
        }),
      );
    } catch (error: unknown) {
      if (isPrismaError(error, RECORD_NOT_FOUND)) {
        return null;
      }

      throw error;
    }
  }

  async createMilestone(milestone: Milestone): Promise<Milestone | null> {
    try {
      return toMilestone(
        await this.prisma.milestone.create({
          data: {
            id: milestone.id,
            eventId: milestone.eventId,
            name: milestone.name,
            order: milestone.order,
            dueAt: milestone.dueAt,
          },
          select: MILESTONE_COLUMNS,
        }),
      );
    } catch (error: unknown) {
      if (isPrismaError(error, UNIQUE_VIOLATION)) {
        return null;
      }

      throw error;
    }
  }

  async findMilestone(id: string): Promise<Milestone | null> {
    const row = await this.prisma.milestone.findUnique({
      where: { id },
      select: MILESTONE_COLUMNS,
    });

    return row === null ? null : toMilestone(row);
  }

  async listMilestones(eventId: string): Promise<readonly Milestone[]> {
    const rows = await this.prisma.milestone.findMany({
      where: { eventId },
      select: MILESTONE_COLUMNS,
      orderBy: { order: 'asc' },
    });

    return rows.map(toMilestone);
  }

  async listMilestonePage(
    eventId: string,
    request: PageRequest,
  ): Promise<{ readonly rows: readonly Milestone[]; readonly totalItems?: number }> {
    const rows = await this.prisma.milestone.findMany({
      where: { eventId },
      select: MILESTONE_COLUMNS,
      orderBy: { order: 'asc' },
      skip: offsetOf(request),
      take: takeOf(request),
    });
    const milestones = rows.map(toMilestone);

    return request.withTotal
      ? {
          rows: milestones,
          totalItems: await this.prisma.milestone.count({ where: { eventId } }),
        }
      : { rows: milestones };
  }

  async saveMilestone(milestone: Milestone): Promise<Milestone | null> {
    try {
      return toMilestone(
        await this.prisma.milestone.update({
          where: { id: milestone.id },
          data: { name: milestone.name, order: milestone.order, dueAt: milestone.dueAt },
          select: MILESTONE_COLUMNS,
        }),
      );
    } catch (error: unknown) {
      if (isPrismaError(error, RECORD_NOT_FOUND) || isPrismaError(error, UNIQUE_VIOLATION)) {
        return null;
      }

      throw error;
    }
  }

  async deleteMilestone(id: string): Promise<boolean> {
    const removed = await this.prisma.milestone.deleteMany({ where: { id } });

    return removed.count === 1;
  }

  async hasAdvisor(eventId: string, userId: string): Promise<boolean> {
    return (
      (await this.prisma.advisor.findUnique({
        where: { eventId_userId: { eventId, userId } },
        select: { eventId: true },
      })) !== null
    );
  }

  /**
   * A designação, com a sua trilha.
   *
   * `skipDuplicates` e a conferência de `count` fazem a idempotência de RF-EVT-003 E3
   * sem leitura prévia: só há trilha quando houve designação de fato, e a repetição não
   * produz segunda linha de auditoria.
   */
  async addAdvisor(eventId: string, userId: string, actorId: string): Promise<void> {
    try {
      await this.prisma.transaction(async (tx) => {
        const created = await tx.eventAdvisor.createMany({
          data: { eventId, userId },
          skipDuplicates: true,
        });

        if (created.count === 1) {
          await tx.eventAdvisorAudit.create({
            data: { id: uuidv7(), eventId, userId, actorId, operation: 'ASSIGNED' },
          });
        }
      });
    } catch (error: unknown) {
      if (!isPrismaError(error, UNIQUE_VIOLATION)) {
        throw error;
      }
    }
  }

  async removeAdvisor(eventId: string, userId: string, actorId: string): Promise<void> {
    await this.prisma.transaction(async (tx) => {
      const removed = await tx.eventAdvisor.deleteMany({ where: { eventId, userId } });

      if (removed.count === 1) {
        await tx.eventAdvisorAudit.create({
          data: { id: uuidv7(), eventId, userId, actorId, operation: 'REVOKED' },
        });
      }
    });
  }

  async listAdvisors(eventId: string, request: PageRequest): Promise<AdvisorRows> {
    const rows = await this.prisma.advisor.findMany({
      where: { eventId },
      select: { userId: true },
      orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
      skip: offsetOf(request),
      take: takeOf(request),
    });
    const advisors = rows.map((row) => row.userId);

    return request.withTotal
      ? { rows: advisors, totalItems: await this.prisma.advisor.count({ where: { eventId } }) }
      : { rows: advisors };
  }

  async advisorEventIds(userId: string): Promise<readonly string[]> {
    const rows = await this.prisma.advisor.findMany({
      where: { userId },
      select: { eventId: true },
    });

    return rows.map((row) => row.eventId);
  }

  /**
   * A projeção, em uma transação com o registro do fato consumido.
   *
   * A violação de unicidade em `processed_event` é o **sucesso** do caso repetido: o fato
   * já foi aplicado, e aplicar de novo é o que a idempotência existe para evitar
   * (`ADR-0032` §16). Evento inexistente também não é erro — a linha pode ter sido
   * removida entre o fato e o seu consumo.
   */
  async projectTeamUsage(fact: TeamUsageFact): Promise<void> {
    try {
      await this.prisma.transaction(async (tx) => {
        await tx.eventProcessedEvent.create({
          data: { id: fact.factId, eventType: fact.factType },
        });

        await tx.event.updateMany({
          where: { id: fact.eventId },
          data: { teamsInUse: fact.teamsInUse, largestTeamSize: fact.largestTeamSize },
        });
      });
    } catch (error: unknown) {
      if (isPrismaError(error, UNIQUE_VIOLATION)) {
        return;
      }

      throw error;
    }
  }
}
