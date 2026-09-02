import { Controller, Get, Module, Post } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthModule } from '@shared/auth/auth.module';
import { CredentialVerifier } from '@shared/auth/credential-verifier';
import { IdentityResolver } from '@shared/auth/identity';
import { RedisSessionStore } from '@shared/auth/redis-session-store';
import type { SessionStore } from '@shared/auth/session-store';
import { loadAuthConfig } from '@shared/config/environment';
import { generateCorrelationId } from '@shared/correlation/correlation';
import { UndeclaredRouteAccessError } from '@shared/http/route-access-check';
import { AuthenticatedRoute, PublicRoute, RequiresPermission } from '@shared/http/route-access';

import { AccessModule } from '@modules/access/access.module';
import { AccessFacade } from '@modules/access/contracts/access.facade';

import { AppModule } from './app.module';
import { AccessCredentialVerifier, AccessIdentityResolver } from './auth/access-auth-ports';
import { configureApi } from './bootstrap/http';
import { getPrismaClient } from './prisma/prisma-client';
import { getRedisClient } from './redis/redis-client';

/**
 * Teste de **contrato de API** (`ADR-0024` §1): caixa preta, endpoint exercitado por HTTP.
 *
 * A aplicação é montada por `AppModule` e configurada por `configureApi` — as mesmas duas
 * chamadas de `main.ts`. Montar a borda de outro jeito aqui faria este arquivo aprovar um
 * sistema que não é o que sobe.
 *
 * O `ProbeModule` acrescenta rotas que **não existem no sistema** e servem só para
 * exercitar o mecanismo: esta vertical não publica nenhuma rota protegida por permissão
 * (RF-ACS-002 a RF-ACS-005 declaram "Permissões geradas: —"), e sem uma delas a guarda de
 * `ADR-0014` §11 ficaria sem verificação até a próxima vertical.
 */

const PREFIX = '/api/v1';
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? 'vince_session';
const CSRF_COOKIE = process.env.CSRF_COOKIE_NAME ?? 'vince_csrf';

const PASSWORD = 'senha-de-teste-conforme';

@Controller('probe')
class ProbeController {
  @Get('permitted')
  @RequiresPermission('EVENT:READ')
  permitted(): { readonly reached: true } {
    return { reached: true };
  }

  @Get('open')
  @PublicRoute()
  open(): { readonly reached: true } {
    return { reached: true };
  }

  @Post('mutation')
  @AuthenticatedRoute()
  mutate(): { readonly reached: true } {
    return { reached: true };
  }

  /** Falha inesperada, com detalhe interno que NÃO pode chegar ao cliente. */
  @Get('boom')
  @PublicRoute()
  boom(): never {
    throw new Error('detalhe interno: senha=abc123 em UserRepository.findByEmail');
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

/** Rota que **não** declara o seu acesso. Só existe para que a recusa seja verificável. */
@Controller('undeclared')
class UndeclaredController {
  @Get()
  get(): { readonly reached: true } {
    return { reached: true };
  }
}

@Module({ controllers: [UndeclaredController] })
class UndeclaredModule {}

/**
 * Contagem de consultas ao banco relacional, por extensão do cliente Prisma
 * (`ADR-0011` §12).
 *
 * É reescrita aqui, e não importada de `modules/access/infrastructure/`, porque a
 * fronteira não deixa: `app` importa `shared`, `contracts` e o registro do módulo, nunca
 * o seu interno (`ADR-0007`). Suprimir a regra para reaproveitar um utilitário de teste
 * seria abrir exceção de fronteira pelo motivo mais fraco que existe.
 */
function countingPrisma(prisma: PrismaClient): {
  readonly client: PrismaClient;
  count(): number;
  reset(): void;
} {
  let queries = 0;

  const instrumented = prisma.$extends({
    name: 'query-counter',
    query: {
      $allModels: {
        $allOperations({ args, query }) {
          queries += 1;

          return query(args);
        },
      },
    },
  });

  return {
    client: instrumented as unknown as PrismaClient,
    count: () => queries,
    reset: () => {
      queries = 0;
    },
  };
}

/**
 * O corpo da resposta, tipado.
 *
 * `supertest` devolve `body` como `any`, e `any` atravessando o teste desliga justamente
 * a verificação que faria o teste falhar quando o contrato mudasse de forma.
 */
interface ResponseBody {
  readonly data: Record<string, unknown> | null;
  readonly status: { readonly code: string; readonly severity: string; readonly message?: string };
  readonly errors?: readonly { readonly field: string; readonly code: string }[];
  readonly paths?: Record<string, unknown>;
  readonly components?: { readonly schemas: Record<string, unknown> };
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

function cookieLine(response: request.Response, name: string): string | undefined {
  return setCookieLines(response).find((line) => line.startsWith(`${name}=`));
}

function cookieValue(response: request.Response, name: string): string {
  const line = cookieLine(response, name) ?? '';
  const pair = line.split(';')[0] ?? '';

  return pair.slice(pair.indexOf('=') + 1);
}

function header(cookies: Cookies): string {
  return `${SESSION_COOKIE}=${cookies.session}; ${CSRF_COOKIE}=${cookies.csrf}`;
}

describe('contrato da API', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let facade: AccessFacade;
  let server: unknown;

  const anEmail = (): string => `pessoa-${uuidv7()}@exemplo.test`;

  /** Cria conta ativa com senha definida, pela via que o sistema de fato oferece. */
  const createAccount = async (
    overrides: { readonly email?: string; readonly password?: string } = {},
  ): Promise<{ readonly id: string; readonly email: string; readonly password: string }> => {
    const email = overrides.email ?? anEmail();
    const password = overrides.password ?? PASSWORD;

    const created = await facade.createUser({
      email,
      name: 'Pessoa de Teste',
      roleCode: 'PROFESSOR',
      institutionId: uuidv7(),
    });

    if (!created.ok) {
      throw new Error(`não foi possível criar a conta: ${created.failure.code}`);
    }

    const issued = await facade.requestPasswordReset({ email });

    if (issued === null) {
      throw new Error('nenhum meio de redefinição foi emitido');
    }

    const reset = await facade.resetPassword({ token: issued.token, password });

    if (!reset.ok) {
      throw new Error(`não foi possível definir a senha: ${reset.failure.code}`);
    }

    return { id: created.value.id, email, password };
  };

  const authenticate = async (email: string, password = PASSWORD): Promise<Cookies> => {
    const response = await request(server as never)
      .post(`${PREFIX}/sessions`)
      .send({ email, password })
      .expect(200);

    return {
      session: cookieValue(response, SESSION_COOKIE),
      csrf: cookieValue(response, CSRF_COOKIE),
    };
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule.forRole('api', []), ProbeModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();

    facade = app.get(AccessFacade);
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await AccessModule.seed(app);
  });

  describe('envelope de resposta', () => {
    it('consulta por identificador devolve `data` e `status`, sem `pagination` nem `errors`', async () => {
      const account = await createAccount();
      const cookies = await authenticate(account.email);

      const response = await request(server as never)
        .get(`${PREFIX}/profile`)
        .set('Cookie', header(cookies))
        .expect(200);

      expect(bodyOf(response)).toHaveProperty('data');
      expect(bodyOf(response)).toHaveProperty('status');
      expect(bodyOf(response)).not.toHaveProperty('pagination');
      expect(bodyOf(response)).not.toHaveProperty('errors');
      expect(bodyOf(response).status).toEqual({ code: 'SUCCESS', severity: 'success' });
    });

    it('resposta sem corpo é 204 e não tem envelope', async () => {
      const account = await createAccount();
      const cookies = await authenticate(account.email);

      const response = await request(server as never)
        .delete(`${PREFIX}/sessions/current`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .expect(204);

      expect(bodyOf(response)).toEqual({});
      expect(response.text).toBe('');
    });

    it('falha de validação traz um item por campo, sem o valor submetido', async () => {
      const account = await createAccount();
      const cookies = await authenticate(account.email);

      const response = await request(server as never)
        .put(`${PREFIX}/password`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .send({ newPassword: 'curta' })
        .expect(400);

      expect(bodyOf(response).data).toBeNull();
      expect(bodyOf(response).status.code).toBe('VALIDATION_FAILED');
      expect(bodyOf(response).errors).toEqual([
        { field: 'currentPassword', code: 'REQUIRED' },
        { field: 'newPassword', code: 'TOO_SHORT' },
      ]);
      expect(JSON.stringify(bodyOf(response))).not.toContain('curta');
    });

    it('o e-mail submetido não é ecoado quando a validação o recusa', async () => {
      const response = await request(server as never)
        .post(`${PREFIX}/password/recovery`)
        .send({ email: '   ' })
        .expect(400);

      expect(JSON.stringify(bodyOf(response))).not.toContain('   ');
      expect(bodyOf(response).errors?.[0]?.field).toBe('email');
    });

    it('falha inesperada é 500 genérico, sem detalhe interno (ADR-0022 §15)', async () => {
      const response = await request(server as never)
        .get(`${PREFIX}/probe/boom`)
        .expect(500);

      expect(bodyOf(response)).toEqual({
        data: null,
        status: { code: 'INTERNAL_ERROR', severity: 'error' },
      });

      const body = JSON.stringify(bodyOf(response));

      expect(body).not.toContain('senha=abc123');
      expect(body).not.toContain('UserRepository');
      expect(body).not.toContain('Error');
      expect(response.headers['x-correlation-id']).toBeDefined();
    });

    it('nenhuma resposta carrega texto redigido para exibição (ADR-0026 §13)', async () => {
      const responses = [
        await request(server as never).get(`${PREFIX}/identity`),
        await request(server as never)
          .post(`${PREFIX}/sessions`)
          .send({ email: 'a@b.test', password: 'x' }),
        await request(server as never).get(`${PREFIX}/probe/boom`),
      ];

      for (const response of responses) {
        expect(bodyOf(response).status).not.toHaveProperty('message');
      }
    });

    it('o código HTTP não é replicado no corpo (ADR-0025 §13)', async () => {
      const response = await request(server as never)
        .get(`${PREFIX}/identity`)
        .expect(401);

      expect(JSON.stringify(bodyOf(response))).not.toContain('401');
    });
  });

  describe('semântica dos códigos HTTP', () => {
    it('recurso inexistente é 404 com RESOURCE_NOT_FOUND', async () => {
      const response = await request(server as never)
        .get(`${PREFIX}/rota-que-nao-existe`)
        .expect(404);

      expect(bodyOf(response).status.code).toBe('RESOURCE_NOT_FOUND');
      expect(response.headers['x-correlation-id']).toBeDefined();
    });

    it('violação de regra de negócio é 422', async () => {
      const account = await createAccount();
      const cookies = await authenticate(account.email);

      const response = await request(server as never)
        .patch(`${PREFIX}/profile`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .send({ preferredLanguage: 'xx-YY' })
        .expect(422);

      expect(bodyOf(response).status.code).toBe('LANGUAGE_NOT_SUPPORTED');
    });

    it('toda falha responde fora da faixa 2xx', async () => {
      for (const response of [
        await request(server as never).get(`${PREFIX}/identity`),
        await request(server as never).get(`${PREFIX}/nao-existe`),
        await request(server as never).get(`${PREFIX}/probe/boom`),
      ]) {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(bodyOf(response).status.severity).toBe('error');
      }
    });
  });

  describe('identificador de correlação', () => {
    it('requisição sem identificador recebe um gerado', async () => {
      const response = await request(server as never)
        .get(`${PREFIX}/probe/open`)
        .expect(200);

      expect(response.headers['x-correlation-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('identificador no formato declarado é devolvido tal como veio', async () => {
      const correlationId = generateCorrelationId();

      const response = await request(server as never)
        .get(`${PREFIX}/probe/open`)
        .set('X-Correlation-Id', correlationId)
        .expect(200);

      expect(response.headers['x-correlation-id']).toBe(correlationId);
    });

    it('identificador malformado é descartado e outro é gerado', async () => {
      const response = await request(server as never)
        .get(`${PREFIX}/probe/open`)
        .set('X-Correlation-Id', 'nao-e-um-uuid')
        .expect(200);

      expect(response.headers['x-correlation-id']).not.toBe('nao-e-um-uuid');
      expect(response.headers['x-correlation-id']).toBeDefined();
    });

    it('a resposta sem corpo também o carrega', async () => {
      const account = await createAccount();
      const cookies = await authenticate(account.email);

      const response = await request(server as never)
        .delete(`${PREFIX}/sessions/current`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .expect(204);

      expect(response.headers['x-correlation-id']).toBeDefined();
    });
  });

  describe('origens aceitas', () => {
    it('origem listada é autorizada, com credenciais', async () => {
      const listed = (process.env.CORS_ORIGINS ?? '').split(',')[0] ?? '';

      const response = await request(server as never)
        .get(`${PREFIX}/probe/open`)
        .set('Origin', listed)
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe(listed);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('origem fora da lista não é autorizada', async () => {
      const response = await request(server as never)
        .get(`${PREFIX}/probe/open`)
        .set('Origin', 'https://sitio-atacante.test');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('estabelecimento de sessão', () => {
    it('credencial válida devolve identidade e permissões efetivas', async () => {
      const account = await createAccount();

      const response = await request(server as never)
        .post(`${PREFIX}/sessions`)
        .send({ email: account.email, password: account.password })
        .expect(200);

      expect(bodyOf(response).data?.userId).toBe(account.id);
      expect(bodyOf(response).data?.email).toBe(account.email);
      expect(bodyOf(response).data?.roles).toEqual(['PROFESSOR']);
      expect(bodyOf(response).data?.permissions).toContain('ARTICLE:GRADE');
    });

    it('o cookie de sessão tem HttpOnly, Secure, SameSite e Path restrito', async () => {
      const account = await createAccount();

      const response = await request(server as never)
        .post(`${PREFIX}/sessions`)
        .send({ email: account.email, password: account.password })
        .expect(200);

      const line = cookieLine(response, SESSION_COOKIE) ?? '';

      expect(line).toContain('HttpOnly');
      expect(line).toContain('Secure');
      expect(line).toMatch(/SameSite=Lax/i);
      expect(line).toContain(`Path=${PREFIX}`);
    });

    it('o identificador de sessão não aparece no corpo nem fora do cookie', async () => {
      const account = await createAccount();

      const response = await request(server as never)
        .post(`${PREFIX}/sessions`)
        .send({ email: account.email, password: account.password })
        .expect(200);

      const sessionId = cookieValue(response, SESSION_COOKIE);

      expect(sessionId.length).toBeGreaterThan(0);
      expect(JSON.stringify(bodyOf(response))).not.toContain(sessionId);

      for (const [name, value] of Object.entries(response.headers)) {
        if (name !== 'set-cookie') {
          expect(JSON.stringify(value)).not.toContain(sessionId);
        }
      }
    });

    /**
     * Os quatro casos de falha respondem o mesmo (RF-ACS-001 E1, E2, e a conta sem senha).
     * A comparação é entre os corpos inteiros, e não só entre os códigos: qualquer
     * diferença — um campo a mais, uma ordem distinta — seria o oráculo que a regra proíbe.
     */
    it('senha incorreta, conta inexistente, conta desativada e conta sem senha são indistinguíveis', async () => {
      const account = await createAccount();

      const inactive = await createAccount();
      await facade.deactivateUser({ userId: inactive.id });

      const withoutPassword = await facade.createUser({
        email: anEmail(),
        name: 'Sem Senha',
        roleCode: 'STUDENT',
        institutionId: uuidv7(),
      });

      if (!withoutPassword.ok) {
        throw new Error('não foi possível criar a conta sem senha');
      }

      const attempts = [
        { email: account.email, password: 'senha-completamente-errada' },
        { email: anEmail(), password: PASSWORD },
        { email: inactive.email, password: inactive.password },
        { email: withoutPassword.value.email, password: PASSWORD },
      ];

      const responses = [];

      for (const attempt of attempts) {
        responses.push(
          await request(server as never)
            .post(`${PREFIX}/sessions`)
            .send(attempt)
            .expect(401),
        );
      }

      for (const response of responses) {
        expect(bodyOf(response)).toEqual({
          data: null,
          status: { code: 'AUTHENTICATION_FAILED', severity: 'error' },
        });
        expect(cookieLine(response, SESSION_COOKIE)).toBeUndefined();
      }
    });

    it('a autenticação regenera o identificador: o anterior deixa de ser aceito', async () => {
      const account = await createAccount();
      const first = await authenticate(account.email);

      const response = await request(server as never)
        .post(`${PREFIX}/sessions`)
        .set('Cookie', header(first))
        .set('X-CSRF-Token', first.csrf)
        .send({ email: account.email, password: account.password })
        .expect(200);

      const second = {
        session: cookieValue(response, SESSION_COOKIE),
        csrf: cookieValue(response, CSRF_COOKIE),
      };

      expect(second.session).not.toBe(first.session);

      await request(server as never)
        .get(`${PREFIX}/identity`)
        .set('Cookie', header(first))
        .expect(401);

      await request(server as never)
        .get(`${PREFIX}/identity`)
        .set('Cookie', header(second))
        .expect(200);
    });

    it('duas sessões da mesma conta recebem identificadores distintos', async () => {
      const account = await createAccount();
      const first = await authenticate(account.email);
      const second = await authenticate(account.email);

      expect(first.session).not.toBe(second.session);
      // 32 bytes em base64url — bem acima dos 128 bits de ADR-0013 §2.
      expect(first.session.length).toBeGreaterThanOrEqual(43);
    });
  });

  describe('encerramento e revogação', () => {
    it('encerrada a sessão, a credencial anterior é recusada', async () => {
      const account = await createAccount();
      const cookies = await authenticate(account.email);

      await request(server as never)
        .delete(`${PREFIX}/sessions/current`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .expect(204);

      await request(server as never)
        .get(`${PREFIX}/identity`)
        .set('Cookie', header(cookies))
        .expect(401);
    });

    it('encerrar sessão já expirada conclui com sucesso (RF-ACS-002 E1)', async () => {
      const account = await createAccount();
      const cookies = await authenticate(account.email);

      await request(server as never)
        .delete(`${PREFIX}/sessions/current`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .expect(204);

      await request(server as never)
        .delete(`${PREFIX}/sessions/current`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .expect(204);
    });

    it('o encerramento afeta apenas a sessão corrente (RF-ACS-002 RN1)', async () => {
      const account = await createAccount();
      const first = await authenticate(account.email);
      const second = await authenticate(account.email);

      await request(server as never)
        .delete(`${PREFIX}/sessions/current`)
        .set('Cookie', header(first))
        .set('X-CSRF-Token', first.csrf)
        .expect(204);

      await request(server as never)
        .get(`${PREFIX}/identity`)
        .set('Cookie', header(second))
        .expect(200);
    });
  });

  describe('proteção anti-CSRF', () => {
    it('requisição que altera estado com o token da sessão é processada', async () => {
      const account = await createAccount();
      const cookies = await authenticate(account.email);

      await request(server as never)
        .post(`${PREFIX}/probe/mutation`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .expect(201);
    });

    it('requisição que altera estado sem o token é recusada, e nada é alterado', async () => {
      const account = await createAccount();
      const cookies = await authenticate(account.email);

      const response = await request(server as never)
        .patch(`${PREFIX}/profile`)
        .set('Cookie', header(cookies))
        .send({ name: 'Nome Novo' })
        .expect(403);

      expect(bodyOf(response).status.code).toBe('PERMISSION_DENIED');

      const profile = await request(server as never)
        .get(`${PREFIX}/profile`)
        .set('Cookie', header(cookies))
        .expect(200);

      expect(bodyOf(profile).data?.name).toBe('Pessoa de Teste');
    });

    it('token de outra sessão é recusado', async () => {
      const mine = await createAccount();
      const yours = await createAccount();

      const mineCookies = await authenticate(mine.email);
      const yoursCookies = await authenticate(yours.email);

      await request(server as never)
        .patch(`${PREFIX}/profile`)
        .set('Cookie', header(mineCookies))
        .set('X-CSRF-Token', yoursCookies.csrf)
        .send({ name: 'Nome Novo' })
        .expect(403);
    });

    it('requisição de leitura passa sem token', async () => {
      const account = await createAccount();
      const cookies = await authenticate(account.email);

      await request(server as never)
        .get(`${PREFIX}/identity`)
        .set('Cookie', `${SESSION_COOKIE}=${cookies.session}`)
        .expect(200);
    });

    it('o cookie do token anti-CSRF é legível por script, e o de sessão não', async () => {
      const account = await createAccount();

      const response = await request(server as never)
        .post(`${PREFIX}/sessions`)
        .send({ email: account.email, password: account.password })
        .expect(200);

      expect(cookieLine(response, CSRF_COOKIE)).not.toContain('HttpOnly');
      expect(cookieLine(response, CSRF_COOKIE)).toContain('Secure');
      expect(cookieLine(response, SESSION_COOKIE)).toContain('HttpOnly');
    });
  });

  describe('verificação de permissão na borda', () => {
    it('usuário com a permissão alcança o caso de uso', async () => {
      const account = await createAccount();
      const cookies = await authenticate(account.email);

      // `EVENT:READ` está na composição de PROFESSOR (URS §2.3.1).
      const response = await request(server as never)
        .get(`${PREFIX}/probe/permitted`)
        .set('Cookie', header(cookies))
        .expect(200);

      expect(bodyOf(response).data).toEqual({ reached: true });
    });

    it('usuário sem a permissão recebe 403, e o caso de uso não executa', async () => {
      const account = await createAccount();
      await facade.revokeRole({ userId: account.id, roleCode: 'PROFESSOR' });

      const cookies = await authenticate(account.email);

      const response = await request(server as never)
        .get(`${PREFIX}/probe/permitted`)
        .set('Cookie', header(cookies))
        .expect(403);

      expect(bodyOf(response)).toEqual({
        data: null,
        status: { code: 'PERMISSION_DENIED', severity: 'error' },
      });
    });

    it('rota protegida sem sessão responde 401', async () => {
      await request(server as never)
        .get(`${PREFIX}/probe/permitted`)
        .expect(401);
    });

    it('permissão enviada pelo cliente é integralmente desconsiderada', async () => {
      const account = await createAccount();
      await facade.revokeRole({ userId: account.id, roleCode: 'PROFESSOR' });

      const cookies = await authenticate(account.email);

      await request(server as never)
        .get(`${PREFIX}/probe/permitted`)
        .set('Cookie', header(cookies))
        .set('X-Permissions', 'EVENT:READ')
        .query({ permissions: 'EVENT:READ' })
        .expect(403);
    });

    it('a identidade reflete a revogação de papel na consulta seguinte', async () => {
      const account = await createAccount();
      const cookies = await authenticate(account.email);

      const before = await request(server as never)
        .get(`${PREFIX}/identity`)
        .set('Cookie', header(cookies))
        .expect(200);

      expect(bodyOf(before).data?.permissions).toContain('EVENT:READ');

      await facade.revokeRole({ userId: account.id, roleCode: 'PROFESSOR' });

      const after = await request(server as never)
        .get(`${PREFIX}/identity`)
        .set('Cookie', header(cookies))
        .expect(200);

      expect(bodyOf(after).data?.permissions).not.toContain('EVENT:READ');
      expect(bodyOf(after).data?.roles).toEqual([]);
    });

    it('ação oculta na interface continua protegida no servidor', async () => {
      const account = await createAccount();
      await facade.revokeRole({ userId: account.id, roleCode: 'PROFESSOR' });

      const cookies = await authenticate(account.email);

      const identity = await request(server as never)
        .get(`${PREFIX}/identity`)
        .set('Cookie', header(cookies))
        .expect(200);

      expect(bodyOf(identity).data?.permissions).not.toContain('EVENT:READ');

      // A interface esconderia a ação; requisitá-la diretamente continua sendo recusado.
      await request(server as never)
        .get(`${PREFIX}/probe/permitted`)
        .set('Cookie', header(cookies))
        .expect(403);
    });
  });

  describe('especificação OpenAPI', () => {
    it('descreve as rotas publicadas, com o envelope e os códigos possíveis', async () => {
      const response = await request(server as never)
        .get('/api/openapi.json')
        .expect(200);

      const paths = Object.keys(bodyOf(response).paths ?? {});

      for (const path of [
        `${PREFIX}/sessions`,
        `${PREFIX}/sessions/current`,
        `${PREFIX}/identity`,
        `${PREFIX}/profile`,
        `${PREFIX}/password`,
        `${PREFIX}/password/recovery`,
        `${PREFIX}/password/reset`,
      ]) {
        expect(paths).toContain(path);
      }

      const schemas = bodyOf(response).components?.schemas ?? {};

      expect(schemas).toHaveProperty('ResponseStatusDto');
      expect(schemas).toHaveProperty('FailureEnvelopeDto');
      expect(schemas).toHaveProperty('IdentityDto');

      const sessions = (bodyOf(response).paths?.[`${PREFIX}/sessions`] ?? {}) as {
        readonly post: { readonly responses: Record<string, unknown> };
      };

      expect(Object.keys(sessions.post.responses).sort()).toEqual(['200', '400', '401']);
    });

    it('rota nova consta da especificação sem edição manual de documento', async () => {
      const response = await request(server as never)
        .get('/api/openapi.json')
        .expect(200);

      // `ProbeController` foi acrescentado por este teste e nenhum documento foi editado.
      expect(Object.keys(bodyOf(response).paths ?? {})).toContain(`${PREFIX}/probe/permitted`);
    });
  });

  describe('perfil próprio', () => {
    it('devolve o perfil do titular', async () => {
      const account = await createAccount();
      const cookies = await authenticate(account.email);

      const response = await request(server as never)
        .get(`${PREFIX}/profile`)
        .set('Cookie', header(cookies))
        .expect(200);

      expect(bodyOf(response).data?.id).toBe(account.id);
      expect(bodyOf(response).data?.email).toBe(account.email);
      expect(bodyOf(response).data?.roleCodes).toEqual(['PROFESSOR']);
    });

    it('atualiza nome, área de atuação e preferência de idioma', async () => {
      const account = await createAccount();
      const cookies = await authenticate(account.email);

      const response = await request(server as never)
        .patch(`${PREFIX}/profile`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .send({
          name: 'Nome Atualizado',
          expertiseArea: 'Administração',
          preferredLanguage: 'pt-BR',
        })
        .expect(200);

      expect(bodyOf(response).data?.name).toBe('Nome Atualizado');
      expect(bodyOf(response).data?.expertiseArea).toBe('Administração');
      expect(bodyOf(response).data?.preferredLanguage).toBe('pt-BR');
    });

    it('alterar e-mail, papéis ou vínculo recusa a operação inteira (RF-ACS-005 E2)', async () => {
      const account = await createAccount();
      const cookies = await authenticate(account.email);

      for (const attempt of [
        { name: 'Nome Novo', email: 'outro@exemplo.test' },
        { name: 'Nome Novo', roleCode: 'SYSTEM_ADMIN' },
        { name: 'Nome Novo', institutionId: uuidv7() },
        { name: 'Nome Novo', active: false },
      ]) {
        const response = await request(server as never)
          .patch(`${PREFIX}/profile`)
          .set('Cookie', header(cookies))
          .set('X-CSRF-Token', cookies.csrf)
          .send(attempt)
          .expect(403);

        expect(bodyOf(response).status.code).toBe('PERMISSION_DENIED');
      }

      const profile = await request(server as never)
        .get(`${PREFIX}/profile`)
        .set('Cookie', header(cookies))
        .expect(200);

      // Nenhum campo foi alterado: a recusa é da operação inteira, e não do campo.
      expect(bodyOf(profile).data?.name).toBe('Pessoa de Teste');
      expect(bodyOf(profile).data?.email).toBe(account.email);
    });
  });

  describe('senha', () => {
    it('alteração aceita passa a valer na autenticação seguinte', async () => {
      const account = await createAccount();
      const cookies = await authenticate(account.email);

      await request(server as never)
        .put(`${PREFIX}/password`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .send({ currentPassword: account.password, newPassword: 'outra-senha-conforme' })
        .expect(204);

      await request(server as never)
        .post(`${PREFIX}/sessions`)
        .send({ email: account.email, password: account.password })
        .expect(401);

      await request(server as never)
        .post(`${PREFIX}/sessions`)
        .send({ email: account.email, password: 'outra-senha-conforme' })
        .expect(200);
    });

    it('senha atual incorreta falha com VALIDATION_FAILED e nada muda', async () => {
      const account = await createAccount();
      const cookies = await authenticate(account.email);

      const response = await request(server as never)
        .put(`${PREFIX}/password`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .send({ currentPassword: 'nao-e-a-atual-mas-e-longa', newPassword: 'outra-senha-conforme' })
        .expect(400);

      expect(bodyOf(response).status.code).toBe('VALIDATION_FAILED');
      expect(bodyOf(response).errors).toEqual([{ field: 'currentPassword', code: 'INCORRECT' }]);

      await request(server as never)
        .post(`${PREFIX}/sessions`)
        .send({ email: account.email, password: account.password })
        .expect(200);
    });

    it('senha acima do comprimento máximo é recusada', async () => {
      const account = await createAccount();
      const cookies = await authenticate(account.email);

      const response = await request(server as never)
        .put(`${PREFIX}/password`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .send({ currentPassword: account.password, newPassword: 'a'.repeat(129) })
        .expect(400);

      expect(bodyOf(response).errors).toEqual([{ field: 'newPassword', code: 'TOO_LONG' }]);
    });

    it('alterada a senha, as DEMAIS sessões caem e a corrente permanece (RN2)', async () => {
      const account = await createAccount();
      const current = await authenticate(account.email);
      const second = await authenticate(account.email);
      const third = await authenticate(account.email);

      await request(server as never)
        .put(`${PREFIX}/password`)
        .set('Cookie', header(current))
        .set('X-CSRF-Token', current.csrf)
        .send({ currentPassword: account.password, newPassword: 'outra-senha-conforme' })
        .expect(204);

      await request(server as never)
        .get(`${PREFIX}/identity`)
        .set('Cookie', header(current))
        .expect(200);

      for (const dropped of [second, third]) {
        await request(server as never)
          .get(`${PREFIX}/identity`)
          .set('Cookie', header(dropped))
          .expect(401);
      }
    });

    it('a solicitação de recuperação responde igual para conta existente, inexistente e desativada', async () => {
      const account = await createAccount();
      const inactive = await createAccount();
      await facade.deactivateUser({ userId: inactive.id });

      const responses = [];

      for (const email of [account.email, anEmail(), inactive.email]) {
        responses.push(
          await request(server as never)
            .post(`${PREFIX}/password/recovery`)
            .send({ email })
            .expect(204),
        );
      }

      for (const response of responses) {
        expect(response.status).toBe(204);
        expect(response.text).toBe('');
      }
    });

    it('o meio de redefinição não é devolvido na resposta', async () => {
      const account = await createAccount();

      const response = await request(server as never)
        .post(`${PREFIX}/password/recovery`)
        .send({ email: account.email })
        .expect(204);

      expect(response.text).toBe('');
      expect(JSON.stringify(response.headers)).not.toMatch(/token/i);
    });

    it('meio válido define a senha sem exigir a atual, e derruba TODAS as sessões', async () => {
      const account = await createAccount();
      const first = await authenticate(account.email);
      const second = await authenticate(account.email);

      const issued = await facade.requestPasswordReset({ email: account.email });

      await request(server as never)
        .post(`${PREFIX}/password/reset`)
        .send({ token: issued?.token, password: 'senha-definida-por-meio' })
        .expect(204);

      for (const dropped of [first, second]) {
        await request(server as never)
          .get(`${PREFIX}/identity`)
          .set('Cookie', header(dropped))
          .expect(401);
      }

      await request(server as never)
        .post(`${PREFIX}/sessions`)
        .send({ email: account.email, password: 'senha-definida-por-meio' })
        .expect(200);
    });

    it('meio reutilizado, expirado e desconhecido produzem o mesmo INVITATION_EXPIRED', async () => {
      const reused = await createAccount();
      const issuedReused = await facade.requestPasswordReset({ email: reused.email });

      await request(server as never)
        .post(`${PREFIX}/password/reset`)
        .send({ token: issuedReused?.token, password: 'senha-definida-por-meio' })
        .expect(204);

      const expired = await createAccount();
      const issuedExpired = await facade.requestPasswordReset({ email: expired.email });

      const prisma = new PrismaClient();

      try {
        await prisma.invitation.updateMany({
          where: { userId: expired.id },
          data: { expiresAt: new Date(Date.now() - 1_000) },
        });
      } finally {
        await prisma.$disconnect();
      }

      const attempts = [issuedReused?.token, issuedExpired?.token, 'meio-que-nunca-existiu'];

      for (const token of attempts) {
        const response = await request(server as never)
          .post(`${PREFIX}/password/reset`)
          .send({ token, password: 'mais-uma-senha-conforme' })
          .expect(422);

        expect(bodyOf(response)).toEqual({
          data: null,
          status: { code: 'INVITATION_EXPIRED', severity: 'error' },
        });
      }
    });

    it('senha fora da política NÃO queima o meio de redefinição', async () => {
      const account = await createAccount();
      const issued = await facade.requestPasswordReset({ email: account.email });

      await request(server as never)
        .post(`${PREFIX}/password/reset`)
        .send({ token: issued?.token, password: 'curta' })
        .expect(400);

      await request(server as never)
        .post(`${PREFIX}/password/reset`)
        .send({ token: issued?.token, password: 'agora-com-senha-conforme' })
        .expect(204);
    });

    it('conta sem senha definida autentica depois de defini-la por meio de redefinição', async () => {
      const created = await facade.createUser({
        email: anEmail(),
        name: 'Primeira Senha',
        roleCode: 'STUDENT',
        institutionId: uuidv7(),
      });

      if (!created.ok) {
        throw new Error('não foi possível criar a conta');
      }

      await request(server as never)
        .post(`${PREFIX}/sessions`)
        .send({ email: created.value.email, password: 'qualquer-senha-longa' })
        .expect(401);

      const issued = await facade.requestPasswordReset({ email: created.value.email });

      await request(server as never)
        .post(`${PREFIX}/password/reset`)
        .send({ token: issued?.token, password: 'primeira-senha-da-conta' })
        .expect(204);

      await request(server as never)
        .post(`${PREFIX}/sessions`)
        .send({ email: created.value.email, password: 'primeira-senha-da-conta' })
        .expect(200);
    });
  });

  describe('jornada completa (ADR-0024 §8)', () => {
    it('entrar, consultar rota protegida, sair e ser recusado', async () => {
      const account = await createAccount();

      const entrance = await request(server as never)
        .post(`${PREFIX}/sessions`)
        .send({ email: account.email, password: account.password })
        .expect(200);

      const cookies = {
        session: cookieValue(entrance, SESSION_COOKIE),
        csrf: cookieValue(entrance, CSRF_COOKIE),
      };

      await request(server as never)
        .get(`${PREFIX}/identity`)
        .set('Cookie', header(cookies))
        .expect(200);

      await request(server as never)
        .get(`${PREFIX}/probe/permitted`)
        .set('Cookie', header(cookies))
        .expect(200);

      await request(server as never)
        .delete(`${PREFIX}/sessions/current`)
        .set('Cookie', header(cookies))
        .set('X-CSRF-Token', cookies.csrf)
        .expect(204);

      await request(server as never)
        .get(`${PREFIX}/probe/permitted`)
        .set('Cookie', header(cookies))
        .expect(401);
    });
  });

  /**
   * Invariantes que exigem infraestrutura instrumentada ou avariada.
   *
   * A composição do módulo é repetida aqui porque `AppModule` monta as instâncias reais e
   * não admite substituição — e não deveria admitir: um ponto de injeção existente só para
   * o teste é um ponto por onde a produção também pode ser desviada.
   */
  describe('invariantes da borda', () => {
    const buildApp = async (overrides: {
      readonly prisma?: PrismaClient;
      readonly sessions?: SessionStore;
    }): Promise<INestApplication> => {
      const config = loadAuthConfig();
      const redis = getRedisClient();
      const sessions = overrides.sessions ?? new RedisSessionStore(redis, config.session);

      const access = AccessModule.forRoot(overrides.prisma ?? getPrismaClient(), redis, {
        passwordHashing: config.passwordHashing,
        passwordResetTtlSeconds: config.passwordResetTtlSeconds,
        sessions,
      });

      const ref = await Test.createTestingModule({
        imports: [
          DiscoveryModule,
          AuthModule.forRoot({
            config,
            sessions,
            imports: [access],
            ports: [
              { provide: CredentialVerifier, useClass: AccessCredentialVerifier },
              { provide: IdentityResolver, useClass: AccessIdentityResolver },
            ],
          }),
          ProbeModule,
        ],
      }).compile();

      const built = ref.createNestApplication();
      configureApi(built);
      await built.init();

      return built;
    };

    it('rota sem declaração de acesso não é servida (decisão D4)', async () => {
      const ref = await Test.createTestingModule({
        imports: [AppModule.forRole('api', []), UndeclaredModule],
      }).compile();

      const broken = ref.createNestApplication();

      try {
        expect(() => {
          configureApi(broken);
        }).toThrow(UndeclaredRouteAccessError);

        expect(() => {
          configureApi(broken);
        }).toThrow('UndeclaredController.get');
      } finally {
        await broken.close();
      }
    });

    /**
     * `ADR-0013` §15: a resolução da sessão não consulta o banco relacional. Com as
     * permissões já em cache, a requisição autenticada **inteira** não o consulta —
     * que é o que faz do Redis o caminho crítico, e do PostgreSQL, não.
     */
    it('requisição autenticada comum não produz consulta ao banco relacional', async () => {
      const account = await createAccount();
      const counter = countingPrisma(new PrismaClient());
      const instrumented = await buildApp({ prisma: counter.client });

      try {
        const login = await request(instrumented.getHttpServer() as never)
          .post(`${PREFIX}/sessions`)
          .send({ email: account.email, password: account.password })
          .expect(200);

        const cookies = {
          session: cookieValue(login, SESSION_COOKIE),
          csrf: cookieValue(login, CSRF_COOKIE),
        };

        // Aquece o cache de permissões: a primeira apuração consulta, as seguintes não
        // (`ADR-0014` §10).
        await request(instrumented.getHttpServer() as never)
          .get(`${PREFIX}/probe/permitted`)
          .set('Cookie', header(cookies))
          .expect(200);

        counter.reset();

        await request(instrumented.getHttpServer() as never)
          .get(`${PREFIX}/probe/permitted`)
          .set('Cookie', header(cookies))
          .expect(200);

        await request(instrumented.getHttpServer() as never)
          .post(`${PREFIX}/probe/mutation`)
          .set('Cookie', header(cookies))
          .set('X-CSRF-Token', cookies.csrf)
          .expect(201);

        expect(counter.count()).toBe(0);
      } finally {
        await instrumented.close();
      }
    });

    /**
     * `ADR-0013` §16: **não existe modo degradado**. Com o repositório de sessões fora do
     * ar, nenhuma requisição é aceita sem verificação — a negativa é deliberada, e é a
     * implicação 1 do ADR: o Redis passa a ser condição de disponibilidade do sistema.
     */
    it('repositório de sessões indisponível recusa a requisição autenticada', async () => {
      const account = await createAccount();
      const cookies = await authenticate(account.email);

      const unreachable = new Redis('redis://localhost:1', {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      unreachable.on('error', () => undefined);

      const degraded = await buildApp({
        sessions: new RedisSessionStore(unreachable, loadAuthConfig().session),
      });

      try {
        for (const path of [`${PREFIX}/identity`, `${PREFIX}/probe/permitted`]) {
          const response = await request(degraded.getHttpServer() as never)
            .get(path)
            .set('Cookie', header(cookies));

          expect(response.status).toBe(401);
          expect(bodyOf(response).status.code).toBe('AUTHENTICATION_FAILED');
        }

        // A rota pública continua servindo: o que caiu foi a sessão, não o sistema.
        await request(degraded.getHttpServer() as never)
          .get(`${PREFIX}/probe/open`)
          .expect(200);
      } finally {
        await degraded.close();
        unreachable.disconnect();
      }
    });
  });
});
