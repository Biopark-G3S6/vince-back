import type { Page, PageRequest } from '@shared/http/pagination';

export interface CohortDto {
  readonly id: string;
  readonly courseId: string;
  readonly identification: string;
  readonly term: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly active: boolean;
}

export interface CreateCohortCommand {
  readonly actorId: string;
  readonly courseId: string;
  readonly identification: string;
  readonly term: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
}

export interface ListCohortsCommand {
  readonly actorId: string;
  readonly courseId: string;
  readonly request: PageRequest;
}

export interface CohortQuery {
  readonly actorId: string;
  readonly cohortId: string;
}

export interface UpdateCohortCommand extends CohortQuery {
  readonly identification?: string;
  readonly term?: string;
  readonly startsAt?: Date;
  readonly endsAt?: Date;
}

export interface ProfessorCommand extends CohortQuery {
  readonly userId: string;
}

export interface EnrollmentCommand extends CohortQuery {
  readonly name: string;
  readonly email: string;
}

export interface EnrollmentDto {
  readonly id: string;
  readonly cohortId: string;
  readonly userId: string;
  readonly status: string;
}

export interface ListEnrollmentsCommand extends CohortQuery {
  readonly request: PageRequest;
}

export interface IssueCohortInvitationCommand extends CohortQuery {
  readonly expiresAt: Date;
}

export interface CohortInvitationDto {
  readonly id: string;
  readonly invitationId: string;
  readonly cohortId: string;
  readonly professorId: string;
  readonly url?: string;
}

export interface ListCohortInvitationsCommand extends CohortQuery {
  readonly request: PageRequest;
}

export interface RevokeCohortInvitationCommand extends CohortQuery {
  readonly invitationId: string;
}

/**
 * Existência, estado e ancestralidade da turma, para o consumidor interno.
 *
 * `exists: false` **não é falha** — é resposta: quem pergunta é outro módulo validando o
 * alvo de um escopo, e uma exceção ali transformaria referência órfã em erro de servidor.
 */
export interface CohortStateDto {
  readonly exists: boolean;
  readonly active: boolean;
  readonly courseId: string | null;
  readonly institutionId: string | null;
}

/**
 * A consulta de vínculo, em lote (`ADR-0011` §9).
 *
 * O alvo é a turma **ou** o curso, nunca os dois: `cohortId` pergunta pelos vínculos
 * daquela turma; `courseId`, pelos de qualquer turma do curso — que é o que um evento de
 * escopo de curso precisa saber (`ADR-0032` §12).
 */
export interface CohortLinkQuery {
  readonly userIds: readonly string[];
  readonly cohortId?: string;
  readonly courseId?: string;
}

/** O vínculo de um usuário com o alvo consultado. */
export interface CohortLinkDto {
  readonly enrolled: boolean;
  readonly professor: boolean;
}

/**
 * O vínculo do usuário com uma turma, e o curso dela.
 *
 * O curso viaja junto porque quem pergunta — `event`, resolvendo alcance — precisa dos
 * dois no mesmo instante, e uma segunda ida por turma seria consulta em laço
 * (`ADR-0011` §7).
 */
export interface CohortScopeDto {
  readonly cohortId: string;
  readonly courseId: string;
  readonly enrolled: boolean;
  readonly professor: boolean;
}

export type CohortPageDto = Page<CohortDto>;
export type EnrollmentPageDto = Page<EnrollmentDto>;
export type CohortInvitationPageDto = Page<CohortInvitationDto>;
