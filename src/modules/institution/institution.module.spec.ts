import { Module, type DynamicModule } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MAX_PAGE_SIZE, type PageRequest } from '@shared/http/pagination';

import { AccessFacade } from '@modules/access/contracts/access.facade';
import type { AccessResult } from '@modules/access/contracts/result.dto';
import type { RoleAssignmentCommand } from '@modules/access/contracts/user.dto';

import type { CreateInstitutionCommand, InstitutionDto } from './contracts/institution.dto';
import { InstitutionFacade } from './contracts/institution.facade';
import type { InstitutionResult } from './contracts/result.dto';
import { institutionStateKey } from './infrastructure/redis-institution-state-cache';
import { createQueryCounter } from './infrastructure/query-counter';
import { InstitutionModule } from './institution.module';

/**
 * Teste do módulo pela sua fachada (`ADR-0024` §2): o interno — repositório, caso de uso,
 * cliente Prisma, cache — é real, contra PostgreSQL e Redis reais (§3, §9).
 *
 * A fachada do módulo `access` é **substituída**, e apenas ela: `ADR-0024` §4 manda
 * substituir a fachada de outro módulo e §3 manda manter real todo o interno deste. O que
 * este arquivo verifica é o que o módulo `institution` faz — inclusive **que** ele pede o
 * papel pela fachada, na ordem que `ADR-0028` §18 fixa, em vez de escrever em tabela
 * alheia.
 *
 * O efeito do outro lado da fronteira — o papel de fato atribuído a uma conta de fato
 * existente — é verificado onde os dois módulos são reais: `src/app/institution.http.spec.ts`,
 * teste de contrato de API (`ADR-0024` §1).
 *
 * As rotas que o módulo publica também são exercitadas lá.
 */

const ADMIN_ROLE = 'INSTITUTION_ADMIN';

/** O que o módulo pediu à fachada alheia, na ordem em que pediu. */
interface RoleCall {
  readonly operation: 'assign' | 'revoke';
  readonly userId: string;
  readonly roleCode: string;
}

/**
 * A fachada de `access`, substituída (`ADR-0024` §4).
 *
 * Guarda os papéis por conta e recusa conta desconhecida com `RESOURCE_NOT_FOUND` — que é
 * o contrato que o módulo `institution` consome (RF-INS-002 E3). Os demais métodos não são
 * alcançados por este módulo, e falham alto se um dia forem: um duplo silencioso
 * esconderia uma dependência nova atrás de um `undefined`.
 */
class SubstituteAccessFacade extends AccessFacade {
  readonly accounts = new Set<string>();
  readonly rolesByUser = new Map<string, Set<string>>();
  readonly calls: RoleCall[] = [];

  register(userId: string): void {
    this.accounts.add(userId);
  }

  rolesOf(userId: string): readonly string[] {
    return [...(this.rolesByUser.get(userId) ?? [])];
  }

  assignRole(command: RoleAssignmentCommand): Promise<AccessResult<void>> {
    this.calls.push({ operation: 'assign', userId: command.userId, roleCode: command.roleCode });

    if (!this.accounts.has(command.userId)) {
      return Promise.resolve({ ok: false, failure: { code: 'RESOURCE_NOT_FOUND' } });
    }

    const roles = this.rolesByUser.get(command.userId) ?? new Set<string>();
    roles.add(command.roleCode);
    this.rolesByUser.set(command.userId, roles);

    return Promise.resolve({ ok: true, value: undefined });
  }

  revokeRole(command: RoleAssignmentCommand): Promise<AccessResult<void>> {
    this.calls.push({ operation: 'revoke', userId: command.userId, roleCode: command.roleCode });

    if (!this.accounts.has(command.userId)) {
      return Promise.resolve({ ok: false, failure: { code: 'RESOURCE_NOT_FOUND' } });
    }

    this.rolesByUser.get(command.userId)?.delete(command.roleCode);

    return Promise.resolve({ ok: true, value: undefined });
  }

  permissionsOfRoles(): never {
    return expect.unreachable('`institution` não consulta a composição de papéis');
  }

  createUser(): never {
    return expect.unreachable('`institution` não cria conta');
  }

  findOwnProfile(): never {
    return expect.unreachable('`institution` não lê perfil');
  }

  updateOwnProfile(): never {
    return expect.unreachable('`institution` não altera perfil');
  }

  deactivateUser(): never {
    return expect.unreachable('`institution` não desativa conta');
  }

  activateUser(): never {
    return expect.unreachable('`institution` não ativa conta');
  }

  effectivePermissions(): never {
    return expect.unreachable('`institution` não apura permissões efetivas');
  }

  verifyCredential(): never {
    return expect.unreachable('`institution` não verifica credencial');
  }

  changeOwnPassword(): never {
    return expect.unreachable('`institution` não troca senha');
  }

  requestPasswordReset(): never {
    return expect.unreachable('`institution` não emite redefinição de senha');
  }

  resetPassword(): never {
    return expect.unreachable('`institution` não redefine senha');
  }
}

@Module({})
class SubstituteAccessModule {
  static of(facade: AccessFacade): DynamicModule {
    return {
      module: SubstituteAccessModule,
      providers: [{ provide: AccessFacade, useValue: facade }],
      exports: [AccessFacade],
    };
  }
}

/** Construtor parametrizável dos dados de teste (`ADR-0024` §16). */
let sequence = 0;

function aDraft(overrides: Partial<CreateInstitutionCommand> = {}): CreateInstitutionCommand {
  sequence += 1;

  return {
    name: `Instituição ${sequence}`,
    code: `INST${sequence}`,
    ...overrides,
  };
}

function aPage(overrides: Partial<PageRequest> = {}): PageRequest {
  return { page: 1, pageSize: 20, withTotal: false, ...overrides };
}

function valueOf<T>(result: InstitutionResult<T>): T {
  if (!result.ok) {
    expect.unreachable(`esperava sucesso, veio \`${result.failure.code}\``);
  }

  return result.value;
}

function failureOf<T>(result: InstitutionResult<T>): {
  code: string;
  fields?: readonly { field: string; code: string }[];
} {
  if (result.ok) {
    expect.unreachable('esperava falha, veio sucesso');
  }

  return result.failure;
}

describe('módulo institution', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let moduleRef: TestingModule;
  let facade: InstitutionFacade;
  let access: SubstituteAccessFacade;

  const create = async (
    overrides: Partial<CreateInstitutionCommand> = {},
  ): Promise<InstitutionDto> => valueOf(await facade.create(aDraft(overrides)));

  /** Uma conta que a fachada substituta reconhece. */
  const createUser = (): string => {
    sequence += 1;

    const userId = `01930000-0000-7000-8000-${String(sequence).padStart(12, '0')}`;
    access.register(userId);

    return userId;
  };

  const rolesOf = (userId: string): readonly string[] => access.rolesOf(userId);

  beforeAll(async () => {
    prisma = new PrismaClient();
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    access = new SubstituteAccessFacade();

    moduleRef = await Test.createTestingModule({
      imports: [
        InstitutionModule.forRoot(prisma, redis, {
          imports: [SubstituteAccessModule.of(access)],
        }),
      ],
    }).compile();

    facade = moduleRef.get(InstitutionFacade);
  });

  afterAll(async () => {
    await moduleRef.close();
    await prisma.$disconnect();
    redis.disconnect();
  });

  /**
   * Cada teste declara o estado de que depende (`ADR-0024` §14): a fachada substituta é
   * zerada, e as tabelas foram truncadas pelo `test-setup`.
   *
   * O Redis NÃO é limpo aqui, e a ausência é deliberada: a instância é compartilhada entre
   * os processos da suíte, e um `FLUSHDB` derrubaria as sessões dos testes de HTTP que
   * rodam em paralelo. As chaves deste módulo são por identificador, e cada teste cria os
   * seus — não há resíduo a limpar.
   */
  beforeEach(() => {
    access.accounts.clear();
    access.rolesByUser.clear();
    access.calls.length = 0;
  });

  describe('cadastro (RF-INS-001)', () => {
    it('cadastro aceito: a instituição passa a existir em estado ativo', async () => {
      const institution = await create({ name: 'Biopark Educação', code: 'bio' });

      expect(institution).toMatchObject({ name: 'Biopark Educação', active: true });
      // A sigla é normalizada em caixa alta: é a forma comparável e a forma gravada.
      expect(institution.code).toBe('BIO');
      expect(institution.id).toMatch(/^[0-9a-f-]{36}$/);

      expect(valueOf(await facade.findById({ institutionId: institution.id }))).toEqual(
        institution,
      );
    });

    it('nome ausente: falha apontando o campo', async () => {
      const failure = failureOf(await facade.create({ name: '  ', code: 'X' }));

      expect(failure.code).toBe('VALIDATION_FAILED');
      expect(failure.fields).toEqual([{ field: 'name', code: 'REQUIRED' }]);
    });

    it('apura todas as violações de uma vez, e não a primeira', async () => {
      const failure = failureOf(
        await facade.create({ name: '', code: '', cnpj: '123', website: 'nao-e-url' }),
      );

      expect(failure.fields).toEqual([
        { field: 'name', code: 'REQUIRED' },
        { field: 'code', code: 'REQUIRED' },
        { field: 'cnpj', code: 'MALFORMED' },
        { field: 'website', code: 'MALFORMED' },
      ]);
    });

    it('sigla repetida é recusada, nomeando o campo que colidiu', async () => {
      await create({ code: 'DUPLA' });

      const failure = failureOf(await facade.create(aDraft({ code: 'dupla' })));

      expect(failure.code).toBe('VALIDATION_FAILED');
      expect(failure.fields).toEqual([{ field: 'code', code: 'DUPLICATE' }]);
    });

    it('o CNPJ é gravado só com dígitos, e a máscara não produz um segundo valor', async () => {
      const institution = await create({ cnpj: '12.345.678/0001-90' });

      expect(institution.cnpj).toBe('12345678000190');

      const failure = failureOf(await facade.create(aDraft({ cnpj: '12345678000190' })));

      expect(failure.fields).toEqual([{ field: 'cnpj', code: 'DUPLICATE' }]);
    });

    it('os campos opcionais ausentes são nulos, e nunca texto vazio', async () => {
      const institution = await create({ cnpj: '  ', website: null });

      expect(institution).toMatchObject({ cnpj: null, website: null, contactEmail: null });
    });
  });

  describe('consulta e listagem (RF-INS-001, ADR-0025 §21 a §25)', () => {
    it('consulta por identificador devolve os dados e o estado', async () => {
      const created = await create();

      expect(valueOf(await facade.findById({ institutionId: created.id }))).toEqual(created);
    });

    it('instituição inexistente: RESOURCE_NOT_FOUND', async () => {
      const failure = failureOf(
        await facade.findById({ institutionId: '01930000-0000-7000-8000-00000000dead' }),
      );

      expect(failure.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('listagem paginada informa page, pageSize e hasNext, e não o total', async () => {
      await create();
      await create();
      await create();

      const page = await facade.list(aPage({ pageSize: 2 }));

      expect(page.items).toHaveLength(2);
      expect(page.pagination).toEqual({ page: 1, pageSize: 2, hasNext: true });
      expect(page.pagination.totalItems).toBeUndefined();
      expect(page.pagination.totalPages).toBeUndefined();
    });

    it('última página: hasNext é falso', async () => {
      await create();
      await create();

      const page = await facade.list(aPage({ page: 2, pageSize: 1 }));

      expect(page.items).toHaveLength(1);
      expect(page.pagination.hasNext).toBe(false);
    });

    it('total solicitado explicitamente devolve totalItems e totalPages', async () => {
      await create();
      await create();
      await create();

      const page = await facade.list(aPage({ pageSize: 2, withTotal: true }));

      expect(page.pagination).toEqual({
        page: 1,
        pageSize: 2,
        hasNext: true,
        totalItems: 3,
        totalPages: 2,
      });
    });

    it('página acima do limite é truncada, e a resposta informa o pageSize efetivo', async () => {
      await create();

      const page = await facade.list(aPage({ pageSize: MAX_PAGE_SIZE + 500 }));

      // A fachada recebe o pedido já saneado pela borda; o que se verifica aqui é que ela
      // devolve o tamanho com que de fato operou.
      expect(page.pagination.pageSize).toBe(MAX_PAGE_SIZE + 500);

      const truncated = await facade.list(aPage({ pageSize: MAX_PAGE_SIZE }));

      expect(truncated.pagination.pageSize).toBe(MAX_PAGE_SIZE);
    });

    it('a listagem inclui ativas e inativas, distinguidas pelo estado', async () => {
      const active = await create();
      const inactive = await create();

      await facade.deactivate({ institutionId: inactive.id });

      const page = await facade.list(aPage());
      const states = new Map(page.items.map((item) => [item.id, item.active]));

      expect(states.get(active.id)).toBe(true);
      expect(states.get(inactive.id)).toBe(false);
    });
  });

  describe('alteração (RF-INS-001)', () => {
    it('alteração aceita, e refletida na consulta seguinte', async () => {
      const created = await create({ name: 'Nome Antigo' });

      const updated = valueOf(
        await facade.update({ institutionId: created.id, name: 'Nome Novo' }),
      );

      expect(updated.name).toBe('Nome Novo');
      expect(valueOf(await facade.findById({ institutionId: created.id })).name).toBe('Nome Novo');
    });

    it('campo ausente permanece como está', async () => {
      const created = await create({ name: 'Original', website: 'https://exemplo.test' });

      const updated = valueOf(await facade.update({ institutionId: created.id, name: 'Outro' }));

      expect(updated.website).toBe('https://exemplo.test');
    });

    it('alteração de instituição inexistente: RESOURCE_NOT_FOUND', async () => {
      const failure = failureOf(
        await facade.update({
          institutionId: '01930000-0000-7000-8000-00000000dead',
          name: 'Qualquer',
        }),
      );

      expect(failure.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('a alteração NÃO muda o estado, ainda que o campo seja submetido', async () => {
      const created = await create();

      await facade.deactivate({ institutionId: created.id });

      // `active` não pertence ao comando; um cliente que o envie encontra o tipo fechado,
      // e o caso de uso nunca o lê.
      const updated = valueOf(
        await facade.update({
          institutionId: created.id,
          name: 'Renomeada',
          active: true,
        } as never),
      );

      expect(updated.active).toBe(false);
      expect(updated.name).toBe('Renomeada');
    });
  });

  describe('desativação e reativação (RF-INS-001 E2, RN2)', () => {
    it('desativação é aceita ainda que a instituição tenha registros associados', async () => {
      const created = await create();
      const userId = createUser();

      await facade.assignAdmin({ institutionId: created.id, userId });

      const deactivated = valueOf(await facade.deactivate({ institutionId: created.id }));

      expect(deactivated.active).toBe(false);
    });

    it('desativação é idempotente', async () => {
      const created = await create();

      const first = valueOf(await facade.deactivate({ institutionId: created.id }));
      const second = valueOf(await facade.deactivate({ institutionId: created.id }));

      expect(first.active).toBe(false);
      expect(second).toEqual(first);
    });

    it('reativação devolve a instituição ao estado ativo', async () => {
      const created = await create();

      await facade.deactivate({ institutionId: created.id });

      expect(valueOf(await facade.activate({ institutionId: created.id })).active).toBe(true);
    });

    it('a desativação preserva a instituição e os seus administradores designados', async () => {
      const created = await create();
      const userId = createUser();

      await facade.assignAdmin({ institutionId: created.id, userId });
      await facade.deactivate({ institutionId: created.id });

      expect(valueOf(await facade.findById({ institutionId: created.id })).id).toBe(created.id);
      expect(await prisma.institutionAdmin.count({ where: { institutionId: created.id } })).toBe(1);
    });

    it('desativar instituição inexistente: RESOURCE_NOT_FOUND', async () => {
      const failure = failureOf(
        await facade.deactivate({ institutionId: '01930000-0000-7000-8000-00000000dead' }),
      );

      expect(failure.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('designação de administrador (RF-INS-002)', () => {
    it('designação aceita: o vínculo passa a existir e o papel é atribuído', async () => {
      const institution = await create();
      const userId = createUser();

      expect((await facade.assignAdmin({ institutionId: institution.id, userId })).ok).toBe(true);

      expect(
        await prisma.institutionAdmin.count({
          where: { institutionId: institution.id, userId },
        }),
      ).toBe(1);
      expect(rolesOf(userId)).toContain(ADMIN_ROLE);
    });

    it('designação repetida conclui com sucesso e continua havendo um único vínculo', async () => {
      const institution = await create();
      const userId = createUser();

      await facade.assignAdmin({ institutionId: institution.id, userId });
      expect((await facade.assignAdmin({ institutionId: institution.id, userId })).ok).toBe(true);

      expect(
        await prisma.institutionAdmin.count({
          where: { institutionId: institution.id, userId },
        }),
      ).toBe(1);
    });

    it('a instituição admite mais de um administrador ativo (RN1)', async () => {
      const institution = await create();
      const first = createUser();
      const second = createUser();

      await facade.assignAdmin({ institutionId: institution.id, userId: first });
      await facade.assignAdmin({ institutionId: institution.id, userId: second });

      const admins = await prisma.institutionAdmin.findMany({
        where: { institutionId: institution.id },
        select: { userId: true },
      });

      expect(admins.map((admin) => admin.userId).sort()).toEqual([first, second].sort());
    });

    it('instituição inativa: INSTITUTION_INACTIVE (E2)', async () => {
      const institution = await create();
      const userId = createUser();

      await facade.deactivate({ institutionId: institution.id });

      expect(
        failureOf(await facade.assignAdmin({ institutionId: institution.id, userId })).code,
      ).toBe('INSTITUTION_INACTIVE');
    });

    it('instituição inexistente: RESOURCE_NOT_FOUND', async () => {
      const userId = createUser();

      expect(
        failureOf(
          await facade.assignAdmin({
            institutionId: '01930000-0000-7000-8000-00000000dead',
            userId,
          }),
        ).code,
      ).toBe('RESOURCE_NOT_FOUND');
    });

    it('usuário inexistente: RESOURCE_NOT_FOUND (E3)', async () => {
      const institution = await create();

      expect(
        failureOf(
          await facade.assignAdmin({
            institutionId: institution.id,
            userId: '01930000-0000-7000-8000-00000000beef',
          }),
        ).code,
      ).toBe('RESOURCE_NOT_FOUND');
    });

    it('retomada após falha parcial: o estado final é o de uma designação única', async () => {
      const institution = await create();
      const userId = createUser();

      // A falha parcial que `ADR-0028` §18 admite: o papel foi atribuído e o vínculo não
      // chegou a ser gravado. Reproduzida atribuindo o papel por fora e designando depois.
      expect((await access.assignRole({ userId, roleCode: ADMIN_ROLE })).ok).toBe(true);
      expect(
        await prisma.institutionAdmin.count({ where: { institutionId: institution.id, userId } }),
      ).toBe(0);

      expect((await facade.assignAdmin({ institutionId: institution.id, userId })).ok).toBe(true);

      expect(
        await prisma.institutionAdmin.count({ where: { institutionId: institution.id, userId } }),
      ).toBe(1);
      expect(rolesOf(userId)).toContain(ADMIN_ROLE);
    });

    it('o papel vem pela fachada, e é pedido ANTES de o vínculo ser gravado', async () => {
      const institution = await create();
      const userId = createUser();

      await facade.assignAdmin({ institutionId: institution.id, userId });

      // A fachada alheia recebeu o pedido: o papel não foi obtido por escrita em
      // `access.user_role`, que o cliente Prisma escopado recusaria de todo modo
      // (`ADR-0028` §17, `institution-prisma.spec.ts`).
      expect(access.calls).toEqual([{ operation: 'assign', userId, roleCode: ADMIN_ROLE }]);
    });

    it('usuário recusado pela fachada não deixa vínculo gravado', async () => {
      const institution = await create();
      const unknown = '01930000-0000-7000-8000-00000000beef';

      expect(
        failureOf(await facade.assignAdmin({ institutionId: institution.id, userId: unknown }))
          .code,
      ).toBe('RESOURCE_NOT_FOUND');

      // A ordem de `ADR-0028` §18 é o que garante isto: o papel vem primeiro, e a recusa
      // dele interrompe a operação antes de qualquer escrita neste módulo.
      expect(
        await prisma.institutionAdmin.count({ where: { institutionId: institution.id } }),
      ).toBe(0);
    });
  });

  describe('revogação de administrador (RF-INS-002 RN3)', () => {
    it('revogação do único vínculo remove o vínculo e o papel', async () => {
      const institution = await create();
      const userId = createUser();

      await facade.assignAdmin({ institutionId: institution.id, userId });

      expect((await facade.revokeAdmin({ institutionId: institution.id, userId })).ok).toBe(true);

      expect(
        await prisma.institutionAdmin.count({ where: { institutionId: institution.id, userId } }),
      ).toBe(0);
      expect(rolesOf(userId)).not.toContain(ADMIN_ROLE);
    });

    it('com outro vínculo remanescente, o papel é conservado', async () => {
      const first = await create();
      const second = await create();
      const userId = createUser();

      await facade.assignAdmin({ institutionId: first.id, userId });
      await facade.assignAdmin({ institutionId: second.id, userId });

      await facade.revokeAdmin({ institutionId: first.id, userId });

      expect(
        await prisma.institutionAdmin.count({ where: { institutionId: first.id, userId } }),
      ).toBe(0);
      expect(
        await prisma.institutionAdmin.count({ where: { institutionId: second.id, userId } }),
      ).toBe(1);
      expect(rolesOf(userId)).toContain(ADMIN_ROLE);
    });

    it('revogação de vínculo inexistente conclui com sucesso e nada altera', async () => {
      const institution = await create();
      const userId = createUser();

      const before = rolesOf(userId);

      expect((await facade.revokeAdmin({ institutionId: institution.id, userId })).ok).toBe(true);
      expect(rolesOf(userId)).toEqual(before);
    });

    it('a revogação do papel é pedida à fachada, e só quando o vínculo some', async () => {
      const institution = await create();
      const userId = createUser();

      await facade.assignAdmin({ institutionId: institution.id, userId });
      await facade.revokeAdmin({ institutionId: institution.id, userId });

      expect(access.calls).toEqual([
        { operation: 'assign', userId, roleCode: ADMIN_ROLE },
        { operation: 'revoke', userId, roleCode: ADMIN_ROLE },
      ]);
      expect(rolesOf(userId)).not.toContain(ADMIN_ROLE);

      // Repetir a revogação não pede nada de novo: não há vínculo a remover.
      await facade.revokeAdmin({ institutionId: institution.id, userId });

      expect(access.calls).toHaveLength(2);
    });
  });

  /**
   * `ADR-0011` §9, §10 e `ADR-0024` §23: a contagem de consultas por requisição é
   * constante em relação à quantidade de registros devolvidos, e a divergência reprova o
   * build (§11).
   *
   * Módulo próprio, sobre cliente instrumentado: o da suíte é o cru, e trocá-lo depois de
   * montado não alcançaria o repositório já construído.
   */
  describe('contagem de consultas invariante (ADR-0011 §9, §10)', () => {
    let counted: TestingModule;
    let countedFacade: InstitutionFacade;
    let counter: ReturnType<typeof createQueryCounter>;

    beforeAll(async () => {
      counter = createQueryCounter(prisma);

      counted = await Test.createTestingModule({
        imports: [
          InstitutionModule.forRoot(counter.client, redis, {
            imports: [SubstituteAccessModule.of(new SubstituteAccessFacade())],
          }),
        ],
      }).compile();

      countedFacade = counted.get(InstitutionFacade);
    });

    afterAll(async () => {
      await counted.close();
    });

    const seed = async (quantity: number): Promise<void> => {
      for (let index = 0; index < quantity; index += 1) {
        await countedFacade.create(aDraft());
      }
    };

    it('a listagem emite a mesma quantidade de consultas com um e com dez registros', async () => {
      await seed(1);

      counter.reset();
      const one = await countedFacade.list(aPage({ pageSize: 50 }));
      const forOne = counter.count();

      await seed(9);

      counter.reset();
      const ten = await countedFacade.list(aPage({ pageSize: 50 }));
      const forTen = counter.count();

      expect(one.items).toHaveLength(1);
      expect(ten.items).toHaveLength(10);
      expect(forTen).toBe(forOne);
      // Uma consulta: a página com o registro excedente (`ADR-0025` §23).
      expect(forOne).toBe(1);
    });

    it('o total pedido custa exatamente uma consulta a mais, e continua invariante', async () => {
      await seed(1);

      counter.reset();
      await countedFacade.list(aPage({ pageSize: 50, withTotal: true }));
      const forOne = counter.count();

      await seed(9);

      counter.reset();
      await countedFacade.list(aPage({ pageSize: 50, withTotal: true }));

      expect(counter.count()).toBe(forOne);
      expect(forOne).toBe(2);
    });

    it('a consulta em lote independe da quantidade de identificadores informados', async () => {
      await seed(10);

      const all = await countedFacade.list(aPage({ pageSize: 50 }));
      const ids = all.items.map((item) => item.id);

      expect(ids).toHaveLength(10);

      // As chaves em jogo são apagadas entre as duas medições — e só elas: o que se
      // verifica é o caminho que vai ao banco, e não o que a segunda chamada evitaria
      // por já ter a resposta em cache.
      const forget = async (): Promise<void> => {
        await redis.del(...ids.map(institutionStateKey));
      };

      await forget();
      counter.reset();
      await countedFacade.statesOf(ids.slice(0, 1));
      const forOne = counter.count();

      await forget();
      counter.reset();
      await countedFacade.statesOf(ids);

      expect(counter.count()).toBe(forOne);
      expect(forOne).toBe(1);
    });

    it('o estado servido pelo cache não vai ao banco (ADR-0028 §14)', async () => {
      const institution = valueOf(await countedFacade.create(aDraft()));

      await redis.del(institutionStateKey(institution.id));

      counter.reset();
      await countedFacade.stateOf(institution.id);
      expect(counter.count()).toBe(1);

      counter.reset();
      await countedFacade.stateOf(institution.id);
      expect(counter.count()).toBe(0);
    });
  });

  describe('consulta de existência e estado por outro módulo (ADR-0028 §21)', () => {
    it('instituição ativa: existe e está ativa', async () => {
      const institution = await create();

      expect(await facade.stateOf(institution.id)).toEqual({ exists: true, active: true });
    });

    it('instituição desativada: existe e não está ativa', async () => {
      const institution = await create();

      await facade.deactivate({ institutionId: institution.id });

      // Existe: a desativação não é exclusão (`ADR-0028` §9, §10). É `active` que muda.
      expect(await facade.stateOf(institution.id)).toEqual({ exists: true, active: false });
    });

    it('instituição inexistente: devolve que não existe, sem falhar', async () => {
      expect(await facade.stateOf('01930000-0000-7000-8000-00000000dead')).toEqual({
        exists: false,
        active: false,
      });
    });

    it('consulta em lote devolve o estado de cada identificador informado', async () => {
      const first = await create();
      const second = await create();

      await facade.deactivate({ institutionId: second.id });

      const absent = '01930000-0000-7000-8000-00000000dead';
      const states = await facade.statesOf([first.id, second.id, absent]);

      expect(states.get(first.id)).toEqual({ exists: true, active: true });
      expect(states.get(second.id)).toEqual({ exists: true, active: false });
      expect(states.get(absent)).toEqual({ exists: false, active: false });
    });
  });
});
