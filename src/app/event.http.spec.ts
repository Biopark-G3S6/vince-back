import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AccessModule } from '@modules/access/access.module';
import { AccessFacade } from '@modules/access/contracts/access.facade';
import { CohortFacade } from '@modules/cohort/contracts/cohort.facade';
import { CourseFacade } from '@modules/course/contracts/course.facade';
import { EventFacade } from '@modules/event/contracts/event.facade';
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
  readonly pagination?: { readonly page: number; readonly pageSize: number };
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

const EVENT_BODY = {
  title: 'Congresso interno',
  theme: 'Cidades inteligentes',
  researchProblem: 'Como medir mobilidade urbana?',
  objectives: 'Produzir artigo publicável',
  maxTeams: 4,
  maxTeamSize: 5,
};

describe('contrato HTTP da vertical event', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let server: unknown;
  let access: AccessFacade;
  let institutions: InstitutionFacade;
  let courses: CourseFacade;
  let cohorts: CohortFacade;
  let events: EventFacade;
  let sequence = 0;

  const setPassword = async (email: string): Promise<void> => {
    const issued = await access.requestPasswordReset({ email });
    if (issued === null) throw new Error('redefinição não emitida');

    const reset = await access.resetPassword({ token: issued.token, password: PASSWORD });
    if (!reset.ok) throw new Error(reset.failure.code);
  };

  const createAccount = async (institutionId: string, roleCode: string) => {
    const email = `event-${uuidv7()}@exemplo.test`;
    const created = await access.createUser({
      email,
      name: `Pessoa ${roleCode}`,
      roleCode,
      institutionId,
    });
    if (!created.ok) throw new Error(created.failure.code);

    await setPassword(email);

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

  /**
   * O cenário de que todos os casos partem: instituição, administrador com vínculo,
   * curso com coordenador, turma com professor designado e aluno matriculado.
   *
   * É montado pelas fachadas, e não por HTTP, porque o que está sob teste aqui é o
   * contrato de `event` — chegar até ele por doze requisições de outras verticais
   * tornaria a falha de qualquer uma delas uma falha deste arquivo.
   */
  const scenario = async () => {
    sequence += 1;
    const institution = await institutions.create({
      name: `Instituição Event ${sequence}`,
      code: `EVENT${sequence}${Date.now() % 100000}`,
    });
    if (!institution.ok) throw new Error(institution.failure.code);
    const institutionId = institution.value.id;

    const admin = await createAccount(institutionId, 'INSTITUTION_ADMIN');

    // O papel diz o que o administrador pode fazer; o vínculo diz onde (RF-INS-002 RN2).
    // É o vínculo que o escopo institucional do evento exige.
    const linked = await institutions.assignAdmin({ institutionId, userId: admin.id });
    if (!linked.ok) throw new Error(linked.failure.code);

    const coordinator = await createAccount(institutionId, 'PROFESSOR');
    const professor = await createAccount(institutionId, 'PROFESSOR');
    const outsider = await createAccount(institutionId, 'PROFESSOR');

    const course = await courses.create({
      actorId: admin.id,
      name: `Curso Event ${sequence}`,
      identification: `E${sequence}${Date.now() % 1000}`,
    });
    if (!course.ok) throw new Error(course.failure.code);

    const assigned = await courses.assignCoordinator({
      actorId: admin.id,
      courseId: course.value.id,
      userId: coordinator.id,
    });
    if (!assigned.ok) throw new Error(assigned.failure.code);

    const cohort = await cohorts.create({
      actorId: coordinator.id,
      courseId: course.value.id,
      identification: 'A',
      term: '2026/1',
      startsAt: new Date('2026-02-01T00:00:00.000Z'),
      endsAt: new Date('2026-06-30T00:00:00.000Z'),
    });
    if (!cohort.ok) throw new Error(cohort.failure.code);

    const designated = await cohorts.assignProfessor({
      actorId: coordinator.id,
      cohortId: cohort.value.id,
      userId: professor.id,
    });
    if (!designated.ok) throw new Error(designated.failure.code);

    const studentEmail = `student-${uuidv7()}@exemplo.test`;
    const enrollment = await cohorts.enroll({
      actorId: professor.id,
      cohortId: cohort.value.id,
      name: 'Aluna Matriculada',
      email: studentEmail,
    });
    if (!enrollment.ok) throw new Error(enrollment.failure.code);
    await setPassword(studentEmail);

    return {
      institutionId,
      admin,
      coordinator,
      professor,
      outsider,
      courseId: course.value.id,
      cohortId: cohort.value.id,
      student: { id: enrollment.value.userId, email: studentEmail },
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
    institutions = app.get(InstitutionFacade);
    courses = app.get(CourseFacade);
    cohorts = app.get(CohortFacade);
    events = app.get(EventFacade);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await AccessModule.seed(moduleRef);
  });

  it('cria evento de turma, recusa escopo superior e alvo inexistente', async () => {
    const fixture = await scenario();
    const cookies = await authenticate(fixture.professor.email);

    const created = await request(server as never)
      .post(`${PREFIX}/events`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ ...EVENT_BODY, scopeType: 'COHORT', scopeId: fixture.cohortId })
      .expect(201);
    const event = bodyOf(created).data as {
      readonly id: string;
      readonly institutionId: string;
      readonly courseId: string;
      readonly status: string;
    };

    expect(event.status).toBe('ACTIVE');
    expect(event.institutionId).toBe(fixture.institutionId);
    expect(event.courseId).toBe(fixture.courseId);
    expect(created.headers.location).toBe(`/events/${event.id}`);

    // O professor está vinculado à turma, e só a ela: o escopo do curso é superior.
    const superior = await request(server as never)
      .post(`${PREFIX}/events`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ ...EVENT_BODY, scopeType: 'COURSE', scopeId: fixture.courseId })
      .expect(422);
    expect(bodyOf(superior).status.code).toBe('EVENT_SCOPE_NOT_ALLOWED');

    const institutional = await request(server as never)
      .post(`${PREFIX}/events`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ ...EVENT_BODY, scopeType: 'INSTITUTION', scopeId: fixture.institutionId })
      .expect(422);
    expect(bodyOf(institutional).status.code).toBe('EVENT_SCOPE_NOT_ALLOWED');

    const absent = await request(server as never)
      .post(`${PREFIX}/events`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ ...EVENT_BODY, scopeType: 'COHORT', scopeId: uuidv7() })
      .expect(404);
    expect(bodyOf(absent).status.code).toBe('RESOURCE_NOT_FOUND');

    const invalid = await request(server as never)
      .post(`${PREFIX}/events`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ ...EVENT_BODY, maxTeams: 0, scopeType: 'COHORT', scopeId: fixture.cohortId })
      .expect(400);
    expect(bodyOf(invalid).status.code).toBe('VALIDATION_FAILED');

    const unsupported = await request(server as never)
      .post(`${PREFIX}/events`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ ...EVENT_BODY, scopeType: 'TEAM', scopeId: fixture.cohortId })
      .expect(400);
    expect(bodyOf(unsupported).status.code).toBe('VALIDATION_FAILED');
  });

  it('o escopo institucional é do administrador com vínculo, e o do curso, do coordenador', async () => {
    const fixture = await scenario();
    const adminCookies = await authenticate(fixture.admin.email);
    const coordinatorCookies = await authenticate(fixture.coordinator.email);

    await request(server as never)
      .post(`${PREFIX}/events`)
      .set('Cookie', cookieHeader(adminCookies))
      .set('X-CSRF-Token', adminCookies.csrf)
      .send({ ...EVENT_BODY, scopeType: 'INSTITUTION', scopeId: fixture.institutionId })
      .expect(201);

    await request(server as never)
      .post(`${PREFIX}/events`)
      .set('Cookie', cookieHeader(coordinatorCookies))
      .set('X-CSRF-Token', coordinatorCookies.csrf)
      .send({ ...EVENT_BODY, scopeType: 'COURSE', scopeId: fixture.courseId })
      .expect(201);

    // O coordenador é dono do curso, e a turma está dentro dele: escopo inferior passa.
    await request(server as never)
      .post(`${PREFIX}/events`)
      .set('Cookie', cookieHeader(coordinatorCookies))
      .set('X-CSRF-Token', coordinatorCookies.csrf)
      .send({ ...EVENT_BODY, scopeType: 'COHORT', scopeId: fixture.cohortId })
      .expect(201);
  });

  it('alcança quem tem vínculo e recusa quem não tem, com 404 e 403', async () => {
    const fixture = await scenario();
    const professorCookies = await authenticate(fixture.professor.email);
    const studentCookies = await authenticate(fixture.student.email);
    const outsiderCookies = await authenticate(fixture.outsider.email);

    const created = await request(server as never)
      .post(`${PREFIX}/events`)
      .set('Cookie', cookieHeader(professorCookies))
      .set('X-CSRF-Token', professorCookies.csrf)
      .send({ ...EVENT_BODY, scopeType: 'COHORT', scopeId: fixture.cohortId })
      .expect(201);
    const eventId = (bodyOf(created).data as { readonly id: string }).id;

    // A aluna matriculada é elegível pelo escopo, e por isso o enxerga.
    const studentView = await request(server as never)
      .get(`${PREFIX}/events/${eventId}`)
      .set('Cookie', cookieHeader(studentCookies))
      .expect(200);
    expect((bodyOf(studentView).data as { readonly id: string }).id).toBe(eventId);

    const studentList = await request(server as never)
      .get(`${PREFIX}/events?pageSize=200&withTotal=true`)
      .set('Cookie', cookieHeader(studentCookies))
      .expect(200);
    expect(bodyOf(studentList).pagination?.pageSize).toBe(100);
    expect((bodyOf(studentList).data as readonly unknown[]).length).toBe(1);

    // O coordenador alcança por ancestralidade do curso, sem vínculo com a turma.
    const coordinatorCookies = await authenticate(fixture.coordinator.email);
    await request(server as never)
      .get(`${PREFIX}/events/${eventId}`)
      .set('Cookie', cookieHeader(coordinatorCookies))
      .expect(200);

    // Fora de qualquer vínculo, o evento é indistinguível de inexistente.
    const hidden = await request(server as never)
      .get(`${PREFIX}/events/${eventId}`)
      .set('Cookie', cookieHeader(outsiderCookies))
      .expect(404);
    expect(bodyOf(hidden).status.code).toBe('RESOURCE_NOT_FOUND');

    const outsiderList = await request(server as never)
      .get(`${PREFIX}/events`)
      .set('Cookie', cookieHeader(outsiderCookies))
      .expect(200);
    expect(bodyOf(outsiderList).data).toEqual([]);

    // A aluna não tem `EVENT:CREATE`: a permissão é negada na borda, antes do escopo.
    const denied = await request(server as never)
      .post(`${PREFIX}/events`)
      .set('Cookie', cookieHeader(studentCookies))
      .set('X-CSRF-Token', studentCookies.csrf)
      .send({ ...EVENT_BODY, scopeType: 'COHORT', scopeId: fixture.cohortId })
      .expect(403);
    expect(bodyOf(denied).status.code).toBe('PERMISSION_DENIED');

    const notOwner = await request(server as never)
      .patch(`${PREFIX}/events/${eventId}`)
      .set('Cookie', cookieHeader(outsiderCookies))
      .set('X-CSRF-Token', outsiderCookies.csrf)
      .send({ title: 'Sequestro de evento' })
      .expect(403);
    expect(bodyOf(notOwner).status.code).toBe('PERMISSION_DENIED');
  });

  it('mantém o cronograma com datas crescentes e protege a etapa iniciada', async () => {
    const fixture = await scenario();
    const cookies = await authenticate(fixture.professor.email);
    const created = await request(server as never)
      .post(`${PREFIX}/events`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ ...EVENT_BODY, scopeType: 'COHORT', scopeId: fixture.cohortId })
      .expect(201);
    const eventId = (bodyOf(created).data as { readonly id: string }).id;

    const milestone = async (order: number, dueAt: string, status = 201) => {
      const response = await request(server as never)
        .post(`${PREFIX}/events/${eventId}/milestones`)
        .set('Cookie', cookieHeader(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .send({ name: `Etapa ${order}`, order, dueAt })
        .expect(status);

      return response;
    };

    const started = await milestone(1, '2020-01-10T00:00:00.000Z');
    const startedId = (bodyOf(started).data as { readonly id: string }).id;
    await milestone(2, '2030-03-01T00:00:00.000Z');
    const last = await milestone(3, '2030-04-01T00:00:00.000Z');
    const lastId = (bodyOf(last).data as { readonly id: string }).id;

    // Prazo anterior ao da etapa precedente: o conflito é do cronograma, não da etapa.
    const conflict = await milestone(4, '2030-03-15T00:00:00.000Z', 409);
    expect(bodyOf(conflict).status.code).toBe('MILESTONE_DATE_CONFLICT');

    const tied = await milestone(5, '2030-04-01T00:00:00.000Z', 409);
    expect(bodyOf(tied).status.code).toBe('MILESTONE_DATE_CONFLICT');

    const duplicateOrder = await milestone(3, '2030-05-01T00:00:00.000Z', 409);
    expect(bodyOf(duplicateOrder).status.code).toBe('MILESTONE_DATE_CONFLICT');

    const moved = await request(server as never)
      .patch(`${PREFIX}/events/${eventId}/milestones/${lastId}`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ dueAt: '2030-02-01T00:00:00.000Z' })
      .expect(409);
    expect(bodyOf(moved).status.code).toBe('MILESTONE_DATE_CONFLICT');

    await request(server as never)
      .patch(`${PREFIX}/events/${eventId}/milestones/${lastId}`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ name: 'Entrega final', dueAt: '2030-05-01T00:00:00.000Z' })
      .expect(200);

    const startedRemoval = await request(server as never)
      .delete(`${PREFIX}/events/${eventId}/milestones/${startedId}`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .expect(400);
    expect(bodyOf(startedRemoval).status.code).toBe('VALIDATION_FAILED');

    await request(server as never)
      .delete(`${PREFIX}/events/${eventId}/milestones/${lastId}`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .expect(204);

    const schedule = await request(server as never)
      .get(`${PREFIX}/events/${eventId}/milestones?withTotal=true`)
      .set('Cookie', cookieHeader(cookies))
      .expect(200);
    expect(bodyOf(schedule).data).toHaveLength(2);

    const hidden = await request(server as never)
      .get(`${PREFIX}/events/${eventId}/milestones`)
      .set('Cookie', cookieHeader(await authenticate(fixture.outsider.email)))
      .expect(404);
    expect(bodyOf(hidden).status.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('designa orientador elegível, é idempotente e recusa inelegível', async () => {
    const fixture = await scenario();
    const cookies = await authenticate(fixture.coordinator.email);
    const created = await request(server as never)
      .post(`${PREFIX}/events`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ ...EVENT_BODY, scopeType: 'COHORT', scopeId: fixture.cohortId })
      .expect(201);
    const eventId = (bodyOf(created).data as { readonly id: string }).id;

    const assign = (userId: string, status: number) =>
      request(server as never)
        .post(`${PREFIX}/events/${eventId}/advisors/${userId}`)
        .set('Cookie', cookieHeader(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .expect(status);

    await assign(fixture.professor.id, 204);
    await assign(fixture.professor.id, 204);

    const ineligible = await assign(fixture.outsider.id, 422);
    expect(bodyOf(ineligible).status.code).toBe('STUDENT_NOT_ELIGIBLE');

    const advisors = await request(server as never)
      .get(`${PREFIX}/events/${eventId}/advisors?withTotal=true`)
      .set('Cookie', cookieHeader(cookies))
      .expect(200);
    expect(bodyOf(advisors).data).toEqual([{ eventId, userId: fixture.professor.id }]);
    expect(await events.isAdvisor(eventId, fixture.professor.id)).toBe(true);

    await request(server as never)
      .delete(`${PREFIX}/events/${eventId}/advisors/${fixture.professor.id}`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .expect(204);
    await request(server as never)
      .delete(`${PREFIX}/events/${eventId}/advisors/${fixture.professor.id}`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .expect(204);
    expect(await events.isAdvisor(eventId, fixture.professor.id)).toBe(false);
  });

  it('recusa reduzir limite abaixo do uso projetado e consome o fato uma vez só', async () => {
    const fixture = await scenario();
    const cookies = await authenticate(fixture.professor.email);
    const created = await request(server as never)
      .post(`${PREFIX}/events`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ ...EVENT_BODY, scopeType: 'COHORT', scopeId: fixture.cohortId })
      .expect(201);
    const eventId = (bodyOf(created).data as { readonly id: string }).id;

    const factId = uuidv7();
    const fact = {
      factId,
      factType: 'TeamCreated',
      eventId,
      teamsInUse: 3,
      largestTeamSize: 4,
      occurredAt: new Date(),
    };

    await events.handleTeamUsage(fact);
    // A reentrega do mesmo fato não pode mover a projeção.
    await events.handleTeamUsage({ ...fact, teamsInUse: 99, largestTeamSize: 99 });

    const below = await request(server as never)
      .patch(`${PREFIX}/events/${eventId}`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ maxTeams: 2, maxTeamSize: 3 })
      .expect(400);
    expect(bodyOf(below).status.code).toBe('VALIDATION_FAILED');

    const atUsage = await request(server as never)
      .patch(`${PREFIX}/events/${eventId}`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ maxTeams: 3, maxTeamSize: 4 })
      .expect(200);
    expect(bodyOf(atUsage).data).toMatchObject({ maxTeams: 3, maxTeamSize: 4 });
  });

  it('cancela de forma idempotente, mantém consultável e recusa alteração depois', async () => {
    const fixture = await scenario();
    const cookies = await authenticate(fixture.professor.email);
    const created = await request(server as never)
      .post(`${PREFIX}/events`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ ...EVENT_BODY, scopeType: 'COHORT', scopeId: fixture.cohortId })
      .expect(201);
    const eventId = (bodyOf(created).data as { readonly id: string }).id;

    const cancel = () =>
      request(server as never)
        .post(`${PREFIX}/events/${eventId}/cancellation`)
        .set('Cookie', cookieHeader(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .expect(200);

    expect((bodyOf(await cancel()).data as { readonly status: string }).status).toBe('CANCELLED');
    expect((bodyOf(await cancel()).data as { readonly status: string }).status).toBe('CANCELLED');

    const consulted = await request(server as never)
      .get(`${PREFIX}/events/${eventId}`)
      .set('Cookie', cookieHeader(cookies))
      .expect(200);
    expect((bodyOf(consulted).data as { readonly status: string }).status).toBe('CANCELLED');

    const update = await request(server as never)
      .patch(`${PREFIX}/events/${eventId}`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ title: 'Outro título' })
      .expect(400);
    expect(bodyOf(update).status.code).toBe('VALIDATION_FAILED');

    const milestone = await request(server as never)
      .post(`${PREFIX}/events/${eventId}/milestones`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ name: 'Etapa', order: 1, dueAt: '2030-03-01T00:00:00.000Z' })
      .expect(400);
    expect(bodyOf(milestone).status.code).toBe('VALIDATION_FAILED');

    // O estado publicado para quem possui a equipe é o que recusa novas formações.
    expect(await events.stateOf(eventId)).toMatchObject({ exists: true, active: false });
    expect(await events.stateOf(uuidv7())).toMatchObject({ exists: false });
  });

  it('apura elegibilidade e etapa corrente para o consumidor interno', async () => {
    const fixture = await scenario();
    const cookies = await authenticate(fixture.professor.email);
    const created = await request(server as never)
      .post(`${PREFIX}/events`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ ...EVENT_BODY, scopeType: 'COHORT', scopeId: fixture.cohortId })
      .expect(201);
    const eventId = (bodyOf(created).data as { readonly id: string }).id;

    const eligibility = await events.eligibilityOf({
      eventId,
      userIds: [
        fixture.student.id,
        fixture.professor.id,
        fixture.coordinator.id,
        fixture.outsider.id,
      ],
    });

    expect(eligibility.get(fixture.student.id)).toBe(true);
    expect(eligibility.get(fixture.professor.id)).toBe(true);
    expect(eligibility.get(fixture.coordinator.id)).toBe(true);
    expect(eligibility.get(fixture.outsider.id)).toBe(false);

    expect(await events.currentMilestoneOf(eventId)).toBeNull();

    await request(server as never)
      .post(`${PREFIX}/events/${eventId}/milestones`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ name: 'Primeira entrega', order: 1, dueAt: '2030-03-01T00:00:00.000Z' })
      .expect(201);

    expect((await events.currentMilestoneOf(eventId))?.name).toBe('Primeira entrega');
  });
});
