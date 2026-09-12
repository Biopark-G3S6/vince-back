import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import { AccessModule } from '@modules/access/access.module';
import { InstitutionFacade } from '@modules/institution/contracts/institution.facade';

import { AppModule } from './app.module';
import { configureApi } from './bootstrap/http';

/**
 * Teste de **contrato de API** da vertical de instituição (`ADR-0024` §1): caixa preta,
 * endpoint exercitado por HTTP.
 *
 * A aplicação é montada por `AppModule` e configurada por `configureApi` — as mesmas duas
 * chamadas de `main.ts`. É aqui que se verificam as três coisas que só existem com a borda
 * de pé: a guarda de permissão de `ADR-0014` §11, o envelope de `ADR-0025`, e o fechamento
 * das duas dívidas herdadas — `INSTITUTION_INACTIVE` na autenticação e a procedência do
 * vínculo institucional da conta.
 */

const PREFIX = '/api/v1';
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'vince_session';
const CSRF_COOKIE = process.env.CSRF_COOKIE_NAME ?? 'vince_csrf';

const PASSWORD = 'senha-de-teste-conforme';

interface ResponseBody {
  readonly data: unknown;
  readonly status: { readonly code: string; readonly severity: string };
  readonly pagination?: {
    readonly page: number;
    readonly pageSize: number;
    readonly hasNext: boolean;
    readonly totalItems?: number;
    readonly totalPages?: number;
  };
  readonly errors?: readonly { readonly field: string; readonly code: string }[];
}

function bodyOf(response: request.Response): ResponseBody {
  return response.body as ResponseBody;
}

interface Cookies {
  readonly session: string;
  readonly csrf: string;
}

function setCookieLines(response: request.Response): string[] {
  const raw: unknown = response.headers['set-cookie'];

  if (Array.isArray(raw)) {
    return raw as string[];
  }

  return typeof raw === 'string' ? [raw] : [];
}

function cookieValue(response: request.Response, name: string): string {
  const line = setCookieLines(response).find((entry) => entry.startsWith(`${name}=`)) ?? '';
  const pair = line.split(';')[0] ?? '';

  return pair.slice(pair.indexOf('=') + 1);
}

function header(cookies: Cookies): string {
  return `${SESSION_COOKIE}=${cookies.session}; ${CSRF_COOKIE}=${cookies.csrf}`;
}

describe('contrato da API — instituição', () => {
  let moduleRef: TestingModule;
  let app: INestApplication | undefined;
  let access: AccessFacade;
  let institutions: InstitutionFacade;
  let server: unknown;
  let seedReport: Awaited<ReturnType<typeof AccessModule.seed>>;

  let sequence = 0;

  const anEmail = (): string => `pessoa-${uuidv7()}@exemplo.test`;

  /** Conta ativa com senha definida, pela via que o sistema de fato oferece. */
  const createAccount = async (
    overrides: { readonly roleCode?: string; readonly institutionId?: string | null } = {},
  ): Promise<{ readonly id: string; readonly email: string }> => {
    const email = anEmail();

    const created = await access.createUser({
      email,
      name: 'Pessoa de Teste',
      roleCode: overrides.roleCode ?? 'SYSTEM_ADMIN',
      institutionId: overrides.institutionId ?? null,
    });

    if (!created.ok) {
      throw new Error(`não foi possível criar a conta: ${created.failure.code}`);
    }

    const issued = await access.requestPasswordReset({ email });

    if (issued === null) {
      throw new Error('nenhum meio de redefinição foi emitido');
    }

    const reset = await access.resetPassword({ token: issued.token, password: PASSWORD });

    if (!reset.ok) {
      throw new Error(`não foi possível definir a senha: ${reset.failure.code}`);
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

  /** Sessão de administrador de sistema — o ator de RF-INS-001 e RF-INS-002. */
  const asSystemAdmin = async (): Promise<Cookies> => {
    const account = await createAccount({ roleCode: 'SYSTEM_ADMIN', institutionId: null });

    return authenticate(account.email);
  };

  const anInstitution = async (): Promise<{ readonly id: string; readonly code: string }> => {
    sequence += 1;

    const code = `HTTP${sequence}${Date.now() % 100000}`;
    const created = await institutions.create({ name: `Instituição ${sequence}`, code });

    if (!created.ok) {
      throw new Error(`não foi possível cadastrar: ${created.failure.code}`);
    }

    return { id: created.value.id, code: created.value.code };
  };

  const anInstitutionAs = async (cookies: Cookies): Promise<{ readonly id: string }> => {
    sequence += 1;
    const response = await request(server as never)
      .post(`${PREFIX}/institutions`)
      .set('Cookie', header(cookies))
      .set('X-CSRF-Token', cookies.csrf)
      .send({ name: `Instituição ${sequence}`, code: `API${sequence}${Date.now() % 100000}` })
      .expect(201);

    return { id: (bodyOf(response).data as { id: string }).id };
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule.forRole('api', [])],
    }).compile();

    const created = moduleRef.createNestApplication();
    configureApi(created);
    await created.init();

    app = created;
    access = created.get(AccessFacade);
    institutions = created.get(InstitutionFacade);
    server = created.getHttpServer();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    seedReport = await AccessModule.seed(moduleRef);
  });

  describe('cadastro (RF-INS-001)', () => {
    it('201 com o recurso criado e o cabeçalho Location (ADR-0025 §27)', async () => {
      const cookies = await asSystemAdmin();

      const response = await request(server as never)
        .post(`${PREFIX}/institutions`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .send({ name: 'Biopark Educação', code: 'bio-http' })
        .expect(201);

      const body = bodyOf(response);
      const created = body.data as { readonly id: string; readonly active: boolean };

      expect(body.status).toEqual({ code: 'SUCCESS', severity: 'success' });
      expect(created.active).toBe(true);
      expect(response.headers.location).toBe(`/institutions/${created.id}`);
    });

    it('ator sem INSTITUTION:CREATE é recusado com 403', async () => {
      // A instituição é real: uma conta com vínculo para instituição inexistente sequer
      // autentica — o vínculo que não se pode confirmar nega, e é o teste de autenticação
      // que cobre esse caso.
      const institution = await anInstitution();
      const account = await createAccount({
        roleCode: 'PROFESSOR',
        institutionId: institution.id,
      });
      const cookies = await authenticate(account.email);

      const response = await request(server as never)
        .post(`${PREFIX}/institutions`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .send({ name: 'Não Autorizada', code: 'NAO' })
        .expect(403);

      expect(bodyOf(response).status.code).toBe('PERMISSION_DENIED');
      expect(bodyOf(response).data).toBeNull();
    });

    it('nome ausente: 400 com o campo apontado, sem ecoar o valor submetido', async () => {
      const cookies = await asSystemAdmin();

      const response = await request(server as never)
        .post(`${PREFIX}/institutions`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .send({ name: '   ', code: 'VAZIA' })
        .expect(400);

      const body = bodyOf(response);

      expect(body.status.code).toBe('VALIDATION_FAILED');
      expect(body.errors).toEqual([{ field: 'name', code: 'REQUIRED' }]);
      expect(JSON.stringify(body)).not.toContain('VAZIA');
    });
  });

  describe('listagem paginada (ADR-0025 §21 a §25)', () => {
    it('o envelope traz pagination com page, pageSize e hasNext, e não o total', async () => {
      const cookies = await asSystemAdmin();

      await anInstitution();
      await anInstitution();

      const response = await request(server as never)
        .get(`${PREFIX}/institutions?pageSize=1`)
        .set('Cookie', header(cookies))
        .expect(200);

      const body = bodyOf(response);

      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toEqual({ page: 1, pageSize: 1, hasNext: true });
    });

    it('withTotal=true acrescenta totalItems e totalPages', async () => {
      const cookies = await asSystemAdmin();

      await anInstitution();
      await anInstitution();

      const response = await request(server as never)
        .get(`${PREFIX}/institutions?pageSize=1&withTotal=true`)
        .set('Cookie', header(cookies))
        .expect(200);

      const pagination = bodyOf(response).pagination;

      expect(pagination?.totalItems).toBeGreaterThanOrEqual(2);
      expect(pagination?.totalPages).toBeGreaterThanOrEqual(2);
    });

    it('pageSize acima do limite é truncado a 100, e a resposta informa o efetivo', async () => {
      const cookies = await asSystemAdmin();

      await anInstitution();

      const response = await request(server as never)
        .get(`${PREFIX}/institutions?pageSize=5000`)
        .set('Cookie', header(cookies))
        .expect(200);

      expect(bodyOf(response).pagination?.pageSize).toBe(100);
    });
  });

  describe('desativação e o acesso dos seus usuários (RF-INS-001 RN2, RF-ACS-001 E3)', () => {
    it('credencial correta de instituição desativada: INSTITUTION_INACTIVE, sem sessão', async () => {
      const institution = await anInstitution();
      const account = await createAccount({
        roleCode: 'PROFESSOR',
        institutionId: institution.id,
      });

      await institutions.deactivate({ institutionId: institution.id });

      const response = await request(server as never)
        .post(`${PREFIX}/sessions`)
        .send({ email: account.email, password: PASSWORD })
        .expect(422);

      expect(bodyOf(response).status.code).toBe('INSTITUTION_INACTIVE');
      expect(cookieValue(response, SESSION_COOKIE)).toBe('');
    });

    it('credencial INCORRETA de instituição desativada: AUTHENTICATION_FAILED (decisão D4)', async () => {
      const institution = await anInstitution();
      const account = await createAccount({
        roleCode: 'PROFESSOR',
        institutionId: institution.id,
      });

      await institutions.deactivate({ institutionId: institution.id });

      // A distinção só existe para quem provou a credencial. Sem ela, a resposta é a
      // mesma de qualquer conta inexistente — o código não pode virar oráculo.
      const response = await request(server as never)
        .post(`${PREFIX}/sessions`)
        .send({ email: account.email, password: 'senha-errada-de-proposito' })
        .expect(401);

      expect(bodyOf(response).status.code).toBe('AUTHENTICATION_FAILED');
    });

    it('conta sem vínculo institucional autentica, sem verificação de instituição', async () => {
      const account = await createAccount({ roleCode: 'SYSTEM_ADMIN', institutionId: null });

      const response = await request(server as never)
        .post(`${PREFIX}/sessions`)
        .send({ email: account.email, password: PASSWORD })
        .expect(200);

      expect(bodyOf(response).status.code).toBe('SUCCESS');
    });

    it('reativação devolve o acesso: o mesmo usuário volta a autenticar', async () => {
      const institution = await anInstitution();
      const account = await createAccount({
        roleCode: 'PROFESSOR',
        institutionId: institution.id,
      });

      await institutions.deactivate({ institutionId: institution.id });
      await institutions.activate({ institutionId: institution.id });

      await request(server as never)
        .post(`${PREFIX}/sessions`)
        .send({ email: account.email, password: PASSWORD })
        .expect(200);
    });

    it('sessão já estabelecida: a desativação zera as permissões e a rota protegida dá 403', async () => {
      const institution = await anInstitution();

      // Um `SYSTEM_ADMIN` **com** vínculo institucional: é o único papel cujas permissões
      // alcançam uma rota desta vertical, e o vínculo é o que a desativação atinge.
      const admin = await createAccount({
        roleCode: 'SYSTEM_ADMIN',
        institutionId: institution.id,
      });

      const cookies = await authenticate(admin.email);

      // Antes: a permissão do papel vale, e a rota responde.
      await request(server as never)
        .get(`${PREFIX}/institutions`)
        .set('Cookie', header(cookies))
        .expect(200);

      await institutions.deactivate({ institutionId: institution.id });

      // Depois: a sessão continua tecnicamente válida — `ADR-0013` §18 proíbe módulo de
      // invalidá-la —, e o efeito prático é `403` em toda rota que exija permissão.
      const denied = await request(server as never)
        .get(`${PREFIX}/institutions`)
        .set('Cookie', header(cookies))
        .expect(403);

      expect(bodyOf(denied).status.code).toBe('PERMISSION_DENIED');

      // A sessão NÃO caiu: `/identity` não exige permissão, e continua respondendo — com
      // o conjunto de permissões vazio, que é o que produz o `403` acima.
      const identity = await request(server as never)
        .get(`${PREFIX}/identity`)
        .set('Cookie', header(cookies))
        .expect(200);

      expect((bodyOf(identity).data as { permissions: readonly string[] }).permissions).toEqual([]);
    });

    it('as permissões voltam na reativação, sem exigir nova autenticação', async () => {
      const institution = await anInstitution();
      const admin = await createAccount({
        roleCode: 'SYSTEM_ADMIN',
        institutionId: institution.id,
      });

      const cookies = await authenticate(admin.email);

      await institutions.deactivate({ institutionId: institution.id });
      await institutions.activate({ institutionId: institution.id });

      // Os mesmos cookies da sessão de antes da desativação.
      const identity = await request(server as never)
        .get(`${PREFIX}/identity`)
        .set('Cookie', header(cookies))
        .expect(200);

      const body = bodyOf(identity).data as { readonly permissions: readonly string[] };

      expect(body.permissions).toContain('INSTITUTION:READ');

      await request(server as never)
        .get(`${PREFIX}/institutions`)
        .set('Cookie', header(cookies))
        .expect(200);
    });
  });

  describe('designação de administrador por HTTP (RF-INS-002)', () => {
    it('204 na designação, e o papel passa a valer para o designado', async () => {
      const cookies = await asSystemAdmin();
      const institution = await anInstitution();
      const account = await createAccount({
        roleCode: 'PROFESSOR',
        institutionId: institution.id,
      });

      await request(server as never)
        .post(`${PREFIX}/institutions/${institution.id}/admins`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .send({ userId: account.id })
        .expect(204);

      const granted = await access.effectivePermissions({ userId: account.id });

      expect(granted.permissions).toContain('COURSE:CREATE');
    });

    it('designação em instituição desativada: 422 INSTITUTION_INACTIVE', async () => {
      const cookies = await asSystemAdmin();
      const institution = await anInstitution();
      const home = await anInstitution();
      const account = await createAccount({ roleCode: 'PROFESSOR', institutionId: home.id });

      await institutions.deactivate({ institutionId: institution.id });

      const response = await request(server as never)
        .post(`${PREFIX}/institutions/${institution.id}/admins`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .send({ userId: account.id })
        .expect(422);

      expect(bodyOf(response).status.code).toBe('INSTITUTION_INACTIVE');
    });

    it('204 na revogação, e o papel cai quando não resta vínculo', async () => {
      const cookies = await asSystemAdmin();
      const institution = await anInstitution();
      const account = await createAccount({
        roleCode: 'PROFESSOR',
        institutionId: institution.id,
      });

      await request(server as never)
        .post(`${PREFIX}/institutions/${institution.id}/admins`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .send({ userId: account.id })
        .expect(204);

      await request(server as never)
        .delete(`${PREFIX}/institutions/${institution.id}/admins/${account.id}`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .expect(204);

      const granted = await access.effectivePermissions({ userId: account.id });

      expect(granted.permissions).not.toContain('COURSE:CREATE');
    });

    it('ator sem INSTITUTION:ASSIGN_ADMIN é recusado com 403', async () => {
      const institution = await anInstitution();
      const account = await createAccount({
        roleCode: 'PROFESSOR',
        institutionId: institution.id,
      });
      const cookies = await authenticate(account.email);

      await request(server as never)
        .post(`${PREFIX}/institutions/${institution.id}/admins`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .send({ userId: account.id })
        .expect(403);
    });
  });

  describe('procedência do vínculo institucional da conta (delta de user-account)', () => {
    it('a conta criada com instituição validada registra o vínculo e o devolve', async () => {
      const institution = await anInstitution();
      const account = await createAccount({
        roleCode: 'PROFESSOR',
        institutionId: institution.id,
      });

      const cookies = await authenticate(account.email);

      const response = await request(server as never)
        .get(`${PREFIX}/profile`)
        .set('Cookie', header(cookies))
        .expect(200);

      expect((bodyOf(response).data as { institutionId: string }).institutionId).toBe(
        institution.id,
      );
    });

    it('o cliente NÃO consegue definir a instituição da própria conta', async () => {
      const institution = await anInstitution();
      const other = await anInstitution();
      const account = await createAccount({
        roleCode: 'PROFESSOR',
        institutionId: institution.id,
      });

      const cookies = await authenticate(account.email);

      // O vínculo é campo protegido do perfil (RF-ACS-005 E2, RN1): a tentativa recusa a
      // operação inteira, e nenhum campo é alterado.
      const response = await request(server as never)
        .patch(`${PREFIX}/profile`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .send({ name: 'Nome Novo', institutionId: other.id })
        .expect(403);

      expect(bodyOf(response).status.code).toBe('PERMISSION_DENIED');

      const profile = await request(server as never)
        .get(`${PREFIX}/profile`)
        .set('Cookie', header(cookies))
        .expect(200);

      const data = bodyOf(profile).data as { institutionId: string; name: string };

      expect(data.institutionId).toBe(institution.id);
      expect(data.name).not.toBe('Nome Novo');
    });

    it('não existe rota pública de criação de conta por onde a instituição entre', async () => {
      const cookies = await asSystemAdmin();

      // A criação de conta é operação de consumidor interno (`ADR-0027` §12, decisão D1
      // de `add-institution-management`): sem endpoint, não há corpo de cliente de onde
      // um identificador de instituição arbitrário pudesse chegar.
      await request(server as never)
        .post(`${PREFIX}/users`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .send({ email: anEmail(), name: 'Alguém', roleCode: 'STUDENT', institutionId: uuidv7() })
        .expect(404);
    });
  });

  describe('convites de ingresso (RF-ACS-009)', () => {
    const issue = async (
      cookies: Cookies,
      institutionId: string,
      body: Record<string, unknown>,
    ): Promise<string> => {
      const response = await request(server as never)
        .post(`${PREFIX}/institutions/${institutionId}/invitations`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .send(body)
        .expect(201);

      return (bodyOf(response).data as { url: string }).url;
    };

    it('emite, consulta e aceita convite dirigido sem criar sessão', async () => {
      const cookies = await asSystemAdmin();
      const institution = await anInstitution();
      const email = anEmail();
      const url = await issue(cookies, institution.id, {
        roleCode: 'INSTITUTION_ADMIN',
        targetEmail: email,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      });
      const token = url.split('/').pop();

      const details = await request(server as never)
        .get(`${PREFIX}${url}`)
        .expect(200);

      expect((bodyOf(details).data as { targetEmail: string }).targetEmail).toBe(email);

      const accepted = await request(server as never)
        .post(`${PREFIX}/invitations/${token}/acceptance`)
        .send({ name: 'Administradora Convidada', password: PASSWORD })
        .expect(201);

      expect((bodyOf(accepted).data as { email: string }).email).toBe(email);

      await request(server as never)
        .get(`${PREFIX}/profile`)
        .expect(401);
    });

    it('percorre a cadeia desde o primeiro acesso sem intervenção no banco', async () => {
      const resetUrl = seedReport.systemAdmin.passwordResetUrl as string;
      const token = new URL(resetUrl, 'http://localhost').searchParams.get('token');

      await request(server as never)
        .post(`${PREFIX}/password/reset`)
        .send({ token, password: PASSWORD })
        .expect(204);

      const systemAdmin = await authenticate('admin@vinceart.local');
      const institution = await anInstitutionAs(systemAdmin);
      const adminEmail = anEmail();
      const adminUrl = await issue(systemAdmin, institution.id, {
        roleCode: 'INSTITUTION_ADMIN',
        targetEmail: adminEmail,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      });

      const adminToken = adminUrl.split('/').pop();
      await request(server as never)
        .post(`${PREFIX}/invitations/${adminToken}/acceptance`)
        .send({ name: 'Administrador Institucional', password: PASSWORD })
        .expect(201);

      const institutionAdmin = await authenticate(adminEmail);
      const coordinatorEmail = anEmail();

      await issue(institutionAdmin, institution.id, {
        roleCode: 'COORDINATOR',
        targetEmail: coordinatorEmail,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      });

      expect(coordinatorEmail).toContain('@exemplo.test');
    });

    it('convite aberto respeita limite de usos', async () => {
      const cookies = await asSystemAdmin();
      const institution = await anInstitution();
      const url = await issue(cookies, institution.id, {
        roleCode: 'INSTITUTION_ADMIN',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        maxUses: 1,
      });
      const token = url.split('/').pop();

      await request(server as never)
        .post(`${PREFIX}/invitations/${token}/acceptance`)
        .send({ name: 'Primeiro Aluno', email: anEmail(), password: PASSWORD })
        .expect(201);

      const second = await request(server as never)
        .post(`${PREFIX}/invitations/${token}/acceptance`)
        .send({ name: 'Segundo Aluno', email: anEmail(), password: PASSWORD })
        .expect(422);

      expect(bodyOf(second).status.code).toBe('INVITATION_LIMIT_REACHED');
    });

    it('duas aceitações simultâneas de convite dirigido criam exatamente uma conta', async () => {
      const cookies = await asSystemAdmin();
      const institution = await anInstitution();
      const email = anEmail();
      const url = await issue(cookies, institution.id, {
        roleCode: 'INSTITUTION_ADMIN',
        targetEmail: email,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      });
      const token = url.split('/').pop();

      const responses = await Promise.all(
        ['Primeira tentativa', 'Segunda tentativa'].map((name) =>
          request(server as never)
            .post(`${PREFIX}/invitations/${token}/acceptance`)
            .send({ name, password: PASSWORD }),
        ),
      );

      expect(responses.map((response) => response.status).sort()).toEqual([201, 422]);
      expect(responses.filter((response) => response.status === 201).length).toBe(1);
    });

    it('revogação é idempotente e impede aceitação posterior', async () => {
      const cookies = await asSystemAdmin();
      const institution = await anInstitution();
      const url = await issue(cookies, institution.id, {
        roleCode: 'INSTITUTION_ADMIN',
        targetEmail: anEmail(),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      });
      const token = url.split('/').pop();
      const invitationId = (
        bodyOf(
          await request(server as never)
            .get(`${PREFIX}${url}`)
            .expect(200),
        ).data as { readonly id: string }
      ).id;

      await request(server as never)
        .post(`${PREFIX}/institutions/${institution.id}/invitations/${invitationId}/revocation`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .expect(204);
      await request(server as never)
        .post(`${PREFIX}/institutions/${institution.id}/invitations/${invitationId}/revocation`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .expect(204);

      const response = await request(server as never)
        .post(`${PREFIX}/invitations/${token}/acceptance`)
        .send({ name: 'Não Aceito', password: PASSWORD })
        .expect(422);

      expect(bodyOf(response).status.code).toBe('INVITATION_REVOKED');
    });

    it('lista somente os convites da instituição e informa paginação', async () => {
      const cookies = await asSystemAdmin();
      const first = await anInstitution();
      const second = await anInstitution();

      await issue(cookies, first.id, {
        roleCode: 'INSTITUTION_ADMIN',
        targetEmail: anEmail(),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      });
      await issue(cookies, second.id, {
        roleCode: 'INSTITUTION_ADMIN',
        targetEmail: anEmail(),
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      });

      const response = await request(server as never)
        .get(`${PREFIX}/institutions/${first.id}/invitations`)
        .set('Cookie', header(cookies))
        .expect(200);

      expect((bodyOf(response).data as readonly unknown[]).length).toBe(1);
      expect(bodyOf(response).pagination).toEqual({ page: 1, pageSize: 20, hasNext: false });
    });
  });
});
