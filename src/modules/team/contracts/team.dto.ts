/**
 * DTOs da equipe.
 *
 * Nenhum tipo do Prisma entra aqui (`ADR-0004` §8, §9, `ADR-0033` §24): evento, equipe,
 * usuário e artigo atravessam a fronteira como texto.
 */
import type { Page, PageRequest } from '@shared/http/pagination';

export interface TeamDto {
  readonly id: string;
  readonly eventId: string;
  readonly institutionId: string;
  readonly identification: string;
}

export interface CreateTeamCommand {
  readonly actorId: string;
  readonly eventId: string;
  readonly identification: string;
}

export interface TeamQuery {
  readonly actorId: string;
  readonly teamId: string;
}

export interface ListTeamsCommand {
  readonly actorId: string;
  readonly eventId: string;
  readonly request: PageRequest;
}

export interface MemberDto {
  readonly id: string;
  readonly teamId: string;
  readonly eventId: string;
  readonly userId: string;
  readonly status: string;
  readonly joinedAt: Date;
  readonly leftAt: Date | null;
}

/** O ingresso por conta própria (RF-EQP-002): o ator é o próprio aluno. */
export type JoinTeamCommand = TeamQuery;

/** A designação e a remoção pelo orientador (RF-EQP-003). */
export interface MemberCommand extends TeamQuery {
  readonly userId: string;
}

export interface ListMembersCommand extends TeamQuery {
  readonly request: PageRequest;
}

export interface InviteMemberCommand extends TeamQuery {
  readonly userId: string;
  readonly expiresAt: Date;
}

export interface TeamInvitationDto {
  readonly id: string;
  readonly teamId: string;
  readonly eventId: string;
  readonly userId: string;
  readonly status: string;
  readonly expiresAt: Date;
}

/** O aceite e a recusa: o ator é o próprio convidado. */
export interface InvitationResponseCommand {
  readonly actorId: string;
  readonly invitationId: string;
}

export interface ListTeamInvitationsCommand extends TeamQuery {
  readonly request: PageRequest;
}

export interface TeamAdvisorCommand extends TeamQuery {
  readonly userId: string;
}

export interface ListEligibleStudentsCommand {
  readonly actorId: string;
  readonly eventId: string;
  readonly request: PageRequest;
}

/**
 * Existência, evento e responsabilidade, para o consumidor interno (`ADR-0033` §25).
 *
 * `exists: false` **não é falha** — é resposta: quem pergunta é `article`, decidindo se
 * pode mostrar ou avaliar, e uma exceção ali transformaria referência órfã em erro de
 * servidor.
 */
export interface TeamStateDto {
  readonly exists: boolean;
  readonly eventId: string | null;
  readonly institutionId: string | null;
  /** O orientador responsável corrente, ou `null`. É ele quem avalia (RF-EQP-005 RN2). */
  readonly responsibleAdvisorId: string | null;
}

/**
 * O vínculo de um usuário com a equipe.
 *
 * Duas respostas, e não uma: `active` diz quem integra agora; `participated`, quem já
 * integrou. A segunda existe porque a nota individual e o histórico de quem foi removido
 * continuam consultáveis (`ADR-0030` §15).
 */
export interface TeamMembershipDto {
  readonly active: boolean;
  readonly participated: boolean;
}

export type TeamPageDto = Page<TeamDto>;
export type MemberPageDto = Page<MemberDto>;
export type TeamInvitationPageDto = Page<TeamInvitationDto>;
export type EligibleStudentPageDto = Page<string>;
