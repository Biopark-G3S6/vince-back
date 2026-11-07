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
import { ArticleFacade } from '@modules/article/contracts/article.facade';
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

describe('contrato HTTP da vertical article', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let server: unknown;
  let access: AccessFacade;
  let institutions: InstitutionFacade;
  let courses: CourseFacade;
  let cohorts: CohortFacade;
  let events: EventFacade;
  let articles: ArticleFacade;
  let sequence = 0;

  const setPassword = async (email: string): Promise<void> => {
    const issued = await access.requestPasswordReset({ email });
    if (issued === null) throw new Error('redefinição não emitida');

    const reset = await access.resetPassword({ token: issued.token, password: PASSWORD });
    if (!reset.ok) throw new Error(reset.failure.code);
  };

  const createAccount = async (institutionId: string, roleCode: string) => {
    const email = `article-${uuidv7()}@exemplo.test`;
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
      name: `Instituição Article ${sequence}`,
      code: `ART${sequence}${Date.now() % 100000}`,
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
      name: `Curso Article ${sequence}`,
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

  /**
   * A jornada completa até o artigo: evento, equipe, integrantes e responsável.
   *
   * A equipe é criada **por HTTP**, de propósito: é a transação dela que publica o fato,
   * e é o consumo desse fato que faz o artigo existir. Criar a equipe por fachada
   * testaria o mesmo caminho, mas esconderia que a rota o percorre.
   */
  const articleScenario = async () => {
    const fixture = await teamScenario();
    const advisor = await authenticate(fixture.professor.email);
    const owner = await authenticate(fixture.coordinator.email);
    const created = await request(server as never)
      .post(`${PREFIX}/events/${fixture.eventId}/teams`)
      .set('Cookie', cookieHeader(advisor))
      .set('X-CSRF-Token', advisor.csrf)
      .send({ identification: 'Equipe A' })
      .expect(201);
    const teamId = (bodyOf(created).data as { readonly id: string }).id;

    for (const userId of [fixture.student.id, fixture.mate.id]) {
      await request(server as never)
        .post(`${PREFIX}/teams/${teamId}/members/${userId}`)
        .set('Cookie', cookieHeader(advisor))
        .set('X-CSRF-Token', advisor.csrf)
        .expect(201);
    }

    await request(server as never)
      .post(`${PREFIX}/teams/${teamId}/advisor/${fixture.professor.id}`)
      .set('Cookie', cookieHeader(owner))
      .set('X-CSRF-Token', owner.csrf)
      .expect(204);

    const situation = await request(server as never)
      .get(`${PREFIX}/teams/${teamId}/article`)
      .set('Cookie', cookieHeader(advisor))
      .expect(200);
    const article = (bodyOf(situation).data as { readonly article: { readonly id: string } })
      .article;

    return { ...fixture, teamId, articleId: article.id, advisor, owner };
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
    articles = app.get(ArticleFacade);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await AccessModule.seed(moduleRef);
  });

  it('a equipe criada produz o artigo STARTED, consultável pela equipe e por identificador', async () => {
    const fixture = await articleScenario();
    const student = await authenticate(fixture.student.email);

    const byTeam = await request(server as never)
      .get(`${PREFIX}/teams/${fixture.teamId}/article`)
      .set('Cookie', cookieHeader(student))
      .expect(200);
    const situation = bodyOf(byTeam).data as {
      readonly article: { readonly id: string; readonly status: string; readonly teamId: string };
      readonly currentMilestone: unknown;
      readonly grade: unknown;
    };

    expect(situation.article).toMatchObject({
      id: fixture.articleId,
      teamId: fixture.teamId,
      status: 'STARTED',
    });
    expect(situation.grade).toBeNull();
    expect(situation.currentMilestone).toBeNull();

    const byId = await request(server as never)
      .get(`${PREFIX}/articles/${fixture.articleId}`)
      .set('Cookie', cookieHeader(student))
      .expect(200);
    expect((bodyOf(byId).data as { readonly article: { readonly id: string } }).article.id).toBe(
      fixture.articleId,
    );

    // A etapa corrente vem do cronograma do evento, e não de cópia local.
    await request(server as never)
      .post(`${PREFIX}/events/${fixture.eventId}/milestones`)
      .set('Cookie', cookieHeader(fixture.owner))
      .set('X-CSRF-Token', fixture.owner.csrf)
      .send({ name: 'Primeira entrega', order: 1, dueAt: '2030-03-01T00:00:00.000Z' })
      .expect(201);

    const withMilestone = await request(server as never)
      .get(`${PREFIX}/articles/${fixture.articleId}`)
      .set('Cookie', cookieHeader(student))
      .expect(200);
    expect(
      (bodyOf(withMilestone).data as { readonly currentMilestone: { readonly name: string } })
        .currentMilestone.name,
    ).toBe('Primeira entrega');
  });

  it('o artigo fora do vínculo é indistinguível de inexistente', async () => {
    const fixture = await articleScenario();
    const outsider = await authenticate(fixture.outsider.email);
    const unenrolled = await authenticate(fixture.unenrolled.email);

    for (const cookies of [outsider, unenrolled]) {
      const hidden = await request(server as never)
        .get(`${PREFIX}/articles/${fixture.articleId}`)
        .set('Cookie', cookieHeader(cookies))
        .expect(404);
      expect(bodyOf(hidden).status.code).toBe('RESOURCE_NOT_FOUND');
    }

    // O coordenador do curso do evento alcança o artigo (RF-ART-001 RN3).
    await request(server as never)
      .get(`${PREFIX}/articles/${fixture.articleId}`)
      .set('Cookie', cookieHeader(fixture.owner))
      .expect(200);

    const absent = await request(server as never)
      .get(`${PREFIX}/articles/${uuidv7()}`)
      .set('Cookie', cookieHeader(fixture.advisor))
      .expect(404);
    expect(bodyOf(absent).status.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('só o orientador responsável avalia, e a alteração preserva o histórico', async () => {
    const fixture = await articleScenario();
    const student = await authenticate(fixture.student.email);

    const grade = (cookies: Cookies, value: number, status: number) =>
      request(server as never)
        .put(`${PREFIX}/articles/${fixture.articleId}/grade`)
        .set('Cookie', cookieHeader(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .send({ value })
        .expect(status);

    // A aluna não tem `ARTICLE:GRADE`: a borda recusa antes do caso de uso.
    expect(bodyOf(await grade(student, 8, 403)).status.code).toBe('PERMISSION_DENIED');

    const outOfRange = await grade(fixture.advisor, 11, 400);
    expect(bodyOf(outOfRange).status.code).toBe('VALIDATION_FAILED');

    expect(bodyOf(await grade(fixture.advisor, 6, 200)).data).toMatchObject({
      value: 6,
      authorId: fixture.professor.id,
    });
    expect(bodyOf(await grade(fixture.advisor, 9.25, 200)).data).toMatchObject({ value: 9.25 });

    const situation = await request(server as never)
      .get(`${PREFIX}/articles/${fixture.articleId}`)
      .set('Cookie', cookieHeader(student))
      .expect(200);
    expect(
      (bodyOf(situation).data as { readonly grade: { readonly value: number } }).grade.value,
    ).toBe(9.25);

    // O registro anterior permanece no histórico, com autor e instante.
    const history = await articles.listGradeHistory({
      actorId: fixture.professor.id,
      articleId: fixture.articleId,
      request: { page: 1, pageSize: 20, withTotal: true },
    });
    if (!history.ok) throw new Error(history.failure.code);
    expect(history.value.items.map((entry) => entry.value)).toEqual([9.25, 6]);
  });

  it('o orientador do evento sem responsabilidade direta lê e não avalia', async () => {
    const fixture = await articleScenario();

    // Um segundo orientador, designado ao evento e não à equipe.
    const second = await createAccount(fixture.institutionId, 'PROFESSOR');
    const enrolled = await cohorts.assignProfessor({
      actorId: fixture.coordinator.id,
      cohortId: fixture.cohortId,
      userId: second.id,
    });
    if (!enrolled.ok) throw new Error(enrolled.failure.code);

    const designated = await events.assignAdvisor({
      actorId: fixture.coordinator.id,
      eventId: fixture.eventId,
      userId: second.id,
    });
    if (!designated.ok) throw new Error(designated.failure.code);

    const cookies = await authenticate(second.email);

    await request(server as never)
      .get(`${PREFIX}/articles/${fixture.articleId}`)
      .set('Cookie', cookieHeader(cookies))
      .expect(200);

    const denied = await request(server as never)
      .put(`${PREFIX}/articles/${fixture.articleId}/grade`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ value: 8 })
      .expect(403);
    expect(bodyOf(denied).status.code).toBe('PERMISSION_DENIED');
  });

  it('as notas individuais são independentes e sobrevivem à remoção do integrante', async () => {
    const fixture = await articleScenario();

    const gradeMember = (userId: string, value: number, status: number) =>
      request(server as never)
        .put(`${PREFIX}/articles/${fixture.articleId}/member-grades/${userId}`)
        .set('Cookie', cookieHeader(fixture.advisor))
        .set('X-CSRF-Token', fixture.advisor.csrf)
        .send({ value })
        .expect(status);

    await gradeMember(fixture.student.id, 7, 200);
    await gradeMember(fixture.mate.id, 9.5, 200);

    const outsider = await gradeMember(fixture.unenrolled.id, 7, 404);
    expect(bodyOf(outsider).status.code).toBe('RESOURCE_NOT_FOUND');

    const listed = await request(server as never)
      .get(`${PREFIX}/articles/${fixture.articleId}/member-grades`)
      .set('Cookie', cookieHeader(fixture.advisor))
      .expect(200);
    const grades = bodyOf(listed).data as readonly {
      readonly userId: string;
      readonly value: number;
      readonly memberActive: boolean;
    }[];

    expect(grades.find((grade) => grade.userId === fixture.student.id)).toMatchObject({
      value: 7,
      memberActive: true,
    });
    expect(grades.find((grade) => grade.userId === fixture.mate.id)?.value).toBe(9.5);

    // A integrante é removida depois de avaliada (RF-ART-003 E3).
    await request(server as never)
      .delete(`${PREFIX}/teams/${fixture.teamId}/members/${fixture.student.id}`)
      .set('Cookie', cookieHeader(fixture.advisor))
      .set('X-CSRF-Token', fixture.advisor.csrf)
      .expect(204);

    const after = await request(server as never)
      .get(`${PREFIX}/articles/${fixture.articleId}/member-grades`)
      .set('Cookie', cookieHeader(fixture.advisor))
      .expect(200);
    expect(
      (bodyOf(after).data as readonly { readonly userId: string; readonly value: number }[]).find(
        (grade) => grade.userId === fixture.student.id,
      )?.value,
    ).toBe(7);

    // E ela continua enxergando o próprio artigo e a própria nota.
    const removed = await authenticate(fixture.student.email);
    await request(server as never)
      .get(`${PREFIX}/articles/${fixture.articleId}`)
      .set('Cookie', cookieHeader(removed))
      .expect(200);
  });

  it('registra, altera e remove publicação externa, recusando endereço inválido', async () => {
    const fixture = await articleScenario();
    const student = await authenticate(fixture.student.email);
    const body = {
      venue: 'Congresso Brasileiro de Computação',
      kind: 'EVENT',
      publishedAt: '2026-09-01T00:00:00.000Z',
      url: 'https://exemplo.test/artigo',
    };

    const invalid = await request(server as never)
      .post(`${PREFIX}/articles/${fixture.articleId}/publications`)
      .set('Cookie', cookieHeader(student))
      .set('X-CSRF-Token', student.csrf)
      .send({ ...body, url: 'nao-e-url' })
      .expect(400);
    expect(bodyOf(invalid).status.code).toBe('VALIDATION_FAILED');

    const created = await request(server as never)
      .post(`${PREFIX}/articles/${fixture.articleId}/publications`)
      .set('Cookie', cookieHeader(student))
      .set('X-CSRF-Token', student.csrf)
      .send(body)
      .expect(201);
    const publication = bodyOf(created).data as { readonly id: string };

    expect(created.headers.location).toBe(
      `/articles/${fixture.articleId}/publications/${publication.id}`,
    );

    const listed = await request(server as never)
      .get(`${PREFIX}/articles/${fixture.articleId}/publications?withTotal=true`)
      .set('Cookie', cookieHeader(fixture.owner))
      .expect(200);
    expect(bodyOf(listed).data).toHaveLength(1);

    const updated = await request(server as never)
      .patch(`${PREFIX}/articles/${fixture.articleId}/publications/${publication.id}`)
      .set('Cookie', cookieHeader(fixture.advisor))
      .set('X-CSRF-Token', fixture.advisor.csrf)
      .send({ kind: 'JOURNAL', venue: 'Revista Brasileira de Computação' })
      .expect(200);
    expect(bodyOf(updated).data).toMatchObject({
      kind: 'JOURNAL',
      venue: 'Revista Brasileira de Computação',
    });

    // Fora do vínculo, a publicação do artigo é inalcançável.
    const unenrolled = await authenticate(fixture.unenrolled.email);
    const hidden = await request(server as never)
      .get(`${PREFIX}/articles/${fixture.articleId}/publications`)
      .set('Cookie', cookieHeader(unenrolled))
      .expect(404);
    expect(bodyOf(hidden).status.code).toBe('RESOURCE_NOT_FOUND');

    await request(server as never)
      .delete(`${PREFIX}/articles/${fixture.articleId}/publications/${publication.id}`)
      .set('Cookie', cookieHeader(fixture.advisor))
      .set('X-CSRF-Token', fixture.advisor.csrf)
      .expect(204);

    const gone = await request(server as never)
      .delete(`${PREFIX}/articles/${fixture.articleId}/publications/${publication.id}`)
      .set('Cookie', cookieHeader(fixture.advisor))
      .set('X-CSRF-Token', fixture.advisor.csrf)
      .expect(404);
    expect(bodyOf(gone).status.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('o reprocessamento do fato de criação não duplica o artigo', async () => {
    const fixture = await articleScenario();

    // A reentrega do fato é o caminho normal de uma retentativa (ADR-0012, ADR-0021).
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await articles.handleTeamCreated({
        factId: uuidv7(),
        teamId: fixture.teamId,
        eventId: fixture.eventId,
        institutionId: fixture.institutionId,
        occurredAt: new Date(),
      });
    }

    const situation = await request(server as never)
      .get(`${PREFIX}/teams/${fixture.teamId}/article`)
      .set('Cookie', cookieHeader(fixture.advisor))
      .expect(200);
    expect(
      (bodyOf(situation).data as { readonly article: { readonly id: string } }).article.id,
    ).toBe(fixture.articleId);
  });
});
