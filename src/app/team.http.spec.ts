import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { DomainEventBus } from '@shared/events/event-bus';

import { AccessModule } from '@modules/access/access.module';
import { AccessFacade } from '@modules/access/contracts/access.facade';
import { CohortFacade } from '@modules/cohort/contracts/cohort.facade';
import { CourseFacade } from '@modules/course/contracts/course.facade';
import { EventFacade } from '@modules/event/contracts/event.facade';
import { TeamFacade } from '@modules/team/contracts/team.facade';
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

describe('contrato HTTP da vertical team', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let server: unknown;
  let access: AccessFacade;
  let institutions: InstitutionFacade;
  let courses: CourseFacade;
  let cohorts: CohortFacade;
  let events: EventFacade;
  let teams: TeamFacade;
  let sequence = 0;

  const setPassword = async (email: string): Promise<void> => {
    const issued = await access.requestPasswordReset({ email });
    if (issued === null) throw new Error('redefinição não emitida');

    const reset = await access.resetPassword({ token: issued.token, password: PASSWORD });
    if (!reset.ok) throw new Error(reset.failure.code);
  };

  const createAccount = async (institutionId: string, roleCode: string) => {
    const email = `team-${uuidv7()}@exemplo.test`;
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
      name: `Instituição Team ${sequence}`,
      code: `TEAM${sequence}${Date.now() % 100000}`,
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
      name: `Curso Team ${sequence}`,
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

    const enroll = async (name: string) => {
      const email = `student-${uuidv7()}@exemplo.test`;
      const enrollment = await cohorts.enroll({
        actorId: professor.id,
        cohortId: cohort.value.id,
        name,
        email,
      });
      if (!enrollment.ok) throw new Error(enrollment.failure.code);
      await setPassword(email);

      return { id: enrollment.value.userId, email };
    };

    const student = await enroll('Aluna Matriculada');
    const mate = await enroll('Colega Matriculado');

    // Aluno da instituição **sem** matrícula na turma: tem a permissão de ingressar, e
    // não a elegibilidade. É o que separa a recusa da borda da recusa do caso de uso.
    const unenrolled = await createAccount(institutionId, 'STUDENT');

    return {
      institutionId,
      admin,
      coordinator,
      professor,
      outsider,
      courseId: course.value.id,
      cohortId: cohort.value.id,
      student,
      mate,
      unenrolled,
    };
  };

  /**
   * O cenário de equipe: o evento, criado pelo coordenador, com o professor designado
   * como seu orientador — a pré-condição de `RF-EQP-001`.
   */
  const teamScenario = async (
    overrides: { readonly maxTeamSize?: number; readonly maxTeams?: number } = {},
  ) => {
    const fixture = await scenario();
    const created = await events.create({
      actorId: fixture.coordinator.id,
      scopeType: 'COHORT',
      scopeId: fixture.cohortId,
      title: 'Congresso interno',
      theme: 'Cidades inteligentes',
      researchProblem: 'Como medir mobilidade urbana?',
      objectives: 'Produzir artigo publicável',
      maxTeams: overrides.maxTeams ?? 4,
      maxTeamSize: overrides.maxTeamSize ?? 5,
    });
    if (!created.ok) throw new Error(created.failure.code);

    const designated = await events.assignAdvisor({
      actorId: fixture.coordinator.id,
      eventId: created.value.id,
      userId: fixture.professor.id,
    });
    if (!designated.ok) throw new Error(designated.failure.code);

    return { ...fixture, eventId: created.value.id };
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
    teams = app.get(TeamFacade);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await AccessModule.seed(moduleRef);
  });

  it('cria equipe, admite integrantes e recusa quem não orienta o evento', async () => {
    const fixture = await teamScenario();
    const advisor = await authenticate(fixture.professor.email);
    const outsider = await authenticate(fixture.outsider.email);
    const student = await authenticate(fixture.student.email);

    const created = await request(server as never)
      .post(`${PREFIX}/events/${fixture.eventId}/teams`)
      .set('Cookie', cookieHeader(advisor))
      .set('X-CSRF-Token', advisor.csrf)
      .send({ identification: 'Equipe A' })
      .expect(201);
    const team = bodyOf(created).data as { readonly id: string; readonly eventId: string };

    expect(team.eventId).toBe(fixture.eventId);
    expect(created.headers.location).toBe(`/teams/${team.id}`);

    // O professor sem designação no evento não forma equipe (RF-EQP-001 E2).
    const notAdvisor = await request(server as never)
      .post(`${PREFIX}/events/${fixture.eventId}/teams`)
      .set('Cookie', cookieHeader(outsider))
      .set('X-CSRF-Token', outsider.csrf)
      .send({ identification: 'Equipe clandestina' })
      .expect(422);
    expect(bodyOf(notAdvisor).status.code).toBe('ADVISOR_NOT_ASSIGNED_TO_EVENT');

    // A aluna ingressa por conta própria; o orientador designa a colega.
    const joined = await request(server as never)
      .post(`${PREFIX}/teams/${team.id}/membership`)
      .set('Cookie', cookieHeader(student))
      .set('X-CSRF-Token', student.csrf)
      .expect(201);
    expect(bodyOf(joined).data).toMatchObject({ userId: fixture.student.id, status: 'ACTIVE' });

    await request(server as never)
      .post(`${PREFIX}/teams/${team.id}/members/${fixture.mate.id}`)
      .set('Cookie', cookieHeader(advisor))
      .set('X-CSRF-Token', advisor.csrf)
      .expect(201);

    const members = await request(server as never)
      .get(`${PREFIX}/teams/${team.id}/members?withTotal=true`)
      .set('Cookie', cookieHeader(advisor))
      .expect(200);
    expect(bodyOf(members).data).toHaveLength(2);

    // Fora do escopo do evento, o aluno não ingressa (RF-EQP-002 E1). A recusa é do caso
    // de uso, e não da borda: quem tenta **tem** `TEAM:JOIN`, e lhe falta o vínculo.
    const unenrolled = await authenticate(fixture.unenrolled.email);
    const ineligible = await request(server as never)
      .post(`${PREFIX}/teams/${team.id}/membership`)
      .set('Cookie', cookieHeader(unenrolled))
      .set('X-CSRF-Token', unenrolled.csrf)
      .expect(422);
    expect(bodyOf(ineligible).status.code).toBe('STUDENT_NOT_ELIGIBLE');

    // O professor, mesmo orientador, não ingressa: a permissão é do aluno (403 na borda).
    const wrongRole = await request(server as never)
      .post(`${PREFIX}/teams/${team.id}/membership`)
      .set('Cookie', cookieHeader(advisor))
      .set('X-CSRF-Token', advisor.csrf)
      .expect(403);
    expect(bodyOf(wrongRole).status.code).toBe('PERMISSION_DENIED');
  });

  it('recusa segunda equipe no mesmo evento e respeita o limite de equipes', async () => {
    const fixture = await teamScenario({ maxTeams: 2 });
    const advisor = await authenticate(fixture.professor.email);
    const student = await authenticate(fixture.student.email);

    const create = (identification: string, status: number) =>
      request(server as never)
        .post(`${PREFIX}/events/${fixture.eventId}/teams`)
        .set('Cookie', cookieHeader(advisor))
        .set('X-CSRF-Token', advisor.csrf)
        .send({ identification })
        .expect(status);

    const first = bodyOf(await create('Equipe A', 201)).data as { readonly id: string };

    // A identificação repetida é recusada **abaixo** do limite: acima dele, quem responde
    // primeiro é o limite, e o teste não provaria nada sobre a unicidade.
    const duplicate = await create('Equipe A', 400);
    expect(bodyOf(duplicate).status.code).toBe('VALIDATION_FAILED');

    const second = bodyOf(await create('Equipe B', 201)).data as { readonly id: string };

    const beyond = await create('Equipe C', 422);
    expect(bodyOf(beyond).status.code).toBe('EVENT_TEAM_LIMIT_REACHED');

    await request(server as never)
      .post(`${PREFIX}/teams/${first.id}/membership`)
      .set('Cookie', cookieHeader(student))
      .set('X-CSRF-Token', student.csrf)
      .expect(201);

    const twice = await request(server as never)
      .post(`${PREFIX}/teams/${second.id}/membership`)
      .set('Cookie', cookieHeader(student))
      .set('X-CSRF-Token', student.csrf)
      .expect(409);
    expect(bodyOf(twice).status.code).toBe('STUDENT_ALREADY_IN_TEAM');
  });

  it('a remoção preserva a participação e libera a vaga', async () => {
    const fixture = await teamScenario({ maxTeamSize: 1 });
    const advisor = await authenticate(fixture.professor.email);
    const student = await authenticate(fixture.student.email);
    const created = await request(server as never)
      .post(`${PREFIX}/events/${fixture.eventId}/teams`)
      .set('Cookie', cookieHeader(advisor))
      .set('X-CSRF-Token', advisor.csrf)
      .send({ identification: 'Equipe A' })
      .expect(201);
    const team = bodyOf(created).data as { readonly id: string };

    await request(server as never)
      .post(`${PREFIX}/teams/${team.id}/membership`)
      .set('Cookie', cookieHeader(student))
      .set('X-CSRF-Token', student.csrf)
      .expect(201);

    const full = await request(server as never)
      .post(`${PREFIX}/teams/${team.id}/members/${fixture.mate.id}`)
      .set('Cookie', cookieHeader(advisor))
      .set('X-CSRF-Token', advisor.csrf)
      .expect(422);
    expect(bodyOf(full).status.code).toBe('TEAM_SIZE_LIMIT_REACHED');

    await request(server as never)
      .delete(`${PREFIX}/teams/${team.id}/members/${fixture.student.id}`)
      .set('Cookie', cookieHeader(advisor))
      .set('X-CSRF-Token', advisor.csrf)
      .expect(204);

    const members = await request(server as never)
      .get(`${PREFIX}/teams/${team.id}/members`)
      .set('Cookie', cookieHeader(advisor))
      .expect(200);
    expect(bodyOf(members).data).toMatchObject([{ userId: fixture.student.id, status: 'REMOVED' }]);

    // A participação encerrada continua consultável, e a vaga voltou.
    expect(await teams.membershipOf(team.id, fixture.student.id)).toEqual({
      active: false,
      participated: true,
    });
    await request(server as never)
      .post(`${PREFIX}/teams/${team.id}/members/${fixture.mate.id}`)
      .set('Cookie', cookieHeader(advisor))
      .set('X-CSRF-Token', advisor.csrf)
      .expect(201);
  });

  it('o convite é aceito pelo convidado e revalidado no aceite', async () => {
    const fixture = await teamScenario({ maxTeamSize: 1 });
    const advisor = await authenticate(fixture.professor.email);
    const student = await authenticate(fixture.student.email);
    const mate = await authenticate(fixture.mate.email);
    const created = await request(server as never)
      .post(`${PREFIX}/events/${fixture.eventId}/teams`)
      .set('Cookie', cookieHeader(advisor))
      .set('X-CSRF-Token', advisor.csrf)
      .send({ identification: 'Equipe A' })
      .expect(201);
    const team = bodyOf(created).data as { readonly id: string };

    const invite = (userId: string, expiresAt: string, status: number) =>
      request(server as never)
        .post(`${PREFIX}/teams/${team.id}/invitations`)
        .set('Cookie', cookieHeader(advisor))
        .set('X-CSRF-Token', advisor.csrf)
        .send({ userId, expiresAt })
        .expect(status);

    const expired = await invite(fixture.student.id, '2020-01-01T00:00:00.000Z', 400);
    expect(bodyOf(expired).status.code).toBe('VALIDATION_FAILED');

    const issued = await invite(fixture.student.id, '2030-01-01T00:00:00.000Z', 201);
    const invitation = bodyOf(issued).data as { readonly id: string };

    const invitations = await request(server as never)
      .get(`${PREFIX}/teams/${team.id}/invitations`)
      .set('Cookie', cookieHeader(advisor))
      .expect(200);
    expect(bodyOf(invitations).data).toHaveLength(1);

    // team-read-extensions: o convidado encontra o convite; a colega, não.
    const received = (cookies: Cookies) =>
      request(server as never)
        .get(`${PREFIX}/team-invitations`)
        .set('Cookie', cookieHeader(cookies))
        .expect(200);
    expect(bodyOf(await received(student)).data).toEqual([
      expect.objectContaining({ id: invitation.id, teamId: team.id }),
    ]);
    expect(bodyOf(await received(mate)).data).toEqual([]);

    // Só o convidado responde ao convite.
    const notMine = await request(server as never)
      .post(`${PREFIX}/team-invitations/${invitation.id}/acceptance`)
      .set('Cookie', cookieHeader(mate))
      .set('X-CSRF-Token', mate.csrf)
      .expect(404);
    expect(bodyOf(notMine).status.code).toBe('RESOURCE_NOT_FOUND');

    // A vaga é preenchida antes do aceite: o convite não a reservou.
    await request(server as never)
      .post(`${PREFIX}/teams/${team.id}/membership`)
      .set('Cookie', cookieHeader(mate))
      .set('X-CSRF-Token', mate.csrf)
      .expect(201);

    const late = await request(server as never)
      .post(`${PREFIX}/team-invitations/${invitation.id}/acceptance`)
      .set('Cookie', cookieHeader(student))
      .set('X-CSRF-Token', student.csrf)
      .expect(422);
    expect(bodyOf(late).status.code).toBe('TEAM_SIZE_LIMIT_REACHED');

    await request(server as never)
      .delete(`${PREFIX}/teams/${team.id}/members/${fixture.mate.id}`)
      .set('Cookie', cookieHeader(advisor))
      .set('X-CSRF-Token', advisor.csrf)
      .expect(204);

    const accepted = await request(server as never)
      .post(`${PREFIX}/team-invitations/${invitation.id}/acceptance`)
      .set('Cookie', cookieHeader(student))
      .set('X-CSRF-Token', student.csrf)
      .expect(201);
    expect(bodyOf(accepted).data).toMatchObject({ userId: fixture.student.id });
    // Aceito, o convite deixa de constar entre os recebidos.
    expect(bodyOf(await received(student)).data).toEqual([]);

    const again = await request(server as never)
      .post(`${PREFIX}/team-invitations/${invitation.id}/acceptance`)
      .set('Cookie', cookieHeader(student))
      .set('X-CSRF-Token', student.csrf)
      .expect(422);
    expect(bodyOf(again).status.code).toBe('INVITATION_REVOKED');
  });

  it('o dono do escopo nomeia o responsável, e o orientador comum não', async () => {
    const fixture = await teamScenario();
    const advisor = await authenticate(fixture.professor.email);
    const owner = await authenticate(fixture.coordinator.email);
    const created = await request(server as never)
      .post(`${PREFIX}/events/${fixture.eventId}/teams`)
      .set('Cookie', cookieHeader(advisor))
      .set('X-CSRF-Token', advisor.csrf)
      .send({ identification: 'Equipe A' })
      .expect(201);
    const team = bodyOf(created).data as { readonly id: string };

    const notOwner = await request(server as never)
      .post(`${PREFIX}/teams/${team.id}/advisor/${fixture.professor.id}`)
      .set('Cookie', cookieHeader(advisor))
      .set('X-CSRF-Token', advisor.csrf)
      .expect(403);
    expect(bodyOf(notOwner).status.code).toBe('PERMISSION_DENIED');

    const notInEvent = await request(server as never)
      .post(`${PREFIX}/teams/${team.id}/advisor/${fixture.outsider.id}`)
      .set('Cookie', cookieHeader(owner))
      .set('X-CSRF-Token', owner.csrf)
      .expect(422);
    expect(bodyOf(notInEvent).status.code).toBe('ADVISOR_NOT_ASSIGNED_TO_EVENT');

    await request(server as never)
      .post(`${PREFIX}/teams/${team.id}/advisor/${fixture.professor.id}`)
      .set('Cookie', cookieHeader(owner))
      .set('X-CSRF-Token', owner.csrf)
      .expect(204);
    expect((await teams.stateOf(team.id)).responsibleAdvisorId).toBe(fixture.professor.id);

    // team-read-extensions: a consulta e a listagem trazem o responsável.
    const found = await request(server as never)
      .get(`${PREFIX}/teams/${team.id}`)
      .set('Cookie', cookieHeader(owner))
      .expect(200);
    expect(bodyOf(found).data).toMatchObject({ responsibleAdvisorId: fixture.professor.id });
    const listed = await request(server as never)
      .get(`${PREFIX}/events/${fixture.eventId}/teams`)
      .set('Cookie', cookieHeader(owner))
      .expect(200);
    expect(bodyOf(listed).data).toEqual([
      expect.objectContaining({ id: team.id, responsibleAdvisorId: fixture.professor.id }),
    ]);

    await request(server as never)
      .delete(`${PREFIX}/teams/${team.id}/advisor/${fixture.professor.id}`)
      .set('Cookie', cookieHeader(owner))
      .set('X-CSRF-Token', owner.csrf)
      .expect(204);
    expect((await teams.stateOf(team.id)).responsibleAdvisorId).toBeNull();

    const cleared = await request(server as never)
      .get(`${PREFIX}/teams/${team.id}`)
      .set('Cookie', cookieHeader(owner))
      .expect(200);
    expect(bodyOf(cleared).data).toMatchObject({ responsibleAdvisorId: null });
  });

  it('lista os alunos elegíveis sem equipe e a esvazia quando todos ingressam', async () => {
    const fixture = await teamScenario();
    const advisor = await authenticate(fixture.professor.email);
    const outsider = await authenticate(fixture.outsider.email);
    const created = await request(server as never)
      .post(`${PREFIX}/events/${fixture.eventId}/teams`)
      .set('Cookie', cookieHeader(advisor))
      .set('X-CSRF-Token', advisor.csrf)
      .send({ identification: 'Equipe A' })
      .expect(201);
    const team = bodyOf(created).data as { readonly id: string };

    const pending = async (): Promise<readonly string[]> => {
      const response = await request(server as never)
        .get(`${PREFIX}/events/${fixture.eventId}/eligible-students?withTotal=true`)
        .set('Cookie', cookieHeader(advisor))
        .expect(200);

      return (bodyOf(response).data as readonly { readonly userId: string }[]).map(
        (entry) => entry.userId,
      );
    };

    expect([...(await pending())].sort()).toEqual([fixture.student.id, fixture.mate.id].sort());

    for (const userId of [fixture.student.id, fixture.mate.id]) {
      await request(server as never)
        .post(`${PREFIX}/teams/${team.id}/members/${userId}`)
        .set('Cookie', cookieHeader(advisor))
        .set('X-CSRF-Token', advisor.csrf)
        .expect(201);
    }

    expect(await pending()).toEqual([]);

    const notAdvisor = await request(server as never)
      .get(`${PREFIX}/events/${fixture.eventId}/eligible-students`)
      .set('Cookie', cookieHeader(outsider))
      .expect(422);
    expect(bodyOf(notAdvisor).status.code).toBe('ADVISOR_NOT_ASSIGNED_TO_EVENT');
  });

  it('o evento cancelado recusa novas formações, e o uso chega à projeção do evento', async () => {
    const fixture = await teamScenario();
    const advisor = await authenticate(fixture.professor.email);
    const owner = await authenticate(fixture.coordinator.email);
    const created = await request(server as never)
      .post(`${PREFIX}/events/${fixture.eventId}/teams`)
      .set('Cookie', cookieHeader(advisor))
      .set('X-CSRF-Token', advisor.csrf)
      .send({ identification: 'Equipe A' })
      .expect(201);
    const team = bodyOf(created).data as { readonly id: string };

    await request(server as never)
      .post(`${PREFIX}/teams/${team.id}/members/${fixture.student.id}`)
      .set('Cookie', cookieHeader(advisor))
      .set('X-CSRF-Token', advisor.csrf)
      .expect(201);

    // O fato de formação alimentou a projeção de uso do evento: reduzir o limite abaixo
    // dela é recusado, sem que `event` tenha perguntado nada a `team`.
    const below = await request(server as never)
      .patch(`${PREFIX}/events/${fixture.eventId}`)
      .set('Cookie', cookieHeader(owner))
      .set('X-CSRF-Token', owner.csrf)
      .send({ maxTeams: 0 })
      .expect(400);
    expect(bodyOf(below).status.code).toBe('VALIDATION_FAILED');

    await request(server as never)
      .post(`${PREFIX}/events/${fixture.eventId}/cancellation`)
      .set('Cookie', cookieHeader(owner))
      .set('X-CSRF-Token', owner.csrf)
      .expect(200);

    const refused = await request(server as never)
      .post(`${PREFIX}/events/${fixture.eventId}/teams`)
      .set('Cookie', cookieHeader(advisor))
      .set('X-CSRF-Token', advisor.csrf)
      .send({ identification: 'Equipe B' })
      .expect(400);
    expect(bodyOf(refused).status.code).toBe('VALIDATION_FAILED');

    const student = await authenticate(fixture.mate.email);
    const noJoin = await request(server as never)
      .post(`${PREFIX}/teams/${team.id}/membership`)
      .set('Cookie', cookieHeader(student))
      .set('X-CSRF-Token', student.csrf)
      .expect(400);
    expect(bodyOf(noJoin).status.code).toBe('VALIDATION_FAILED');

    // A equipe criada antes do cancelamento continua consultável.
    await request(server as never)
      .get(`${PREFIX}/teams/${team.id}`)
      .set('Cookie', cookieHeader(advisor))
      .expect(200);
  });

  it('a equipe de evento fora do vínculo é indistinguível de inexistente', async () => {
    const fixture = await teamScenario();
    const advisor = await authenticate(fixture.professor.email);
    const outsider = await authenticate(fixture.outsider.email);
    const created = await request(server as never)
      .post(`${PREFIX}/events/${fixture.eventId}/teams`)
      .set('Cookie', cookieHeader(advisor))
      .set('X-CSRF-Token', advisor.csrf)
      .send({ identification: 'Equipe A' })
      .expect(201);
    const team = bodyOf(created).data as { readonly id: string };

    const hidden = await request(server as never)
      .get(`${PREFIX}/teams/${team.id}`)
      .set('Cookie', cookieHeader(outsider))
      .expect(404);
    expect(bodyOf(hidden).status.code).toBe('RESOURCE_NOT_FOUND');

    const absent = await request(server as never)
      .get(`${PREFIX}/teams/${uuidv7()}`)
      .set('Cookie', cookieHeader(advisor))
      .expect(404);
    expect(bodyOf(absent).status.code).toBe('RESOURCE_NOT_FOUND');

    // A aluna matriculada enxerga as equipes do seu evento: é por elas que escolhe.
    const student = await authenticate(fixture.student.email);
    const listed = await request(server as never)
      .get(`${PREFIX}/events/${fixture.eventId}/teams`)
      .set('Cookie', cookieHeader(student))
      .expect(200);
    expect(bodyOf(listed).data).toHaveLength(1);
  });
  describe('o artigo acompanha a equipe (article-follows-team, article-listing)', () => {
    interface ArticleItem {
      readonly id: string;
      readonly teamId: string;
      readonly status: string;
      readonly advisorId: string | null;
      readonly memberIds: readonly string[];
    }

    const listArticles = async (cookies: Cookies, query: string): Promise<ArticleItem[]> =>
      bodyOf(
        await request(server as never)
          .get(`${PREFIX}/articles?${query}`)
          .set('Cookie', cookieHeader(cookies))
          .expect(200),
      ).data as ArticleItem[];

    const createTeam = async (advisor: Cookies, eventId: string, identification: string) =>
      (
        bodyOf(
          await request(server as never)
            .post(`${PREFIX}/events/${eventId}/teams`)
            .set('Cookie', cookieHeader(advisor))
            .set('X-CSRF-Token', advisor.csrf)
            .send({ identification })
            .expect(201),
        ).data as { readonly id: string }
      ).id;

    it('cria o artigo uma vez, segue a composição e o responsável', async () => {
      const fixture = await teamScenario();
      const advisor = await authenticate(fixture.professor.email);
      const owner = await authenticate(fixture.coordinator.email);
      const student = await authenticate(fixture.student.email);
      const teamId = await createTeam(advisor, fixture.eventId, 'Equipe Artigo');

      // RF-EQP-001 RN1: a equipe nasce com o seu artigo em STARTED.
      const [article] = await listArticles(advisor, `teamId=${teamId}`);
      expect(article).toMatchObject({ teamId, status: 'STARTED', memberIds: [] });
      const articleId = article?.id ?? '';

      // Reprocessar o fato de criação não cria um segundo artigo.
      await app
        .get(DomainEventBus, { strict: false })
        .publish({ type: 'TeamCreated', payload: { teamId, eventId: fixture.eventId } });
      expect(await listArticles(advisor, `eventId=${fixture.eventId}`)).toHaveLength(1);

      // A aluna fora da equipe não alcança o artigo; ingressando, alcança.
      expect(await listArticles(student, `eventId=${fixture.eventId}`)).toHaveLength(0);
      await request(server as never)
        .get(`${PREFIX}/articles/${articleId}`)
        .set('Cookie', cookieHeader(student))
        .expect(404);
      await request(server as never)
        .post(`${PREFIX}/teams/${teamId}/membership`)
        .set('Cookie', cookieHeader(student))
        .set('X-CSRF-Token', student.csrf)
        .expect(201);
      await request(server as never)
        .get(`${PREFIX}/articles/${articleId}`)
        .set('Cookie', cookieHeader(student))
        .expect(200);
      expect(await listArticles(student, `eventId=${fixture.eventId}`)).toHaveLength(1);

      // O orientador do evento lê, mas só o responsável avalia (RF-ART-002 E1).
      const grade = (status: number) =>
        request(server as never)
          .post(`${PREFIX}/articles/${articleId}/assessments`)
          .set('Cookie', cookieHeader(advisor))
          .set('X-CSRF-Token', advisor.csrf)
          .send({ score: 8.5 })
          .expect(status);

      expect(bodyOf(await grade(403)).status.code).toBe('PERMISSION_DENIED');

      await request(server as never)
        .post(`${PREFIX}/teams/${teamId}/advisor/${fixture.professor.id}`)
        .set('Cookie', cookieHeader(owner))
        .set('X-CSRF-Token', owner.csrf)
        .expect(204);
      await grade(201);

      await request(server as never)
        .delete(`${PREFIX}/teams/${teamId}/advisor/${fixture.professor.id}`)
        .set('Cookie', cookieHeader(owner))
        .set('X-CSRF-Token', owner.csrf)
        .expect(204);
      expect(bodyOf(await grade(403)).status.code).toBe('PERMISSION_DENIED');

      // Removida, a integrante perde a edição.
      await request(server as never)
        .delete(`${PREFIX}/teams/${teamId}/members/${fixture.student.id}`)
        .set('Cookie', cookieHeader(advisor))
        .set('X-CSRF-Token', advisor.csrf)
        .expect(204);
      await request(server as never)
        .put(`${PREFIX}/articles/${articleId}/content`)
        .set('Cookie', cookieHeader(student))
        .set('X-CSRF-Token', student.csrf)
        .send({ content: { type: 'doc' } })
        .expect(404);
    });

    it('o orientador do evento lista todas as equipes; aluno vê só a sua', async () => {
      const fixture = await teamScenario();
      const advisor = await authenticate(fixture.professor.email);
      const student = await authenticate(fixture.student.email);
      const outsider = await authenticate(fixture.outsider.email);
      const first = await createTeam(advisor, fixture.eventId, 'Equipe 1');
      await createTeam(advisor, fixture.eventId, 'Equipe 2');

      await request(server as never)
        .post(`${PREFIX}/teams/${first}/membership`)
        .set('Cookie', cookieHeader(student))
        .set('X-CSRF-Token', student.csrf)
        .expect(201);

      expect(await listArticles(advisor, `eventId=${fixture.eventId}`)).toHaveLength(2);
      const own = await listArticles(student, `eventId=${fixture.eventId}`);
      expect(own.map((item) => item.teamId)).toEqual([first]);

      // Professor sem vínculo com o evento: nem lista, nem consulta.
      expect(await listArticles(outsider, `eventId=${fixture.eventId}`)).toHaveLength(0);
      const articleId = own[0]?.id ?? '';
      const hidden = await request(server as never)
        .get(`${PREFIX}/articles/${articleId}`)
        .set('Cookie', cookieHeader(outsider))
        .expect(404);
      expect(bodyOf(hidden).status.code).toBe('RESOURCE_NOT_FOUND');

      const invalid = await request(server as never)
        .get(`${PREFIX}/articles?status=DRAFT`)
        .set('Cookie', cookieHeader(advisor))
        .expect(400);
      expect(bodyOf(invalid).status.code).toBe('VALIDATION_FAILED');
    });
  });
});
