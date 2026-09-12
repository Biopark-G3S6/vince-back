import type { Page, PageRequest } from '@shared/http/pagination';

import type {
  CreateInstitutionCommand,
  InstitutionAdminCommand,
  InstitutionDto,
  InstitutionQuery,
  InstitutionStateCommand,
  InstitutionStateDto,
  UpdateInstitutionCommand,
} from './institution.dto';
import type { InstitutionResult } from './result.dto';
import type {
  InvitationIssuedDto,
  InvitationPageDto,
  IssueInvitationCommand,
  ListInvitationsCommand,
  RevokeInvitationCommand,
} from './invitation.dto';

/**
 * A única superfície pública do módulo `institution` (`ADR-0004` §1, `ADR-0028` §20).
 *
 * Declarada como `abstract class` para servir de token de injeção (`ADR-0004` §2, §3).
 *
 * A superfície tem **duas metades com públicos distintos**, e isso é deliberado:
 *
 *   - o cadastro, a consulta, a listagem, a alteração, o estado e a designação existem
 *     para o controlador **deste módulo**, que é quem publica as rotas de RF-INS-001 e
 *     RF-INS-002;
 *   - `stateOf` e `statesOf` existem para o **consumidor interno** — a composição de
 *     borda que zera as permissões de quem pertence a instituição inativa
 *     (`ADR-0028` §13, §21).
 *
 * `ADR-0028` §22 mantém a primeira metade fora do alcance de outro módulo por acordo, e
 * não por tipo: nenhum módulo tem motivo para cadastrar instituição alheia, e a revisão é
 * o que o impede.
 */
export abstract class InstitutionFacade {
  abstract create(command: CreateInstitutionCommand): Promise<InstitutionResult<InstitutionDto>>;

  abstract findById(query: InstitutionQuery): Promise<InstitutionResult<InstitutionDto>>;

  /**
   * A listagem paginada (`ADR-0025` §21 a §25). Inclui ativas e inativas, distinguidas
   * pelo estado: a desativação não some com a instituição da lista.
   */
  abstract list(request: PageRequest): Promise<Page<InstitutionDto>>;

  abstract update(command: UpdateInstitutionCommand): Promise<InstitutionResult<InstitutionDto>>;

  /** Idempotente: desativar instituição já inativa conclui com sucesso e nada muda. */
  abstract deactivate(command: InstitutionStateCommand): Promise<InstitutionResult<InstitutionDto>>;

  /** Idempotente. Devolve o acesso aos usuários da instituição, sem nova autenticação. */
  abstract activate(command: InstitutionStateCommand): Promise<InstitutionResult<InstitutionDto>>;

  /**
   * Designa administrador institucional (RF-INS-002). Idempotente (E1).
   *
   * Atribui o papel pela fachada do `access` **antes** de gravar o vínculo
   * (`ADR-0028` §18): das duas falhas parciais possíveis, papel sem vínculo é a inócua.
   */
  abstract assignAdmin(command: InstitutionAdminCommand): Promise<InstitutionResult<void>>;

  /**
   * Revoga o vínculo (RF-INS-002). Idempotente.
   *
   * Remove o papel apenas quando não resta vínculo que o justifique (RN3,
   * `ADR-0028` §19).
   */
  abstract revokeAdmin(command: InstitutionAdminCommand): Promise<InstitutionResult<void>>;

  abstract issueInvitation(
    command: IssueInvitationCommand,
  ): Promise<InstitutionResult<InvitationIssuedDto>>;

  abstract listInvitations(
    command: ListInvitationsCommand,
  ): Promise<InstitutionResult<InvitationPageDto>>;

  abstract revokeInvitation(command: RevokeInvitationCommand): Promise<InstitutionResult<void>>;

  /** Existência e estado, para o consumidor interno. Não falha por inexistência. */
  abstract stateOf(institutionId: string): Promise<InstitutionStateDto>;

  /**
   * O mesmo, em lote. Executa em número de consultas **independente da quantidade** de
   * identificadores informados (`ADR-0028` §21, `ADR-0011` §9).
   */
  abstract statesOf(
    institutionIds: readonly string[],
  ): Promise<ReadonlyMap<string, InstitutionStateDto>>;
}
