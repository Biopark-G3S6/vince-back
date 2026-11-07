import { Injectable } from '@nestjs/common';

import { CourseFacade } from '@modules/course/contracts/course.facade';

import { toPage, type Page } from '@shared/http/pagination';

import type {
  CohortLinkDto,
  CohortLinkQuery,
  CohortScopeDto,
  CohortStateDto,
  CohortStudentQuery,
} from '../contracts/cohort.dto';
import { CohortRepository } from '../domain/ports/cohort-repository';

/**
 * As consultas de vínculo e de estado que outro módulo faz à turma.
 *
 * Existem para quem avalia escopo fora daqui — `event`, ao validar o alvo de um evento e
 * a elegibilidade dos seus participantes (`ADR-0032` §12). Não decidem autorização
 * alguma: devolvem o vínculo, e quem pergunta decide o que ele significa.
 */
@Injectable()
export class FindCohortLinksUseCase {
  constructor(
    private readonly cohorts: CohortRepository,
    private readonly courses: CourseFacade,
  ) {}

  /**
   * O estado da turma, com o curso e a instituição a que ela pertence.
   *
   * A instituição vem da fachada do curso, e não de coluna local: a turma conhece o seu
   * curso, e é o curso que conhece a sua instituição (`ADR-0006`).
   */
  async stateOf(cohortId: string): Promise<CohortStateDto> {
    const cohort = await this.cohorts.findById(cohortId);

    if (cohort === null) {
      return { exists: false, active: false, courseId: null, institutionId: null };
    }

    const course = await this.courses.stateOf(cohort.courseId);

    return {
      exists: true,
      active: cohort.active && course.exists && course.active,
      courseId: cohort.courseId,
      institutionId: course.institutionId,
    };
  }

  async linksOf(query: CohortLinkQuery): Promise<ReadonlyMap<string, CohortLinkDto>> {
    return this.cohorts.linksOf(query);
  }

  async scopesOf(userId: string): Promise<readonly CohortScopeDto[]> {
    return this.cohorts.scopesOf(userId);
  }

  async studentsOf(query: CohortStudentQuery): Promise<Page<string>> {
    const rows = await this.cohorts.studentsOf(query, query.request);

    return toPage(query.request, rows.rows, rows.totalItems);
  }
}
