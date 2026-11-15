import { Module, type DynamicModule, type InjectionToken } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { InMemoryDomainEventBus } from '@shared/events/event-bus';
import { toPage, type Page, type PageRequest } from '@shared/http/pagination';

import type { EventStateDto, MilestoneDto } from '@modules/event/contracts/event.dto';
import { EventFacade } from '@modules/event/contracts/event.facade';

import type { TeamResult } from './contracts/result.dto';
import { TeamFacade } from './contracts/team.facade';
import { createQueryCounter } from './infrastructure/query-counter';
import { TeamModule } from './team.module';

/**
 * O evento, substituído (`ADR-0024` §7).
 *
 * O que está sob teste é o módulo `team`: o estado, os limites, a orientação e a
 * elegibilidade são **entrada** dele. Os seus próprios repositórios correm contra
 * PostgreSQL real (§9) — e precisam correr, porque o que estes testes verificam é
 * justamente o que só o banco garante: bloqueio, índice único parcial e concorrência.
 */
class SubstituteEventFacade extends EventFacade {
  active = true;
  maxTeams = 4;
  maxTeamSize = 3;
  readonly advisors = new Set<string>();
  readonly owners = new Set<string>();
  readonly eligible = new Set<string>();
  eligibleStudents: readonly string[] = [];

  stateOf(): Promise<EventStateDto> {
    return Promise.resolve({
      exists: true,
      active: this.active,
      institutionId: institutionId,
      courseId: null,
      scopeType: 'COHORT',
      scopeId: cohortId,
      ownerId: [...this.owners][0] ?? null,
      maxTeams: this.maxTeams,
      maxTeamSize: this.maxTeamSize,
    });
  }

  isAdvisor(_eventId: string, userId: string): Promise<boolean> {
    return Promise.resolve(this.advisors.has(userId));
  }

  advisedEventIdsOf(): never {
    return expect.unreachable('o módulo `team` não consulta os eventos orientados');
  }

  isScopeOwner(_eventId: string, userId: string): Promise<boolean> {
    return Promise.resolve(this.owners.has(userId));
  }

  eligibilityOf(query: {
    readonly eventId: string;
    readonly userIds: readonly string[];
  }): Promise<ReadonlyMap<string, boolean>> {
    return Promise.resolve(
      new Map(query.userIds.map((userId) => [userId, this.eligible.has(userId)])),
    );
  }

  eligibleStudentsOf(query: {
    readonly eventId: string;
    readonly request: PageRequest;
  }): Promise<Page<string>> {
    return Promise.resolve(toPage(query.request, this.eligibleStudents));
  }

  currentMilestoneOf(): Promise<MilestoneDto | null> {
    return Promise.resolve(null);
  }

  handleTeamUsage(): Promise<void> {
    return Promise.resolve();
  }

  assignAdvisor(): never {
    return expect.unreachable('o módulo `team` não designa orientador do evento');
  }
  cancel(): never {
    return expect.unreachable('o módulo `team` não cancela evento');
  }
  create(): never {
    return expect.unreachable('o módulo `team` não cria evento');
  }
  createMilestone(): never {
    return expect.unreachable('o módulo `team` não mexe no cronograma');
  }
  findById(): never {
    return expect.unreachable('o módulo `team` usa `stateOf`');
  }
  list(): never {
    return expect.unreachable('o módulo `team` não lista eventos');
  }
  listAdvisors(): never {
    return expect.unreachable('o módulo `team` consulta orientação por `isAdvisor`');
  }
  listMilestones(): never {
    return expect.unreachable('o módulo `team` não lista etapas');
  }
  removeMilestone(): never {
    return expect.unreachable('o módulo `team` não mexe no cronograma');
  }
  revokeAdvisor(): never {
    return expect.unreachable('o módulo `team` não revoga orientador do evento');
  }
  update(): never {
    return expect.unreachable('o módulo `team` não altera evento');
  }
  updateMilestone(): never {
    return expect.unreachable('o módulo `team` não mexe no cronograma');
  }
}

@Module({})
class SubstituteModule {
  static of(token: InjectionToken, value: object): DynamicModule {
    return {
      module: SubstituteModule,
      providers: [{ provide: token, useValue: value }],
      exports: [token],
    };
  }
}

function valueOf<T>(result: TeamResult<T>): T {
  if (!result.ok) {
    expect.unreachable(`esperava sucesso, veio ${result.failure.code}`);
  }

  return result.value;
}

function failureOf<T>(result: TeamResult<T>): { code: string } {
  if (result.ok) {
    expect.unreachable('esperava falha');
  }

  return result.failure;
}

const institutionId = '01930000-0000-7000-8000-000000000101';
const cohortId = '01930000-0000-7000-8000-000000000201';
const eventId = '01930000-0000-7000-8000-000000000301';
const advisorId = '01930000-0000-7000-8000-000000000401';
const ownerId = '01930000-0000-7000-8000-000000000402';
const outsiderId = '01930000-0000-7000-8000-000000000403';

function studentId(index: number): string {
  return `01930000-0000-7000-8000-0000000005${index.toString().padStart(2, '0')}`;
}

describe('módulo team', () => {
  let prisma: PrismaClient;
  let moduleRef: TestingModule;
  let facade: TeamFacade;
  let events: SubstituteEventFacade;
  let bus: InMemoryDomainEventBus;

  const page: PageRequest = { page: 1, pageSize: 20, withTotal: false };
  let sequence = 0;

  const newTeam = async (actorId = advisorId) => {
    sequence += 1;

    return facade.create({ actorId, eventId, identification: `Equipe ${sequence}` });
  };

  beforeAll(async () => {
    prisma = new PrismaClient();
    events = new SubstituteEventFacade();
    bus = new InMemoryDomainEventBus();

    moduleRef = await Test.createTestingModule({
      imports: [
        TeamModule.forRoot(prisma, {
          imports: [SubstituteModule.of(EventFacade, events)],
          events: bus,
        }),
      ],
    }).compile();
    await moduleRef.init();
    facade = moduleRef.get(TeamFacade);
  });

  afterAll(async () => {
    await moduleRef?.close();
    await prisma?.$disconnect();
  });

  beforeEach(() => {
    events.active = true;
    events.maxTeams = 4;
    events.maxTeamSize = 3;
    events.advisors.clear();
    events.owners.clear();
    events.eligible.clear();
    events.eligibleStudents = [];
    events.advisors.add(advisorId);
    events.owners.add(ownerId);

    for (let index = 0; index < 6; index += 1) {
      events.eligible.add(studentId(index));
    }

    bus.deadLetters.length = 0;
  });

  describe('criação', () => {
    it('cria a equipe e publica o fato de que ela nasceu', async () => {
      const received: unknown[] = [];
      const unsubscribe = bus.subscribe('TeamCreated', (event) => {
        received.push(event.payload);

        return Promise.resolve();
      });

      try {
        const team = valueOf(await newTeam());

        expect(team).toMatchObject({ eventId, institutionId });
        expect(received).toHaveLength(1);
        expect(received[0]).toMatchObject({ teamId: team.id, eventId, teamsInUse: 1 });
      } finally {
        unsubscribe();
      }
    });

    it('recusa quem não orienta o evento, e o evento cancelado', async () => {
      expect(failureOf(await newTeam(outsiderId)).code).toBe('ADVISOR_NOT_ASSIGNED_TO_EVENT');

      events.active = false;
      expect(failureOf(await newTeam()).code).toBe('VALIDATION_FAILED');
    });

    it('recusa criar além do limite do evento', async () => {
      events.maxTeams = 1;
      valueOf(await newTeam());

      expect(failureOf(await newTeam()).code).toBe('EVENT_TEAM_LIMIT_REACHED');
    });

    it('o limite resiste a criações concorrentes', async () => {
      events.maxTeams = 2;

      const outcomes = await Promise.all([newTeam(), newTeam(), newTeam(), newTeam()]);
      const created = outcomes.filter((outcome) => outcome.ok);
      const refused = outcomes.filter((outcome) => !outcome.ok);

      expect(created).toHaveLength(2);
      expect(refused.map((outcome) => failureOf(outcome).code)).toEqual([
        'EVENT_TEAM_LIMIT_REACHED',
        'EVENT_TEAM_LIMIT_REACHED',
      ]);
      expect(await prisma.team.count({ where: { eventId } })).toBe(2);
    });
  });

  describe('participação', () => {
    it('o aluno elegível ingressa, e o inelegível não', async () => {
      const team = valueOf(await newTeam());

      expect(valueOf(await facade.join({ actorId: studentId(0), teamId: team.id })).status).toBe(
        'ACTIVE',
      );
      expect(failureOf(await facade.join({ actorId: outsiderId, teamId: team.id })).code).toBe(
        'STUDENT_NOT_ELIGIBLE',
      );
    });

    it('um aluno integra no máximo uma equipe por evento', async () => {
      const first = valueOf(await newTeam());
      const second = valueOf(await newTeam());

      valueOf(await facade.join({ actorId: studentId(0), teamId: first.id }));

      expect(failureOf(await facade.join({ actorId: studentId(0), teamId: second.id })).code).toBe(
        'STUDENT_ALREADY_IN_TEAM',
      );
    });

    it('a unicidade resiste a ingressos concorrentes em equipes distintas', async () => {
      const first = valueOf(await newTeam());
      const second = valueOf(await newTeam());
      const student = studentId(1);

      const outcomes = await Promise.all([
        facade.join({ actorId: student, teamId: first.id }),
        facade.join({ actorId: student, teamId: second.id }),
      ]);

      expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
      expect(
        outcomes.filter((outcome) => !outcome.ok).map((outcome) => failureOf(outcome).code),
      ).toEqual(['STUDENT_ALREADY_IN_TEAM']);
    });

    it('a lotação resiste a ingressos concorrentes na mesma equipe', async () => {
      events.maxTeamSize = 2;
      const team = valueOf(await newTeam());

      const outcomes = await Promise.all([
        facade.join({ actorId: studentId(0), teamId: team.id }),
        facade.join({ actorId: studentId(1), teamId: team.id }),
        facade.join({ actorId: studentId(2), teamId: team.id }),
        facade.join({ actorId: studentId(3), teamId: team.id }),
      ]);

      expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(2);
      expect(
        outcomes.filter((outcome) => !outcome.ok).map((outcome) => failureOf(outcome).code),
      ).toEqual(['TEAM_SIZE_LIMIT_REACHED', 'TEAM_SIZE_LIMIT_REACHED']);
    });

    it('a remoção encerra a participação, preserva a linha e libera a vaga', async () => {
      events.maxTeamSize = 1;
      const team = valueOf(await newTeam());

      valueOf(await facade.join({ actorId: studentId(0), teamId: team.id }));
      expect(failureOf(await facade.join({ actorId: studentId(1), teamId: team.id })).code).toBe(
        'TEAM_SIZE_LIMIT_REACHED',
      );

      valueOf(
        await facade.removeMember({ actorId: advisorId, teamId: team.id, userId: studentId(0) }),
      );

      const members = valueOf(
        await facade.listMembers({ actorId: advisorId, teamId: team.id, request: page }),
      );

      expect(members.items).toHaveLength(1);
      expect(members.items[0]).toMatchObject({ status: 'REMOVED', userId: studentId(0) });
      expect(await facade.membershipOf(team.id, studentId(0))).toEqual({
        active: false,
        participated: true,
      });

      // A vaga voltou, e quem saiu pode reingressar: o índice de unicidade é parcial.
      valueOf(await facade.join({ actorId: studentId(0), teamId: team.id }));
      expect(await facade.activeMemberIdsOf(team.id)).toEqual([studentId(0)]);
    });

    it('a remoção é idempotente', async () => {
      const team = valueOf(await newTeam());

      valueOf(await facade.join({ actorId: studentId(0), teamId: team.id }));
      valueOf(
        await facade.removeMember({ actorId: advisorId, teamId: team.id, userId: studentId(0) }),
      );
      valueOf(
        await facade.removeMember({ actorId: advisorId, teamId: team.id, userId: studentId(0) }),
      );
    });
  });

  describe('convite', () => {
    const future = (): Date => new Date(Date.now() + 86_400_000);

    it('o convite aceito insere o aluno na equipe', async () => {
      const team = valueOf(await newTeam());
      const invitation = valueOf(
        await facade.invite({
          actorId: advisorId,
          teamId: team.id,
          userId: studentId(0),
          expiresAt: future(),
        }),
      );

      expect(invitation.status).toBe('PENDING');

      const member = valueOf(
        await facade.acceptInvitation({
          actorId: studentId(0),
          invitationId: invitation.id,
        }),
      );

      expect(member.userId).toBe(studentId(0));
    });

    it('só o convidado responde ao convite', async () => {
      const team = valueOf(await newTeam());
      const invitation = valueOf(
        await facade.invite({
          actorId: advisorId,
          teamId: team.id,
          userId: studentId(0),
          expiresAt: future(),
        }),
      );

      expect(
        failureOf(
          await facade.acceptInvitation({ actorId: studentId(1), invitationId: invitation.id }),
        ).code,
      ).toBe('RESOURCE_NOT_FOUND');
    });

    it('recusa prazo no passado na emissão', async () => {
      const team = valueOf(await newTeam());

      expect(
        failureOf(
          await facade.invite({
            actorId: advisorId,
            teamId: team.id,
            userId: studentId(0),
            expiresAt: new Date(Date.now() - 1000),
          }),
        ).code,
      ).toBe('VALIDATION_FAILED');
    });

    it('a vaga preenchida antes do aceite recusa o convite', async () => {
      events.maxTeamSize = 1;
      const team = valueOf(await newTeam());
      const invitation = valueOf(
        await facade.invite({
          actorId: advisorId,
          teamId: team.id,
          userId: studentId(0),
          expiresAt: future(),
        }),
      );

      valueOf(await facade.join({ actorId: studentId(1), teamId: team.id }));

      expect(
        failureOf(
          await facade.acceptInvitation({ actorId: studentId(0), invitationId: invitation.id }),
        ).code,
      ).toBe('TEAM_SIZE_LIMIT_REACHED');
    });

    it('o mesmo convite não é aceito duas vezes', async () => {
      const team = valueOf(await newTeam());
      const invitation = valueOf(
        await facade.invite({
          actorId: advisorId,
          teamId: team.id,
          userId: studentId(0),
          expiresAt: future(),
        }),
      );

      valueOf(
        await facade.acceptInvitation({ actorId: studentId(0), invitationId: invitation.id }),
      );

      expect(
        failureOf(
          await facade.acceptInvitation({ actorId: studentId(0), invitationId: invitation.id }),
        ).code,
      ).toBe('INVITATION_REVOKED');
    });

    it('a recusa encerra o convite sem efeito sobre a equipe', async () => {
      const team = valueOf(await newTeam());
      const invitation = valueOf(
        await facade.invite({
          actorId: advisorId,
          teamId: team.id,
          userId: studentId(0),
          expiresAt: future(),
        }),
      );

      valueOf(
        await facade.declineInvitation({ actorId: studentId(0), invitationId: invitation.id }),
      );

      expect(await facade.activeMemberIdsOf(team.id)).toEqual([]);
      expect(
        failureOf(
          await facade.acceptInvitation({ actorId: studentId(0), invitationId: invitation.id }),
        ).code,
      ).toBe('INVITATION_REVOKED');
    });
  });

  describe('orientador responsável', () => {
    it('o dono do escopo nomeia quem orienta o evento, e substitui o anterior', async () => {
      const team = valueOf(await newTeam());
      const second = '01930000-0000-7000-8000-000000000404';

      events.advisors.add(second);

      valueOf(await facade.assignAdvisor({ actorId: ownerId, teamId: team.id, userId: advisorId }));
      expect((await facade.stateOf(team.id)).responsibleAdvisorId).toBe(advisorId);

      valueOf(await facade.assignAdvisor({ actorId: ownerId, teamId: team.id, userId: second }));
      expect((await facade.stateOf(team.id)).responsibleAdvisorId).toBe(second);

      // Idempotente: nomear de novo o mesmo não troca nada.
      valueOf(await facade.assignAdvisor({ actorId: ownerId, teamId: team.id, userId: second }));
      expect((await facade.stateOf(team.id)).responsibleAdvisorId).toBe(second);
    });

    it('recusa professor não designado ao evento e ator que não é dono do escopo', async () => {
      const team = valueOf(await newTeam());

      expect(
        failureOf(
          await facade.assignAdvisor({ actorId: ownerId, teamId: team.id, userId: outsiderId }),
        ).code,
      ).toBe('ADVISOR_NOT_ASSIGNED_TO_EVENT');
      expect(
        failureOf(
          await facade.assignAdvisor({ actorId: advisorId, teamId: team.id, userId: advisorId }),
        ).code,
      ).toBe('PERMISSION_DENIED');
    });

    it('publica TeamAdvisorChanged com o responsável resultante, só quando algo muda', async () => {
      const team = valueOf(await newTeam());
      const received: unknown[] = [];
      const unsubscribe = bus.subscribe('TeamAdvisorChanged', (event) => {
        received.push(event.payload);

        return Promise.resolve();
      });

      try {
        valueOf(
          await facade.assignAdvisor({ actorId: ownerId, teamId: team.id, userId: advisorId }),
        );
        valueOf(
          await facade.assignAdvisor({ actorId: ownerId, teamId: team.id, userId: advisorId }),
        );
        valueOf(
          await facade.revokeAdvisor({ actorId: ownerId, teamId: team.id, userId: advisorId }),
        );
        valueOf(
          await facade.revokeAdvisor({ actorId: ownerId, teamId: team.id, userId: advisorId }),
        );

        expect(received).toEqual([
          expect.objectContaining({ teamId: team.id, eventId, institutionId, advisorId }),
          expect.objectContaining({ teamId: team.id, eventId, institutionId, advisorId: null }),
        ]);
      } finally {
        unsubscribe();
      }
    });

    it('a revogação é idempotente e vale em evento cancelado', async () => {
      const team = valueOf(await newTeam());

      valueOf(await facade.assignAdvisor({ actorId: ownerId, teamId: team.id, userId: advisorId }));
      events.active = false;

      valueOf(await facade.revokeAdvisor({ actorId: ownerId, teamId: team.id, userId: advisorId }));
      valueOf(await facade.revokeAdvisor({ actorId: ownerId, teamId: team.id, userId: advisorId }));

      expect((await facade.stateOf(team.id)).responsibleAdvisorId).toBeNull();
    });
  });

  describe('alunos elegíveis sem equipe', () => {
    it('desconta quem já integra equipe e esvazia quando todos ingressam', async () => {
      const team = valueOf(await newTeam());

      events.eligibleStudents = [studentId(0), studentId(1), studentId(2)];
      events.maxTeamSize = 3;

      const before = valueOf(
        await facade.listEligibleStudents({ actorId: advisorId, eventId, request: page }),
      );

      expect(before.items).toEqual([studentId(0), studentId(1), studentId(2)]);

      for (const index of [0, 1, 2]) {
        valueOf(await facade.join({ actorId: studentId(index), teamId: team.id }));
      }

      const after = valueOf(
        await facade.listEligibleStudents({ actorId: advisorId, eventId, request: page }),
      );

      expect(after.items).toEqual([]);
      expect(after.pagination).toMatchObject({ page: 1, pageSize: 20, hasNext: false });
    });

    it('recusa quem não orienta o evento', async () => {
      expect(
        failureOf(
          await facade.listEligibleStudents({ actorId: outsiderId, eventId, request: page }),
        ).code,
      ).toBe('ADVISOR_NOT_ASSIGNED_TO_EVENT');
    });
  });

  describe('invariância da contagem de consultas', () => {
    it('desconta N candidatos no mesmo número de consultas que um só', async () => {
      const counter = createQueryCounter(prisma);
      const scoped = await Test.createTestingModule({
        imports: [
          TeamModule.forRoot(counter.client, {
            imports: [SubstituteModule.of(EventFacade, events)],
            events: new InMemoryDomainEventBus(),
          }),
        ],
      }).compile();

      try {
        const scopedFacade = scoped.get(TeamFacade);

        events.eligibleStudents = [studentId(0)];
        counter.reset();
        valueOf(
          await scopedFacade.listEligibleStudents({ actorId: advisorId, eventId, request: page }),
        );
        const forOne = counter.count();

        events.eligibleStudents = [0, 1, 2, 3, 4, 5].map(studentId);
        counter.reset();
        const many = valueOf(
          await scopedFacade.listEligibleStudents({ actorId: advisorId, eventId, request: page }),
        );

        expect(many.items).toHaveLength(6);
        expect(counter.count()).toBe(forOne);
        expect(forOne).toBeGreaterThan(0);
      } finally {
        await scoped.close();
      }
    });

    it('lista N integrantes no mesmo número de consultas que um só', async () => {
      const counter = createQueryCounter(prisma);
      const scoped = await Test.createTestingModule({
        imports: [
          TeamModule.forRoot(counter.client, {
            imports: [SubstituteModule.of(EventFacade, events)],
            events: new InMemoryDomainEventBus(),
          }),
        ],
      }).compile();

      try {
        const scopedFacade = scoped.get(TeamFacade);

        sequence += 1;
        const team = valueOf(
          await scopedFacade.create({
            actorId: advisorId,
            eventId,
            identification: `Equipe contada ${sequence}`,
          }),
        );

        valueOf(await scopedFacade.join({ actorId: studentId(0), teamId: team.id }));

        counter.reset();
        valueOf(
          await scopedFacade.listMembers({ actorId: advisorId, teamId: team.id, request: page }),
        );
        const forOne = counter.count();

        valueOf(await scopedFacade.join({ actorId: studentId(1), teamId: team.id }));
        valueOf(await scopedFacade.join({ actorId: studentId(2), teamId: team.id }));

        counter.reset();
        const many = valueOf(
          await scopedFacade.listMembers({ actorId: advisorId, teamId: team.id, request: page }),
        );

        expect(many.items).toHaveLength(3);
        expect(counter.count()).toBe(forOne);
        expect(forOne).toBeGreaterThan(0);
      } finally {
        await scoped.close();
      }
    });
  });
});
