import { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  createInstitutionPrisma,
  isOwnedModel,
  OWNED_MODELS,
  type InstitutionPrisma,
} from './institution-prisma';

/**
 * O que este arquivo verifica é `ADR-0028` §17 — o módulo atribui papel **pela fachada**,
 * e não escrevendo em tabela do `access`.
 *
 * A promessa não é de disciplina: é de tipo em compilação e de gancho em execução. Um
 * `INSERT` em `access.user_role` a partir daqui não compila e, se compilasse, não roda.
 */
describe('cliente Prisma escopado ao módulo `institution`', () => {
  it('não expõe model de outro módulo em tempo de compilação', () => {
    // `user` pertence ao módulo `access` (`ADR-0027` §5). Se ele passar a constar do tipo
    // do cliente escopado, o tipo abaixo vira `never` e a compilação reprova
    // (`ADR-0010` §4, §5).
    const absent: 'user' extends keyof InstitutionPrisma ? never : true = true;
    const auditAbsent: 'roleAssignmentAudit' extends keyof InstitutionPrisma ? never : true = true;

    expect(absent).toBe(true);
    expect(auditAbsent).toBe(true);
  });

  it('expõe exatamente os models próprios em execução', () => {
    const scoped = createInstitutionPrisma(new PrismaClient());

    expect(Object.keys(scoped).sort()).toEqual([...OWNED_MODELS, 'transaction'].sort());
    expect('user' in scoped).toBe(false);
    expect('userRole' in scoped).toBe(false);
  });

  it('reconhece como próprios apenas os models do módulo', () => {
    for (const model of ['Institution', 'InstitutionAdmin', 'institution', 'institutionAdmin']) {
      expect(isOwnedModel(model)).toBe(true);
    }

    for (const model of [
      'User',
      'UserRole',
      'Role',
      'Permission',
      'RolePermission',
      'PasswordCredential',
      'Invitation',
      'RoleAssignmentAudit',
      'AssinaturaErro',
    ]) {
      expect(isOwnedModel(model)).toBe(false);
    }
  });
});
