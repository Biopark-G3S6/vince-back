import Redis from 'ioredis';

/**
 * A conexão única de Redis do processo (`ADR-0020` §4).
 *
 * Nasce aqui, no composition root, pelo mesmo motivo que a instância de `PrismaClient`:
 * `shared/` não pode conhecer dado de módulo (`ADR-0009` §5), e nenhum módulo abre
 * conexão própria. Cada módulo recebe a instância e cria as suas chaves sob o próprio
 * prefixo (`ADR-0020` §6).
 */

let client: Redis | undefined;

function resolveRedisUrl(env: NodeJS.ProcessEnv): string {
  const raw = (env.REDIS_URL ?? '').trim();

  if (raw.length === 0) {
    throw new Error('REDIS_URL não está definida. Ver `.env.example` (ADR-0013, ADR-0020).');
  }

  return raw;
}

/**
 * `enableOfflineQueue: false` é o que faz o cache **falhar fechado**: com a fila de
 * espera ligada, um comando emitido durante a queda ficaria pendurado até a reconexão, e
 * a requisição penduraria com ele. `ADR-0013` §16 quer negativa, não espera.
 *
 * `maxRetriesPerRequest: 1` limita a insistência pelo mesmo motivo: `ADR-0011` §8 exige
 * timeout explícito em toda chamada a dependência externa.
 */
export function createRedisClient(url: string): Redis {
  return new Redis(url, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    lazyConnect: false,
  });
}

export function getRedisClient(env: NodeJS.ProcessEnv = process.env): Redis {
  client ??= createRedisClient(resolveRedisUrl(env));

  return client;
}
