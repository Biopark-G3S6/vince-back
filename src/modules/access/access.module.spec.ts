import { PrismaClient } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AccessModule } from './access.module';
import { AccessFacade } from './contracts/access.facade';
import type { CatalogDeclaration } from './domain/catalog';
import { createQueryCounter } from './infrastructure/query-counter';

/**
 * Teste do módulo pela sua fachada (ADR-0024 §2): o interno — repositório, caso de uso,
 * cliente Prisma — é real, contra PostgreSQL real (§3, §9). A carga inicial entra pelo
 * método estático do módulo, que é a única via que ela tem (ADR-0027 §21).
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

describe('módulo access', () => {
  let prisma: PrismaClient;
  let moduleRef: TestingModule;
  let facade: AccessFacade;

  beforeAll(async () => {
    prisma = new PrismaClient();
    moduleRef = await Test.createTestingModule({
      imports: [AccessModule.forRoot(prisma)],
    }).compile();
    facade = moduleRef.get(AccessFacade);
  });

  afterAll(async () => {
    await moduleRef.close();
    await prisma.$disconnect();
  });

  describe('carga inicial', () => {
    it('primeira execução: cria as permissões, os cinco papéis e a composição', async () => {
      const report = await AccessModule.seed(moduleRef);

      expect(report).toEqual({
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

      expect(report).toEqual({
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

      expect(report.grantsRemoved).toBe(1);
      expect(report.grantsCreated).toBe(0);

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

  describe('invariância da contagem de consultas', () => {
    it('resolve N papéis no mesmo número de consultas que um só', async () => {
      await AccessModule.seed(moduleRef);

      const counter = createQueryCounter(prisma);
      const counted = await Test.createTestingModule({
        imports: [AccessModule.forRoot(counter.client)],
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
  });
});
