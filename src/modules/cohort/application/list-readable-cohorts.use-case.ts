import { Injectable } from '@nestjs/common';

import { CourseFacade } from '@modules/course/contracts/course.facade';
import { toPage, type Page, type PageRequest } from '@shared/http/pagination';

import type { Cohort } from '../domain/cohort';
import { CohortRepository } from '../domain/ports/cohort-repository';

/**
 * As turmas que o ator lê, numa consulta (`cohort-listing`): o mesmo alcance da leitura por
 * identificador — coordenador do curso, professor designado, aluno matriculado.
 */
@Injectable()
export class ListReadableCohortsUseCase {
  constructor(
    private readonly cohorts: CohortRepository,
    private readonly courses: CourseFacade,
  ) {}

  async execute(actorId: string, request: PageRequest): Promise<Page<Cohort>> {
    const coordinated = await this.courses.coordinatedBy(actorId);
    const rows = await this.cohorts.listReadableBy(actorId, coordinated, request);

    return toPage(request, rows.rows, rows.totalItems);
  }
}
