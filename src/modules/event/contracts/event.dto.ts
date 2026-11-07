/**
 * DTOs do evento.
 *
 * Nenhum tipo do Prisma entra aqui (`ADR-0004` §8, §9, `ADR-0032` §24): escopo, alvo e
 * usuário atravessam a fronteira como texto.
 */
import type { Page, PageRequest } from '@shared/http/pagination';

export interface EventDto {
  readonly id: string;
  readonly institutionId: string;
  readonly courseId: string | null;
  readonly scopeType: string;
  readonly scopeId: string;
  readonly ownerId: string;
  readonly title: string;
  readonly theme: string;
  readonly researchProblem: string;
  readonly objectives: string;
  readonly maxTeams: number;
  readonly maxTeamSize: number;
  readonly status: string;
}

export interface CreateEventCommand {
  readonly actorId: string;
  readonly scopeType: string;
  readonly scopeId: string;
  readonly title: string;
  readonly theme: string;
  readonly researchProblem: string;
  readonly objectives: string;
  readonly maxTeams: number;
  readonly maxTeamSize: number;
}

export interface EventQuery {
  readonly actorId: string;
  readonly eventId: string;
}

export interface ListEventsCommand {
  readonly actorId: string;
  readonly request: PageRequest;
}

export interface UpdateEventCommand extends EventQuery {
  readonly title?: string;
  readonly theme?: string;
  readonly researchProblem?: string;
  readonly objectives?: string;
  readonly maxTeams?: number;
  readonly maxTeamSize?: number;
}

export interface MilestoneDto {
  readonly id: string;
  readonly eventId: string;
  readonly name: string;
  readonly order: number;
  readonly dueAt: Date;
}

export interface CreateMilestoneCommand extends EventQuery {
  readonly name: string;
  readonly order: number;
  readonly dueAt: Date;
}

export interface UpdateMilestoneCommand extends EventQuery {
  readonly milestoneId: string;
  readonly name?: string;
  readonly order?: number;
  readonly dueAt?: Date;
}

export interface MilestoneQuery extends EventQuery {
  readonly milestoneId: string;
}

export interface ListMilestonesCommand extends EventQuery {
  readonly request: PageRequest;
}

export interface AdvisorCommand extends EventQuery {
  readonly userId: string;
}

export interface AdvisorDto {
  readonly eventId: string;
  readonly userId: string;
}

export interface ListAdvisorsCommand extends EventQuery {
  readonly request: PageRequest;
}

/**
 * Existência, estado e limites, para o consumidor interno (`ADR-0032` §25).
 *
 * `exists: false` **não é falha** — é resposta: quem pergunta é outro módulo decidindo se
 * pode escrever, e uma exceção ali transformaria referência órfã em erro de servidor.
 */
export interface EventStateDto {
  readonly exists: boolean;
  readonly active: boolean;
  readonly institutionId: string | null;
  readonly courseId: string | null;
  readonly scopeType: string | null;
  readonly scopeId: string | null;
  readonly ownerId: string | null;
  readonly maxTeams: number;
  readonly maxTeamSize: number;
}

/** A consulta de elegibilidade, em lote (`ADR-0032` §13, `ADR-0011` §9). */
export interface EligibilityQuery {
  readonly eventId: string;
  readonly userIds: readonly string[];
}

/** O fato de formação publicado por quem possui a equipe (`ADR-0033` §20). */
export interface TeamUsageEvent {
  readonly factId: string;
  readonly factType: string;
  readonly eventId: string;
  readonly teamsInUse: number;
  readonly largestTeamSize: number;
  readonly occurredAt: Date;
}

export type EventPageDto = Page<EventDto>;
export type MilestonePageDto = Page<MilestoneDto>;
export type AdvisorPageDto = Page<AdvisorDto>;
