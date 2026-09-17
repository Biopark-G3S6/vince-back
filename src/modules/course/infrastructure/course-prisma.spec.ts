import { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { createCoursePrisma, isOwnedModel, OWNED_MODELS, type CoursePrisma } from './course-prisma';

describe('cliente Prisma escopado ao módulo course', () => {
  it('não expõe models de outros módulos no tipo', () => {
    const absent: 'user' extends keyof CoursePrisma ? never : true = true;
    const institutionAbsent: 'institution' extends keyof CoursePrisma ? never : true = true;

    expect(absent).toBe(true);
    expect(institutionAbsent).toBe(true);
  });

  it('expõe somente os models próprios e a transação', () => {
    const scoped = createCoursePrisma(new PrismaClient());

    expect(Object.keys(scoped).sort()).toEqual([...OWNED_MODELS, 'transaction'].sort());
    expect('user' in scoped).toBe(false);
    expect('institution' in scoped).toBe(false);
  });

  it('recusa model de outro módulo', () => {
    expect(isOwnedModel('Course')).toBe(true);
    expect(isOwnedModel('CourseCoordinator')).toBe(true);
    expect(isOwnedModel('CourseCoordinatorAudit')).toBe(true);
    expect(isOwnedModel('User')).toBe(false);
    expect(isOwnedModel('Institution')).toBe(false);
    expect(isOwnedModel('AssinaturaErro')).toBe(false);
  });
});
