import type {
  CreateTeamCommand,
  EligibleStudentPageDto,
  InvitationResponseCommand,
  InviteMemberCommand,
  JoinTeamCommand,
  ListEligibleStudentsCommand,
  ListMembersCommand,
  ListTeamInvitationsCommand,
  ListReceivedInvitationsCommand,
  MemberRoleCommand,
  ListTeamsCommand,
  MemberCommand,
  MemberDto,
  MemberPageDto,
  TeamAdvisorCommand,
  TeamDto,
  TeamInvitationDto,
  TeamInvitationPageDto,
  TeamMembershipDto,
  TeamPageDto,
  TeamQuery,
  TeamStateDto,
} from './team.dto';
import type { TeamResult } from './result.dto';

/**
 * A única superfície pública do módulo `team` (`ADR-0004` §1, `ADR-0033` §24).
 *
 * Declarada como `abstract class` para servir de token de injeção (`ADR-0004` §2, §3).
 *
 * `stateOf`, `membershipOf` e `activeMemberIdsOf` existem para o **consumidor interno** —
 * `article`, que precisa do evento da equipe e de quem responde por ela sem poder ler as
 * suas tabelas (`ADR-0006`).
 *
 * Não há aqui operação sobre o artigo: ele pertence a `article`, e esta vertical apenas
 * publica o fato de que a equipe nasceu (`ADR-0033` §17).
 */
export abstract class TeamFacade {
  abstract create(command: CreateTeamCommand): Promise<TeamResult<TeamDto>>;
  abstract list(command: ListTeamsCommand): Promise<TeamResult<TeamPageDto>>;
  abstract findById(query: TeamQuery): Promise<TeamResult<TeamDto>>;

  /** O ingresso por conta própria do aluno elegível (RF-EQP-002). */
  abstract join(command: JoinTeamCommand): Promise<TeamResult<MemberDto>>;
  abstract assignMember(command: MemberCommand): Promise<TeamResult<MemberDto>>;
  /** Idempotente, e **não destrutivo**: encerra a participação sem apagá-la. */
  abstract setMemberRole(command: MemberRoleCommand): Promise<TeamResult<MemberDto>>;
  abstract removeMember(command: MemberCommand): Promise<TeamResult<void>>;
  abstract listMembers(command: ListMembersCommand): Promise<TeamResult<MemberPageDto>>;

  abstract invite(command: InviteMemberCommand): Promise<TeamResult<TeamInvitationDto>>;
  /** Reavalia elegibilidade, unicidade e lotação no instante do aceite (RF-EQP-004 RN2). */
  abstract listReceivedInvitations(
    command: ListReceivedInvitationsCommand,
  ): Promise<TeamResult<TeamInvitationPageDto>>;
  abstract acceptInvitation(command: InvitationResponseCommand): Promise<TeamResult<MemberDto>>;
  abstract declineInvitation(command: InvitationResponseCommand): Promise<TeamResult<void>>;
  abstract listInvitations(
    command: ListTeamInvitationsCommand,
  ): Promise<TeamResult<TeamInvitationPageDto>>;

  /** Nomeia o responsável entre os orientadores do evento, substituindo o anterior. */
  abstract assignAdvisor(command: TeamAdvisorCommand): Promise<TeamResult<void>>;
  abstract revokeAdvisor(command: TeamAdvisorCommand): Promise<TeamResult<void>>;

  /** Os alunos elegíveis do evento que ainda não integram equipe alguma (RF-EQP-006). */
  abstract listEligibleStudents(
    command: ListEligibleStudentsCommand,
  ): Promise<TeamResult<EligibleStudentPageDto>>;

  /** Existência, evento e responsável. Não falha por inexistência. */
  abstract stateOf(teamId: string): Promise<TeamStateDto>;

  /** O vínculo do usuário com a equipe: integra agora, já integrou, ou nenhum dos dois. */
  abstract membershipOf(teamId: string, userId: string): Promise<TeamMembershipDto>;

  /**
   * Os integrantes ativos da equipe.
   *
   * Sem paginação, e deliberadamente: a lista é limitada pelo tamanho máximo que o evento
   * declara, que é cota natural (`ADR-0011` §6 exige paginar o que não tem cota).
   */
  abstract activeMemberIdsOf(teamId: string): Promise<readonly string[]>;
}
