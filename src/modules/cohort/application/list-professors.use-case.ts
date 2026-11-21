import { Injectable } from '@nestjs/common';

import type { Page, PageRequest } from '@shared/http/pagination';
import { toPage } from '@shared/http/pagination';
import { CourseFacade } from '@modules/course/contracts/course.facade';

import type { CohortProfessorDto } from '../contracts/cohort.dto';
import type { Result } from '../domain/failure';
import { CohortRepository } from '../domain/ports/cohort-repository';
import { readableCohort } from './cohort-scope';

/**
 * Os professores designados à turma (`cohort-read-extensions`, RF-TUR-002).
 *
 * A revogação recebe o identificador do professor; sem esta consulta, quem revoga não teria
 * como sabê-lo. O alcance é o da consulta da turma: a mesma checagem de `FindCohortUseCase`.
 * A revogação remove a linha, e por isso só as designações ativas aparecem.
 */
@Injectable()
export class ListProfessorsUseCase {
  constructor(
    private readonly cohorts: CohortRepository,
    private readonly courses: CourseFacade,
  ) {}

  async execute(
    actorId: string,
    cohortId: string,
    request: PageRequest,
  ): Promise<Result<Page<CohortProfessorDto>>> {
    const scoped = await readableCohort(this.courses, this.cohorts, actorId, cohortId);

    if (!scoped.ok) {
      return { ok: false, failure: scoped.failure };
    }

    const rows = await this.cohorts.listProfessors(cohortId, request);

    return {
      ok: true,
      value: toPage(
        request,
        rows.rows.map((userId) => ({ cohortId, userId })),
        rows.totalItems,
      ),
    };
  }
}
