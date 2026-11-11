import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { AccessModule } from '@modules/access/access.module';
import { CohortFacade } from '@modules/cohort/contracts/cohort.facade';
import { CourseFacade } from '@modules/course/contracts/course.facade';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';

import { AppModule } from './app.module';
import { configureApi } from './bootstrap/http';

const PREFIX = '/api/v1';
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'vince_session';
const CSRF_COOKIE = process.env.CSRF_COOKIE_NAME ?? 'vince_csrf';
const PASSWORD = 'senha-de-teste-conforme';

interface ApiBody {
  readonly data: unknown;
  readonly status: { readonly code: string; readonly severity: string };
}

interface Cookies {
  readonly session: string;
  readonly csrf: string;
}

function bodyOf(response: request.Response): ApiBody {
  return response.body as ApiBody;
}

function cookieValue(response: request.Response, name: string): string {
  const raw: unknown = response.headers['set-cookie'];
  const cookies = Array.isArray(raw)
    ? raw.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const line = cookies.find((entry) => entry.startsWith(`${name}=`));

  return line?.split(';')[0]?.slice(name.length + 1) ?? '';
}

function cookieHeader(cookies: Cookies): string {
  return `${SESSION_COOKIE}=${cookies.session}; ${CSRF_COOKIE}=${cookies.csrf}`;
}

describe('contrato HTTP da vertical cohort', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let server: unknown;
  let access: AccessFacade;
  let courses: CourseFacade;
  let institutions: InstitutionFacade;
  let cohorts: CohortFacade;
  let sequence = 0;

  const createAccount = async (institutionId: string, roleCode: string) => {
    const email = `cohort-${uuidv7()}@exemplo.test`;
    const created = await access.createUser({
      email,
      name: `Pessoa ${roleCode}`,
      roleCode,
      institutionId,
    });

    if (!created.ok) {
      throw new Error(created.failure.code);
    }

    const issued = await access.requestPasswordReset({ email });
    if (issued === null) {
      throw new Error('redefinição não emitida');
    }

    const reset = await access.resetPassword({ token: issued.token, password: PASSWORD });
    if (!reset.ok) {
      throw new Error(reset.failure.code);
    }

    return { id: created.value.id, email };
  };

  const authenticate = async (email: string): Promise<Cookies> => {
    const response = await request(server as never)
      .post(`${PREFIX}/sessions`)
      .send({ email, password: PASSWORD })
      .expect(200);

    return {
      session: cookieValue(response, SESSION_COOKIE),
      csrf: cookieValue(response, CSRF_COOKIE),
    };
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule.forRole('api', [])],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();
    server = app.getHttpServer();
    access = app.get(AccessFacade);
    courses = app.get(CourseFacade);
    institutions = app.get(InstitutionFacade);
    cohorts = app.get(CohortFacade);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await AccessModule.seed(moduleRef);
  });

  it('mantém turma, designa professor, matricula e processa convite', async () => {
    sequence += 1;
    const institution = await institutions.create({
      name: `Instituição Cohort ${sequence}`,
      code: `COHORT${sequence}${Date.now() % 10000}`,
    });
    if (!institution.ok) throw new Error(institution.failure.code);

    const admin = await createAccount(institution.value.id, 'INSTITUTION_ADMIN');
    const coordinator = await createAccount(institution.value.id, 'PROFESSOR');
    const professor = await createAccount(institution.value.id, 'PROFESSOR');
    const course = await courses.create({
      actorId: admin.id,
      name: 'Curso Cohort',
      identification: `C${sequence}`,
    });
    if (!course.ok) throw new Error(course.failure.code);

    const assigned = await courses.assignCoordinator({
      actorId: admin.id,
      courseId: course.value.id,
      userId: coordinator.id,
    });
    if (!assigned.ok) throw new Error(assigned.failure.code);

    const coordinatorCookies = await authenticate(coordinator.email);
    const professorCookies = await authenticate(professor.email);
    const created = await request(server as never)
      .post(`${PREFIX}/courses/${course.value.id}/cohorts`)
      .set('Cookie', cookieHeader(coordinatorCookies))
      .set('X-CSRF-Token', coordinatorCookies.csrf)
      .send({
        identification: 'A',
        term: '2026/1',
        startsAt: '2026-02-01T00:00:00.000Z',
        endsAt: '2026-06-30T00:00:00.000Z',
      })
      .expect(201);
    const cohort = bodyOf(created).data as { readonly id: string };

    await request(server as never)
      .post(`${PREFIX}/cohorts/${cohort.id}/professors/${professor.id}`)
      .set('Cookie', cookieHeader(coordinatorCookies))
      .set('X-CSRF-Token', coordinatorCookies.csrf)
      .expect(204);

    const enrolled = await request(server as never)
      .post(`${PREFIX}/cohorts/${cohort.id}/enrollments`)
      .set('Cookie', cookieHeader(professorCookies))
      .set('X-CSRF-Token', professorCookies.csrf)
      .send({ name: 'Aluno Direto', email: `direct-${uuidv7()}@exemplo.test` })
      .expect(201);
    expect((bodyOf(enrolled).data as { readonly status: string }).status).toBe('ACTIVE');

    const invitation = await request(server as never)
      .post(`${PREFIX}/cohorts/${cohort.id}/invitations`)
      .set('Cookie', cookieHeader(professorCookies))
      .set('X-CSRF-Token', professorCookies.csrf)
      .send({ expiresAt: '2030-01-01T00:00:00.000Z' })
      .expect(201);
    const invitationData = bodyOf(invitation).data as {
      readonly url: string;
      readonly invitationId: string;
    };
    const token = invitationData.url.split('/').at(-1);

    const accepted = await request(server as never)
      .post(`${PREFIX}/invitations/${token}/acceptance`)
      .send({ name: 'Aluno Convite', email: `invite-${uuidv7()}@exemplo.test`, password: PASSWORD })
      .expect(201);
    expect(bodyOf(accepted).status.code).toBe('SUCCESS');
    const acceptedUserId = (bodyOf(accepted).data as { readonly userId: string }).userId;
    const eventId = uuidv7();
    const acceptedEvent = {
      eventId,
      invitationId: invitationData.invitationId,
      userId: acceptedUserId,
      roleCode: 'STUDENT',
      institutionId: institution.value.id,
      scopeType: 'COHORT',
      scopeId: cohort.id,
      occurredAt: new Date(),
    };
    await cohorts.handleInvitationAccepted(acceptedEvent);
    await cohorts.handleInvitationAccepted(acceptedEvent);

    const invalidInvitation = await request(server as never)
      .post(`${PREFIX}/cohorts/${cohort.id}/invitations`)
      .set('Cookie', cookieHeader(professorCookies))
      .set('X-CSRF-Token', professorCookies.csrf)
      .send({ expiresAt: '2020-01-01T00:00:00.000Z' })
      .expect(400);
    expect(bodyOf(invalidInvitation).status.code).toBe('VALIDATION_FAILED');

    const revocable = await request(server as never)
      .post(`${PREFIX}/cohorts/${cohort.id}/invitations`)
      .set('Cookie', cookieHeader(professorCookies))
      .set('X-CSRF-Token', professorCookies.csrf)
      .send({ expiresAt: '2030-01-01T00:00:00.000Z' })
      .expect(201);
    const revocableData = bodyOf(revocable).data as {
      readonly url: string;
      readonly invitationId: string;
    };

    await request(server as never)
      .delete(`${PREFIX}/cohorts/${cohort.id}/invitations/${revocableData.invitationId}`)
      .set('Cookie', cookieHeader(professorCookies))
      .set('X-CSRF-Token', professorCookies.csrf)
      .expect(204);

    const revokedAcceptance = await request(server as never)
      .post(`${PREFIX}/invitations/${revocableData.url.split('/').at(-1)}/acceptance`)
      .send({
        name: 'Aluno Revogado',
        email: `revoked-${uuidv7()}@exemplo.test`,
        password: PASSWORD,
      })
      .expect(422);
    expect(bodyOf(revokedAcceptance).status.code).toBe('INVITATION_REVOKED');

    const enrollments = await cohorts.listEnrollments({
      actorId: professor.id,
      cohortId: cohort.id,
      request: { page: 1, pageSize: 20, withTotal: false },
    });
    if (!enrollments.ok) throw new Error(enrollments.failure.code);
    expect(enrollments.value.items).toHaveLength(2);
  });
});
