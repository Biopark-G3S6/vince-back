import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

import { offsetOf, takeOf, type PageRequest } from '@shared/http/pagination';

import { TEAM_ADVISOR_STATUS, type TeamAdvisor, type TeamAdvisorStatus } from '../domain/advisor';
import {
  TEAM_INVITATION_STATUS,
  type TeamInvitation,
  type TeamInvitationStatus,
} from '../domain/invitation';
import { MEMBER_STATUS, type MemberStatus, type TeamMember } from '../domain/member';
import type { Team } from '../domain/team';
import {
  TeamRepository,
  type AcceptOutcome,
  type CreateTeamOutcome,
  type InvitationRows,
  type JoinOutcome,
  type MemberRows,
  type OutboxFact,
  type RemovalOutcome,
  type TeamRows,
} from '../domain/ports/team-repository';
import { TeamPrisma, type TeamTransaction } from './team-prisma';

const UNIQUE_VIOLATION = 'P2002';

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

const TEAM_COLUMNS = {
  id: true,
  eventId: true,
  institutionId: true,
  identification: true,
} as const;

const MEMBER_COLUMNS = {
  id: true,
  eventId: true,
  teamId: true,
  userId: true,
  status: true,
  joinedAt: true,
  leftAt: true,
} as const;

const INVITATION_COLUMNS = {
  id: true,
  eventId: true,
  teamId: true,
  userId: true,
  status: true,
  expiresAt: true,
} as const;

const ADVISOR_COLUMNS = {
  id: true,
  teamId: true,
  userId: true,
  status: true,
  revokedAt: true,
} as const;

function toTeam(row: {
  id: string;
  eventId: string;
  institutionId: string;
  identification: string;
}): Team {
  return row;
}

function toMember(row: {
  id: string;
  eventId: string;
  teamId: string;
  userId: string;
  status: string;
  joinedAt: Date;
  leftAt: Date | null;
}): TeamMember {
  return { ...row, status: row.status as MemberStatus };
}

function toInvitation(row: {
  id: string;
  eventId: string;
  teamId: string;
  userId: string;
  status: string;
  expiresAt: Date;
}): TeamInvitation {
  return { ...row, status: row.status as TeamInvitationStatus };
}

function toAdvisor(row: {
  id: string;
  teamId: string;
  userId: string;
  status: string;
  revokedAt: Date | null;
}): TeamAdvisor {
  return { ...row, status: row.status as TeamAdvisorStatus };
}

/** As chaves de serialização. Prefixadas para não colidir com outro módulo. */
const eventLock = (eventId: string): string => `team:event:${eventId}`;
const teamLock = (teamId: string): string => `team:team:${teamId}`;

@Injectable()
export class PrismaTeamRepository extends TeamRepository {
  constructor(private readonly prisma: TeamPrisma) {
    super();
  }

  async createTeam(team: Team, maxTeams: number): Promise<CreateTeamOutcome> {
    return this.prisma.transaction(async (tx) => {
      await tx.lock(eventLock(team.eventId));

      if ((await tx.team.count({ where: { eventId: team.eventId } })) >= maxTeams) {
        return { kind: 'LIMIT_REACHED' } as const;
      }

      try {
        const created = toTeam(
          await tx.team.create({
            data: {
              id: team.id,
              eventId: team.eventId,
              institutionId: team.institutionId,
              identification: team.identification,
            },
            select: TEAM_COLUMNS,
          }),
        );
        const facts = [
          await this.recordFact(tx, 'TeamCreated', {
            teamId: created.id,
            eventId: created.eventId,
            institutionId: created.institutionId,
            identification: created.identification,
            ...(await this.usageOf(tx, created.eventId)),
          }),
        ];

        return { kind: 'CREATED', team: created, facts } as const;
      } catch (error: unknown) {
        if (isPrismaError(error, UNIQUE_VIOLATION)) {
          return { kind: 'DUPLICATE' } as const;
        }

        throw error;
      }
    });
  }

  async findById(id: string): Promise<Team | null> {
    const row = await this.prisma.team.findUnique({ where: { id }, select: TEAM_COLUMNS });

    return row === null ? null : toTeam(row);
  }

  async listByEvent(eventId: string, request: PageRequest): Promise<TeamRows> {
    const rows = await this.prisma.team.findMany({
      where: { eventId },
      select: TEAM_COLUMNS,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: offsetOf(request),
      take: takeOf(request),
    });
    const teams = rows.map(toTeam);

    return request.withTotal
      ? { rows: teams, totalItems: await this.prisma.team.count({ where: { eventId } }) }
      : { rows: teams };
  }

  async countTeams(eventId: string): Promise<number> {
    return this.prisma.team.count({ where: { eventId } });
  }

  async addMember(member: TeamMember, maxTeamSize: number): Promise<JoinOutcome> {
    return this.prisma.transaction(async (tx) => {
      await tx.lock(teamLock(member.teamId));

      return this.join(tx, member, maxTeamSize);
    });
  }

  async removeMember(teamId: string, userId: string, leftAt: Date): Promise<RemovalOutcome> {
    return this.prisma.transaction(async (tx) => {
      await tx.lock(teamLock(teamId));

      const current = await tx.teamMember.findFirst({
        where: { teamId, userId, status: MEMBER_STATUS.ACTIVE },
        select: MEMBER_COLUMNS,
      });

      if (current === null) {
        return { removed: false, facts: [] };
      }

      // A linha é **encerrada**, não apagada: a contribuição registrada no artigo aponta
      // para esta participação (`ADR-0033` §9).
      await tx.teamMember.update({
        where: { id: current.id },
        data: { status: MEMBER_STATUS.REMOVED, leftAt },
      });

      return {
        removed: true,
        facts: [
          await this.recordFact(tx, 'TeamCompositionChanged', {
            teamId,
            eventId: current.eventId,
            userId,
            operation: 'REMOVED',
            memberCount: await tx.teamMember.count({
              where: { teamId, status: MEMBER_STATUS.ACTIVE },
            }),
            ...(await this.usageOf(tx, current.eventId)),
          }),
        ],
      };
    });
  }

  async listMembers(teamId: string, request: PageRequest): Promise<MemberRows> {
    const rows = await this.prisma.member.findMany({
      where: { teamId },
      select: MEMBER_COLUMNS,
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      skip: offsetOf(request),
      take: takeOf(request),
    });
    const members = rows.map(toMember);

    return request.withTotal
      ? { rows: members, totalItems: await this.prisma.member.count({ where: { teamId } }) }
      : { rows: members };
  }

  async membershipsOf(teamId: string, userId: string): Promise<readonly TeamMember[]> {
    const rows = await this.prisma.member.findMany({
      where: { teamId, userId },
      select: MEMBER_COLUMNS,
      orderBy: { joinedAt: 'asc' },
    });

    return rows.map(toMember);
  }

  async activeMembersOf(teamId: string): Promise<readonly TeamMember[]> {
    const rows = await this.prisma.member.findMany({
      where: { teamId, status: MEMBER_STATUS.ACTIVE },
      select: MEMBER_COLUMNS,
      orderBy: { joinedAt: 'asc' },
    });

    return rows.map(toMember);
  }

  async activeMembershipOf(eventId: string, userId: string): Promise<TeamMember | null> {
    const row = await this.prisma.member.findFirst({
      where: { eventId, userId, status: MEMBER_STATUS.ACTIVE },
      select: MEMBER_COLUMNS,
    });

    return row === null ? null : toMember(row);
  }

  async activeMemberIdsOf(eventId: string, userIds: readonly string[]): Promise<readonly string[]> {
    if (userIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.member.findMany({
      where: { eventId, userId: { in: [...userIds] }, status: MEMBER_STATUS.ACTIVE },
      select: { userId: true },
      distinct: ['userId'],
    });

    return rows.map((row) => row.userId);
  }

  async createInvitation(invitation: TeamInvitation): Promise<TeamInvitation | null> {
    try {
      return toInvitation(
        await this.prisma.invitation.create({
          data: {
            id: invitation.id,
            eventId: invitation.eventId,
            teamId: invitation.teamId,
            userId: invitation.userId,
            status: invitation.status,
            expiresAt: invitation.expiresAt,
          },
          select: INVITATION_COLUMNS,
        }),
      );
    } catch (error: unknown) {
      if (isPrismaError(error, UNIQUE_VIOLATION)) {
        return null;
      }

      throw error;
    }
  }

  async findInvitation(id: string): Promise<TeamInvitation | null> {
    const row = await this.prisma.invitation.findUnique({
      where: { id },
      select: INVITATION_COLUMNS,
    });

    return row === null ? null : toInvitation(row);
  }

  async listInvitations(teamId: string, request: PageRequest): Promise<InvitationRows> {
    const rows = await this.prisma.invitation.findMany({
      where: { teamId },
      select: INVITATION_COLUMNS,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: offsetOf(request),
      take: takeOf(request),
    });
    const invitations = rows.map(toInvitation);

    return request.withTotal
      ? {
          rows: invitations,
          totalItems: await this.prisma.invitation.count({ where: { teamId } }),
        }
      : { rows: invitations };
  }

  /**
   * O aceite, com todas as regras reavaliadas dentro da transação (`ADR-0033` §15).
   *
   * A releitura do convite **sob o bloqueio** é o que fecha a corrida entre dois aceites
   * do mesmo convite: o primeiro o marca aceito, e o segundo encontra `GONE`.
   */
  async acceptInvitation(
    invitationId: string,
    member: TeamMember,
    maxTeamSize: number,
    now: Date,
  ): Promise<AcceptOutcome> {
    return this.prisma.transaction(async (tx) => {
      await tx.lock(teamLock(member.teamId));

      const invitation = await tx.teamInvitation.findUnique({
        where: { id: invitationId },
        select: INVITATION_COLUMNS,
      });

      if (invitation === null || invitation.status !== TEAM_INVITATION_STATUS.PENDING) {
        return { kind: 'GONE' } as const;
      }
      if (invitation.expiresAt.getTime() <= now.getTime()) {
        return { kind: 'EXPIRED' } as const;
      }

      const joined = await this.join(tx, member, maxTeamSize);

      if (joined.kind !== 'JOINED') {
        return joined;
      }

      await tx.teamInvitation.update({
        where: { id: invitationId },
        data: { status: TEAM_INVITATION_STATUS.ACCEPTED },
      });

      return joined;
    });
  }

  async declineInvitation(invitationId: string): Promise<boolean> {
    const declined = await this.prisma.invitation.updateMany({
      where: { id: invitationId, status: TEAM_INVITATION_STATUS.PENDING },
      data: { status: TEAM_INVITATION_STATUS.DECLINED },
    });

    return declined.count === 1;
  }

  /**
   * A designação do responsável, que **substitui** o anterior.
   *
   * Uma equipe tem no máximo um responsável ativo (RF-EQP-005 RN3), e o índice único
   * parcial o impõe; revogar o corrente dentro da mesma transação é o que permite trocar
   * sem passar por um estado sem responsável.
   */
  async assignAdvisor(advisor: TeamAdvisor, actorId: string): Promise<boolean> {
    return this.prisma.transaction(async (tx) => {
      await tx.lock(teamLock(advisor.teamId));

      const current = await tx.teamAdvisor.findFirst({
        where: { teamId: advisor.teamId, status: TEAM_ADVISOR_STATUS.ACTIVE },
        select: ADVISOR_COLUMNS,
      });

      if (current !== null && current.userId === advisor.userId) {
        return false;
      }

      if (current !== null) {
        await tx.teamAdvisor.update({
          where: { id: current.id },
          data: { status: TEAM_ADVISOR_STATUS.REVOKED, revokedAt: new Date() },
        });
        await tx.teamAdvisorAudit.create({
          data: {
            id: uuidv7(),
            teamId: advisor.teamId,
            userId: current.userId,
            actorId,
            operation: 'REVOKED',
          },
        });
      }

      await tx.teamAdvisor.create({
        data: {
          id: advisor.id,
          teamId: advisor.teamId,
          userId: advisor.userId,
          status: advisor.status,
        },
      });
      await tx.teamAdvisorAudit.create({
        data: {
          id: uuidv7(),
          teamId: advisor.teamId,
          userId: advisor.userId,
          actorId,
          operation: 'ASSIGNED',
        },
      });

      return true;
    });
  }

  async revokeAdvisor(teamId: string, userId: string, actorId: string): Promise<boolean> {
    return this.prisma.transaction(async (tx) => {
      await tx.lock(teamLock(teamId));

      const revoked = await tx.teamAdvisor.updateMany({
        where: { teamId, userId, status: TEAM_ADVISOR_STATUS.ACTIVE },
        data: { status: TEAM_ADVISOR_STATUS.REVOKED, revokedAt: new Date() },
      });

      if (revoked.count === 0) {
        return false;
      }

      await tx.teamAdvisorAudit.create({
        data: { id: uuidv7(), teamId, userId, actorId, operation: 'REVOKED' },
      });

      return true;
    });
  }

  async activeAdvisorOf(teamId: string): Promise<TeamAdvisor | null> {
    const row = await this.prisma.advisor.findFirst({
      where: { teamId, status: TEAM_ADVISOR_STATUS.ACTIVE },
      select: ADVISOR_COLUMNS,
    });

    return row === null ? null : toAdvisor(row);
  }

  /**
   * O ingresso, já sob o bloqueio da equipe.
   *
   * Compartilhado entre o ingresso direto, a designação e o aceite de convite: as três
   * revalidam as mesmas regras, e duplicá-las seria admitir que um dia divirjam.
   *
   * A violação de unicidade aqui é sempre o índice parcial `(event_id, user_id)` — a
   * chave primária é UUIDv7 recém-gerado —, e significa que o aluno já integra uma equipe
   * do evento.
   */
  private async join(
    tx: TeamTransaction,
    member: TeamMember,
    maxTeamSize: number,
  ): Promise<JoinOutcome> {
    const occupied = await tx.teamMember.count({
      where: { teamId: member.teamId, status: MEMBER_STATUS.ACTIVE },
    });

    if (occupied >= maxTeamSize) {
      return { kind: 'TEAM_FULL' };
    }

    try {
      const created = toMember(
        await tx.teamMember.create({
          data: {
            id: member.id,
            eventId: member.eventId,
            teamId: member.teamId,
            userId: member.userId,
            status: member.status,
            joinedAt: member.joinedAt,
          },
          select: MEMBER_COLUMNS,
        }),
      );

      return {
        kind: 'JOINED',
        member: created,
        facts: [
          await this.recordFact(tx, 'TeamCompositionChanged', {
            teamId: created.teamId,
            eventId: created.eventId,
            userId: created.userId,
            operation: 'JOINED',
            memberCount: occupied + 1,
            ...(await this.usageOf(tx, created.eventId)),
          }),
        ],
      };
    } catch (error: unknown) {
      if (isPrismaError(error, UNIQUE_VIOLATION)) {
        return { kind: 'ALREADY_IN_TEAM' };
      }

      throw error;
    }
  }

  /**
   * As contagens que o fato transporta (`ADR-0033` §20).
   *
   * Apuradas aqui, dentro da transação, porque é aqui que elas são verdade. Quem projeta
   * o uso recebe números absolutos e não precisa perguntar nada de volta.
   */
  private async usageOf(
    tx: TeamTransaction,
    eventId: string,
  ): Promise<{ readonly teamsInUse: number; readonly largestTeamSize: number }> {
    return {
      teamsInUse: await tx.team.count({ where: { eventId } }),
      largestTeamSize: await tx.largestTeamSize(eventId),
    };
  }

  /** Grava o fato na outbox, na mesma transação do fato que o origina (`ADR-0021` §1). */
  private async recordFact(
    tx: TeamTransaction,
    type: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<OutboxFact> {
    const factId = uuidv7();

    await tx.teamOutbox.create({
      data: {
        id: factId,
        eventType: type,
        eventVersion: 1,
        payload: { factId, ...payload, occurredAt: new Date().toISOString() },
      },
    });

    return { factId, type, payload: { factId, ...payload } };
  }
}
