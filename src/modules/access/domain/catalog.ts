import { describePermissionShapeViolation, violationOfPermissionCode } from './permission-code';
import { PERMISSION_CODES } from './permission-catalog';
import { ROLE_CODES, ROLE_COMPOSITION } from './role-catalog';

/**
 * O catálogo declarado: o que o repositório afirma que o sistema reconhece.
 *
 * É a declaração única de ADR-0027 §17. A carga inicial o grava, os testes o conferem
 * e o comando de conferência o confronta com a URS §2.3 e §2.3.1.
 *
 * Os tipos abaixo usam `string`, e não os tipos estreitos de `permission-catalog` e
 * `role-catalog`, porque a validação precisa poder receber declaração inválida — é
 * disso que ela protege.
 */

export interface RoleDeclaration {
  readonly code: string;
  readonly permissions: readonly string[];
}

export interface CatalogDeclaration {
  readonly permissions: readonly string[];
  readonly roles: readonly RoleDeclaration[];
}

/** Declaração inválida. Carrega todos os problemas encontrados, não apenas o primeiro. */
export class InvalidCatalogError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Catálogo de acesso inválido:\n  ${problems.join('\n  ')}`);
    this.name = 'InvalidCatalogError';
  }
}

/**
 * Os papéis que o sistema reconhece, conforme a URS §1.4. Papel fora desta lista
 * reprova a carga (ADR-0027 §15, §16).
 */
const DECLARED_ROLE_CODES: readonly string[] = ROLE_CODES;

function collectProblems(catalog: CatalogDeclaration): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const code of catalog.permissions) {
    const violation = violationOfPermissionCode(code);

    if (violation !== null) {
      problems.push(`permissão \`${code}\` ${describePermissionShapeViolation(violation)}`);
      continue;
    }

    if (seen.has(code)) {
      problems.push(`permissão \`${code}\` está declarada mais de uma vez`);
    }

    seen.add(code);
  }

  const expected = new Set(DECLARED_ROLE_CODES);
  const declared = new Set<string>();

  for (const role of catalog.roles) {
    if (!expected.has(role.code)) {
      problems.push(
        `papel \`${role.code}\` não é um dos cinco papéis da URS §1.4: ` +
          DECLARED_ROLE_CODES.join(', '),
      );
    }

    if (declared.has(role.code)) {
      problems.push(`papel \`${role.code}\` está declarado mais de uma vez`);
    }

    declared.add(role.code);

    for (const code of role.permissions) {
      if (!seen.has(code)) {
        problems.push(`papel \`${role.code}\` referencia a permissão inexistente \`${code}\``);
      }
    }
  }

  for (const code of DECLARED_ROLE_CODES) {
    if (!declared.has(code)) {
      problems.push(`papel \`${code}\` da URS §1.4 não consta da declaração`);
    }
  }

  return problems;
}

/**
 * Reprova a declaração inteira diante de qualquer problema.
 *
 * É chamada antes de qualquer gravação: é o que garante que a carga falhe por inteiro,
 * sem estado parcial, diante de declaração inválida.
 */
export function assertCatalogIsValid(catalog: CatalogDeclaration): void {
  const problems = collectProblems(catalog);

  if (problems.length > 0) {
    throw new InvalidCatalogError(problems);
  }
}

/** O catálogo deste repositório, montado a partir das duas declarações de `domain/`. */
export const DECLARED_CATALOG: CatalogDeclaration = {
  permissions: PERMISSION_CODES,
  roles: ROLE_CODES.map((code) => ({ code, permissions: ROLE_COMPOSITION[code] })),
};
