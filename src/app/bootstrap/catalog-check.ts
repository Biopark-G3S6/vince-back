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
const RESPONSE_CODES_HEADING = '### 2.4 Catálogo de códigos de resposta';
const AFTER_RESPONSE_CODES = '## 3. ';

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

/**
 * Os códigos da URS §2.4, na ordem em que ela os declara.
 *
 * A coluna de origem também traz texto entre crases — `ADR-0025` §4 —, e por isso só a
 * primeira coluna é lida: `CODE_ROW` ancora no início da linha.
 */
export function parseUrsResponseCodes(markdown: string): readonly string[] {
  const section = sectionBetween(markdown, RESPONSE_CODES_HEADING, AFTER_RESPONSE_CODES);

  const codes: string[] = [];

  for (const line of section.split('\n')) {
    const match = CODE_ROW.exec(line);

    if (match?.[1] !== undefined) {
      codes.push(match[1]);
    }
  }

  if (codes.length === 0) {
    throw new UrsFormatError('a tabela de §2.4 veio vazia');
  }

  return codes;
}

/** O texto da URS. Lê uma vez; quem chama decide o que extrair dele. */
export function readUrs(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (error: unknown) {
    throw new DocumentationUnavailableError(
      path,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function readUrsCatalog(path: string): CatalogSnapshot {
  return parseUrsCatalog(readUrs(path));
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

/**
 * Conferência do catálogo de códigos de resposta contra a URS §2.4 (`ADR-0025` §20,
 * `PAD-REQ-008`).
 *
 * Existe pelo mesmo motivo que a conferência do catálogo de permissões: `src/shared/http/
 * response-code.ts` e a URS §2.4 são duas cópias da mesma lista, e sem isto elas divergem
 * sem que nada reclame. `PAD-NOM-008` depende dessa lista estar certa — cada código
 * precisa de chave no catálogo de tradução do cliente, e um código que só existe em um
 * dos lados não ganha chave nenhuma.
 *
 * A função recebe os códigos em vez de importá-los pelo mesmo motivo que `CatalogSnapshot`
 * repete a forma de `CatalogDeclaration`: manter este módulo confrontando duas listas, e
 * nada além disso.
 */
export interface ResponseCodeComparison {
  /** Declarados na URS e ausentes do repositório. */
  readonly missing: readonly string[];
  /** Declarados no repositório e ausentes da URS. */
  readonly surplus: readonly string[];
}

export function compareResponseCodes(
  declared: readonly string[],
  urs: readonly string[],
): ResponseCodeComparison {
  return { missing: difference(urs, declared), surplus: difference(declared, urs) };
}

export function isResponseCodeMatch(comparison: ResponseCodeComparison): boolean {
  return comparison.missing.length === 0 && comparison.surplus.length === 0;
}

export function describeResponseCodes(
  comparison: ResponseCodeComparison,
  declared: readonly string[],
): string {
  if (isResponseCodeMatch(comparison)) {
    return `códigos de resposta em correspondência com a URS §2.4: ${declared.length} códigos\n`;
  }

  const lines: string[] = ['códigos de resposta divergentes da URS §2.4:'];

  if (comparison.surplus.length > 0) {
    lines.push(`  códigos do repositório sem origem na URS: ${comparison.surplus.join(', ')}`);
  }

  if (comparison.missing.length > 0) {
    lines.push(`  códigos da URS ausentes do repositório: ${comparison.missing.join(', ')}`);
  }

  return `${lines.join('\n')}\n`;
}
