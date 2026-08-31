import { describe, expect, it } from 'vitest';

import {
  assertCatalogIsValid,
  DECLARED_CATALOG,
  InvalidCatalogError,
  type CatalogDeclaration,
} from './catalog';
import { violationOfPermissionCode } from './permission-code';
import { PERMISSION_CODES } from './permission-catalog';
import { ROLE, ROLE_CODES, ROLE_COMPOSITION } from './role-catalog';

/** O catálogo da URS §2.3 tem 98 permissões; a divergência precisa reprovar o build. */
const URS_PERMISSION_COUNT = 98;

function withRoles(roles: CatalogDeclaration['roles']): CatalogDeclaration {
  return { permissions: DECLARED_CATALOG.permissions, roles };
}

describe('catálogo declarado', () => {
  it('declara as 98 permissões da URS §2.3, sem repetição', () => {
    expect(PERMISSION_CODES).toHaveLength(URS_PERMISSION_COUNT);
    expect(new Set(PERMISSION_CODES).size).toBe(URS_PERMISSION_COUNT);
  });

  it('declara toda permissão no formato RECURSO:ACAO', () => {
    const malformed = PERMISSION_CODES.filter((code) => violationOfPermissionCode(code) !== null);

    expect(malformed).toEqual([]);
  });

  it('declara exatamente os cinco papéis da URS §1.4', () => {
    expect([...ROLE_CODES]).toEqual([
      'SYSTEM_ADMIN',
      'INSTITUTION_ADMIN',
      'COORDINATOR',
      'PROFESSOR',
      'STUDENT',
    ]);
  });

  it('compõe todo papel apenas com permissões do catálogo', () => {
    const known = new Set<string>(PERMISSION_CODES);

    for (const role of ROLE_CODES) {
      const unknown = ROLE_COMPOSITION[role].filter((code) => !known.has(code));

      expect({ role, unknown }).toEqual({ role, unknown: [] });
    }
  });

  it('enumera a composição sem repetição e sem curinga', () => {
    for (const role of ROLE_CODES) {
      const composition = ROLE_COMPOSITION[role];

      expect(new Set(composition).size).toBe(composition.length);
      expect(composition.filter((code) => code.includes('*'))).toEqual([]);
    }
  });

  it('aprova o catálogo deste repositório', () => {
    expect(() => {
      assertCatalogIsValid(DECLARED_CATALOG);
    }).not.toThrow();
  });
});

describe('validação da declaração', () => {
  it('reprova permissão com curinga, identificando-a', () => {
    const catalog: CatalogDeclaration = {
      permissions: [...DECLARED_CATALOG.permissions, 'COURSE:*'],
      roles: DECLARED_CATALOG.roles,
    };

    expect(() => {
      assertCatalogIsValid(catalog);
    }).toThrow(/COURSE:\*/);
  });

  it('reprova permissão fora do formato, identificando-a', () => {
    for (const malformed of ['COURSECREATE', 'course:create', 'COURSES:CREATE']) {
      const catalog: CatalogDeclaration = {
        permissions: [...DECLARED_CATALOG.permissions, malformed],
        roles: DECLARED_CATALOG.roles,
      };

      expect(() => {
        assertCatalogIsValid(catalog);
      }).toThrow(new RegExp(malformed.replace(':', ':')));
    }
  });

  it('reprova papel que referencia permissão inexistente, identificando os dois', () => {
    const catalog = withRoles([
      ...DECLARED_CATALOG.roles.filter((role) => role.code !== ROLE.STUDENT),
      { code: ROLE.STUDENT, permissions: ['ARTICLE:INVENT'] },
    ]);

    expect(() => {
      assertCatalogIsValid(catalog);
    }).toThrow(/STUDENT.*ARTICLE:INVENT/s);
  });

  it('reprova papel fora dos cinco da URS §1.4', () => {
    const catalog = withRoles([...DECLARED_CATALOG.roles, { code: 'AUDITOR', permissions: [] }]);

    expect(() => {
      assertCatalogIsValid(catalog);
    }).toThrow(/AUDITOR/);
  });

  it('reprova a ausência de um dos cinco papéis', () => {
    const catalog = withRoles(DECLARED_CATALOG.roles.filter((role) => role.code !== ROLE.STUDENT));

    expect(() => {
      assertCatalogIsValid(catalog);
    }).toThrow(/STUDENT/);
  });

  it('relata todos os problemas, e não apenas o primeiro', () => {
    const catalog: CatalogDeclaration = {
      permissions: ['COURSE:*', 'course:create'],
      roles: [{ code: 'AUDITOR', permissions: [] }],
    };

    try {
      assertCatalogIsValid(catalog);
      expect.unreachable('a declaração inválida deveria ter reprovado');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(InvalidCatalogError);
      expect((error as InvalidCatalogError).problems.length).toBeGreaterThan(5);
    }
  });
});
