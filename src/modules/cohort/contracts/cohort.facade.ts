import type {
  CohortDto,
  CohortLinkDto,
  CohortLinkQuery,
  CohortInvitationDto,
  CohortInvitationPageDto,
  CohortPageDto,
  CohortScopeDto,
  CohortStateDto,
  CohortQuery,
  CreateCohortCommand,
  EnrollmentCommand,
  EnrollmentDto,
  EnrollmentPageDto,
  IssueCohortInvitationCommand,
  ListCohortInvitationsCommand,
  ListCohortsCommand,
  ListEnrollmentsCommand,
  ProfessorCommand,
  RevokeCohortInvitationCommand,
  UpdateCohortCommand,
} from './cohort.dto';
import type { CohortResult } from './result.dto';

export interface InvitationAcceptedEvent {
  readonly eventId: string;
  readonly invitationId: string;
  readonly userId: string;
  readonly roleCode: string;
  readonly institutionId: string;
  readonly scopeType: string | null;
  readonly scopeId: string | null;
  readonly occurredAt: Date;
}

export abstract class CohortFacade {
  abstract create(command: CreateCohortCommand): Promise<CohortResult<CohortDto>>;
  abstract list(command: ListCohortsCommand): Promise<CohortResult<CohortPageDto>>;
  abstract findById(query: CohortQuery): Promise<CohortResult<CohortDto>>;
  abstract update(command: UpdateCohortCommand): Promise<CohortResult<CohortDto>>;
  abstract deactivate(query: CohortQuery): Promise<CohortResult<CohortDto>>;
  abstract assignProfessor(command: ProfessorCommand): Promise<CohortResult<void>>;
  abstract revokeProfessor(command: ProfessorCommand): Promise<CohortResult<void>>;
  abstract enroll(command: EnrollmentCommand): Promise<CohortResult<EnrollmentDto>>;
  abstract listEnrollments(
    command: ListEnrollmentsCommand,
  ): Promise<CohortResult<EnrollmentPageDto>>;
  abstract issueInvitation(
    command: IssueCohortInvitationCommand,
  ): Promise<CohortResult<CohortInvitationDto>>;
  abstract listInvitations(
    command: ListCohortInvitationsCommand,
  ): Promise<CohortResult<CohortInvitationPageDto>>;
  abstract revokeInvitation(command: RevokeCohortInvitationCommand): Promise<CohortResult<void>>;
  abstract handleInvitationAccepted(event: InvitationAcceptedEvent): Promise<void>;

  /** Existência, estado, curso e instituição da turma. Não falha por inexistência. */
  abstract stateOf(cohortId: string): Promise<CohortStateDto>;

  /**
   * O vínculo de vários usuários com a turma, ou com qualquer turma do curso, em lote.
   *
   * Executa em número de consultas **independente da quantidade** de identificadores
   * informados (`ADR-0011` §9). Usuário ausente do mapa não tem vínculo algum.
   */
  abstract linksOf(query: CohortLinkQuery): Promise<ReadonlyMap<string, CohortLinkDto>>;

  /**
   * As turmas a que o usuário está ligado — por matrícula ativa ou por designação —, com
   * o curso de cada uma.
   *
   * É a consulta inversa de `linksOf`, e existe para quem resolve o **alcance** do ator
   * sem conhecer de antemão as turmas a perguntar (`ADR-0032` §21). Duas consultas,
   * qualquer que seja a quantidade de vínculos.
   */
  abstract scopesOf(userId: string): Promise<readonly CohortScopeDto[]>;
}
