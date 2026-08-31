import { PrismaClient } from '@prisma/client';

/**
 * A instância única de `PrismaClient` do processo (ADR-0010 §7).
 *
 * Nasce aqui, no composition root, porque `shared/` não pode conhecer models de módulo
 * (ADR-0009 §5) e nenhum módulo pode instanciar cliente próprio (ADR-0010 §5). Cada
 * módulo recebe dela apenas a extensão escopada aos seus models.
 */

let client: PrismaClient | undefined;

/**
 * O tamanho do pool é declarado explicitamente (ADR-0019 §9) e viaja na URL, que é
 * como o Prisma o recebe.
 */
function resolveDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const raw = (env.DATABASE_URL ?? '').trim();

  if (raw.length === 0) {
    throw new Error('DATABASE_URL não está definida. Ver `.env.example` (ADR-0018, ADR-0019).');
  }

  const poolSize = (env.DATABASE_POOL_SIZE ?? '').trim();

  if (poolSize.length === 0) {
    return raw;
  }

  const url = new URL(raw);
  url.searchParams.set('connection_limit', poolSize);

  return url.toString();
}

export function getPrismaClient(env: NodeJS.ProcessEnv = process.env): PrismaClient {
  client ??= new PrismaClient({ datasourceUrl: resolveDatabaseUrl(env) });

  return client;
}
