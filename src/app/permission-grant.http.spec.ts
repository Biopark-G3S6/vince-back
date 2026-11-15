import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AccessModule } from '@modules/access/access.module';
import { AccessFacade } from '@modules/access/contracts/access.facade';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';

import { AppModule } from './app.module';
import { configureApi } from './bootstrap/http';

const PREFIX = '/api/v1';
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'vince_session';
const CSRF_COOKIE = process.env.CSRF_COOKIE_NAME ?? 'vince_csrf';
const PASSWORD = 'senha-de-teste-conforme';

interface ApiBody {
  readonly data: unknown;
  readonly status: { readonly code: string };
}

interface Cookies {
  readonly session: string;
  readonly csrf: string;
}

interface Grant {
  readonly id: string;
  readonly beneficiaryId: string;
  readonly granterId: string;
  readonly permission: string;
  readonly validUntil: string | null;
}

function bodyOf(response: request.Response): ApiBody {
  return response.body as ApiBody;
}

function cookieValue(response: request.Response, name: string): string {
  const raw: unknown = response.headers['set-cookie'];
  const cookies = Array.isArray(raw)
    ? raw.filter((entry): entry is string => typeof entry === 'string')
    : [];

  return (
    cookies
      .find((entry) => entry.startsWith(`${name}=`))
      ?.split(';')[0]
      ?.slice(name.length + 1) ?? ''
  );
}

function cookieHeader(cookies: Cookies): string {
  return `${SESSION_COOKIE}=${cookies.session}; ${CSRF_COOKIE}=${cookies.csrf}`;
}

describe('contrato HTTP das concessões de permissão (permission-delegation)', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let server: unknown;
  let access: AccessFacade;
  let institutions: InstitutionFacade;
  let prisma: PrismaClient;
  let sequence = 0;

  const createAccount = async (institutionId: string, roleCode: string) => {
    const email = `grant-${uuidv7()}@exemplo.test`;
    const created = await access.createUser({
      email,
      name: `Pessoa ${roleCode}`,
      roleCode,
      institutionId,
    });
    if (!created.ok) throw new Error(created.failure.code);
    const issued = await access.requestPasswordReset({ email });
    if (issued === null) throw new Error('redefinição não emitida');
    const reset = await access.resetPassword({ token: issued.token, password: PASSWORD });
    if (!reset.ok) throw new Error(reset.failure.code);

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

  const scenario = async () => {
    sequence += 1;
    const institution = await institutions.create({
      name: `Instituição Concessão ${sequence}`,
      code: `GRT${sequence}${Date.now() % 100000}`,
    });
    if (!institution.ok) throw new Error(institution.failure.code);
    const institutionId = institution.value.id;

    return {
      institutionId,
      granter: await createAccount(institutionId, 'PROFESSOR'),
      beneficiary: await createAccount(institutionId, 'STUDENT'),
      revoker: await createAccount(institutionId, 'PROFESSOR'),
    };
  };

  const identityPermissions = async (cookies: Cookies): Promise<readonly string[]> =>
    (
      bodyOf(
        await request(server as never)
          .get(`${PREFIX}/identity`)
          .set('Cookie', cookieHeader(cookies))
          .expect(200),
      ).data as { readonly permissions: readonly string[] }
    ).permissions;

  const grant = (cookies: Cookies, body: Record<string, unknown>, status: number) =>
    request(server as never)
      .post(`${PREFIX}/permission-grants`)
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send(body)
      .expect(status);

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
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    await AccessModule.seed(moduleRef);
  });

  it('concede permissão possuída, lista e revoga com efeito imediato', async () => {
    const fixture = await scenario();
    const granter = await authenticate(fixture.granter.email);
    const beneficiary = await authenticate(fixture.beneficiary.email);
    const revoker = await authenticate(fixture.revoker.email);

    expect(await identityPermissions(beneficiary)).not.toContain('ARTICLE:GRADE');

    const created = await grant(
      granter,
      { beneficiaryId: fixture.beneficiary.id, permission: 'ARTICLE:GRADE' },
      201,
    );
    const granted = bodyOf(created).data as Grant;
    expect(granted).toMatchObject({
      beneficiaryId: fixture.beneficiary.id,
      granterId: fixture.granter.id,
      permission: 'ARTICLE:GRADE',
      validUntil: null,
    });
    expect(created.headers.location).toBe(`/permission-grants/${granted.id}`);

    // A apuração seguinte do beneficiário já contém a permissão (RF-ACS-006).
    expect(await identityPermissions(beneficiary)).toContain('ARTICLE:GRADE');

    const listed = await request(server as never)
      .get(`${PREFIX}/permission-grants?beneficiaryId=${fixture.beneficiary.id}`)
      .set('Cookie', cookieHeader(revoker))
      .expect(200);
    expect((bodyOf(listed).data as Grant[]).map((item) => item.id)).toEqual([granted.id]);

    // Quem revoga não precisa ser quem concedeu (RF-ACS-007 RN1).
    await request(server as never)
      .delete(`${PREFIX}/permission-grants/${granted.id}`)
      .set('Cookie', cookieHeader(revoker))
      .set('X-CSRF-Token', revoker.csrf)
      .expect(204);
    expect(await identityPermissions(beneficiary)).not.toContain('ARTICLE:GRADE');

    const again = await request(server as never)
      .delete(`${PREFIX}/permission-grants/${granted.id}`)
      .set('Cookie', cookieHeader(revoker))
      .set('X-CSRF-Token', revoker.csrf)
      .expect(404);
    expect(bodyOf(again).status.code).toBe('RESOURCE_NOT_FOUND');

    // A linha permanece como trilha, com o autor da revogação (ADR-0014 §18).
    const row = await prisma.permissionGrant.findUniqueOrThrow({ where: { id: granted.id } });
    expect(row.revokedBy).toBe(fixture.revoker.id);
    expect(row.revokedAt).not.toBeNull();
  });

  it('recusa permissão não possuída, a si mesmo, beneficiário de fora e prazo vencido', async () => {
    const fixture = await scenario();
    const other = await scenario();
    const granter = await authenticate(fixture.granter.email);

    const notHeld = await grant(
      granter,
      { beneficiaryId: fixture.beneficiary.id, permission: 'INSTITUTION:CREATE' },
      422,
    );
    expect(bodyOf(notHeld).status.code).toBe('GRANT_NOT_HELD_BY_GRANTER');

    const self = await grant(
      granter,
      { beneficiaryId: fixture.granter.id, permission: 'ARTICLE:GRADE' },
      422,
    );
    expect(bodyOf(self).status.code).toBe('SELF_GRANT_NOT_ALLOWED');

    const outsider = await grant(
      granter,
      { beneficiaryId: other.beneficiary.id, permission: 'ARTICLE:GRADE' },
      404,
    );
    expect(bodyOf(outsider).status.code).toBe('RESOURCE_NOT_FOUND');

    const past = await grant(
      granter,
      {
        beneficiaryId: fixture.beneficiary.id,
        permission: 'ARTICLE:GRADE',
        validUntil: new Date(Date.now() - 60_000).toISOString(),
      },
      400,
    );
    expect(bodyOf(past).status.code).toBe('VALIDATION_FAILED');

    // O aluno não tem `PERMISSION_GRANT:CREATE`: a borda recusa antes do caso de uso.
    const student = await authenticate(fixture.beneficiary.email);
    await grant(student, { beneficiaryId: fixture.granter.id, permission: 'ARTICLE:READ' }, 403);
  });

  it('concessão expirada some da lista e das permissões efetivas', async () => {
    const fixture = await scenario();
    const granter = await authenticate(fixture.granter.email);
    const beneficiary = await authenticate(fixture.beneficiary.email);

    const created = bodyOf(
      await grant(
        granter,
        {
          beneficiaryId: fixture.beneficiary.id,
          permission: 'ARTICLE:GRADE',
          validUntil: new Date(Date.now() + 1_500).toISOString(),
        },
        201,
      ),
    ).data as Grant;
    expect(await identityPermissions(beneficiary)).toContain('ARTICLE:GRADE');

    await new Promise((resolve) => setTimeout(resolve, 2_200));

    // Nenhuma escrita invalidou o cache: é o teto de validade da entrada que a faz vencer.
    expect(await identityPermissions(beneficiary)).not.toContain('ARTICLE:GRADE');
    const listed = await request(server as never)
      .get(`${PREFIX}/permission-grants?beneficiaryId=${fixture.beneficiary.id}`)
      .set('Cookie', cookieHeader(granter))
      .expect(200);
    expect((bodyOf(listed).data as Grant[]).map((item) => item.id)).not.toContain(created.id);
  });
});

describe('contrato HTTP do diretório de usuários (user-directory)', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let server: unknown;
  let access: AccessFacade;
  let institutions: InstitutionFacade;
  let sequence = 0;

  interface Person {
    readonly id: string;
    readonly name: string;
    readonly email?: string;
    readonly roleCodes?: readonly string[];
  }

  const createAccount = async (institutionId: string | null, roleCode: string, name: string) => {
    const email = `dir-${uuidv7()}@exemplo.test`;
    const created = await access.createUser({ email, name, roleCode, institutionId });
    if (!created.ok) throw new Error(created.failure.code);
    const issued = await access.requestPasswordReset({ email });
    if (issued === null) throw new Error('redefinição não emitida');
    const reset = await access.resetPassword({ token: issued.token, password: PASSWORD });
    if (!reset.ok) throw new Error(reset.failure.code);

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

  const institution = async () => {
    sequence += 1;
    const created = await institutions.create({
      name: `Instituição Diretório ${sequence}`,
      code: `DIR${sequence}${Date.now() % 100000}`,
    });
    if (!created.ok) throw new Error(created.failure.code);

    return created.value.id;
  };

  const directory = (cookies: Cookies, query: string, status = 200) =>
    request(server as never)
      .get(`${PREFIX}/users?${query}`)
      .set('Cookie', cookieHeader(cookies))
      .expect(status);

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
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await AccessModule.seed(moduleRef);
  });

  it('o professor busca por nome e papel, só na própria instituição', async () => {
    const own = await institution();
    const other = await institution();
    const searcher = await createAccount(own, 'PROFESSOR', 'Professora Busca');
    const target = await createAccount(own, 'PROFESSOR', 'Ricardo Almeida');
    await createAccount(own, 'STUDENT', 'Ricardo Aluno');
    await createAccount(other, 'PROFESSOR', 'Ricardo de Fora');

    const cookies = await authenticate(searcher.email);
    const found = bodyOf(await directory(cookies, 'search=ricardo&role=PROFESSOR'))
      .data as Person[];

    expect(found).toEqual([
      {
        id: target.id,
        name: 'Ricardo Almeida',
        email: target.email,
        active: true,
        roleCodes: ['PROFESSOR'],
      },
    ]);
  });

  it('o aluno só resolve nomes, sem e-mail, e não busca', async () => {
    const own = await institution();
    const other = await institution();
    const student = await createAccount(own, 'STUDENT', 'Aluna Que Consulta');
    const mate = await createAccount(own, 'STUDENT', 'Colega de Equipe');
    const outsider = await createAccount(other, 'STUDENT', 'Aluno de Fora');
    const cookies = await authenticate(student.email);

    const denied = await directory(cookies, 'search=colega', 403);
    expect(bodyOf(denied).status.code).toBe('PERMISSION_DENIED');

    const names = bodyOf(await directory(cookies, `ids=${mate.id},${outsider.id}`))
      .data as Person[];
    expect(names).toEqual([{ id: mate.id, name: 'Colega de Equipe' }]);

    const invalid = await directory(cookies, 'ids=nao-e-uuid', 400);
    expect(bodyOf(invalid).status.code).toBe('VALIDATION_FAILED');
  });

  it('o administrador de sistema busca na instituição que informa', async () => {
    const target = await institution();
    const admin = await createAccount(null, 'SYSTEM_ADMIN', 'Administração Central');
    const member = await createAccount(target, 'PROFESSOR', 'Futura Administradora');
    const cookies = await authenticate(admin.email);

    const missing = await directory(cookies, 'search=futura', 400);
    expect(bodyOf(missing).status.code).toBe('VALIDATION_FAILED');

    const found = bodyOf(await directory(cookies, `institutionId=${target}`)).data as Person[];
    expect(found.map((person) => person.id)).toEqual([member.id]);
  });
});
