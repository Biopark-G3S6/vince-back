import type { PageRequest } from '@shared/http/pagination';

import type { Event, EventScopeType, EventStatus } from '../event';
import type { Milestone } from '../milestone';

export interface EventRows {
  readonly rows: readonly Event[];
  readonly totalItems?: number;
}

export interface AdvisorRows {
  readonly rows: readonly string[];
  readonly totalItems?: number;
}

export interface ScopeRef {
  readonly scopeType: EventScopeType;
  readonly scopeId: string;
}

/**
 * O alcance do ator, já resolvido pelas fachadas dos módulos proprietários do vínculo
 * (`ADR-0032` §12, §21).
 *
 * Chega pronto ao repositório — uma consulta, qualquer que seja a quantidade de vínculos
 * (`ADR-0011` §9). Alcance vazio em todas as três dimensões não alcança evento algum, e
 * isso é resposta legítima: lista vazia, não erro.
 */
export interface EventReach {
  /** Correspondência exata de escopo: o vínculo do ator com aquele alvo. */
  readonly scopes: readonly ScopeRef[];
  /** Coordenador: alcança o que estiver dentro do curso, em qualquer escopo. */
  readonly courseIds: readonly string[];
  /** Administrador institucional: alcança o que estiver dentro da instituição. */
  readonly institutionIds: readonly string[];
  /** Dono do escopo: enxerga o que criou. */
  readonly ownerId?: string;
  /** Orientador designado: enxerga o evento em que orienta. */
  readonly advisorId?: string;
}

/** A projeção de uso vinda de um fato de `team` (`ADR-0032` §16). */
export interface TeamUsageFact {
  readonly factId: string;
  readonly factType: string;
  readonly eventId: string;
  readonly teamsInUse: number;
  readonly largestTeamSize: number;
}

export abstract class EventRepository {
  abstract create(event: Event): Promise<Event>;
  abstract findById(id: string): Promise<Event | null>;
  /** O evento, apenas quando alcançado: fora do alcance é indistinguível de inexistente. */
  abstract findReachable(id: string, reach: EventReach): Promise<Event | null>;
  abstract listReachable(reach: EventReach, request: PageRequest): Promise<EventRows>;
  abstract save(event: Event): Promise<Event | null>;
  abstract setStatus(id: string, status: EventStatus): Promise<Event | null>;

  abstract createMilestone(milestone: Milestone): Promise<Milestone | null>;
  abstract findMilestone(id: string): Promise<Milestone | null>;
  abstract listMilestones(eventId: string): Promise<readonly Milestone[]>;
  abstract listMilestonePage(
    eventId: string,
    request: PageRequest,
  ): Promise<{
    readonly rows: readonly Milestone[];
    readonly totalItems?: number;
  }>;
  abstract saveMilestone(milestone: Milestone): Promise<Milestone | null>;
  abstract deleteMilestone(id: string): Promise<boolean>;

  abstract hasAdvisor(eventId: string, userId: string): Promise<boolean>;
  abstract addAdvisor(eventId: string, userId: string, actorId: string): Promise<void>;
  abstract removeAdvisor(eventId: string, userId: string, actorId: string): Promise<void>;
  abstract listAdvisors(eventId: string, request: PageRequest): Promise<AdvisorRows>;
  abstract advisorEventIds(userId: string): Promise<readonly string[]>;

  /**
   * Aplica o fato de uso, uma vez só.
   *
   * _Limite declarado:_ o fato transporta contagens **absolutas**, de modo que a reentrega
   * converge, mas uma entrega fora de ordem regride a projeção até o fato seguinte. A
   * ordenação por evento é responsabilidade do transporte (`ADR-0020`), e a projeção não é
   * a guarda do limite (`ADR-0032` §17) — a defasagem não autoriza equipe acima do teto.
   */
  abstract projectTeamUsage(fact: TeamUsageFact): Promise<void>;
}
