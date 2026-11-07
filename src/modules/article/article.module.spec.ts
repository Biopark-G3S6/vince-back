import { Module, type DynamicModule, type InjectionToken } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { InMemoryDomainEventBus } from '@shared/events/event-bus';
import type { PageRequest } from '@shared/http/pagination';

import { CourseFacade } from '@modules/course/contracts/course.facade';
import type { EventStateDto, MilestoneDto } from '@modules/event/contracts/event.dto';
import { EventFacade } from '@modules/event/contracts/event.facade';
import type { TeamMembershipDto, TeamStateDto } from '@modules/team/contracts/team.dto';
import { TeamFacade } from '@modules/team/contracts/team.facade';

import { ArticleModule } from './article.module';
import { ArticleFacade } from './contracts/article.facade';
import type { ArticleResult } from './contracts/result.dto';

/**
 * As fachadas vizinhas, substituídas (`ADR-0024` §7).
 *
 * O que está sob teste é o módulo `article`: participação, orientação, responsabilidade e
 * coordenação são **entrada** dele. Os seus repositórios correm contra PostgreSQL real
 * (§9) — e precisam, porque o que estes testes verificam é o histórico append-only e a
 * idempotência garantida por índice único.
 */
class SubstituteTeamFacade extends TeamFacade {
  readonly memberships = new Map<string, TeamMembershipDto>();
  readonly responsible = new Map<string, string | null>();

  member(teamId: string, userId: string, membership: TeamMembershipDto): void {
    this.memberships.set(`${teamId}:${userId}`, membership);
  }

  responsibleOf(teamId: string, userId: string | null): void {
    this.responsible.set(teamId, userId);
  }

  membershipOf(teamId: string, userId: string): Promise<TeamMembershipDto> {
    return Promise.resolve(
      this.memberships.get(`${teamId}:${userId}`) ?? { active: false, participated: false },
    );
  }

  stateOf(teamId: string): Promise<TeamStateDto> {
    return Promise.resolve({
      exists: true,
      eventId,
      institutionId,
      responsibleAdvisorId: this.responsible.get(teamId) ?? null,
    });
  }

  activeMemberIdsOf(teamId: string): Promise<readonly string[]> {
    return Promise.resolve(
      [...this.memberships.entries()]
        .filter(([key, value]) => key.startsWith(`${teamId}:`) && value.active)
        .map(([key]) => key.split(':')[1] ?? ''),
    );
  }

  acceptInvitation(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `team`');
  }

  assignAdvisor(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `team`');
  }

  assignMember(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `team`');
  }

  create(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `team`');
  }

  declineInvitation(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `team`');
  }

  findById(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `team`');
  }

  invite(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `team`');
  }

  join(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `team`');
  }

  list(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `team`');
  }

  listEligibleStudents(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `team`');
  }

  listInvitations(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `team`');
  }

  listMembers(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `team`');
  }

  removeMember(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `team`');
  }

  revokeAdvisor(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `team`');
  }
}

class SubstituteEventFacade extends EventFacade {
  readonly advisors = new Set<string>();
  courseId: string | null = courseId;
  milestone: MilestoneDto | null = null;

  isAdvisor(_eventId: string, userId: string): Promise<boolean> {
    return Promise.resolve(this.advisors.has(userId));
  }

  stateOf(): Promise<EventStateDto> {
    return Promise.resolve({
      exists: true,
      active: true,
      institutionId,
      courseId: this.courseId,
      scopeType: 'COHORT',
      scopeId: cohortId,
      ownerId: null,
      maxTeams: 4,
      maxTeamSize: 5,
    });
  }

  currentMilestoneOf(): Promise<MilestoneDto | null> {
    return Promise.resolve(this.milestone);
  }

  assignAdvisor(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `event`');
  }

  cancel(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `event`');
  }

  create(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `event`');
  }

  createMilestone(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `event`');
  }

  eligibilityOf(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `event`');
  }

  eligibleStudentsOf(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `event`');
  }

  findById(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `event`');
  }

  handleTeamUsage(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `event`');
  }

  isScopeOwner(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `event`');
  }

  list(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `event`');
  }

  listAdvisors(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `event`');
  }

  listMilestones(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `event`');
  }

  removeMilestone(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `event`');
  }

  revokeAdvisor(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `event`');
  }

  update(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `event`');
  }

  updateMilestone(): never {
    return expect.unreachable('o módulo `article` não usa esta operação de `event`');
  }
}

class SubstituteCourseFacade extends CourseFacade {
  coordinator: string | null = null;

  coordinatorOf(): Promise<string | null> {
    return Promise.resolve(this.coordinator);
  }

  assignCoordinator(): never {
    return expect.unreachable('o módulo `article` só pergunta pelo coordenador');
  }

  coordinatedBy(): never {
    return expect.unreachable('o módulo `article` só pergunta pelo coordenador');
  }

  create(): never {
    return expect.unreachable('o módulo `article` só pergunta pelo coordenador');
  }

  deactivate(): never {
    return expect.unreachable('o módulo `article` só pergunta pelo coordenador');
  }

  findById(): never {
    return expect.unreachable('o módulo `article` só pergunta pelo coordenador');
  }

  list(): never {
    return expect.unreachable('o módulo `article` só pergunta pelo coordenador');
  }

  revokeCoordinator(): never {
    return expect.unreachable('o módulo `article` só pergunta pelo coordenador');
  }

  stateOf(): never {
    return expect.unreachable('o módulo `article` só pergunta pelo coordenador');
  }

  update(): never {
    return expect.unreachable('o módulo `article` só pergunta pelo coordenador');
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

function valueOf<T>(result: ArticleResult<T>): T {
  if (!result.ok) {
    expect.unreachable(`esperava sucesso, veio ${result.failure.code}`);
  }

  return result.value;
}

function failureOf<T>(result: ArticleResult<T>): { code: string } {
  if (result.ok) {
    expect.unreachable('esperava falha');
  }

  return result.failure;
}

const institutionId = '01930000-0000-7000-8000-000000000101';
const courseId = '01930000-0000-7000-8000-000000000102';
const cohortId = '01930000-0000-7000-8000-000000000103';
const eventId = '01930000-0000-7000-8000-000000000301';
const responsibleId = '01930000-0000-7000-8000-000000000401';
const otherAdvisorId = '01930000-0000-7000-8000-000000000402';
const coordinatorId = '01930000-0000-7000-8000-000000000403';
const outsiderId = '01930000-0000-7000-8000-000000000404';
const memberId = '01930000-0000-7000-8000-000000000501';
const mateId = '01930000-0000-7000-8000-000000000502';

const PUBLICATION = {
  venue: 'Congresso Brasileiro de Computação',
  kind: 'EVENT',
  publishedAt: new Date('2026-09-01T00:00:00.000Z'),
  url: 'https://exemplo.test/artigo',
};

describe('módulo article', () => {
  let prisma: PrismaClient;
  let moduleRef: TestingModule;
  let facade: ArticleFacade;
  let teams: SubstituteTeamFacade;
  let events: SubstituteEventFacade;
  let courses: SubstituteCourseFacade;
  let bus: InMemoryDomainEventBus;

  const page: PageRequest = { page: 1, pageSize: 20, withTotal: false };
  let sequence = 0;

  /** A equipe nova e o seu artigo, criados pelo fato — o único caminho que existe. */
  const newArticle = async () => {
    sequence += 1;
    const teamId = `01930000-0000-7000-8000-00000000${(6000 + sequence).toString()}`;

    await facade.handleTeamCreated({
      factId: uuidv7(),
      teamId,
      eventId,
      institutionId,
      occurredAt: new Date(),
    });

    const situation = valueOf(await facade.findSituationOfTeam({ actorId: responsibleId, teamId }));

    teams.member(teamId, memberId, { active: true, participated: true });
    teams.member(teamId, mateId, { active: true, participated: true });
    teams.responsibleOf(teamId, responsibleId);

    return { teamId, articleId: situation.article.id };
  };

  beforeAll(async () => {
    prisma = new PrismaClient();
    teams = new SubstituteTeamFacade();
    events = new SubstituteEventFacade();
    courses = new SubstituteCourseFacade();
    bus = new InMemoryDomainEventBus();

    moduleRef = await Test.createTestingModule({
      imports: [
        ArticleModule.forRoot(prisma, {
          imports: [
            SubstituteModule.of(TeamFacade, teams),
            SubstituteModule.of(EventFacade, events),
            SubstituteModule.of(CourseFacade, courses),
          ],
          events: bus,
        }),
      ],
    }).compile();
    await moduleRef.init();
    facade = moduleRef.get(ArticleFacade);
  });

  afterAll(async () => {
    await moduleRef?.close();
    await prisma?.$disconnect();
  });

  beforeEach(() => {
    teams.memberships.clear();
    teams.responsible.clear();
    events.advisors.clear();
    events.advisors.add(responsibleId);
    events.advisors.add(otherAdvisorId);
    events.courseId = courseId;
    events.milestone = null;
    courses.coordinator = coordinatorId;
  });

  describe('criação pelo fato de equipe', () => {
    it('o artigo nasce STARTED, e o fato reentregue não cria um segundo', async () => {
      const teamId = '01930000-0000-7000-8000-000000009001';
      const fact = {
        factId: uuidv7(),
        teamId,
        eventId,
        institutionId,
        occurredAt: new Date(),
      };

      await facade.handleTeamCreated(fact);
      await facade.handleTeamCreated(fact);
      // Fato novo, mesma equipe: a unicidade do artigo é que decide (ADR-0030 §9).
      await facade.handleTeamCreated({ ...fact, factId: uuidv7() });

      expect(await prisma.article.count({ where: { teamId } })).toBe(1);

      teams.member(teamId, memberId, { active: true, participated: true });
      const situation = valueOf(await facade.findSituationOfTeam({ actorId: memberId, teamId }));

      expect(situation.article).toMatchObject({ teamId, eventId, status: 'STARTED' });
      expect(situation.grade).toBeNull();
      expect(situation.currentMilestone).toBeNull();
    });

    it('fato sem equipe é descartado', async () => {
      const before = await prisma.article.count();

      await facade.handleTeamCreated({
        factId: uuidv7(),
        teamId: '',
        eventId,
        institutionId,
        occurredAt: new Date(),
      });

      expect(await prisma.article.count()).toBe(before);
    });

    it('o fato chega pelo barramento', async () => {
      const teamId = '01930000-0000-7000-8000-000000009002';

      await bus.publish({
        type: 'TeamCreated',
        payload: {
          factId: uuidv7(),
          teamId,
          eventId,
          institutionId,
          occurredAt: new Date().toISOString(),
        },
      });

      expect(await prisma.article.count({ where: { teamId } })).toBe(1);
      expect(bus.deadLetters).toEqual([]);
    });
  });

  describe('alcance de leitura', () => {
    it('integrante, orientador do evento e coordenador leem; mais ninguém', async () => {
      const { articleId, teamId } = await newArticle();

      valueOf(await facade.findSituation({ actorId: memberId, articleId }));
      valueOf(await facade.findSituation({ actorId: otherAdvisorId, articleId }));
      valueOf(await facade.findSituation({ actorId: coordinatorId, articleId }));

      expect(failureOf(await facade.findSituation({ actorId: outsiderId, articleId })).code).toBe(
        'RESOURCE_NOT_FOUND',
      );

      // Quem saiu da equipe continua lendo: a sua avaliação segue consultável.
      teams.member(teamId, memberId, { active: false, participated: true });
      valueOf(await facade.findSituation({ actorId: memberId, articleId }));
    });

    it('apresenta a etapa corrente do cronograma do evento', async () => {
      events.milestone = {
        id: '01930000-0000-7000-8000-000000007001',
        eventId,
        name: 'Primeira entrega',
        order: 1,
        dueAt: new Date('2030-03-01T00:00:00.000Z'),
      };

      const { articleId } = await newArticle();
      const situation = valueOf(await facade.findSituation({ actorId: memberId, articleId }));

      expect(situation.currentMilestone).toMatchObject({ name: 'Primeira entrega', order: 1 });
    });

    it('artigo inexistente é indistinguível de artigo fora do vínculo', async () => {
      expect(
        failureOf(await facade.findSituation({ actorId: responsibleId, articleId: uuidv7() })).code,
      ).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('avaliação do artigo', () => {
    it('só o orientador responsável avalia', async () => {
      const { articleId } = await newArticle();

      expect(
        failureOf(await facade.gradeArticle({ actorId: otherAdvisorId, articleId, value: 8 })).code,
      ).toBe('PERMISSION_DENIED');
      expect(
        failureOf(await facade.gradeArticle({ actorId: memberId, articleId, value: 8 })).code,
      ).toBe('PERMISSION_DENIED');
      expect(
        failureOf(await facade.gradeArticle({ actorId: outsiderId, articleId, value: 8 })).code,
      ).toBe('RESOURCE_NOT_FOUND');

      expect(
        valueOf(await facade.gradeArticle({ actorId: responsibleId, articleId, value: 8.5 })).value,
      ).toBe(8.5);
    });

    it('recusa nota fora da faixa', async () => {
      const { articleId } = await newArticle();

      expect(
        failureOf(await facade.gradeArticle({ actorId: responsibleId, articleId, value: 11 })).code,
      ).toBe('VALIDATION_FAILED');
      expect(
        failureOf(await facade.gradeArticle({ actorId: responsibleId, articleId, value: -1 })).code,
      ).toBe('VALIDATION_FAILED');
    });

    it('a alteração apresenta o novo valor e preserva o anterior no histórico', async () => {
      const { articleId } = await newArticle();

      valueOf(await facade.gradeArticle({ actorId: responsibleId, articleId, value: 6 }));
      valueOf(await facade.gradeArticle({ actorId: responsibleId, articleId, value: 9.25 }));

      const situation = valueOf(await facade.findSituation({ actorId: memberId, articleId }));

      expect(situation.grade).toMatchObject({ value: 9.25, authorId: responsibleId });

      const history = valueOf(
        await facade.listGradeHistory({ actorId: memberId, articleId, request: page }),
      );

      expect(history.items.map((entry) => entry.value)).toEqual([9.25, 6]);
      expect(history.items.every((entry) => entry.authorId === responsibleId)).toBe(true);
      expect(history.items.every((entry) => entry.recordedAt instanceof Date)).toBe(true);
    });
  });

  describe('avaliação individual', () => {
    it('integrantes da mesma equipe recebem notas distintas', async () => {
      const { articleId } = await newArticle();

      valueOf(
        await facade.gradeMember({ actorId: responsibleId, articleId, userId: memberId, value: 7 }),
      );
      valueOf(
        await facade.gradeMember({ actorId: responsibleId, articleId, userId: mateId, value: 9 }),
      );

      const grades = valueOf(await facade.listMemberGrades({ actorId: memberId, articleId }));

      expect(grades).toHaveLength(2);
      expect(grades.find((grade) => grade.userId === memberId)?.value).toBe(7);
      expect(grades.find((grade) => grade.userId === mateId)?.value).toBe(9);
    });

    it('quem nunca integrou a equipe não tem nota individual nela', async () => {
      const { articleId } = await newArticle();

      expect(
        failureOf(
          await facade.gradeMember({
            actorId: responsibleId,
            articleId,
            userId: outsiderId,
            value: 7,
          }),
        ).code,
      ).toBe('RESOURCE_NOT_FOUND');
    });

    it('a nota e o histórico sobrevivem à remoção do integrante', async () => {
      const { articleId, teamId } = await newArticle();

      valueOf(
        await facade.gradeMember({ actorId: responsibleId, articleId, userId: memberId, value: 7 }),
      );

      // O integrante é removido da equipe depois de avaliado (RF-ART-003 E3).
      teams.member(teamId, memberId, { active: false, participated: true });

      const grades = valueOf(await facade.listMemberGrades({ actorId: responsibleId, articleId }));

      expect(grades.find((grade) => grade.userId === memberId)).toMatchObject({
        value: 7,
        memberActive: true,
      });

      // E continua avaliável: a participação encerrada não apaga a avaliação.
      valueOf(
        await facade.gradeMember({ actorId: responsibleId, articleId, userId: memberId, value: 8 }),
      );

      const history = valueOf(
        await facade.listGradeHistory({
          actorId: responsibleId,
          articleId,
          userId: memberId,
          request: page,
        }),
      );

      expect(history.items.map((entry) => entry.value)).toEqual([8, 7]);
      expect(
        history.items.map((entry) => (entry as { memberActive: boolean }).memberActive),
      ).toEqual([false, true]);
    });
  });

  describe('publicação externa', () => {
    it('o integrante e o orientador do evento registram; o de fora, não', async () => {
      const { articleId } = await newArticle();

      const created = valueOf(
        await facade.createPublication({ ...PUBLICATION, actorId: memberId, articleId }),
      );

      expect(created).toMatchObject({ articleId, authorId: memberId, kind: 'EVENT' });

      valueOf(
        await facade.createPublication({
          ...PUBLICATION,
          actorId: otherAdvisorId,
          articleId,
          kind: 'JOURNAL',
        }),
      );

      expect(
        failureOf(
          await facade.createPublication({ ...PUBLICATION, actorId: outsiderId, articleId }),
        ).code,
      ).toBe('RESOURCE_NOT_FOUND');

      const listed = valueOf(
        await facade.listPublications({ actorId: coordinatorId, articleId, request: page }),
      );

      expect(listed.items).toHaveLength(2);
    });

    it('recusa endereço inválido na criação e na alteração', async () => {
      const { articleId } = await newArticle();

      expect(
        failureOf(
          await facade.createPublication({
            ...PUBLICATION,
            actorId: memberId,
            articleId,
            url: 'nao-e-url',
          }),
        ).code,
      ).toBe('VALIDATION_FAILED');

      const created = valueOf(
        await facade.createPublication({ ...PUBLICATION, actorId: memberId, articleId }),
      );

      expect(
        failureOf(
          await facade.updatePublication({
            actorId: memberId,
            articleId,
            publicationId: created.id,
            url: 'ftp://exemplo.test/a',
          }),
        ).code,
      ).toBe('VALIDATION_FAILED');
    });

    it('altera e remove o registro, e recusa o de outro artigo', async () => {
      const first = await newArticle();
      const second = await newArticle();
      const created = valueOf(
        await facade.createPublication({
          ...PUBLICATION,
          actorId: memberId,
          articleId: first.articleId,
        }),
      );

      const updated = valueOf(
        await facade.updatePublication({
          actorId: memberId,
          articleId: first.articleId,
          publicationId: created.id,
          venue: 'Revista Brasileira de Computação',
          kind: 'JOURNAL',
        }),
      );

      expect(updated).toMatchObject({ venue: 'Revista Brasileira de Computação', kind: 'JOURNAL' });

      expect(
        failureOf(
          await facade.updatePublication({
            actorId: memberId,
            articleId: second.articleId,
            publicationId: created.id,
            venue: 'Outro',
          }),
        ).code,
      ).toBe('RESOURCE_NOT_FOUND');

      valueOf(
        await facade.removePublication({
          actorId: memberId,
          articleId: first.articleId,
          publicationId: created.id,
        }),
      );

      expect(
        failureOf(
          await facade.removePublication({
            actorId: memberId,
            articleId: first.articleId,
            publicationId: created.id,
          }),
        ).code,
      ).toBe('RESOURCE_NOT_FOUND');
    });
  });
});
