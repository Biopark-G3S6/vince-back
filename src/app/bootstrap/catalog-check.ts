import { readFileSync } from 'node:fs';

/**
 * Conferência entre o catálogo declarado no repositório e o catálogo da URS §2.3 e
 * §2.3.1 (ADR-0027 §18).
 *
 * Fica fora de `pnpm run verify` por decisão registrada em ADR-0027 §19: o workflow de
 * verificação não busca o submódulo `docs/`, e pôr a conferência ali acoplaria o build
 * do backend à disponibilidade de outro repositório. É ferramenta de revisão, e a
 * revisão é que responde por `PAD-SEG-008`.
 *
 * O tipo `CatalogSnapshot` repete a forma de `CatalogDeclaration` do módulo em vez de
 * importá-la: o composition root conhece o registro do módulo e seus contratos, nunca
 * o seu `domain/` (ADR-0003 §5, ADR-0005 §1).
 */

export interface RoleSnapshot {
  readonly code: string;
  readonly permissions: readonly string[];
}

export interface CatalogSnapshot {
  readonly permissions: readonly string[];
  readonly roles: readonly RoleSnapshot[];
}

/** A documentação de requisitos não está disponível localmente. */
export class DocumentationUnavailableError extends Error {
  constructor(path: string, cause: string) {
    super(
      `Documentação de requisitos indisponível em \`${path}\`: ${cause}. ` +
        'O submódulo `docs/` provavelmente não está inicializado — execute ' +
        '`git submodule update --init docs`.',
    );
    this.name = 'DocumentationUnavailableError';
  }
}

/** A URS está disponível, mas não tem a forma esperada. */
export class UrsFormatError extends Error {
  constructor(message: string) {
    super(`Não foi possível ler o catálogo da URS: ${message}`);
    this.name = 'UrsFormatError';
  }
}

const PERMISSIONS_HEADING = '### 2.3 Catálogo de permissões';
const COMPOSITION_HEADING = '#### 2.3.1 Composição dos papéis padrão';
const NEXT_HEADING = '### 2.4 ';

const CODE_ROW = /^\|\s*`([^`]+)`\s*\|/;
const BACKTICKED = /`([^`]+)`/g;

function sectionBetween(markdown: string, from: string, to: string): string {
  const start = markdown.indexOf(from);

  if (start === -1) {
    throw new UrsFormatError(`a seção \`${from}\` não foi encontrada`);
  }

  const rest = markdown.slice(start + from.length);
  const end = rest.indexOf(to);

  if (end === -1) {
    throw new UrsFormatError(`a seção \`${to}\` não foi encontrada após \`${from}\``);
  }

  return rest.slice(0, end);
}

/**
 * Expande a notação `RECURSO:A/B/C` da URS §2.3.1, que abrevia a leitura daquela
 * tabela e não existe no catálogo (ADR-0014 §3).
 */
function expand(item: string): string[] {
  const separator = item.indexOf(':');

  if (separator === -1) {
    return [item];
  }

  const resource = item.slice(0, separator);

  return item
    .slice(separator + 1)
    .split('/')
    .map((action) => `${resource}:${action}`);
}

export function parseUrsCatalog(markdown: string): CatalogSnapshot {
  const permissionsSection = sectionBetween(markdown, PERMISSIONS_HEADING, COMPOSITION_HEADING);
  const compositionSection = sectionBetween(markdown, COMPOSITION_HEADING, NEXT_HEADING);

  const permissions: string[] = [];

  for (const line of permissionsSection.split('\n')) {
    const match = CODE_ROW.exec(line);

    if (match?.[1] !== undefined) {
      permissions.push(match[1]);
    }
  }

  const roles: RoleSnapshot[] = [];

  for (const line of compositionSection.split('\n')) {
    const match = CODE_ROW.exec(line);
    const code = match?.[1];

    if (match === null || code === undefined) {
      continue;
    }

    const body = line.slice(match.index + match[0].length);
    const composition = [...body.matchAll(BACKTICKED)].flatMap((item) => expand(item[1] ?? ''));

    roles.push({ code, permissions: composition });
  }

  if (permissions.length === 0 || roles.length === 0) {
    throw new UrsFormatError('as tabelas de §2.3 ou de §2.3.1 vieram vazias');
  }

  return { permissions, roles };
}

export function readUrsCatalog(path: string): CatalogSnapshot {
  let markdown: string;

  try {
    markdown = readFileSync(path, 'utf8');
  } catch (error: unknown) {
    throw new DocumentationUnavailableError(
      path,
      error instanceof Error ? error.message : String(error),
    );
  }

  return parseUrsCatalog(markdown);
}

export interface RoleDifference {
  readonly code: string;
  /** Declaradas na URS e ausentes do repositório. */
  readonly missing: readonly string[];
  /** Declaradas no repositório e ausentes da URS. */
  readonly surplus: readonly string[];
}

export interface CatalogComparison {
  readonly missingPermissions: readonly string[];
  readonly surplusPermissions: readonly string[];
  readonly missingRoles: readonly string[];
  readonly surplusRoles: readonly string[];
  readonly roleDifferences: readonly RoleDifference[];
}

function difference(left: readonly string[], right: readonly string[]): string[] {
  const known = new Set(right);

  return [...new Set(left)].filter((item) => !known.has(item)).sort();
}

/** Confronta os dois catálogos e relata as diferenças nos dois sentidos. */
export function compareCatalogs(
  declared: CatalogSnapshot,
  urs: CatalogSnapshot,
): CatalogComparison {
  const declaredRoles = new Map(declared.roles.map((role) => [role.code, role.permissions]));
  const ursRoles = new Map(urs.roles.map((role) => [role.code, role.permissions]));

  const roleDifferences: RoleDifference[] = [];

  for (const [code, ursPermissions] of ursRoles) {
    const declaredPermissions = declaredRoles.get(code);

    if (declaredPermissions === undefined) {
      continue;
    }

    const missing = difference(ursPermissions, declaredPermissions);
    const surplus = difference(declaredPermissions, ursPermissions);

    if (missing.length > 0 || surplus.length > 0) {
      roleDifferences.push({ code, missing, surplus });
    }
  }

  return {
    missingPermissions: difference(urs.permissions, declared.permissions),
    surplusPermissions: difference(declared.permissions, urs.permissions),
    missingRoles: difference([...ursRoles.keys()], [...declaredRoles.keys()]),
    surplusRoles: difference([...declaredRoles.keys()], [...ursRoles.keys()]),
    roleDifferences,
  };
}

export function isMatch(comparison: CatalogComparison): boolean {
  return (
    comparison.missingPermissions.length === 0 &&
    comparison.surplusPermissions.length === 0 &&
    comparison.missingRoles.length === 0 &&
    comparison.surplusRoles.length === 0 &&
    comparison.roleDifferences.length === 0
  );
}

export function describeComparison(
  comparison: CatalogComparison,
  declared: CatalogSnapshot,
): string {
  if (isMatch(comparison)) {
    const grants = declared.roles.reduce((total, role) => total + role.permissions.length, 0);

    return (
      `catálogo em correspondência com a URS §2.3 e §2.3.1: ` +
      `${declared.permissions.length} permissões, ` +
      `${declared.roles.length} papéis, ` +
      `${grants} vínculos\n`
    );
  }

  const lines: string[] = ['catálogo divergente da URS §2.3 e §2.3.1:'];

  const report = (label: string, items: readonly string[]): void => {
    if (items.length > 0) {
      lines.push(`  ${label}: ${items.join(', ')}`);
    }
  };

  report('permissões do repositório sem requisito de origem na URS', comparison.surplusPermissions);
  report('permissões da URS ausentes do repositório', comparison.missingPermissions);
  report('papéis do repositório ausentes da URS', comparison.surplusRoles);
  report('papéis da URS ausentes do repositório', comparison.missingRoles);

  for (const role of comparison.roleDifferences) {
    report(`papel \`${role.code}\` — permissões a mais no repositório`, role.surplus);
    report(`papel \`${role.code}\` — permissões da URS ausentes`, role.missing);
  }

  return `${lines.join('\n')}\n`;
}
