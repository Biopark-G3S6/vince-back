import { Injectable } from '@nestjs/common';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { CohortFacade } from '@modules/cohort/contracts/cohort.facade';
import { CourseFacade } from '@modules/course/contracts/course.facade';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';

import { EVENT_SCOPE, type Event, type EventScopeType } from '../domain/event';
import { FAILURE, fail, ok, type Result } from '../domain/failure';
import type { EventReach, ScopeRef } from '../domain/ports/event-repository';

/** A ancestralidade derivada do alvo, gravada na criação (`ADR-0032` §9). */
export interface EventAncestry {
  readonly institutionId: string;
  readonly courseId: string | null;
}

/**
 * O escopo do evento, resolvido pelas fachadas dos módulos que possuem o vínculo
 * (`ADR-0032` §12).
 *
 * Três perguntas, e as três atravessam fronteira: **de quem é o alvo**, **quem o alvo
 * alcança** e **quem o alvo torna elegível**. Nenhuma delas se responde com uma consulta
 * ao schema `event` — a turma, o curso, a instituição e a conta pertencem a outros
 * módulos, e `ADR-0006` proíbe lê-los diretamente.
 *
 * Toda consulta aqui é **em lote ou de cota fixa**: `reachOf` faz quatro chamadas,
 * qualquer que seja a quantidade de vínculos do ator, e `eligibilityOf` faz duas,
 * qualquer que seja a quantidade de usuários informados (`ADR-0011` §9, `ADR-0032` §13).
 */
@Injectable()
export class EventScope {
  constructor(
    private readonly institutions: InstitutionFacade,
    private readonly courses: CourseFacade,
    private readonly cohorts: CohortFacade,
    private readonly access: AccessFacade,
  ) {}

  /**
   * O alvo existe, está ativo e o ator é o seu dono?
   *
   * Alvo inexistente e alvo inativo são o **mesmo** caso para quem pergunta —
   * `RESOURCE_NOT_FOUND`, conforme RF-EVT-001 E2 —, e escopo acima do vínculo é
   * `EVENT_SCOPE_NOT_ALLOWED` (E1). A ordem importa: confirmar o alvo antes de falar de
   * permissão evita dizer "não pode" sobre o que não existe.
   */
  async ownedTarget(
    actorId: string,
    scopeType: EventScopeType,
    scopeId: string,
  ): Promise<Result<EventAncestry>> {
    const ancestry = await this.ancestryOf(scopeType, scopeId);

    if (ancestry === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    return (await this.owns(actorId, scopeType, scopeId, ancestry))
      ? ok(ancestry)
      : fail(FAILURE.EVENT_SCOPE_NOT_ALLOWED);
  }

  /** O ator é dono do escopo de um evento já criado, ou quem o criou? */
  async ownsEvent(actorId: string, event: Event): Promise<boolean> {
    if (event.ownerId === actorId) {
      return true;
    }

    return this.owns(actorId, event.scopeType, event.scopeId, {
      institutionId: event.institutionId,
      courseId: event.courseId,
    });
  }

  /**
   * O alcance do ator (RF-EVT-004 RN1).
   *
   * As quatro dimensões se somam, e não se excluem por papel: a mesma pessoa pode ser
   * aluno de uma turma, orientador de um evento e coordenadora de um curso. Resolver por
   * papel obrigaria a escolher uma, e escolheria errado em todos os casos mistos.
   */
  async reachOf(actorId: string): Promise<EventReach> {
    const [cohortScopes, institutionLinks, coordinated, administered] = await Promise.all([
      this.cohorts.scopesOf(actorId),
      this.access.institutionLinksOf([actorId]),
      this.courses.coordinatedBy(actorId),
      this.institutions.administeredBy(actorId),
    ]);

    const institutionId = institutionLinks.get(actorId) ?? null;
    const scopes: ScopeRef[] = cohortScopes.map((scope) => ({
      scopeType: EVENT_SCOPE.COHORT,
      scopeId: scope.cohortId,
    }));

    // A turma dá alcance também ao evento do curso dela: quem a integra é elegível no
    // escopo superior (RF-EVT-001 RN2).
    for (const courseId of new Set(cohortScopes.map((scope) => scope.courseId))) {
      scopes.push({ scopeType: EVENT_SCOPE.COURSE, scopeId: courseId });
    }

    if (institutionId !== null) {
      scopes.push({ scopeType: EVENT_SCOPE.INSTITUTION, scopeId: institutionId });
    }

    return {
      scopes,
      courseIds: coordinated,
      institutionIds: administered,
      ownerId: actorId,
      advisorId: actorId,
    };
  }

  /**
   * Quais destes usuários o escopo torna elegíveis (RF-EVT-001 RN2)?
   *
   * O coordenador do curso entra como elegível nos escopos de curso e de turma: ele é
   * parte do corpo docente do alvo, embora não precise estar designado a turma alguma.
   * No escopo institucional, a elegibilidade é o próprio vínculo da conta — e conta
   * desativada fica fora, porque `institutionLinksOf` só devolve conta ativa.
   */
  async eligibilityOf(
    event: Pick<Event, 'scopeType' | 'scopeId' | 'institutionId' | 'courseId'>,
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, boolean>> {
    const unique = [...new Set(userIds)];

    if (unique.length === 0) {
      return new Map();
    }

    if (event.scopeType === EVENT_SCOPE.INSTITUTION) {
      const links = await this.access.institutionLinksOf(unique);

      return new Map(unique.map((id) => [id, links.get(id) === event.institutionId]));
    }

    const target =
      event.scopeType === EVENT_SCOPE.COHORT
        ? { userIds: unique, cohortId: event.scopeId }
        : { userIds: unique, courseId: event.scopeId };

    const [links, coordinatorId] = await Promise.all([
      this.cohorts.linksOf(target),
      event.courseId === null ? Promise.resolve(null) : this.courses.coordinatorOf(event.courseId),
    ]);

    return new Map(
      unique.map((id) => {
        const link = links.get(id);

        return [
          id,
          id === coordinatorId || (link?.enrolled ?? false) || (link?.professor ?? false),
        ];
      }),
    );
  }

  /** A ancestralidade do alvo, ou `null` quando ele não existe ou está inativo. */
  private async ancestryOf(
    scopeType: EventScopeType,
    scopeId: string,
  ): Promise<EventAncestry | null> {
    if (scopeType === EVENT_SCOPE.INSTITUTION) {
      const state = await this.institutions.stateOf(scopeId);

      return state.exists && state.active ? { institutionId: scopeId, courseId: null } : null;
    }

    if (scopeType === EVENT_SCOPE.COURSE) {
      const state = await this.courses.stateOf(scopeId);

      return state.exists && state.active && state.institutionId !== null
        ? { institutionId: state.institutionId, courseId: scopeId }
        : null;
    }

    const state = await this.cohorts.stateOf(scopeId);

    return state.exists && state.active && state.institutionId !== null && state.courseId !== null
      ? { institutionId: state.institutionId, courseId: state.courseId }
      : null;
  }

  /**
   * O ator é dono deste alvo?
   *
   * A propriedade desce a hierarquia: quem administra a instituição é dono de tudo dentro
   * dela; quem coordena o curso, de tudo dentro dele; o professor designado, apenas da
   * sua turma. É o que faz o escopo **superior** ao vínculo ser recusado, e não o
   * inferior.
   */
  private async owns(
    actorId: string,
    scopeType: EventScopeType,
    scopeId: string,
    ancestry: EventAncestry,
  ): Promise<boolean> {
    if ((await this.institutions.administeredBy(actorId)).includes(ancestry.institutionId)) {
      return true;
    }

    if (scopeType === EVENT_SCOPE.INSTITUTION) {
      return false;
    }

    if (
      ancestry.courseId !== null &&
      (await this.courses.coordinatorOf(ancestry.courseId)) === actorId
    ) {
      return true;
    }

    if (scopeType === EVENT_SCOPE.COURSE) {
      return false;
    }

    const links = await this.cohorts.linksOf({ userIds: [actorId], cohortId: scopeId });

    return links.get(actorId)?.professor ?? false;
  }
}
