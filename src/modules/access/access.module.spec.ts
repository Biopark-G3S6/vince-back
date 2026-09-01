import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AccessModule } from './access.module';
import { AccessFacade } from './contracts/access.facade';
import type { AccessResult } from './contracts/result.dto';
import type { CreateUserCommand, UserProfileDto } from './contracts/user.dto';
import type { CatalogDeclaration } from './domain/catalog';
import { INITIAL_SYSTEM_ADMIN } from './domain/initial-account';
import { DEFAULT_LANGUAGE } from './domain/language';
import { NAME_MAX_LENGTH } from './domain/user';
import { createOperationLog, createQueryCounter } from './infrastructure/query-counter';

/**
 * Teste do módulo pela sua fachada (`ADR-0024` §2): o interno — repositório, caso de uso,
 * cliente Prisma, cache — é real, contra PostgreSQL e Redis reais (§3, §9). A carga
 * inicial entra pelo método estático do módulo, que é a única via que ela tem
 * (`ADR-0027` §21).
 *
 * Esta vertical não publica rota, e é deliberado: toda rota que ela publicaria tem
 * "sessão ativa" como pré-condição, e a sessão nasce em `add-session-authentication`.
 * A verificação se dá aqui, na fronteira que `ADR-0024` §2 fixa, e não por exercício
 * manual de endpoint.
 */

const DECLARED = AccessModule.declaredCatalog();

const permissionsOf = (role: string): readonly string[] =>
  DECLARED.roles.find((declared) => declared.code === role)?.permissions ?? [];

const declaredGrants = DECLARED.roles.reduce((total, role) => total + role.permissions.length, 0);

function withoutPermission(role: string, permission: string): CatalogDeclaration {
  return {
    permissions: DECLARED.permissions,
    roles: DECLARED.roles.map((declared) =>
      declared.code === role
        ? { code: role, permissions: declared.permissions.filter((code) => code !== permission) }
        : declared,
    ),
  };
}

/** Construtor parametrizável dos dados de teste (`ADR-0024` §16). */
let sequence = 0;

function aUser(overrides: Partial<CreateUserCommand> = {}): CreateUserCommand {
  sequence += 1;

  return {
    email: `pessoa.${sequence}@exemplo.edu.br`,
    name: `Pessoa ${sequence}`,
    roleCode: 'STUDENT',
    institutionId: '01930000-0000-7000-8000-0000000000ff',
    ...overrides,
  };
}

/**
 * Os métodos que a fachada de fato oferece.
 *
 * Percorre a instância resolvida, e não `AccessFacade.prototype`: método `abstract` é
 * apagado na compilação e não existe no protótipo da classe abstrata, de modo que
 * inspecioná-la passaria por vácuo em qualquer asserção de ausência.
 */
function surfaceOf(instance: object): readonly string[] {
  // `Object.getPrototypeOf` é declarado devolvendo `any`; a conversão o estreita uma vez,
  // aqui, em vez de espalhar `any` pelo laço.
  const parentOf = (value: object): object | null => Object.getPrototypeOf(value) as object | null;

  const names = new Set<string>();
  let proto = parentOf(instance);

  while (proto !== null && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name !== 'constructor') {
        names.add(name);
      }
    }

    proto = parentOf(proto);
  }

  return [...names].sort();
}

/** O valor de um resultado bem-sucedido; falha o teste, com o código, se não for. */
function valueOf<T>(result: AccessResult<T>): T {
  if (!result.ok) {
    expect.unreachable(`esperava sucesso, veio \`${result.failure.code}\``);
  }

  return result.value;
}

function failureOf<T>(result: AccessResult<T>): { code: string; fields?: readonly unknown[] } {
  if (result.ok) {
    expect.unreachable('esperava falha, veio sucesso');
  }

  return result.failure;
}

describe('módulo access', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let moduleRef: TestingModule;
  let facade: AccessFacade;

  const createUser = async (overrides: Partial<CreateUserCommand> = {}): Promise<UserProfileDto> =>
    valueOf(await facade.createUser(aUser(overrides)));

  beforeAll(async () => {
    prisma = new PrismaClient();
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    moduleRef = await Test.createTestingModule({
      imports: [AccessModule.forRoot(prisma, redis)],
    }).compile();
    facade = moduleRef.get(AccessFacade);
  });

  afterAll(async () => {
    await moduleRef.close();
    await prisma.$disconnect();
    redis.disconnect();
  });

  describe('carga inicial do catálogo', () => {
    it('primeira execução: cria as permissões, os cinco papéis e a composição', async () => {
      const report = await AccessModule.seed(moduleRef);

      expect(report.catalog).toEqual({
        permissionsCreated: DECLARED.permissions.length,
        rolesCreated: DECLARED.roles.length,
        grantsCreated: declaredGrants,
        grantsRemoved: 0,
      });

      const roles = await prisma.role.findMany({ select: { code: true } });

      expect(roles.map((role) => role.code).sort()).toEqual(
        DECLARED.roles.map((role) => role.code).sort(),
      );
      expect(await prisma.permission.count()).toBe(DECLARED.permissions.length);
    });

    it('reexecução sobre base já carregada: mesmo estado, mesmos identificadores', async () => {
      await AccessModule.seed(moduleRef);

      const before = await prisma.role.findMany({ orderBy: { code: 'asc' } });
      const beforePermissions = await prisma.permission.findMany({ orderBy: { code: 'asc' } });

      const report = await AccessModule.seed(moduleRef);

      expect(report.catalog).toEqual({
        permissionsCreated: 0,
        rolesCreated: 0,
        grantsCreated: 0,
        grantsRemoved: 0,
      });

      expect(await prisma.role.findMany({ orderBy: { code: 'asc' } })).toEqual(before);
      expect(await prisma.permission.findMany({ orderBy: { code: 'asc' } })).toEqual(
        beforePermissions,
      );
      expect(await prisma.rolePermission.count()).toBe(declaredGrants);
    });

    it('permissão retirada da composição some do papel e permanece no catálogo', async () => {
      await AccessModule.seed(moduleRef);

      const report = await AccessModule.seed(
        moduleRef,
        withoutPermission('STUDENT', 'ARTICLE:EDIT'),
      );

      expect(report.catalog.grantsRemoved).toBe(1);
      expect(report.catalog.grantsCreated).toBe(0);

      const { permissions } = await facade.permissionsOfRoles({ roleCodes: ['STUDENT'] });

      expect(permissions).not.toContain('ARTICLE:EDIT');
      expect(
        await prisma.permission.findUnique({ where: { code: 'ARTICLE:EDIT' } }),
      ).not.toBeNull();
    });

    it('declaração inválida reprova a carga inteira, sem gravação parcial', async () => {
      const invalid: CatalogDeclaration = {
        permissions: [...DECLARED.permissions, 'COURSE:*'],
        roles: DECLARED.roles,
      };

      await expect(AccessModule.seed(moduleRef, invalid)).rejects.toThrow(/COURSE:\*/);

      expect(await prisma.permission.count()).toBe(0);
      expect(await prisma.role.count()).toBe(0);
      expect(await prisma.rolePermission.count()).toBe(0);
      expect(await prisma.user.count()).toBe(0);
    });
  });

  describe('consulta das permissões de um conjunto de papéis', () => {
    // Por teste, e não uma vez só: as tabelas são truncadas entre testes
    // (ADR-0024 §12) e cada teste declara o estado de que depende (§14).
    beforeEach(async () => {
      await AccessModule.seed(moduleRef);
    });

    it('devolve as permissões declaradas para um papel', async () => {
      const { permissions } = await facade.permissionsOfRoles({ roleCodes: ['STUDENT'] });

      expect([...permissions].sort()).toEqual([...permissionsOf('STUDENT')].sort());
    });

    it('devolve a união de vários papéis, cada permissão uma única vez', async () => {
      const { permissions } = await facade.permissionsOfRoles({
        roleCodes: ['PROFESSOR', 'COORDINATOR'],
      });

      const expected = new Set([...permissionsOf('PROFESSOR'), ...permissionsOf('COORDINATOR')]);

      expect(permissions).toHaveLength(expected.size);
      expect([...permissions].sort()).toEqual([...expected].sort());
    });

    it('ignora papel desconhecido, sem erro', async () => {
      const { permissions } = await facade.permissionsOfRoles({
        roleCodes: ['PROFESSOR', 'AUDITOR'],
      });

      expect([...permissions].sort()).toEqual([...permissionsOf('PROFESSOR')].sort());
    });

    it('devolve conjunto vazio quando nenhum papel é informado', async () => {
      const { permissions } = await facade.permissionsOfRoles({ roleCodes: [] });

      expect(permissions).toEqual([]);
    });
  });

  describe('conta de usuário', () => {
    beforeEach(async () => {
      await AccessModule.seed(moduleRef);
    });

    describe('e-mail como identificador único global', () => {
      it('e-mail livre: a conta passa a existir com aquele e-mail', async () => {
        const profile = await createUser({ email: 'livre@exemplo.edu.br' });

        expect(profile.email).toBe('livre@exemplo.edu.br');
        expect(await prisma.user.count({ where: { email: 'livre@exemplo.edu.br' } })).toBe(1);
      });

      it('e-mail já registrado: falha e nenhuma conta é criada', async () => {
        await createUser({ email: 'ocupado@exemplo.edu.br' });
        const before = await prisma.user.count();

        const result = await facade.createUser(aUser({ email: 'ocupado@exemplo.edu.br' }));

        expect(failureOf(result).code).toBe('EMAIL_ALREADY_REGISTERED');
        expect(await prisma.user.count()).toBe(before);
      });

      it('e-mail que difere só por caixa ou espaços é o mesmo e-mail', async () => {
        await createUser({ email: 'Caixa@Exemplo.Edu.Br' });

        for (const variant of ['caixa@exemplo.edu.br', '  CAIXA@EXEMPLO.EDU.BR  ']) {
          const result = await facade.createUser(aUser({ email: variant }));

          expect(failureOf(result).code).toBe('EMAIL_ALREADY_REGISTERED');
        }
      });

      it('grava o e-mail já normalizado', async () => {
        const profile = await createUser({ email: '  Normal@Exemplo.EDU.br ' });

        expect(profile.email).toBe('normal@exemplo.edu.br');
      });

      it('e-mail malformado: falha apontando o campo do e-mail', async () => {
        const result = await facade.createUser(aUser({ email: 'não-é-endereço' }));
        const failure = failureOf(result);

        expect(failure.code).toBe('VALIDATION_FAILED');
        expect(failure.fields).toContainEqual({ field: 'email', code: 'MALFORMED' });
      });
    });

    describe('criação pelos fluxos internos', () => {
      it('a conta existe ativa, com o papel atribuído e sem credencial definida', async () => {
        const profile = await createUser({ roleCode: 'PROFESSOR' });

        expect(profile.active).toBe(true);
        expect(profile.roleCodes).toEqual(['PROFESSOR']);

        // Sem credencial: a tabela `password_credential` nem existe ainda — a senha é
        // dado de autenticação e nasce na vertical seguinte.
        const stored = await prisma.user.findUnique({ where: { id: profile.id } });

        expect(stored).not.toBeNull();
        expect(Object.keys(stored ?? {})).not.toContain('password');
      });

      it('dado obrigatório ausente: um item por campo inválido', async () => {
        const result = await facade.createUser({
          email: '',
          name: '   ',
          roleCode: 'STUDENT',
          institutionId: '01930000-0000-7000-8000-0000000000ff',
        });
        const failure = failureOf(result);

        expect(failure.code).toBe('VALIDATION_FAILED');
        expect(failure.fields).toEqual([
          { field: 'email', code: 'REQUIRED' },
          { field: 'name', code: 'REQUIRED' },
        ]);
      });

      it('papel fora dos cinco declarados: recurso inexistente', async () => {
        const result = await facade.createUser(aUser({ roleCode: 'AUDITOR' }));

        expect(failureOf(result).code).toBe('RESOURCE_NOT_FOUND');
      });
    });

    describe('estado da conta', () => {
      it('a conta nasce ativa', async () => {
        expect((await createUser()).active).toBe(true);
      });

      it('a desativação torna a conta inativa e preserva os vínculos de papel', async () => {
        const created = await createUser({ roleCode: 'PROFESSOR' });

        const deactivated = valueOf(await facade.deactivateUser({ userId: created.id }));

        expect(deactivated.active).toBe(false);
        expect(deactivated.roleCodes).toEqual(['PROFESSOR']);
        expect(await prisma.userRole.count({ where: { userId: created.id } })).toBe(1);
      });

      it('o e-mail permanece ocupado depois da desativação', async () => {
        const created = await createUser({ email: 'inativo@exemplo.edu.br' });
        await facade.deactivateUser({ userId: created.id });

        const result = await facade.createUser(aUser({ email: 'inativo@exemplo.edu.br' }));

        expect(failureOf(result).code).toBe('EMAIL_ALREADY_REGISTERED');
      });

      it('a desativação não remove a conta', async () => {
        const created = await createUser();
        await facade.deactivateUser({ userId: created.id });

        expect(await prisma.user.findUnique({ where: { id: created.id } })).not.toBeNull();
      });

      it('a reativação devolve a conta ao estado ativo', async () => {
        const created = await createUser();
        await facade.deactivateUser({ userId: created.id });

        expect(valueOf(await facade.activateUser({ userId: created.id })).active).toBe(true);
      });

      it('conta inexistente: recurso não encontrado', async () => {
        const result = await facade.deactivateUser({
          userId: '01930000-0000-7000-8000-00000000dead',
        });

        expect(failureOf(result).code).toBe('RESOURCE_NOT_FOUND');
      });
    });

    describe('vínculo institucional', () => {
      it('conta com vínculo: o vínculo é devolvido nas consultas', async () => {
        const institutionId = '01930000-0000-7000-8000-0000000000aa';
        const created = await createUser({ institutionId });

        expect(created.institutionId).toBe(institutionId);
        expect(
          valueOf(await facade.findOwnProfile({ actorId: created.id, userId: created.id }))
            .institutionId,
        ).toBe(institutionId);
      });

      it('administrador de sistema pode existir sem vínculo', async () => {
        const created = await createUser({ roleCode: 'SYSTEM_ADMIN', institutionId: null });

        expect(created.institutionId).toBeNull();
        expect(created.roleCodes).toEqual(['SYSTEM_ADMIN']);
      });

      it('conta de outro papel sem vínculo: falha de validação', async () => {
        for (const roleCode of ['INSTITUTION_ADMIN', 'COORDINATOR', 'PROFESSOR', 'STUDENT']) {
          const result = await facade.createUser(aUser({ roleCode, institutionId: null }));
          const failure = failureOf(result);

          expect(failure.code).toBe('VALIDATION_FAILED');
          expect(failure.fields).toContainEqual({ field: 'institutionId', code: 'REQUIRED' });
        }
      });
    });

    describe('consulta do perfil próprio', () => {
      it('o titular recebe nome, e-mail, área, idioma, estado, papéis e vínculo', async () => {
        const created = await createUser({
          roleCode: 'PROFESSOR',
          expertiseArea: 'Engenharia de Software',
          preferredLanguage: DEFAULT_LANGUAGE,
        });

        const profile = valueOf(
          await facade.findOwnProfile({ actorId: created.id, userId: created.id }),
        );

        expect(profile).toEqual({
          id: created.id,
          email: created.email,
          name: created.name,
          expertiseArea: 'Engenharia de Software',
          preferredLanguage: DEFAULT_LANGUAGE,
          active: true,
          institutionId: created.institutionId,
          roleCodes: ['PROFESSOR'],
        });
      });

      it('área e preferência nunca informadas vêm ausentes, e não como texto vazio', async () => {
        const created = await createUser();

        const profile = valueOf(
          await facade.findOwnProfile({ actorId: created.id, userId: created.id }),
        );

        expect(profile.expertiseArea).toBeNull();
        expect(profile.preferredLanguage).toBeNull();
      });

      it('consulta sobre conta de terceiro é recusada', async () => {
        const owner = await createUser();
        const other = await createUser();

        const result = await facade.findOwnProfile({ actorId: other.id, userId: owner.id });

        expect(failureOf(result).code).toBe('PERMISSION_DENIED');
      });
    });

    describe('atualização do perfil próprio', () => {
      it('alteração aceita persiste e é refletida na consulta seguinte', async () => {
        const created = await createUser();

        const updated = valueOf(
          await facade.updateOwnProfile({
            actorId: created.id,
            userId: created.id,
            name: 'Ana Paula',
            expertiseArea: 'Direito Digital',
          }),
        );

        expect(updated.name).toBe('Ana Paula');

        const reread = valueOf(
          await facade.findOwnProfile({ actorId: created.id, userId: created.id }),
        );

        expect(reread.name).toBe('Ana Paula');
        expect(reread.expertiseArea).toBe('Direito Digital');
      });

      it('tentativa de alterar o próprio e-mail é recusada, e nada é alterado', async () => {
        const created = await createUser({ name: 'Original' });

        const result = await facade.updateOwnProfile({
          actorId: created.id,
          userId: created.id,
          name: 'Alterado',
          email: 'outro@exemplo.edu.br',
        });

        expect(failureOf(result).code).toBe('PERMISSION_DENIED');

        const reread = valueOf(
          await facade.findOwnProfile({ actorId: created.id, userId: created.id }),
        );

        expect(reread.name).toBe('Original');
        expect(reread.email).toBe(created.email);
      });

      it('tentativa de alterar os próprios papéis ou vínculos é recusada', async () => {
        const created = await createUser();

        for (const forbidden of [
          { roleCode: 'PROFESSOR' },
          { institutionId: '01930000-0000-7000-8000-0000000000bb' },
          { active: false },
        ]) {
          const result = await facade.updateOwnProfile({
            actorId: created.id,
            userId: created.id,
            ...forbidden,
          });

          expect(failureOf(result).code).toBe('PERMISSION_DENIED');
        }

        const reread = valueOf(
          await facade.findOwnProfile({ actorId: created.id, userId: created.id }),
        );

        expect(reread.roleCodes).toEqual(['STUDENT']);
        expect(reread.active).toBe(true);
      });

      it('dado inválido: um item por campo, sem o valor submetido', async () => {
        const created = await createUser();
        const submitted = 'a'.repeat(NAME_MAX_LENGTH + 1);

        const result = await facade.updateOwnProfile({
          actorId: created.id,
          userId: created.id,
          name: submitted,
        });
        const failure = failureOf(result);

        expect(failure.code).toBe('VALIDATION_FAILED');
        expect(failure.fields).toEqual([{ field: 'name', code: 'TOO_LONG' }]);
        expect(JSON.stringify(failure)).not.toContain(submitted);
      });

      it('nome vazio é recusado', async () => {
        const created = await createUser();

        const result = await facade.updateOwnProfile({
          actorId: created.id,
          userId: created.id,
          name: '   ',
        });

        expect(failureOf(result).fields).toEqual([{ field: 'name', code: 'REQUIRED' }]);
      });

      it('alteração sobre conta de terceiro é recusada', async () => {
        const owner = await createUser({ name: 'Dona' });
        const other = await createUser();

        const result = await facade.updateOwnProfile({
          actorId: other.id,
          userId: owner.id,
          name: 'Invasor',
        });

        expect(failureOf(result).code).toBe('PERMISSION_DENIED');
        expect(
          valueOf(await facade.findOwnProfile({ actorId: owner.id, userId: owner.id })).name,
        ).toBe('Dona');
      });
    });

    describe('preferência de idioma', () => {
      it('preferência suportada é persistida e devolvida', async () => {
        const created = await createUser();

        valueOf(
          await facade.updateOwnProfile({
            actorId: created.id,
            userId: created.id,
            preferredLanguage: DEFAULT_LANGUAGE,
          }),
        );

        expect(
          valueOf(await facade.findOwnProfile({ actorId: created.id, userId: created.id }))
            .preferredLanguage,
        ).toBe(DEFAULT_LANGUAGE);
      });

      it('idioma não suportado falha e a preferência anterior permanece', async () => {
        const created = await createUser();
        await facade.updateOwnProfile({
          actorId: created.id,
          userId: created.id,
          preferredLanguage: DEFAULT_LANGUAGE,
        });

        const result = await facade.updateOwnProfile({
          actorId: created.id,
          userId: created.id,
          preferredLanguage: 'xx-YY',
        });

        expect(failureOf(result).code).toBe('LANGUAGE_NOT_SUPPORTED');
        expect(
          valueOf(await facade.findOwnProfile({ actorId: created.id, userId: created.id }))
            .preferredLanguage,
        ).toBe(DEFAULT_LANGUAGE);
      });

      it('a remoção devolve o perfil ao estado sem preferência registrada', async () => {
        const created = await createUser({ preferredLanguage: DEFAULT_LANGUAGE });

        valueOf(
          await facade.updateOwnProfile({
            actorId: created.id,
            userId: created.id,
            preferredLanguage: null,
          }),
        );

        expect(
          valueOf(await facade.findOwnProfile({ actorId: created.id, userId: created.id }))
            .preferredLanguage,
        ).toBeNull();
      });

      it('idioma não suportado na criação também é recusado', async () => {
        const result = await facade.createUser(aUser({ preferredLanguage: 'xx-YY' }));

        expect(failureOf(result).code).toBe('LANGUAGE_NOT_SUPPORTED');
      });
    });
  });

  describe('conta inicial de administrador de sistema', () => {
    it('primeira carga: passa a existir conta ativa de SYSTEM_ADMIN sem credencial', async () => {
      const report = await AccessModule.seed(moduleRef);

      expect(report.systemAdmin.created).toBe(true);

      const stored = await prisma.user.findUnique({
        where: { email: INITIAL_SYSTEM_ADMIN.email },
        select: { id: true, active: true, institutionId: true, roles: true },
      });

      expect(stored?.active).toBe(true);
      expect(stored?.institutionId).toBeNull();
      expect(stored?.roles).toHaveLength(1);
      expect(stored?.id).toBe(report.systemAdmin.id);
    });

    it('a conta inicial tem o papel SYSTEM_ADMIN', async () => {
      const report = await AccessModule.seed(moduleRef);

      const { permissions } = await facade.effectivePermissions({ userId: report.systemAdmin.id });

      expect([...permissions].sort()).toEqual([...permissionsOf('SYSTEM_ADMIN')].sort());
    });

    it('reexecução: uma única conta inicial, com o mesmo identificador', async () => {
      const first = await AccessModule.seed(moduleRef);
      const second = await AccessModule.seed(moduleRef);

      expect(second.systemAdmin.created).toBe(false);
      expect(second.systemAdmin.id).toBe(first.systemAdmin.id);
      expect(await prisma.user.count({ where: { email: INITIAL_SYSTEM_ADMIN.email } })).toBe(1);
      expect(await prisma.user.count()).toBe(1);
    });
  });

  describe('ausência de superfície administrativa e de autocadastro', () => {
    it('o catálogo de permissões não contém permissão sobre o recurso de usuário', () => {
      const aboutUser = DECLARED.permissions.filter((code) => code.startsWith('USER:'));

      expect(aboutUser).toEqual([]);
    });

    it('o módulo não tem camada de apresentação, e portanto não publica rota', () => {
      // A ausência do diretório é a verificação: rota só existe em `presentation/`
      // (ADR-0003 §3), e é ali que a análise de fronteiras a procura.
      expect(readdirSync(join('src', 'modules', 'access'))).not.toContain('presentation');
    });

    it('a fachada não expõe operação que liste ou remova conta de terceiro', () => {
      for (const name of surfaceOf(facade)) {
        expect(name).not.toMatch(/^(list|delete|remove|findAll|search)/i);
      }
    });

    it('a fachada não expõe autocadastro que atribua papel administrativo', () => {
      const surface = surfaceOf(facade);

      expect(surface).not.toContain('register');
      expect(surface).not.toContain('signUp');
      // `createUser` existe, mas é operação de consumidor interno: não há rota que a
      // alcance, e o catálogo acima não tem permissão que a autorize.
      expect(surface).toContain('createUser');
    });
  });

  describe('atribuição e revogação de papel', () => {
    beforeEach(async () => {
      await AccessModule.seed(moduleRef);
    });

    it('atribuição nova: a conta passa a possuir o papel', async () => {
      const actor = await createUser();
      const subject = await createUser();

      valueOf(
        await facade.assignRole({
          actorId: actor.id,
          userId: subject.id,
          roleCode: 'PROFESSOR',
        }),
      );

      const profile = valueOf(
        await facade.findOwnProfile({ actorId: subject.id, userId: subject.id }),
      );

      expect([...profile.roleCodes].sort()).toEqual(['PROFESSOR', 'STUDENT']);
    });

    it('atribuição repetida: sucesso, e um único vínculo', async () => {
      const subject = await createUser();

      valueOf(await facade.assignRole({ userId: subject.id, roleCode: 'PROFESSOR' }));
      valueOf(await facade.assignRole({ userId: subject.id, roleCode: 'PROFESSOR' }));

      expect(await prisma.userRole.count({ where: { userId: subject.id } })).toBe(2);
    });

    it('papel desconhecido: recurso não encontrado', async () => {
      const subject = await createUser();

      const result = await facade.assignRole({ userId: subject.id, roleCode: 'AUDITOR' });

      expect(failureOf(result).code).toBe('RESOURCE_NOT_FOUND');
    });

    it('conta inexistente: recurso não encontrado', async () => {
      const result = await facade.assignRole({
        userId: '01930000-0000-7000-8000-00000000dead',
        roleCode: 'PROFESSOR',
      });

      expect(failureOf(result).code).toBe('RESOURCE_NOT_FOUND');
    });

    it('conta inativa: recurso não encontrado', async () => {
      const subject = await createUser();
      await facade.deactivateUser({ userId: subject.id });

      const result = await facade.assignRole({ userId: subject.id, roleCode: 'PROFESSOR' });

      expect(failureOf(result).code).toBe('RESOURCE_NOT_FOUND');
    });

    it('revogação de papel possuído: a conta deixa de possuí-lo', async () => {
      const subject = await createUser();
      await facade.assignRole({ userId: subject.id, roleCode: 'PROFESSOR' });

      valueOf(await facade.revokeRole({ userId: subject.id, roleCode: 'PROFESSOR' }));

      const profile = valueOf(
        await facade.findOwnProfile({ actorId: subject.id, userId: subject.id }),
      );

      expect(profile.roleCodes).toEqual(['STUDENT']);
    });

    it('revogação de papel não possuído: sucesso, e nada é alterado', async () => {
      const subject = await createUser();

      valueOf(await facade.revokeRole({ userId: subject.id, roleCode: 'COORDINATOR' }));

      expect(await prisma.userRole.count({ where: { userId: subject.id } })).toBe(1);
    });

    it('efeito imediato: a apuração seguinte já não tem as permissões do papel revogado', async () => {
      const subject = await createUser({ roleCode: 'PROFESSOR' });

      const before = await facade.effectivePermissions({ userId: subject.id });

      expect(before.permissions).toContain('REMARK:CREATE');

      valueOf(await facade.revokeRole({ userId: subject.id, roleCode: 'PROFESSOR' }));

      const after = await facade.effectivePermissions({ userId: subject.id });

      expect(after.permissions).not.toContain('REMARK:CREATE');
      expect(after.permissions).toEqual([]);
    });
  });

  describe('trilha de auditoria', () => {
    beforeEach(async () => {
      await AccessModule.seed(moduleRef);
    });

    it('atribuição registrada com ator, conta afetada, papel, operação e instante', async () => {
      const actor = await createUser();
      const subject = await createUser();

      await facade.assignRole({ actorId: actor.id, userId: subject.id, roleCode: 'PROFESSOR' });

      const trail = await prisma.roleAssignmentAudit.findMany({
        where: { subjectId: subject.id },
        orderBy: { createdAt: 'asc' },
      });

      // O primeiro registro é o da criação da conta, que atribui o papel inicial.
      expect(trail).toHaveLength(2);
      expect(trail[1]).toMatchObject({
        actorId: actor.id,
        subjectId: subject.id,
        roleCode: 'PROFESSOR',
        operation: 'ASSIGNED',
      });
      expect(trail[1]?.createdAt).toBeInstanceOf(Date);
    });

    it('revogação registrada', async () => {
      const actor = await createUser();
      const subject = await createUser({ roleCode: 'PROFESSOR' });

      await facade.revokeRole({ actorId: actor.id, userId: subject.id, roleCode: 'PROFESSOR' });

      const trail = await prisma.roleAssignmentAudit.findMany({
        where: { subjectId: subject.id, operation: 'REVOKED' },
      });

      expect(trail).toHaveLength(1);
      expect(trail[0]).toMatchObject({ actorId: actor.id, roleCode: 'PROFESSOR' });
    });

    it('a trilha da atribuição permanece depois da revogação', async () => {
      const subject = await createUser({ roleCode: 'COORDINATOR' });

      await facade.revokeRole({ userId: subject.id, roleCode: 'COORDINATOR' });

      const trail = await prisma.roleAssignmentAudit.findMany({
        where: { subjectId: subject.id },
        orderBy: { createdAt: 'asc' },
      });

      expect(trail.map((entry) => entry.operation)).toEqual(['ASSIGNED', 'REVOKED']);
      expect(await prisma.userRole.count({ where: { userId: subject.id } })).toBe(0);
    });

    it('operação idempotente não acrescenta registro', async () => {
      const subject = await createUser({ roleCode: 'PROFESSOR' });
      const before = await prisma.roleAssignmentAudit.count({ where: { subjectId: subject.id } });

      await facade.assignRole({ userId: subject.id, roleCode: 'PROFESSOR' });
      await facade.revokeRole({ userId: subject.id, roleCode: 'STUDENT' });

      expect(await prisma.roleAssignmentAudit.count({ where: { subjectId: subject.id } })).toBe(
        before,
      );
    });

    it('a carga inicial registra a atribuição sem ator', async () => {
      const report = await AccessModule.seed(moduleRef);

      const trail = await prisma.roleAssignmentAudit.findMany({
        where: { subjectId: report.systemAdmin.id },
      });

      expect(trail).toHaveLength(1);
      expect(trail[0]?.actorId).toBeNull();
      expect(trail[0]?.roleCode).toBe('SYSTEM_ADMIN');
    });

    it('nenhuma escrita destrutiva alcança a trilha', async () => {
      // A ausência de método no repositório é promessa de tipo, e some na primeira
      // conversão. O que a torna verificável é observar quais operações de fato
      // alcançaram o model (ADR-0014 §18, ADR-0027 §5).
      const log = createOperationLog(prisma);
      const logged = await Test.createTestingModule({
        imports: [AccessModule.forRoot(log.client, redis)],
      }).compile();

      try {
        const loggedFacade = logged.get(AccessFacade);

        await AccessModule.seed(logged);
        log.reset();

        const subject = valueOf(await loggedFacade.createUser(aUser()));
        await loggedFacade.assignRole({ userId: subject.id, roleCode: 'PROFESSOR' });
        await loggedFacade.revokeRole({ userId: subject.id, roleCode: 'PROFESSOR' });
        await loggedFacade.deactivateUser({ userId: subject.id });

        const touched = log.against('RoleAssignmentAudit');

        expect(touched.length).toBeGreaterThan(0);
        expect(touched).not.toContain('update');
        expect(touched).not.toContain('updateMany');
        expect(touched).not.toContain('delete');
        expect(touched).not.toContain('deleteMany');
        expect(touched).not.toContain('upsert');
        expect([...new Set(touched)].sort()).toEqual(['create']);
      } finally {
        await logged.close();
      }
    });
  });

  describe('resolução das permissões efetivas', () => {
    beforeEach(async () => {
      await AccessModule.seed(moduleRef);
    });

    it('conta com um papel: exatamente as permissões declaradas para ele', async () => {
      const subject = await createUser({ roleCode: 'STUDENT' });

      const { permissions } = await facade.effectivePermissions({ userId: subject.id });

      expect([...permissions].sort()).toEqual([...permissionsOf('STUDENT')].sort());
    });

    it('conta com papéis múltiplos: a união, cada permissão uma única vez', async () => {
      const subject = await createUser({ roleCode: 'PROFESSOR' });
      await facade.assignRole({ userId: subject.id, roleCode: 'COORDINATOR' });

      const { permissions } = await facade.effectivePermissions({ userId: subject.id });
      const expected = new Set([...permissionsOf('PROFESSOR'), ...permissionsOf('COORDINATOR')]);

      expect(permissions).toHaveLength(expected.size);
      expect([...permissions].sort()).toEqual([...expected].sort());
    });

    it('conta sem papel: conjunto vazio', async () => {
      const subject = await createUser({ roleCode: 'STUDENT' });
      await facade.revokeRole({ userId: subject.id, roleCode: 'STUDENT' });

      expect((await facade.effectivePermissions({ userId: subject.id })).permissions).toEqual([]);
    });

    it('conta inativa: conjunto vazio, quaisquer que sejam os papéis', async () => {
      const subject = await createUser({ roleCode: 'PROFESSOR' });
      await facade.deactivateUser({ userId: subject.id });

      expect((await facade.effectivePermissions({ userId: subject.id })).permissions).toEqual([]);
    });

    it('conta inexistente: conjunto vazio, e a apuração não falha', async () => {
      const { permissions } = await facade.effectivePermissions({
        userId: '01930000-0000-7000-8000-00000000dead',
      });

      expect(permissions).toEqual([]);
    });
  });

  describe('cache das permissões efetivas', () => {
    beforeEach(async () => {
      await AccessModule.seed(moduleRef);
    });

    it('apuração repetida: mesmo resultado, e a segunda não consulta o banco', async () => {
      const counter = createQueryCounter(prisma);
      const counted = await Test.createTestingModule({
        imports: [AccessModule.forRoot(counter.client, redis)],
      }).compile();

      try {
        const countedFacade = counted.get(AccessFacade);
        const subject = valueOf(await countedFacade.createUser(aUser({ roleCode: 'PROFESSOR' })));

        const first = await countedFacade.effectivePermissions({ userId: subject.id });

        counter.reset();
        const second = await countedFacade.effectivePermissions({ userId: subject.id });

        expect(second.permissions).toEqual(first.permissions);
        expect(counter.count()).toBe(0);
      } finally {
        await counted.close();
      }
    });

    it('invalidação por revogação: a apuração seguinte reflete a revogação', async () => {
      const subject = await createUser({ roleCode: 'PROFESSOR' });
      await facade.effectivePermissions({ userId: subject.id });

      await facade.revokeRole({ userId: subject.id, roleCode: 'PROFESSOR' });

      expect((await facade.effectivePermissions({ userId: subject.id })).permissions).toEqual([]);
    });

    it('invalidação por atribuição: a apuração seguinte reflete a atribuição', async () => {
      const subject = await createUser({ roleCode: 'STUDENT' });
      await facade.effectivePermissions({ userId: subject.id });

      await facade.assignRole({ userId: subject.id, roleCode: 'COORDINATOR' });

      const { permissions } = await facade.effectivePermissions({ userId: subject.id });

      expect(permissions).toContain('COHORT:CREATE');
    });

    it('invalidação por desativação: a apuração seguinte devolve conjunto vazio', async () => {
      const subject = await createUser({ roleCode: 'PROFESSOR' });

      expect(
        (await facade.effectivePermissions({ userId: subject.id })).permissions.length,
      ).toBeGreaterThan(0);

      await facade.deactivateUser({ userId: subject.id });

      expect((await facade.effectivePermissions({ userId: subject.id })).permissions).toEqual([]);
    });

    it('a reativação devolve as permissões', async () => {
      const subject = await createUser({ roleCode: 'PROFESSOR' });
      await facade.deactivateUser({ userId: subject.id });
      await facade.effectivePermissions({ userId: subject.id });

      await facade.activateUser({ userId: subject.id });

      expect(
        (await facade.effectivePermissions({ userId: subject.id })).permissions.length,
      ).toBeGreaterThan(0);
    });

    it('cache indisponível: a apuração falha, e nada é concedido', async () => {
      const subject = await createUser({ roleCode: 'PROFESSOR' });

      // `enableOfflineQueue: false` é o que faz o comando falhar em vez de esperar pela
      // reconexão: ADR-0013 §16 quer negativa, não espera.
      const unreachable = new Redis({
        host: '127.0.0.1',
        port: 1,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        lazyConnect: true,
      });
      unreachable.on('error', () => undefined);

      const degraded = await Test.createTestingModule({
        imports: [AccessModule.forRoot(prisma, unreachable)],
      }).compile();

      try {
        await expect(
          degraded.get(AccessFacade).effectivePermissions({ userId: subject.id }),
        ).rejects.toThrow();
      } finally {
        await degraded.close();
        unreachable.disconnect();
      }
    });
  });

  describe('invariância da contagem de consultas', () => {
    it('resolve N papéis no mesmo número de consultas que um só', async () => {
      await AccessModule.seed(moduleRef);

      const counter = createQueryCounter(prisma);
      const counted = await Test.createTestingModule({
        imports: [AccessModule.forRoot(counter.client, redis)],
      }).compile();

      try {
        const countedFacade = counted.get(AccessFacade);

        counter.reset();
        await countedFacade.permissionsOfRoles({ roleCodes: ['STUDENT'] });
        const forOne = counter.count();

        counter.reset();
        await countedFacade.permissionsOfRoles({
          roleCodes: DECLARED.roles.map((role) => role.code),
        });

        expect(counter.count()).toBe(forOne);
        expect(forOne).toBeGreaterThan(0);
      } finally {
        await counted.close();
      }
    });

    it('apura as permissões efetivas sem consulta por papel nem por permissão', async () => {
      await AccessModule.seed(moduleRef);

      const counter = createQueryCounter(prisma);
      const counted = await Test.createTestingModule({
        imports: [AccessModule.forRoot(counter.client, redis)],
      }).compile();

      try {
        const countedFacade = counted.get(AccessFacade);

        const one = valueOf(await countedFacade.createUser(aUser({ roleCode: 'STUDENT' })));
        const many = valueOf(await countedFacade.createUser(aUser({ roleCode: 'STUDENT' })));

        for (const roleCode of ['PROFESSOR', 'COORDINATOR', 'INSTITUTION_ADMIN']) {
          await countedFacade.assignRole({ userId: many.id, roleCode });
        }

        counter.reset();
        await countedFacade.effectivePermissions({ userId: one.id });
        const forOneRole = counter.count();

        counter.reset();
        await countedFacade.effectivePermissions({ userId: many.id });

        expect(counter.count()).toBe(forOneRole);
        expect(forOneRole).toBeGreaterThan(0);
      } finally {
        await counted.close();
      }
    });
  });
});
