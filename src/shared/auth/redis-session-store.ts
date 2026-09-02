import type Redis from 'ioredis';

import type { SessionConfig } from '../config/environment';
import { generateSessionId, type Session, type SessionOrigin, type SessionState } from './session';
import { SessionStore } from './session-store';

/**
 * A sessão em Redis (`ADR-0013` §4), com as chaves sob o prefixo do mecanismo
 * (`ADR-0020` §6).
 *
 * Duas chaves por sessão, e a segunda existe só por causa de `ADR-0013` §11:
 *
 *   `session:<id>`        o estado, com TTL
 *   `session:user:<uid>`  o conjunto das sessões da conta, para a revogação em uma operação
 *
 * **As duas expirações são impostas de formas diferentes, de propósito.** A inatividade é
 * o TTL da chave — renovado a cada requisição, é o Redis que a aplica. O prazo absoluto é
 * verificado na leitura **e** limita o TTL escrito: `min(inatividade, o que resta do
 * absoluto)`. Confiar só na verificação deixaria a chave viva depois do prazo; confiar só
 * no TTL faria a renovação empurrar o absoluto para a frente, que é exatamente o que
 * `ADR-0013` §7 proíbe.
 */
const STATE_PREFIX = 'session:';
const USER_PREFIX = 'session:user:';

export class RedisSessionStore extends SessionStore {
  constructor(
    private readonly redis: Redis,
    private readonly config: SessionConfig,
  ) {
    super();
  }

  async create(userId: string, origin: SessionOrigin): Promise<Session> {
    const now = new Date().toISOString();
    const id = generateSessionId();
    const state: SessionState = { userId, createdAt: now, lastSeenAt: now, origin };

    await this.redis
      .multi()
      .set(stateKey(id), JSON.stringify(state), 'EX', this.config.idleTtlSeconds)
      .sadd(userKey(userId), id)
      .expire(userKey(userId), this.config.absoluteTtlSeconds)
      .exec();

    return { id, state };
  }

  async resolve(id: string): Promise<SessionState | null> {
    const raw = await this.redis.get(stateKey(id));

    if (raw === null) {
      return null;
    }

    const state = parseState(raw);

    if (state === null) {
      await this.destroy(id);

      return null;
    }

    const remaining = this.secondsUntilAbsoluteDeadline(state);

    if (remaining <= 0) {
      await this.destroy(id);

      return null;
    }

    const renewed: SessionState = { ...state, lastSeenAt: new Date().toISOString() };
    const ttl = Math.min(this.config.idleTtlSeconds, remaining);

    await this.redis.set(stateKey(id), JSON.stringify(renewed), 'EX', ttl);

    return renewed;
  }

  async destroy(id: string): Promise<void> {
    const raw = await this.redis.get(stateKey(id));
    const state = raw === null ? null : parseState(raw);

    const pipeline = this.redis.multi().del(stateKey(id));

    if (state !== null) {
      pipeline.srem(userKey(state.userId), id);
    }

    await pipeline.exec();
  }

  async revokeAllOfUser(userId: string, keep?: string): Promise<number> {
    const ids = await this.redis.smembers(userKey(userId));
    const doomed = ids.filter((id) => id !== keep);

    if (doomed.length === 0) {
      return 0;
    }

    const pipeline = this.redis.multi();

    for (const id of doomed) {
      pipeline.del(stateKey(id));
      pipeline.srem(userKey(userId), id);
    }

    await pipeline.exec();

    return doomed.length;
  }

  /**
   * Quanto resta do prazo absoluto, em segundos. Zero ou negativo significa vencido.
   *
   * `createdAt` ilegível é tratado como vencido: uma sessão cujo instante de criação não
   * se pode ler é uma sessão cujo prazo absoluto não se pode verificar, e `ADR-0013` §16
   * não admite aceitar o que não se verificou.
   */
  private secondsUntilAbsoluteDeadline(state: SessionState): number {
    const createdAt = Date.parse(state.createdAt);

    if (Number.isNaN(createdAt)) {
      return 0;
    }

    const deadline = createdAt + this.config.absoluteTtlSeconds * 1000;

    return Math.floor((deadline - Date.now()) / 1000);
  }
}

function stateKey(id: string): string {
  return `${STATE_PREFIX}${id}`;
}

function userKey(userId: string): string {
  return `${USER_PREFIX}${userId}`;
}

/** Estado ilegível é estado ausente: não se aceita o que não se conseguiu verificar. */
function parseState(raw: string): SessionState | null {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const candidate = parsed as Partial<SessionState>;

    return typeof candidate.userId === 'string' && typeof candidate.createdAt === 'string'
      ? (parsed as SessionState)
      : null;
  } catch {
    return null;
  }
}
