import { Injectable } from '@nestjs/common';

import { EventFacade } from '@modules/event/contracts/event.facade';
import type { EventStateDto } from '@modules/event/contracts/event.dto';

import { FAILURE, fail, ok, type Result } from '../domain/failure';

/**
 * O evento, resolvido pela fachada de quem o possui (`ADR-0033` §12).
 *
 * Tudo o que autoriza uma operação de equipe vive no evento: o estado, os limites, a
 * orientação e a propriedade do escopo. Este módulo não guarda nenhuma dessas coisas, e
 * `ADR-0006` o proíbe de lê-las — então pergunta, e pergunta uma vez por operação.
 *
 * A ordem das recusas é sempre a mesma: existência, estado, titularidade. Falar de
 * permissão antes de confirmar o evento revelaria a existência de quem não se alcança.
 */
@Injectable()
export class TeamScope {
  constructor(private readonly events: EventFacade) {}

  /** O evento existe e está ativo? */
  async activeEvent(eventId: string): Promise<Result<EventStateDto>> {
    const state = await this.events.stateOf(eventId);

    if (!state.exists) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    // Evento cancelado recusa formação de equipe (RF-EQP-001 E3, RF-EQP-002 E4).
    return state.active ? ok(state) : fail(FAILURE.VALIDATION_FAILED);
  }

  /** O ator orienta no evento? (RF-EQP-001 E2, RF-EQP-003, RF-EQP-004, RF-EQP-006 E1.) */
  async advisorEvent(eventId: string, actorId: string): Promise<Result<EventStateDto>> {
    const state = await this.activeEvent(eventId);

    if (!state.ok) {
      return state;
    }

    return (await this.events.isAdvisor(eventId, actorId))
      ? state
      : fail(FAILURE.ADVISOR_NOT_ASSIGNED_TO_EVENT);
  }

  /** O ator é dono do escopo do evento? (RF-EQP-005 E2.) */
  async ownedEvent(eventId: string, actorId: string): Promise<Result<EventStateDto>> {
    const state = await this.activeEvent(eventId);

    if (!state.ok) {
      return state;
    }

    return (await this.events.isScopeOwner(eventId, actorId))
      ? state
      : fail(FAILURE.PERMISSION_DENIED);
  }

  /**
   * O ator alcança o evento para **leitura**?
   *
   * Três origens: orientar, ser dono do escopo, ou ser elegível por ele. A terceira é o
   * que permite ao aluno consultar as equipes e as suas vagas antes de ingressar
   * (RF-EQP-002, fluxo principal). Fora das três, o evento é indistinguível de
   * inexistente.
   */
  async readableEvent(eventId: string, actorId: string): Promise<Result<EventStateDto>> {
    const state = await this.events.stateOf(eventId);

    if (!state.exists) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    if (await this.events.isAdvisor(eventId, actorId)) {
      return ok(state);
    }
    if (await this.events.isScopeOwner(eventId, actorId)) {
      return ok(state);
    }

    return (await this.isEligible(eventId, actorId)) ? ok(state) : fail(FAILURE.RESOURCE_NOT_FOUND);
  }

  /** O escopo do evento torna este usuário elegível? (RF-EQP-002 E1, RF-EQP-003 E1.) */
  async isEligible(eventId: string, userId: string): Promise<boolean> {
    const eligibility = await this.events.eligibilityOf({ eventId, userIds: [userId] });

    return eligibility.get(userId) === true;
  }
}
