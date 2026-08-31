/**
 * A forma da permissão (ADR-0014 §2, §3).
 *
 * `RECURSO:ACAO`, recurso no singular, inteiramente em maiúsculas, sem acento e sem
 * curinga. A recusa ocorre na carga do catálogo, e não na primeira verificação de
 * acesso: permissão malformada nunca chega a existir no banco.
 */

/** Motivo pelo qual um código de permissão é recusado. */
export type PermissionShapeViolation =
  'wildcard' | 'missing-separator' | 'invalid-characters' | 'plural-resource';

/**
 * Um segmento — recurso ou ação — é uma ou mais palavras em maiúsculas separadas por
 * sublinhado. Dígito é admitido a partir do segundo caractere da palavra.
 */
const SEGMENT = /^[A-Z][A-Z0-9]*(?:_[A-Z][A-Z0-9]*)*$/;

/**
 * Recurso no plural: a última palavra termina em `S` sem terminar em `SS`.
 *
 * É heurística, não análise linguística: pega o erro de transcrição que de fato ocorre
 * (`COURSES` por `COURSE`) sem recusar `PROGRESS`, que é singular e está no catálogo.
 * Recurso singular terminado em `S` isolado exigiria revisão desta regra.
 */
function hasPluralResource(resource: string): boolean {
  const lastWord = resource.split('_').at(-1) ?? resource;

  return lastWord.endsWith('S') && !lastWord.endsWith('SS');
}

/** Devolve o motivo da recusa, ou `null` quando o código observa a forma exigida. */
export function violationOfPermissionCode(code: string): PermissionShapeViolation | null {
  if (code.includes('*')) {
    return 'wildcard';
  }

  const separator = code.indexOf(':');

  if (separator === -1 || code.indexOf(':', separator + 1) !== -1) {
    return 'missing-separator';
  }

  const resource = code.slice(0, separator);
  const action = code.slice(separator + 1);

  if (!SEGMENT.test(resource) || !SEGMENT.test(action)) {
    return 'invalid-characters';
  }

  if (hasPluralResource(resource)) {
    return 'plural-resource';
  }

  return null;
}

const REASONS: Readonly<Record<PermissionShapeViolation, string>> = {
  wildcard: 'contém curinga, proibido por ADR-0014 §3',
  'missing-separator': 'não tem exatamente um separador `:`',
  'invalid-characters': 'não está em `RECURSO:ACAO`, maiúsculas sem acento',
  'plural-resource': 'tem o recurso no plural; ADR-0014 §2 exige o singular',
};

/** Texto de diagnóstico da recusa, destinado a quem escreve o catálogo. */
export function describePermissionShapeViolation(violation: PermissionShapeViolation): string {
  return REASONS[violation];
}
