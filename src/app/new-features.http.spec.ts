import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { AccessModule } from '@modules/access/access.module';
import { ArticleFacade } from '@modules/article/contracts/article.facade';
import { CourseFacade } from '@modules/course/contracts/course.facade';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';
import { NotificationFacade } from '@modules/notification/contracts/notification.facade';

import { AppModule } from './app.module';
import { configureApi } from './bootstrap/http';

const PREFIX = '/api/v1';
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'vince_session';
const CSRF_COOKIE = process.env.CSRF_COOKIE_NAME ?? 'vince_csrf';
const PASSWORD = 'senha-de-teste-conforme';

interface ApiBody {
  readonly data: unknown;
  readonly status: { readonly code: string; readonly severity: string };
  readonly pagination?: {
    readonly page: number;
    readonly pageSize: number;
    readonly hasNext: boolean;
  };
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
  const lines = Array.isArray(raw)
    ? raw.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const line = lines.find((entry) => entry.startsWith(`${name}=`));
  return line?.split(';')[0]?.slice(name.length + 1) ?? '';
}

function cookieHeader(cookies: Cookies): string {
  return `${SESSION_COOKIE}=${cookies.session}; ${CSRF_COOKIE}=${cookies.csrf}`;
}

describe('contrato HTTP — discussão, notificações, assistência e acompanhamento', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let server: unknown;
  let access: AccessFacade;
  let articles: ArticleFacade;
  let courses: CourseFacade;
  let institutions: InstitutionFacade;
  let notifications: NotificationFacade;
  let institutionId: string;
  let sequence = 0;

  const createAccount = async (
    roleCode: string,
  ): Promise<{ readonly id: string; readonly email: string }> => {
    const email = `features-${uuidv7()}@exemplo.test`;
    const created = await access.createUser({
      email,
      name: 'Pessoa de Teste',
      roleCode,
      institutionId,
    });
    if (!created.ok) throw new Error(`não foi possível criar conta: ${created.failure.code}`);

    const issued = await access.requestPasswordReset({ email });
    if (issued === null) throw new Error('não foi emitido token para definir senha');
    const reset = await access.resetPassword({ token: issued.token, password: PASSWORD });
    if (!reset.ok) throw new Error(`não foi possível definir senha: ${reset.failure.code}`);

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

  const createArticle = async (input: {
    readonly actorId: string;
    readonly advisorId: string;
    readonly memberId: string;
    readonly courseId: string;
  }): Promise<string> => {
    const created = await articles.createArticle({
      actorId: input.actorId,
      institutionId,
      courseId: input.courseId,
      eventId: uuidv7(),
      teamId: uuidv7(),
      advisorId: input.advisorId,
      memberIds: [input.memberId],
      currentMilestoneId: uuidv7(),
      currentMilestoneOrder: 1,
    });
    if (!created.ok) throw new Error(`não foi possível criar artigo: ${created.failure.code}`);
    return created.value.id;
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
    articles = app.get(ArticleFacade);
    courses = app.get(CourseFacade);
    institutions = app.get(InstitutionFacade);
    notifications = app.get(NotificationFacade);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await AccessModule.seed(moduleRef);
    sequence += 1;
    const created = await institutions.create({
      name: `Instituição de testes ${sequence}`,
      code: `FEATURE${sequence}${Date.now() % 100000}`,
    });
    if (!created.ok) throw new Error(`não foi possível criar instituição: ${created.failure.code}`);
    institutionId = created.value.id;
  });

  it('publica e lista mensagens; exercita painéis, riscos, contribuições e ciclo de relatório', async () => {
    const admin = await createAccount('INSTITUTION_ADMIN');
    const professor = await createAccount('PROFESSOR');
    const student = await createAccount('STUDENT');
    const createdCourse = await courses.create({
      actorId: admin.id,
      name: `Curso ${sequence}`,
      identification: `CURSO${sequence}`,
    });
    if (!createdCourse.ok)
      throw new Error(`não foi possível criar curso: ${createdCourse.failure.code}`);
    const courseId = createdCourse.value.id;
    const assigned = await courses.assignCoordinator({
      actorId: admin.id,
      courseId,
      userId: professor.id,
    });
    if (!assigned.ok)
      throw new Error(`não foi possível designar coordenador: ${assigned.failure.code}`);

    const articleId = await createArticle({
      actorId: professor.id,
      advisorId: professor.id,
      memberId: student.id,
      courseId,
    });
    const studentCookies = await authenticate(student.email);
    const professorCookies = await authenticate(professor.email);
    const studentCookie = cookieHeader(studentCookies);
    const professorCookie = cookieHeader(professorCookies);

    const published = await request(server as never)
      .post(`${PREFIX}/articles/${articleId}/discussion/messages`)
      .set('Cookie', studentCookie)
      .set('X-CSRF-Token', studentCookies.csrf)
      .send({ body: 'Mensagem inicial da equipe' })
      .expect(201);
    const message = bodyOf(published).data as { readonly id: string; readonly body: string };
    expect(message.body).toBe('Mensagem inicial da equipe');

    const reply = await request(server as never)
      .post(`${PREFIX}/articles/${articleId}/discussion/messages`)
      .set('Cookie', professorCookie)
      .set('X-CSRF-Token', professorCookies.csrf)
      .send({ body: 'Resposta do orientador', replyToId: message.id })
      .expect(201);
    const replyMessage = bodyOf(reply).data as { readonly id: string; readonly rootId: string };
    expect(replyMessage.rootId).toBe(message.id);

    const listed = await request(server as never)
      .get(`${PREFIX}/articles/${articleId}/discussion/messages`)
      .set('Cookie', studentCookie)
      .expect(200);
    expect((bodyOf(listed).data as readonly unknown[]).length).toBe(2);

    await request(server as never)
      .delete(`${PREFIX}/articles/${articleId}/discussion/messages/${replyMessage.id}`)
      .set('Cookie', professorCookie)
      .set('X-CSRF-Token', professorCookies.csrf)
      .expect(200);

    const submission = await articles.submit({ actorId: student.id, articleId });
    if (!submission.ok)
      throw new Error(`não foi possível submeter artigo: ${submission.failure.code}`);
    const remark = await articles.createRemark({
      actorId: professor.id,
      articleId,
      submissionId: submission.value.id,
      anchor: { path: 'introducao', start: 0, end: 5 },
      originalText: 'Texto',
      body: 'Revisar este trecho',
    });
    if (!remark.ok) throw new Error(`não foi possível criar apontamento: ${remark.failure.code}`);
    const returned = await articles.returnArticle({ actorId: professor.id, articleId });
    if (!returned.ok) throw new Error(`não foi possível devolver artigo: ${returned.failure.code}`);

    await request(server as never)
      .post(`${PREFIX}/articles/${articleId}/discussion/messages`)
      .set('Cookie', studentCookie)
      .set('X-CSRF-Token', studentCookies.csrf)
      .send({ body: 'Dúvida sobre o apontamento', remarkId: remark.value.id })
      .expect(201);
    const messagesForRemark = await request(server as never)
      .get(`${PREFIX}/articles/${articleId}/remarks/${remark.value.id}/discussion-messages`)
      .set('Cookie', studentCookie)
      .expect(200);
    expect(bodyOf(messagesForRemark).data).toHaveLength(1);

    const advisorDashboard = await request(server as never)
      .get(`${PREFIX}/progress/advisor`)
      .set('Cookie', professorCookie)
      .expect(200);
    expect((bodyOf(advisorDashboard).data as readonly { articleId: string }[])[0]?.articleId).toBe(
      articleId,
    );

    const courseDashboard = await request(server as never)
      .get(`${PREFIX}/courses/${courseId}/progress`)
      .set('Cookie', professorCookie)
      .expect(200);
    expect(
      (bodyOf(courseDashboard).data as { teams: { items: readonly unknown[] } }).teams.items,
    ).toHaveLength(1);

    const risks = await request(server as never)
      .get(`${PREFIX}/progress/risk-signals`)
      .set('Cookie', professorCookie)
      .expect(200);
    expect(Array.isArray(bodyOf(risks).data)).toBe(true);

    const contribution = await request(server as never)
      .get(`${PREFIX}/articles/${articleId}/contributions`)
      .set('Cookie', professorCookie)
      .expect(200);
    expect(bodyOf(contribution).data).toMatchObject({
      articleId,
      volumeIsNotContributionMeasure: true,
      note: 'SUBSIDY_ONLY_NO_GRADE',
    });

    const periodStart = new Date(Date.now() - 60_000).toISOString();
    const periodEnd = new Date(Date.now() + 60_000).toISOString();
    const generated = await request(server as never)
      .post(`${PREFIX}/courses/${courseId}/reports`)
      .set('Cookie', professorCookie)
      .set('X-CSRF-Token', professorCookies.csrf)
      .send({ periodStart, periodEnd })
      .expect(201);
    const report = bodyOf(generated).data as {
      readonly id: string;
      readonly data: { articles: { total: number } };
    };
    expect(report.data.articles.total).toBe(1);

    const fetched = await request(server as never)
      .get(`${PREFIX}/reports/${report.id}`)
      .set('Cookie', professorCookie)
      .expect(200);
    expect((bodyOf(fetched).data as { readonly id: string }).id).toBe(report.id);

    const exported = await request(server as never)
      .get(`${PREFIX}/reports/${report.id}/export?format=CSV`)
      .set('Cookie', professorCookie)
      .expect(200);
    expect(exported.headers['content-type']).toContain('text/csv');
    expect(exported.text).toContain('campo,valor');
  });

  it('gerencia preferências e leitura de notificações pela API', async () => {
    const professor = await createAccount('PROFESSOR');
    const student = await createAccount('STUDENT');
    const cookies = await authenticate(student.email);
    const cookie = cookieHeader(cookies);

    const preference = await request(server as never)
      .put(`${PREFIX}/notifications/preferences/email`)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', cookies.csrf)
      .send({ type: 'DISCUSSION_MESSAGE', enabled: false })
      .expect(200);
    expect(bodyOf(preference).data).toEqual({ type: 'DISCUSSION_MESSAGE', enabled: false });

    const preferences = await request(server as never)
      .get(`${PREFIX}/notifications/preferences/email`)
      .set('Cookie', cookie)
      .expect(200);
    expect((bodyOf(preferences).data as { items: readonly unknown[] }).items).toContainEqual({
      type: 'DISCUSSION_MESSAGE',
      enabled: false,
    });

    await notifications.create({
      actorId: professor.id,
      recipientIds: [student.id],
      type: 'DISCUSSION_MESSAGE',
      targetType: 'DISCUSSION_MESSAGE',
      targetId: uuidv7(),
      data: { articleId: uuidv7() },
    });
    const listed = await request(server as never)
      .get(`${PREFIX}/notifications?unreadOnly=true`)
      .set('Cookie', cookie)
      .expect(200);
    const items = bodyOf(listed).data as readonly { id: string; readAt: string | null }[];
    expect(items).toHaveLength(1);
    expect(items[0]?.readAt).toBeNull();

    await request(server as never)
      .patch(`${PREFIX}/notifications/${items[0]?.id}/read`)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', cookies.csrf)
      .expect(200);
    const opened = await request(server as never)
      .get(`${PREFIX}/notifications/${items[0]?.id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect((bodyOf(opened).data as { readAt: string | null }).readAt).not.toBeNull();

    await notifications.create({
      actorId: professor.id,
      recipientIds: [student.id],
      type: 'RISK_SIGNAL',
      targetType: 'ARTICLE',
      targetId: uuidv7(),
    });
    const markedAll = await request(server as never)
      .post(`${PREFIX}/notifications/read-all`)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', cookies.csrf)
      .expect(201);
    expect((bodyOf(markedAll).data as { count: number }).count).toBe(1);
  });

  it('executa verificações de assistência, consulta consentimento e idioma do perfil', async () => {
    const admin = await createAccount('INSTITUTION_ADMIN');
    const professor = await createAccount('PROFESSOR');
    const student = await createAccount('STUDENT');
    const createdCourse = await courses.create({
      actorId: admin.id,
      name: `Curso IA ${sequence}`,
      identification: `IA${sequence}`,
    });
    if (!createdCourse.ok)
      throw new Error(`não foi possível criar curso: ${createdCourse.failure.code}`);
    const courseId = createdCourse.value.id;
    const articleId = await createArticle({
      actorId: professor.id,
      advisorId: professor.id,
      memberId: student.id,
      courseId,
    });
    const adminCookies = await authenticate(admin.email);
    const professorCookies = await authenticate(professor.email);
    const studentCookies = await authenticate(student.email);

    const submission = await articles.submit({ actorId: student.id, articleId });
    if (!submission.ok)
      throw new Error(`não foi possível submeter artigo: ${submission.failure.code}`);

    const consent = await request(server as never)
      .get(`${PREFIX}/institutions/${institutionId}/ai-consent`)
      .set('Cookie', cookieHeader(adminCookies))
      .expect(200);
    expect((bodyOf(consent).data as { consented: boolean }).consented).toBe(false);
    const revoked = await request(server as never)
      .put(`${PREFIX}/institutions/${institutionId}/ai-consent`)
      .set('Cookie', cookieHeader(adminCookies))
      .set('X-CSRF-Token', adminCookies.csrf)
      .send({ consented: false })
      .expect(200);
    expect((bodyOf(revoked).data as { consented: boolean }).consented).toBe(false);

    const compliance = await request(server as never)
      .post(`${PREFIX}/articles/${articleId}/compliance-checks`)
      .set('Cookie', cookieHeader(studentCookies))
      .set('X-CSRF-Token', studentCookies.csrf)
      .expect(201);
    const complianceId = (bodyOf(compliance).data as { analysisId: string }).analysisId;
    const complianceHistory = await request(server as never)
      .get(`${PREFIX}/articles/${articleId}/compliance-checks`)
      .set('Cookie', cookieHeader(studentCookies))
      .expect(200);
    expect(
      (bodyOf(complianceHistory).data as { items: readonly { id: string }[] }).items[0]?.id,
    ).toBe(complianceId);

    const similarity = await request(server as never)
      .post(`${PREFIX}/articles/${articleId}/similarity-checks`)
      .set('Cookie', cookieHeader(studentCookies))
      .set('X-CSRF-Token', studentCookies.csrf)
      .expect(201);
    const similarityId = (bodyOf(similarity).data as { analysisId: string }).analysisId;
    const similarityHistory = await request(server as never)
      .get(`${PREFIX}/articles/${articleId}/similarity-checks`)
      .set('Cookie', cookieHeader(studentCookies))
      .expect(200);
    expect(
      (bodyOf(similarityHistory).data as { items: readonly { id: string }[] }).items[0]?.id,
    ).toBe(similarityId);

    const authorship = await request(server as never)
      .get(`${PREFIX}/articles/${articleId}/authorship-signals`)
      .set('Cookie', cookieHeader(professorCookies))
      .expect(200);
    expect((bodyOf(authorship).data as { articleId: string }).articleId).toBe(articleId);

    const summaryNotReady = await request(server as never)
      .post(`${PREFIX}/articles/${articleId}/assistance/summary`)
      .set('Cookie', cookieHeader(professorCookies))
      .set('X-CSRF-Token', professorCookies.csrf)
      .expect(422);
    expect(bodyOf(summaryNotReady).status.code).toBe('AI_CONSENT_REQUIRED');

    const profile = await request(server as never)
      .patch(`${PREFIX}/profile`)
      .set('Cookie', cookieHeader(studentCookies))
      .set('X-CSRF-Token', studentCookies.csrf)
      .send({ preferredLanguage: 'pt-BR' })
      .expect(200);
    expect((bodyOf(profile).data as { preferredLanguage: string }).preferredLanguage).toBe('pt-BR');
  });
});
