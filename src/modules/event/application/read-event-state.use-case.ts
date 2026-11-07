import { Injectable } from '@nestjs/common';

import type { EventStateDto } from '../contracts/event.dto';
import { EVENT_STATUS } from '../domain/event';
import type { Milestone } from '../domain/milestone';
import { currentMilestone } from '../domain/milestone';
import { EventRepository } from '../domain/ports/event-repository';
import { EventScope } from './event-scope';

/** O que se devolve para identificador que não corresponde a evento algum. */
const ABSENT: EventStateDto = {
  exists: false,
  active: false,
  institutionId: null,
  courseId: null,
  scopeType: null,
  scopeId: null,
  ownerId: null,
  maxTeams: 0,
  maxTeamSize: 0,
};

/**
 * As consultas que outro módulo faz ao evento (`ADR-0032` §25).
 *
 * `exists: false` não é falha, é resposta: quem pergunta é `team` decidindo se pode
 * escrever, e uma exceção ali transformaria referência órfã em erro de servidor.
 *
 * Nenhuma destas operações verifica permissão. Quem chama é outro caso de uso, que já
 * verificou a sua; repetir a verificação aqui exigiria conhecer o ator de quem pergunta,
 * e não é isso que `ADR-0014` §11 e §12 dividem entre borda e caso de uso.
 */
@Injectable()
export class ReadEventStateUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly scope: EventScope,
  ) {}

  async stateOf(eventId: string): Promise<EventStateDto> {
    const event = await this.events.findById(eventId);

    if (event === null) {
      return ABSENT;
    }

    return {
      exists: true,
      active: event.status === EVENT_STATUS.ACTIVE,
      institutionId: event.institutionId,
      courseId: event.courseId,
      scopeType: event.scopeType,
      scopeId: event.scopeId,
      ownerId: event.ownerId,
      maxTeams: event.maxTeams,
      maxTeamSize: event.maxTeamSize,
    };
  }

  async isAdvisor(eventId: string, userId: string): Promise<boolean> {
    return this.events.hasAdvisor(eventId, userId);
  }

  async eligibilityOf(
    eventId: string,
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, boolean>> {
    const event = await this.events.findById(eventId);

    return event === null ? new Map() : this.scope.eligibilityOf(event, userIds);
  }

  async currentMilestoneOf(eventId: string, now = new Date()): Promise<Milestone | null> {
    return currentMilestone(await this.events.listMilestones(eventId), now);
  }
}
