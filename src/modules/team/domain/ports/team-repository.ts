import type { PageRequest } from '@shared/http/pagination';

import type { TeamAdvisor } from '../advisor';
import type { TeamInvitation } from '../invitation';
import type { TeamMember } from '../member';
import type { Team } from '../team';

export interface TeamRows {
  readonly rows: readonly Team[];
  readonly totalItems?: number;
}

export interface MemberRows {
  readonly rows: readonly TeamMember[];
  readonly totalItems?: number;
}

export interface InvitationRows {
  readonly rows: readonly TeamInvitation[];
  readonly totalItems?: number;
}

/**
 * O fato gravado na outbox, devolvido para que o caso de uso o publique.
 *
 * A gravação é **dentro** da transação (`ADR-0021` §1); a publicação, fora dela. É por
 * isso que o fato sobe até aqui em vez de ser publicado pelo repositório: publicar de
 * dentro da transação anunciaria o que ainda pode ser desfeito.
 */
export interface OutboxFact {
  readonly factId: string;
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export type CreateTeamOutcome =
  | { readonly kind: 'CREATED'; readonly team: Team; readonly facts: readonly OutboxFact[] }
  | { readonly kind: 'LIMIT_REACHED' }
  | { readonly kind: 'DUPLICATE' };

export type JoinOutcome =
  | { readonly kind: 'JOINED'; readonly member: TeamMember; readonly facts: readonly OutboxFact[] }
  | { readonly kind: 'TEAM_FULL' }
  | { readonly kind: 'ALREADY_IN_TEAM' };

export type AcceptOutcome = JoinOutcome | { readonly kind: 'EXPIRED' } | { readonly kind: 'GONE' };

export interface RemovalOutcome {
  readonly removed: boolean;
  readonly facts: readonly OutboxFact[];
}

export abstract class TeamRepository {
  /**
   * Cria a equipe conferindo o limite **dentro** da transação (`ADR-0033` §14).
   *
   * O limite chega como argumento porque é declarado pelo evento, de quem este módulo o
   * recebe; a guarda, porém, é daqui: entre ler o limite e gravar cabe outra criação.
   */
  abstract createTeam(team: Team, maxTeams: number): Promise<CreateTeamOutcome>;

  abstract findById(id: string): Promise<Team | null>;
  abstract listByEvent(eventId: string, request: PageRequest): Promise<TeamRows>;
  abstract countTeams(eventId: string): Promise<number>;

  /** Acrescenta o integrante revalidando lotação e unicidade na escrita (§15). */
  abstract addMember(member: TeamMember, maxTeamSize: number): Promise<JoinOutcome>;

  /** Encerra a participação sem apagá-la (§9). Idempotente. */
  abstract removeMember(teamId: string, userId: string, leftAt: Date): Promise<RemovalOutcome>;

  abstract listMembers(teamId: string, request: PageRequest): Promise<MemberRows>;

  /**
   * As participações de um usuário nesta equipe — a ativa e as encerradas.
   *
   * Sem paginação: a quantidade é limitada pelas entradas e saídas de uma pessoa em uma
   * equipe, que é cota natural (`ADR-0011` §6).
   */
  abstract membershipsOf(teamId: string, userId: string): Promise<readonly TeamMember[]>;

  /** Os integrantes ativos. Limitados pelo tamanho máximo que o evento declara. */
  abstract activeMembersOf(teamId: string): Promise<readonly TeamMember[]>;
  abstract activeMembershipOf(eventId: string, userId: string): Promise<TeamMember | null>;

  /**
   * Quais destes usuários já integram alguma equipe do evento.
   *
   * Uma consulta, qualquer que seja a quantidade de identificadores (`ADR-0011` §9).
   */
  abstract activeMemberIdsOf(
    eventId: string,
    userIds: readonly string[],
  ): Promise<readonly string[]>;

  /** `null` quando já existe convite pendente para o mesmo aluno na mesma equipe. */
  abstract createInvitation(invitation: TeamInvitation): Promise<TeamInvitation | null>;
  abstract findInvitation(id: string): Promise<TeamInvitation | null>;
  abstract listInvitations(teamId: string, request: PageRequest): Promise<InvitationRows>;

  /** Os convites pendentes e não vencidos endereçados ao usuário. */
  abstract listReceivedInvitations(
    userId: string,
    now: Date,
    request: PageRequest,
  ): Promise<InvitationRows>;

  /**
   * Aceita o convite e cria a participação na mesma transação (§15).
   *
   * Reavalia prazo, unicidade e lotação **no instante do aceite**: o convite emitido não
   * reserva vaga, e entre a emissão e o aceite a equipe pode ter lotado.
   */
  abstract acceptInvitation(
    invitationId: string,
    member: TeamMember,
    maxTeamSize: number,
    now: Date,
  ): Promise<AcceptOutcome>;

  abstract declineInvitation(invitationId: string): Promise<boolean>;

  /**
   * Designa o responsável, revogando o anterior. Devolve os fatos gravados na outbox —
   * vazio quando nada mudou.
   */
  abstract assignAdvisor(advisor: TeamAdvisor, actorId: string): Promise<readonly OutboxFact[]>;
  /** Revoga o responsável. Devolve os fatos gravados na outbox — vazio quando nada mudou. */
  abstract revokeAdvisor(
    teamId: string,
    userId: string,
    actorId: string,
  ): Promise<readonly OutboxFact[]>;
  abstract activeAdvisorOf(teamId: string): Promise<TeamAdvisor | null>;
}
