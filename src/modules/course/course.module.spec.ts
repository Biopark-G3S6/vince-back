import { Module, type DynamicModule, type InjectionToken } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import type { AccessResult } from '@modules/access/contracts/result.dto';
import type { RoleAssignmentCommand, UserProfileDto } from '@modules/access/contracts/user.dto';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';
import type { InstitutionStateDto } from '@modules/institution/contracts/institution.dto';
import type { PageRequest } from '@shared/http/pagination';

import type { CourseDto, CreateCourseCommand } from './contracts/course.dto';
import { CourseFacade } from './contracts/course.facade';
import type { CourseResult } from './contracts/result.dto';
import { CourseModule } from './course.module';
import { createQueryCounter } from './infrastructure/query-counter';
import { PrismaCourseRepository } from './infrastructure/prisma-course.repository';
import { createCoursePrisma } from './infrastructure/course-prisma';

class SubstituteAccessFacade extends AccessFacade {
  readonly profiles = new Map<string, UserProfileDto>();
  readonly roles = new Map<string, Set<string>>();

  profile(userId: string, institutionId: string, active = true): void {
    this.profiles.set(userId, {
      id: userId,
      email: `${userId}@teste.local`,
      name: 'Pessoa de teste',
      expertiseArea: null,
      preferredLanguage: null,
      active,
      institutionId,
      roleCodes: [],
    });
  }

  findOwnProfile(query: {
    actorId: string;
    userId: string;
  }): Promise<AccessResult<UserProfileDto>> {
    const profile = this.profiles.get(query.userId);

    return Promise.resolve(
      profile === undefined
        ? { ok: false, failure: { code: 'RESOURCE_NOT_FOUND' } }
        : { ok: true, value: profile },
    );
  }

  assignRole(command: RoleAssignmentCommand): Promise<AccessResult<void>> {
    const roles = this.roles.get(command.userId) ?? new Set<string>();
    roles.add(command.roleCode);
    this.roles.set(command.userId, roles);

    return Promise.resolve({ ok: true, value: undefined });
  }

  revokeRole(command: RoleAssignmentCommand): Promise<AccessResult<void>> {
    this.roles.get(command.userId)?.delete(command.roleCode);

    return Promise.resolve({ ok: true, value: undefined });
  }

  permissionsOfRoles(): never {
    return expect.unreachable('não usado');
  }
  createUser(): never {
    return expect.unreachable('não usado');
  }
  updateOwnProfile(): never {
    return expect.unreachable('não usado');
  }
  deactivateUser(): never {
    return expect.unreachable('não usado');
  }
  activateUser(): never {
    return expect.unreachable('não usado');
  }
  effectivePermissions(): never {
    return expect.unreachable('não usado');
  }
  verifyCredential(): never {
    return expect.unreachable('não usado');
  }
  changeOwnPassword(): never {
    return expect.unreachable('não usado');
  }
  requestPasswordReset(): never {
    return expect.unreachable('não usado');
  }
  resetPassword(): never {
    return expect.unreachable('não usado');
  }
  issueInvitation(): never {
    return expect.unreachable('não usado');
  }
  findInvitation(): never {
    return expect.unreachable('não usado');
  }
  acceptInvitation(): never {
    return expect.unreachable('não usado');
  }
  listInvitations(): never {
    return expect.unreachable('não usado');
  }
  revokeInvitation(): never {
    return expect.unreachable('não usado');
  }
}

class SubstituteInstitutionFacade extends InstitutionFacade {
  readonly states = new Map<string, InstitutionStateDto>();

  active(institutionId: string): void {
    this.states.set(institutionId, { exists: true, active: true });
  }

  stateOf(institutionId: string): Promise<InstitutionStateDto> {
    return Promise.resolve(this.states.get(institutionId) ?? { exists: false, active: false });
  }

  statesOf(): never {
    return expect.unreachable('não usado');
  }
  create(): never {
    return expect.unreachable('não usado');
  }
  findById(): never {
    return expect.unreachable('não usado');
  }
  list(): never {
    return expect.unreachable('não usado');
  }
  update(): never {
    return expect.unreachable('não usado');
  }
  deactivate(): never {
    return expect.unreachable('não usado');
  }
  activate(): never {
    return expect.unreachable('não usado');
  }
  assignAdmin(): never {
    return expect.unreachable('não usado');
  }
  revokeAdmin(): never {
    return expect.unreachable('não usado');
  }
  issueInvitation(): never {
    return expect.unreachable('não usado');
  }
  listInvitations(): never {
    return expect.unreachable('não usado');
  }
  revokeInvitation(): never {
    return expect.unreachable('não usado');
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

function valueOf<T>(result: CourseResult<T>): T {
  if (!result.ok) {
    expect.unreachable(`esperava sucesso, veio ${result.failure.code}`);
  }

  return result.value;
}

function failureOf<T>(result: CourseResult<T>): { code: string } {
  if (result.ok) {
    expect.unreachable('esperava falha');
  }

  return result.failure;
}

const institutionId = '01930000-0000-7000-8000-000000000101';
const otherInstitutionId = '01930000-0000-7000-8000-000000000102';
const actorId = '01930000-0000-7000-8000-000000000201';
const otherActorId = '01930000-0000-7000-8000-000000000202';
const coordinatorId = '01930000-0000-7000-8000-000000000301';
const secondCoordinatorId = '01930000-0000-7000-8000-000000000302';

describe('módulo course', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let moduleRef: TestingModule;
  let facade: CourseFacade;
  let access: SubstituteAccessFacade;
  let institutions: SubstituteInstitutionFacade;

  const page: PageRequest = { page: 1, pageSize: 20, withTotal: false };
  const create = (overrides: Partial<CreateCourseCommand> = {}): Promise<CourseDto> =>
    facade
      .create({ actorId, name: 'Administração', identification: 'ADM', ...overrides })
      .then(valueOf);

  beforeAll(async () => {
    prisma = new PrismaClient();
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    access = new SubstituteAccessFacade();
    institutions = new SubstituteInstitutionFacade();
    institutions.active(institutionId);
    institutions.active(otherInstitutionId);
    access.profile(actorId, institutionId);
    access.profile(otherActorId, otherInstitutionId);
    access.profile(coordinatorId, institutionId);
    access.profile(secondCoordinatorId, institutionId);

    moduleRef = await Test.createTestingModule({
      imports: [
        CourseModule.forRoot(prisma, {
          imports: [
            SubstituteModule.of(AccessFacade, access),
            SubstituteModule.of(InstitutionFacade, institutions),
          ],
        }),
      ],
    }).compile();
    facade = moduleRef.get(CourseFacade);
  });

  afterAll(async () => {
    await moduleRef.close();
    await prisma.$disconnect();
    redis.disconnect();
  });

  beforeEach(async () => {
    access.roles.clear();
    await prisma.courseCoordinatorAudit.deleteMany();
    await prisma.courseCoordinator.deleteMany();
    await prisma.course.deleteMany();
  });

  it('cria, consulta, altera, lista e desativa curso', async () => {
    const course = await create();

    expect(course).toMatchObject({ institutionId, active: true, identification: 'ADM' });
    expect(valueOf(await facade.findById({ actorId, courseId: course.id })).name).toBe(
      'Administração',
    );
    expect(
      valueOf(await facade.update({ actorId, courseId: course.id, name: 'Novo nome' })).name,
    ).toBe('Novo nome');
    expect(valueOf(await facade.list({ actorId, request: page }))).toMatchObject({
      items: [{ id: course.id }],
      pagination: { page: 1, pageSize: 20, hasNext: false },
    });
    expect(valueOf(await facade.deactivate({ actorId, courseId: course.id })).active).toBe(false);
    expect(valueOf(await facade.deactivate({ actorId, courseId: course.id })).active).toBe(false);
  });

  it('isola consultas e alterações por instituição', async () => {
    const course = await create();

    expect(
      failureOf(await facade.findById({ actorId: otherActorId, courseId: course.id })).code,
    ).toBe('PERMISSION_DENIED');
    expect(
      failureOf(await facade.update({ actorId: otherActorId, courseId: course.id, name: 'Outro' }))
        .code,
    ).toBe('PERMISSION_DENIED');
    expect(valueOf(await facade.list({ actorId: otherActorId, request: page })).items).toEqual([]);
  });

  it('designa um coordenador uma vez, audita e impede segundo coordenador', async () => {
    const course = await create();

    expect(
      (await facade.assignCoordinator({ actorId, courseId: course.id, userId: coordinatorId })).ok,
    ).toBe(true);
    expect(
      (await facade.assignCoordinator({ actorId, courseId: course.id, userId: coordinatorId })).ok,
    ).toBe(true);
    expect(
      failureOf(
        await facade.assignCoordinator({
          actorId,
          courseId: course.id,
          userId: secondCoordinatorId,
        }),
      ).code,
    ).toBe('COORDINATOR_ALREADY_ASSIGNED');
    expect(await prisma.courseCoordinator.count({ where: { courseId: course.id } })).toBe(1);
    expect(await prisma.courseCoordinatorAudit.count({ where: { courseId: course.id } })).toBe(1);
  });

  it('revoga o vínculo, o papel e a auditoria, sem segunda auditoria na repetição', async () => {
    const course = await create();

    await facade.assignCoordinator({ actorId, courseId: course.id, userId: coordinatorId });
    await facade.revokeCoordinator({ actorId, courseId: course.id, userId: coordinatorId });
    await facade.revokeCoordinator({ actorId, courseId: course.id, userId: coordinatorId });

    expect(await facade.coordinatorOf(course.id)).toBeNull();
    expect(access.roles.get(coordinatorId)?.has('COORDINATOR')).toBe(false);
    expect(await prisma.courseCoordinatorAudit.count({ where: { courseId: course.id } })).toBe(2);
  });

  it('recusa designação para curso inativo e usuário inativo', async () => {
    const course = await create();
    await facade.deactivate({ actorId, courseId: course.id });
    expect(
      failureOf(
        await facade.assignCoordinator({ actorId, courseId: course.id, userId: coordinatorId }),
      ).code,
    ).toBe('VALIDATION_FAILED');

    const activeCourse = await create({ identification: 'OUTRO' });
    const inactive = access.profiles.get(coordinatorId);
    access.profiles.set(coordinatorId, { ...inactive!, active: false });
    expect(
      failureOf(
        await facade.assignCoordinator({
          actorId,
          courseId: activeCourse.id,
          userId: coordinatorId,
        }),
      ).code,
    ).toBe('RESOURCE_NOT_FOUND');
  });

  it('mantém constante a quantidade de consultas da listagem', async () => {
    const counter = createQueryCounter(prisma);
    const repository = new PrismaCourseRepository(createCoursePrisma(counter.client));
    const first = '01930000-0000-7000-8000-000000000401';

    await repository.create({
      id: first,
      institutionId,
      name: 'Curso 1',
      identification: 'CURSO1',
      active: true,
      coordinatorId: null,
    });
    counter.reset();
    const one = await repository.list(institutionId, { page: 1, pageSize: 50, withTotal: false });
    const oneCount = counter.count();

    for (let index = 2; index <= 10; index += 1) {
      await repository.create({
        id: `01930000-0000-7000-8000-0000000004${String(index).padStart(2, '0')}`,
        institutionId,
        name: `Curso ${index}`,
        identification: `CURSO${index}`,
        active: true,
        coordinatorId: null,
      });
    }
    counter.reset();
    const ten = await repository.list(institutionId, { page: 1, pageSize: 50, withTotal: false });

    expect(one.rows).toHaveLength(1);
    expect(ten.rows).toHaveLength(10);
    expect(oneCount).toBe(1);
    expect(counter.count()).toBe(oneCount);
  });
});
