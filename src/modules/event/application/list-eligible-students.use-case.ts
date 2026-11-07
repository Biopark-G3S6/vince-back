import { Injectable } from '@nestjs/common';

import { toPage, type Page } from '@shared/http/pagination';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { CohortFacade } from '@modules/cohort/contracts/cohort.facade';

import type { EligibleStudentQuery } from '../contracts/event.dto';
import { EVENT_SCOPE } from '../domain/event';
import { EventRepository } from '../domain/ports/event-repository';

/** Página vazia, mas válida: escopo sem aluno algum não é erro. */
const EMPTY = { rows: [] as readonly string[] };

/**
 * Os alunos que o escopo do evento torna elegíveis (`RF-EQP-006`).
 *
 * Enumera percorrendo o módulo dono do vínculo: a turma e o curso, por `cohort`; a
 * instituição, por `access`, filtrando pelo papel `STUDENT`. Uma consulta por página, e
 * nenhuma por aluno (`ADR-0011` §6, §7).
 *
 * O desconto de quem já integra equipe **não** acontece aqui: é fato do módulo que possui
 * a equipe, e pedi-lo fecharia o ciclo que `ADR-0005` §6 proíbe. Quem monta a lista final
 * é aquele módulo, descontando desta página os seus próprios integrantes.
 */
@Injectable()
export class ListEligibleStudentsUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly cohorts: CohortFacade,
    private readonly access: AccessFacade,
  ) {}

  async execute(query: EligibleStudentQuery): Promise<Page<string>> {
    const event = await this.events.findById(query.eventId);

    if (event === null) {
      return toPage(query.request, EMPTY.rows);
    }

    if (event.scopeType === EVENT_SCOPE.INSTITUTION) {
      return this.access.listByRole({
        institutionId: event.institutionId,
        roleCode: 'STUDENT',
        request: query.request,
      });
    }

    return this.cohorts.studentsOf(
      event.scopeType === EVENT_SCOPE.COHORT
        ? { cohortId: event.scopeId, request: query.request }
        : { courseId: event.scopeId, request: query.request },
    );
  }
}
