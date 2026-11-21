import { Module, type DynamicModule, type InjectionToken } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { InMemoryDomainEventBus } from '@shared/events/event-bus';
import type { PageRequest } from '@shared/http/pagination';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { CohortFacade } from '@modules/cohort/contracts/cohort.facade';
import type {
  CohortLinkDto,
  CohortLinkQuery,
  CohortScopeDto,
  CohortStateDto,
} from '@modules/cohort/contracts/cohort.dto';
import { CourseFacade } from '@modules/course/contracts/course.facade';
import type { CourseStateDto } from '@modules/course/contracts/course.dto';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';
import type { InstitutionStateDto } from '@modules/institution/contracts/institution.dto';

import { EventFacade } from './contracts/event.facade';
import type { EventResult } from './contracts/result.dto';
import { EventModule } from './event.module';
import { createQueryCounter } from './infrastructure/query-counter';

/**
 * As fachadas vizinhas, substituídas (`ADR-0024` §7).
 *
 * O que está sob teste é o módulo `event`: o alvo, o vínculo e a conta são **entrada**
 * dele, e fazê-los vir do banco de outros módulos tornaria a falha de qualquer um deles
 * uma falha deste arquivo. Os repositórios de `event`, estes sim, correm contra
 * PostgreSQL real (§9).
 */
class SubstituteAccessFacade extends AccessFacade {
  readonly institutions = new Map<string, string | null>();

  link(userId: string, institutionId: string | null): void {
    this.institutions.set(userId, institutionId);
  }

  institutionLinksOf(userIds: readonly string[]): Promise<ReadonlyMap<string, string | null>> {
    const found = new Map<string, string | null>();

    for (const userId of userIds) {
      if (this.institutions.has(userId)) {
        found.set(userId, this.institutions.get(userId) ?? null);
      }
    }

    return Promise.resolve(found);
  }

  acceptInvitation(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }

  findNotificationRecipients(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }

  activateUser(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }

  assignRole(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }

  changeOwnPassword(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }

  createUser(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }

  deactivateUser(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }

  effectivePermissions(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }

  findInvitation(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }

  findOwnProfile(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }

  issueInvitation(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }

  listInvitations(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }

  listByRole(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }

  permissionsOfRoles(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }

  requestPasswordReset(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }

  resetPassword(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }

  revokeInvitation(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }

  revokeRole(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }

  updateOwnProfile(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }

  verifyCredential(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `access`');
  }
}

class SubstituteInstitutionFacade extends InstitutionFacade {
  readonly states = new Map<string, InstitutionStateDto>();
  readonly admins = new Map<string, readonly string[]>();

  active(institutionId: string): void {
    this.states.set(institutionId, { exists: true, active: true });
  }

  adminOf(userId: string, institutionIds: readonly string[]): void {
    this.admins.set(userId, institutionIds);
  }

  stateOf(institutionId: string): Promise<InstitutionStateDto> {
    return Promise.resolve(this.states.get(institutionId) ?? { exists: false, active: false });
  }

  administeredBy(userId: string): Promise<readonly string[]> {
    return Promise.resolve(this.admins.get(userId) ?? []);
  }

  activate(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `institution`');
  }

  assignAdmin(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `institution`');
  }

  create(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `institution`');
  }

  deactivate(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `institution`');
  }

  findById(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `institution`');
  }

  issueInvitation(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `institution`');
  }

  list(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `institution`');
  }

  listInvitations(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `institution`');
  }

  revokeAdmin(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `institution`');
  }

  revokeInvitation(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `institution`');
  }

  statesOf(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `institution`');
  }

  update(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `institution`');
  }
}

class SubstituteCourseFacade extends CourseFacade {
  readonly states = new Map<string, CourseStateDto>();
  readonly coordinators = new Map<string, string>();

  active(courseId: string, institutionId: string): void {
    this.states.set(courseId, { exists: true, active: true, institutionId });
  }

  coordinatedBy_(courseId: string, userId: string): void {
    this.coordinators.set(courseId, userId);
  }

  stateOf(courseId: string): Promise<CourseStateDto> {
    return Promise.resolve(
      this.states.get(courseId) ?? { exists: false, active: false, institutionId: null },
    );
  }

  coordinatorOf(courseId: string): Promise<string | null> {
    return Promise.resolve(this.coordinators.get(courseId) ?? null);
  }

  coordinatedBy(userId: string): Promise<readonly string[]> {
    return Promise.resolve(
      [...this.coordinators.entries()]
        .filter(([, holder]) => holder === userId)
        .map(([courseId]) => courseId),
    );
  }

  assignCoordinator(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `course`');
  }

  create(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `course`');
  }

  deactivate(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `course`');
  }

  findById(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `course`');
  }

  list(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `course`');
  }

  revokeCoordinator(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `course`');
  }

  update(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `course`');
  }
}

class SubstituteCohortFacade extends CohortFacade {
  readonly states = new Map<string, CohortStateDto>();
  readonly links = new Map<string, CohortLinkDto>();

  active(cohortId: string, courseId: string, institutionId: string): void {
    this.states.set(cohortId, { exists: true, active: true, courseId, institutionId });
  }

  link(cohortId: string, userId: string, link: CohortLinkDto): void {
    this.links.set(`${cohortId}:${userId}`, link);
  }

  stateOf(cohortId: string): Promise<CohortStateDto> {
    return Promise.resolve(
      this.states.get(cohortId) ?? {
        exists: false,
        active: false,
        courseId: null,
        institutionId: null,
      },
    );
  }

  linksOf(query: CohortLinkQuery): Promise<ReadonlyMap<string, CohortLinkDto>> {
    const cohortIds =
      query.cohortId === undefined
        ? [...this.states.entries()]
            .filter(([, state]) => state.courseId === query.courseId)
            .map(([cohortId]) => cohortId)
        : [query.cohortId];
    const found = new Map<string, CohortLinkDto>();

    for (const userId of query.userIds) {
      for (const cohortId of cohortIds) {
        const link = this.links.get(`${cohortId}:${userId}`);

        if (link !== undefined) {
          found.set(userId, link);
        }
      }
    }

    return Promise.resolve(found);
  }

  studentsOf(): never {
    return expect.unreachable('o escopo de turma do teste não enumera alunos');
  }

  scopesOf(userId: string): Promise<readonly CohortScopeDto[]> {
    const scopes: CohortScopeDto[] = [];

    for (const [key, link] of this.links) {
      const [cohortId, holder] = key.split(':');

      if (holder !== userId || cohortId === undefined) {
        continue;
      }

      const courseId = this.states.get(cohortId)?.courseId;

      if (courseId !== undefined && courseId !== null) {
        scopes.push({ cohortId, courseId, ...link });
      }
    }

    return Promise.resolve(scopes);
  }

  assignProfessor(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `cohort`');
  }

  create(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `cohort`');
  }

  deactivate(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `cohort`');
  }

  enroll(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `cohort`');
  }

  findById(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `cohort`');
  }

  handleInvitationAccepted(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `cohort`');
  }

  issueInvitation(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `cohort`');
  }

  list(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `cohort`');
  }

  listReadable(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `cohort`');
  }

  listEnrollments(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `cohort`');
  }

  listProfessors(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `cohort`');
  }

  listInvitations(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `cohort`');
  }

  revokeInvitation(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `cohort`');
  }

  revokeProfessor(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `cohort`');
  }

  update(): never {
    return expect.unreachable('o módulo `event` não usa esta operação de `cohort`');
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

function valueOf<T>(result: EventResult<T>): T {
  if (!result.ok) {
    expect.unreachable(`esperava sucesso, veio ${result.failure.code}`);
  }

  return result.value;
}

function failureOf<T>(result: EventResult<T>): { code: string } {
  if (result.ok) {
    expect.unreachable('esperava falha');
  }

  return result.failure;
}

const institutionId = '01930000-0000-7000-8000-000000000101';
const courseId = '01930000-0000-7000-8000-000000000201';
const cohortId = '01930000-0000-7000-8000-000000000301';
const professorId = '01930000-0000-7000-8000-000000000401';
const coordinatorId = '01930000-0000-7000-8000-000000000402';
const adminId = '01930000-0000-7000-8000-000000000403';
const studentId = '01930000-0000-7000-8000-000000000404';
const outsiderId = '01930000-0000-7000-8000-000000000405';

const DRAFT = {
  title: 'Congresso interno',
  theme: 'Cidades inteligentes',
  researchProblem: 'Como medir mobilidade?',
  objectives: 'Produzir artigo',
  maxTeams: 4,
  maxTeamSize: 5,
};

function wire(
  access: SubstituteAccessFacade,
  institutions: SubstituteInstitutionFacade,
  courses: SubstituteCourseFacade,
  cohorts: SubstituteCohortFacade,
): void {
  institutions.active(institutionId);
  institutions.adminOf(adminId, [institutionId]);
  courses.active(courseId, institutionId);
  courses.coordinatedBy_(courseId, coordinatorId);
  cohorts.active(cohortId, courseId, institutionId);
  cohorts.link(cohortId, professorId, { enrolled: false, professor: true });
  cohorts.link(cohortId, studentId, { enrolled: true, professor: false });

  for (const userId of [professorId, coordinatorId, adminId, studentId, outsiderId]) {
    access.link(userId, institutionId);
  }
}

describe('módulo event', () => {
  let prisma: PrismaClient;
  let moduleRef: TestingModule;
  let facade: EventFacade;
  let access: SubstituteAccessFacade;
  let institutions: SubstituteInstitutionFacade;
  let courses: SubstituteCourseFacade;
  let cohorts: SubstituteCohortFacade;
  let bus: InMemoryDomainEventBus;

  const page: PageRequest = { page: 1, pageSize: 20, withTotal: false };

  const create = (actorId = professorId, scope = { scopeType: 'COHORT', scopeId: cohortId }) =>
    facade.create({ ...DRAFT, ...scope, actorId });

  const imports = (
    accessFacade: SubstituteAccessFacade,
    institutionFacade: SubstituteInstitutionFacade,
    courseFacade: SubstituteCourseFacade,
    cohortFacade: SubstituteCohortFacade,
  ): DynamicModule[] => [
    SubstituteModule.of(AccessFacade, accessFacade),
    SubstituteModule.of(InstitutionFacade, institutionFacade),
    SubstituteModule.of(CourseFacade, courseFacade),
    SubstituteModule.of(CohortFacade, cohortFacade),
  ];

  beforeAll(async () => {
    prisma = new PrismaClient();
    access = new SubstituteAccessFacade();
    institutions = new SubstituteInstitutionFacade();
    courses = new SubstituteCourseFacade();
    cohorts = new SubstituteCohortFacade();
    bus = new InMemoryDomainEventBus();
    wire(access, institutions, courses, cohorts);

    moduleRef = await Test.createTestingModule({
      imports: [
        EventModule.forRoot(prisma, {
          imports: imports(access, institutions, courses, cohorts),
          events: bus,
        }),
      ],
    }).compile();
    await moduleRef.init();
    facade = moduleRef.get(EventFacade);
  });

  afterAll(async () => {
    await moduleRef?.close();
    await prisma?.$disconnect();
  });

  describe('titularidade do escopo', () => {
    it('o professor da turma cria no escopo dela, e não acima dele', async () => {
      expect(valueOf(await create()).scopeId).toBe(cohortId);
      expect(
        failureOf(await create(professorId, { scopeType: 'COURSE', scopeId: courseId })).code,
      ).toBe('EVENT_SCOPE_NOT_ALLOWED');
      expect(
        failureOf(await create(professorId, { scopeType: 'INSTITUTION', scopeId: institutionId }))
          .code,
      ).toBe('EVENT_SCOPE_NOT_ALLOWED');
    });

    it('a propriedade desce a hierarquia: o coordenador é dono da turma do seu curso', async () => {
      expect(valueOf(await create(coordinatorId)).ownerId).toBe(coordinatorId);
      expect(
        valueOf(await create(coordinatorId, { scopeType: 'COURSE', scopeId: courseId })).scopeType,
      ).toBe('COURSE');
      expect(
        valueOf(await create(adminId, { scopeType: 'INSTITUTION', scopeId: institutionId }))
          .institutionId,
      ).toBe(institutionId);
    });

    it('deriva a ancestralidade do alvo e a preserva na alteração', async () => {
      const event = valueOf(await create());

      expect(event).toMatchObject({ institutionId, courseId });

      const changed = valueOf(
        await facade.update({ actorId: professorId, eventId: event.id, title: 'Outro' }),
      );

      expect(changed).toMatchObject({ institutionId, courseId, title: 'Outro' });
    });

    it('alvo inexistente é indistinguível de alvo de outra instituição', async () => {
      expect(
        failureOf(await create(professorId, { scopeType: 'COHORT', scopeId: uuidv7() })).code,
      ).toBe('RESOURCE_NOT_FOUND');
    });

    it('quem não é dono não altera nem cancela', async () => {
      const event = valueOf(await create());

      expect(
        failureOf(await facade.update({ actorId: outsiderId, eventId: event.id, title: 'x' })).code,
      ).toBe('PERMISSION_DENIED');
      expect(failureOf(await facade.cancel({ actorId: outsiderId, eventId: event.id })).code).toBe(
        'PERMISSION_DENIED',
      );
    });
  });

  describe('projeção de uso', () => {
    it('consome o fato uma vez só e recusa redução abaixo dele', async () => {
      const event = valueOf(await create());
      const factId = uuidv7();

      await facade.handleTeamUsage({
        factId,
        factType: 'TeamCreated',
        eventId: event.id,
        teamsInUse: 3,
        largestTeamSize: 4,
        occurredAt: new Date(),
      });
      await facade.handleTeamUsage({
        factId,
        factType: 'TeamCreated',
        eventId: event.id,
        teamsInUse: 99,
        largestTeamSize: 99,
        occurredAt: new Date(),
      });

      expect(
        failureOf(await facade.update({ actorId: professorId, eventId: event.id, maxTeams: 2 }))
          .code,
      ).toBe('VALIDATION_FAILED');
      expect(
        valueOf(await facade.update({ actorId: professorId, eventId: event.id, maxTeams: 3 }))
          .maxTeams,
      ).toBe(3);
    });

    it('o fato chega pelo barramento, sem o módulo perguntar a ninguém', async () => {
      const event = valueOf(await create());

      await bus.publish({
        type: 'TeamCompositionChanged',
        payload: {
          factId: uuidv7(),
          eventId: event.id,
          teamsInUse: 2,
          largestTeamSize: 5,
          occurredAt: new Date().toISOString(),
        },
      });

      expect(
        failureOf(await facade.update({ actorId: professorId, eventId: event.id, maxTeamSize: 4 }))
          .code,
      ).toBe('VALIDATION_FAILED');
      expect(bus.deadLetters).toEqual([]);
    });

    it('fato sem identificador é descartado, e não aplicado às cegas', async () => {
      const event = valueOf(await create());

      await facade.handleTeamUsage({
        factId: '',
        factType: 'TeamCreated',
        eventId: event.id,
        teamsInUse: 9,
        largestTeamSize: 9,
        occurredAt: new Date(),
      });

      expect(
        valueOf(await facade.update({ actorId: professorId, eventId: event.id, maxTeams: 1 }))
          .maxTeams,
      ).toBe(1);
    });
  });

  describe('invariância da contagem de consultas', () => {
    /**
     * O contador enxerga as consultas **deste** módulo.
     *
     * As fachadas vizinhas são substitutos, e o que o teste prova é que `event` não
     * consulta em laço — nem por evento devolvido, nem por orientador, nem por usuário
     * avaliado. A ausência de laço do outro lado da fronteira é provada no módulo dono
     * daquele dado (`ADR-0011` §9).
     */
    it('lista N eventos no mesmo número de consultas que um só', async () => {
      const counter = createQueryCounter(prisma);
      const scoped = await Test.createTestingModule({
        imports: [
          EventModule.forRoot(counter.client, {
            imports: imports(access, institutions, courses, cohorts),
            events: new InMemoryDomainEventBus(),
          }),
        ],
      }).compile();

      try {
        const scopedFacade = scoped.get(EventFacade);

        valueOf(
          await scopedFacade.create({
            ...DRAFT,
            actorId: professorId,
            scopeType: 'COHORT',
            scopeId: cohortId,
          }),
        );

        counter.reset();
        valueOf(await scopedFacade.list({ actorId: studentId, request: page }));
        const forOne = counter.count();

        for (let index = 0; index < 5; index += 1) {
          valueOf(
            await scopedFacade.create({
              ...DRAFT,
              actorId: professorId,
              scopeType: 'COHORT',
              scopeId: cohortId,
            }),
          );
        }

        counter.reset();
        const many = valueOf(await scopedFacade.list({ actorId: studentId, request: page }));

        expect(many.items.length).toBeGreaterThan(1);
        expect(counter.count()).toBe(forOne);
        expect(forOne).toBeGreaterThan(0);
      } finally {
        await scoped.close();
      }
    });

    it('lista N orientadores no mesmo número de consultas que um só', async () => {
      const counter = createQueryCounter(prisma);
      const scoped = await Test.createTestingModule({
        imports: [
          EventModule.forRoot(counter.client, {
            imports: imports(access, institutions, courses, cohorts),
            events: new InMemoryDomainEventBus(),
          }),
        ],
      }).compile();

      try {
        const scopedFacade = scoped.get(EventFacade);
        const event = valueOf(
          await scopedFacade.create({
            ...DRAFT,
            actorId: professorId,
            scopeType: 'COHORT',
            scopeId: cohortId,
          }),
        );

        valueOf(
          await scopedFacade.assignAdvisor({
            actorId: professorId,
            eventId: event.id,
            userId: professorId,
          }),
        );

        counter.reset();
        valueOf(
          await scopedFacade.listAdvisors({
            actorId: professorId,
            eventId: event.id,
            request: page,
          }),
        );
        const forOne = counter.count();

        for (const userId of [coordinatorId, studentId]) {
          valueOf(
            await scopedFacade.assignAdvisor({ actorId: professorId, eventId: event.id, userId }),
          );
        }

        counter.reset();
        const many = valueOf(
          await scopedFacade.listAdvisors({
            actorId: professorId,
            eventId: event.id,
            request: page,
          }),
        );

        expect(many.items).toHaveLength(3);
        expect(counter.count()).toBe(forOne);
        expect(forOne).toBeGreaterThan(0);
      } finally {
        await scoped.close();
      }
    });

    it('apura a elegibilidade de N usuários no mesmo número de consultas que de um', async () => {
      const counter = createQueryCounter(prisma);
      const scoped = await Test.createTestingModule({
        imports: [
          EventModule.forRoot(counter.client, {
            imports: imports(access, institutions, courses, cohorts),
            events: new InMemoryDomainEventBus(),
          }),
        ],
      }).compile();

      try {
        const scopedFacade = scoped.get(EventFacade);
        const event = valueOf(
          await scopedFacade.create({
            ...DRAFT,
            actorId: professorId,
            scopeType: 'COHORT',
            scopeId: cohortId,
          }),
        );

        counter.reset();
        const forOne = await scopedFacade.eligibilityOf({
          eventId: event.id,
          userIds: [studentId],
        });
        const queriesForOne = counter.count();

        counter.reset();
        const forMany = await scopedFacade.eligibilityOf({
          eventId: event.id,
          userIds: [studentId, professorId, coordinatorId, adminId, outsiderId],
        });

        expect(forOne.get(studentId)).toBe(true);
        expect(forMany.get(studentId)).toBe(true);
        expect(forMany.get(professorId)).toBe(true);
        expect(forMany.get(coordinatorId)).toBe(true);
        expect(forMany.get(outsiderId)).toBe(false);
        expect(forMany.size).toBe(5);
        expect(counter.count()).toBe(queriesForOne);
        expect(queriesForOne).toBeGreaterThan(0);
      } finally {
        await scoped.close();
      }
    });
  });
});
