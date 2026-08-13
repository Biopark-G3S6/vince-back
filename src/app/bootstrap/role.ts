/**
 * Papel de execução do processo (ADR-0008).
 *
 * O artefato de build é único (§1). O papel é determinado por variável de ambiente (§2),
 * e os módulos ativos por MODULES (§6). MODULES ausente significa todos (§7).
 *
 * A separação existe desde o primeiro commit por decisão explícita (§8): retrofitá-la
 * depois é doloroso porque o código já teria assumido processo único.
 */

export const ROLES = ['api', 'worker', 'relay'] as const;

export type Role = (typeof ROLES)[number];

export function resolveRole(env: NodeJS.ProcessEnv = process.env): Role {
  const raw = (env.ROLE ?? 'api').trim();

  if (!isRole(raw)) {
    throw new Error(
      `ROLE inválido: "${raw}". Valores admitidos: ${ROLES.join(', ')} (ADR-0008 §3).`,
    );
  }

  return raw;
}

/**
 * Lista de módulos ativos neste processo. Vazio significa todos (ADR-0008 §7).
 */
export function resolveModules(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = (env.MODULES ?? '').trim();

  if (raw.length === 0) {
    return [];
  }

  return raw
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/**
 * O papel `relay` não é replicável horizontalmente para um mesmo módulo (ADR-0008 §13).
 * A exclusividade é garantida por trava distribuída no Redis (ADR-0021 §7).
 */
export function requiresExclusiveInstance(role: Role): boolean {
  return role === 'relay';
}
