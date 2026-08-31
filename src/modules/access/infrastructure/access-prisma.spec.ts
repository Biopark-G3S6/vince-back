import { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { createAccessPrisma, isOwnedModel, OWNED_MODELS, type AccessPrisma } from './access-prisma';

describe('cliente Prisma escopado ao módulo `access`', () => {
  it('não expõe model de outro módulo em tempo de compilação', () => {
    // `assinaturaErro` pertence ao módulo `observabilidade`. Se ele passar a constar do
    // tipo do cliente escopado, o tipo abaixo vira `never` e a compilação reprova
    // (ADR-0010 §4, §5).
    const absent: 'assinaturaErro' extends keyof AccessPrisma ? never : true = true;

    expect(absent).toBe(true);
  });

  it('expõe exatamente os três models próprios em execução', () => {
    const scoped = createAccessPrisma(new PrismaClient());

    expect(Object.keys(scoped).sort()).toEqual([...OWNED_MODELS, 'transaction'].sort());
    expect('assinaturaErro' in scoped).toBe(false);
  });

  it('reconhece como próprios apenas os models do módulo', () => {
    for (const model of ['Permission', 'Role', 'RolePermission', 'permission', 'rolePermission']) {
      expect(isOwnedModel(model)).toBe(true);
    }

    for (const model of ['AssinaturaErro', 'assinaturaErro', 'User']) {
      expect(isOwnedModel(model)).toBe(false);
    }
  });
});
