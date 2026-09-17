import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { AccessModule } from '@modules/access/access.module';
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
  readonly pagination?: {
    readonly page: number;
    readonly pageSize: number;
    readonly hasNext: boolean;
  };
  readonly errors?: readonly { readonly field: string; readonly code: string }[];
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

describe('contrato HTTP da vertical course', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let server: unknown;
  let access: AccessFacade;
  let courses: CourseFacade;
  let institutions: InstitutionFacade;
  let sequence = 0;

  const nextEmail = (): string => `course-${uuidv7()}@exemplo.test`;

  const createAccount = async (
    institutionId: string,
    roleCode: string,
  ): Promise<{ readonly id: string; readonly email: string }> => {
    const email = nextEmail();
    const created = await access.createUser({
      email,
      name: 'Pessoa de Curso',
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

  const institution = async (): Promise<string> => {
    sequence += 1;
    const created = await institutions.create({
      name: `Instituição Course ${sequence}`,
      code: `COURSE${sequence}${Date.now() % 10000}`,
    });

    if (!created.ok) {
      throw new Error(created.failure.code);
    }

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
    courses = app.get(CourseFacade);
    institutions = app.get(InstitutionFacade);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await AccessModule.seed(moduleRef);
  });

  it('cria curso com envelope e Location, lista paginado e consulta o inativo', async () => {
    const institutionId = await institution();
    const admin = await createAccount(institutionId, 'INSTITUTION_ADMIN');
    const cookies = await authenticate(admin.email);
    const create = await request(server as never)
      .post(`${PREFIX}/courses`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ name: 'Administração', identification: 'adm' })
      .expect(201);
    const created = bodyOf(create).data as { readonly id: string; readonly active: boolean };

    expect(bodyOf(create).status).toEqual({ code: 'SUCCESS', severity: 'success' });
    expect(created.active).toBe(true);
    expect(create.headers.location).toBe(`/courses/${created.id}`);

    const listed = await request(server as never)
      .get(`${PREFIX}/courses?pageSize=1`)
      .set('Cookie', cookieHeader(cookies))
      .expect(200);

    expect(bodyOf(listed).pagination).toEqual({ page: 1, pageSize: 1, hasNext: false });

    await request(server as never)
      .post(`${PREFIX}/courses/${created.id}/deactivation`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .expect(201);
    const found = await request(server as never)
      .get(`${PREFIX}/courses/${created.id}`)
      .set('Cookie', cookieHeader(cookies))
      .expect(200);

    expect((bodyOf(found).data as { readonly active: boolean }).active).toBe(false);
  });

  it('recusa ator sem permissão e curso de outra instituição', async () => {
    const first = await institution();
    const second = await institution();
    const firstAdmin = await createAccount(first, 'INSTITUTION_ADMIN');
    const secondAdmin = await createAccount(second, 'INSTITUTION_ADMIN');
    const firstCookies = await authenticate(firstAdmin.email);
    const secondCookies = await authenticate(secondAdmin.email);
    const created = await request(server as never)
      .post(`${PREFIX}/courses`)
      .set('Cookie', cookieHeader(firstCookies))
      .set('X-CSRF-Token', firstCookies.csrf)
      .send({ name: 'Curso Um', identification: 'UM' })
      .expect(201);
    const courseId = (bodyOf(created).data as { readonly id: string }).id;

    const other = await request(server as never)
      .get(`${PREFIX}/courses/${courseId}`)
      .set('Cookie', cookieHeader(secondCookies))
      .expect(403);

    expect(bodyOf(other).status.code).toBe('PERMISSION_DENIED');

    const professor = await createAccount(first, 'PROFESSOR');
    const professorCookies = await authenticate(professor.email);
    const denied = await request(server as never)
      .post(`${PREFIX}/courses`)
      .set('Cookie', cookieHeader(professorCookies))
      .set('X-CSRF-Token', professorCookies.csrf)
      .send({ name: 'Não autorizado', identification: 'NAO' })
      .expect(403);

    expect(bodyOf(denied).status.code).toBe('PERMISSION_DENIED');
  });

  it('designa e revoga coordenador, com máximo de um vínculo', async () => {
    const institutionId = await institution();
    const admin = await createAccount(institutionId, 'INSTITUTION_ADMIN');
    const coordinator = await createAccount(institutionId, 'PROFESSOR');
    const other = await createAccount(institutionId, 'PROFESSOR');
    const cookies = await authenticate(admin.email);
    const created = await request(server as never)
      .post(`${PREFIX}/courses`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ name: 'Curso de Coordenação', identification: 'COORD' })
      .expect(201);
    const courseId = (bodyOf(created).data as { readonly id: string }).id;

    await request(server as never)
      .post(`${PREFIX}/courses/${courseId}/coordinator`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ userId: coordinator.id })
      .expect(204);
    const conflict = await request(server as never)
      .post(`${PREFIX}/courses/${courseId}/coordinator`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ userId: other.id })
      .expect(409);

    expect(bodyOf(conflict).status.code).toBe('COORDINATOR_ALREADY_ASSIGNED');

    await request(server as never)
      .delete(`${PREFIX}/courses/${courseId}/coordinator/${coordinator.id}`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .expect(204);
    const after = await request(server as never)
      .get(`${PREFIX}/courses/${courseId}`)
      .set('Cookie', cookieHeader(cookies))
      .expect(200);

    expect(
      (bodyOf(after).data as { readonly coordinatorId: string | null }).coordinatorId,
    ).toBeNull();
    expect(await courses.coordinatorOf(courseId)).toBeNull();
  });

  it('retorna VALIDATION_FAILED para campos obrigatórios ausentes', async () => {
    const institutionId = await institution();
    const admin = await createAccount(institutionId, 'INSTITUTION_ADMIN');
    const cookies = await authenticate(admin.email);
    const response = await request(server as never)
      .post(`${PREFIX}/courses`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ name: '   ', identification: 'NAO' })
      .expect(400);

    expect(bodyOf(response).status.code).toBe('VALIDATION_FAILED');
    expect(bodyOf(response).errors).toEqual([{ field: 'name', code: 'REQUIRED' }]);
  });

  it('publica as sete rotas de curso no contrato OpenAPI', async () => {
    const response = await request(server as never)
      .get(`${PREFIX.replace('/v1', '')}/openapi.json`)
      .expect(200);
    const document = response.body as { readonly paths?: unknown };
    const paths = (document.paths ?? {}) as Record<string, unknown>;

    expect(Object.keys(paths)).toEqual(
      expect.arrayContaining([
        '/api/v1/courses',
        '/api/v1/courses/{courseId}',
        '/api/v1/courses/{courseId}/deactivation',
        '/api/v1/courses/{courseId}/coordinator',
        '/api/v1/courses/{courseId}/coordinator/{userId}',
      ]),
    );
  });
});
