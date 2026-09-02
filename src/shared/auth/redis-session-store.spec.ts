import Redis from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RedisSessionStore } from './redis-session-store';
import type { SessionOrigin } from './session';

/**
 * O repositório de sessões contra Redis real (`ADR-0024` §9): substituto em memória é
 * proibido (§10) e não reproduziria a expiração, que é justamente o que aqui se verifica.
 *
 * As duas expirações são exercitadas de formas diferentes porque são impostas de formas
 * diferentes: a inatividade é o TTL da chave, e se verifica encurtando-o; o prazo absoluto
 * é lido do estado, e se verifica plantando um estado antigo. Esperar oito horas ou sete
 * dias não é opção, e dormir por segundos produziria teste lento e intermitente
 * (`ADR-0024` §22).
 */

const ORIGIN: SessionOrigin = { ip: '203.0.113.7', userAgent: 'teste' };

const CONFIG = {
  cookieName: 'vince_session',
  idleTtlSeconds: 28_800,
  absoluteTtlSeconds: 604_800,
};

describe('repositório de sessões em Redis', () => {
  let redis: Redis;
  let store: RedisSessionStore;

  const userId = (): string => `u-${Math.random().toString(36).slice(2)}`;

  beforeAll(() => {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    store = new RedisSessionStore(redis, CONFIG);
  });

  afterAll(() => {
    redis.disconnect();
  });

  it('o identificador não codifica nada sobre o usuário nem sobre a sessão', async () => {
    const user = userId();
    const { id, state } = await store.create(user, ORIGIN);

    expect(id).not.toContain(user);
    expect(Buffer.from(id, 'base64url').toString('utf8')).not.toContain(user);
    // 32 bytes — acima dos 128 bits de ADR-0013 §2.
    expect(Buffer.from(id, 'base64url')).toHaveLength(32);
    expect(state.userId).toBe(user);
  });

  it('duas sessões da mesma conta recebem identificadores distintos', async () => {
    const user = userId();
    const first = await store.create(user, ORIGIN);
    const second = await store.create(user, ORIGIN);

    expect(first.id).not.toBe(second.id);
  });

  it('o estado contém usuário, criação, última atividade e origem (ADR-0013 §5)', async () => {
    const user = userId();
    const { id } = await store.create(user, ORIGIN);

    const state = await store.resolve(id);

    expect(state?.userId).toBe(user);
    expect(Date.parse(state?.createdAt ?? '')).not.toBeNaN();
    expect(Date.parse(state?.lastSeenAt ?? '')).not.toBeNaN();
    expect(state?.origin).toEqual(ORIGIN);
  });

  it('a atividade renova a janela de inatividade', async () => {
    const { id } = await store.create(userId(), ORIGIN);

    await redis.expire(`session:${id}`, 10);
    expect(await redis.ttl(`session:${id}`)).toBeLessThanOrEqual(10);

    await store.resolve(id);

    expect(await redis.ttl(`session:${id}`)).toBeGreaterThan(CONFIG.idleTtlSeconds - 60);
  });

  it('vencida a janela de inatividade, a sessão deixa de existir', async () => {
    const { id } = await store.create(userId(), ORIGIN);

    await redis.pexpire(`session:${id}`, 1);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(await store.resolve(id)).toBeNull();
  });

  /**
   * O prazo absoluto **não é renovado** (`ADR-0013` §7): a sessão continuamente ativa
   * morre ao atingi-lo, ainda que a última atividade seja de agora.
   */
  it('atingido o prazo absoluto, a sessão é recusada mesmo com atividade recente', async () => {
    const user = userId();
    const { id } = await store.create(user, ORIGIN);

    const now = new Date();
    const born = new Date(now.getTime() - (CONFIG.absoluteTtlSeconds + 60) * 1000);

    await redis.set(
      `session:${id}`,
      JSON.stringify({
        userId: user,
        createdAt: born.toISOString(),
        lastSeenAt: now.toISOString(),
        origin: ORIGIN,
      }),
      'EX',
      CONFIG.idleTtlSeconds,
    );

    expect(await store.resolve(id)).toBeNull();
    expect(await redis.exists(`session:${id}`)).toBe(0);
  });

  it('o TTL escrito nunca ultrapassa o que resta do prazo absoluto', async () => {
    const user = userId();
    const { id } = await store.create(user, ORIGIN);

    const now = new Date();
    const born = new Date(now.getTime() - (CONFIG.absoluteTtlSeconds - 120) * 1000);

    await redis.set(
      `session:${id}`,
      JSON.stringify({
        userId: user,
        createdAt: born.toISOString(),
        lastSeenAt: now.toISOString(),
        origin: ORIGIN,
      }),
      'EX',
      CONFIG.idleTtlSeconds,
    );

    await store.resolve(id);

    // Restam ~120 segundos de prazo absoluto; a janela de inatividade é de 8 horas.
    expect(await redis.ttl(`session:${id}`)).toBeLessThanOrEqual(120);
  });

  it('estado ilegível é estado ausente, e a chave é removida', async () => {
    const { id } = await store.create(userId(), ORIGIN);

    await redis.set(`session:${id}`, 'nao-e-json', 'EX', 60);

    expect(await store.resolve(id)).toBeNull();
    expect(await redis.exists(`session:${id}`)).toBe(0);
  });

  it('o encerramento remove o registro imediatamente (ADR-0013 §10)', async () => {
    const { id } = await store.create(userId(), ORIGIN);

    await store.destroy(id);

    expect(await store.resolve(id)).toBeNull();
    expect(await redis.exists(`session:${id}`)).toBe(0);
  });

  it('encerrar sessão inexistente conclui com sucesso', async () => {
    await expect(store.destroy('identificador-que-nunca-existiu')).resolves.toBeUndefined();
  });

  it('o encerramento não alcança as demais sessões da conta', async () => {
    const user = userId();
    const first = await store.create(user, ORIGIN);
    const second = await store.create(user, ORIGIN);

    await store.destroy(first.id);

    expect(await store.resolve(second.id)).not.toBeNull();
  });

  it('revoga todas as sessões da conta em uma operação (ADR-0013 §11)', async () => {
    const user = userId();
    const sessions = [
      await store.create(user, ORIGIN),
      await store.create(user, ORIGIN),
      await store.create(user, ORIGIN),
    ];

    expect(await store.revokeAllOfUser(user)).toBe(3);

    for (const session of sessions) {
      expect(await store.resolve(session.id)).toBeNull();
    }
  });

  it('a revogação preserva a sessão indicada — a que originou a operação', async () => {
    const user = userId();
    const kept = await store.create(user, ORIGIN);
    const dropped = await store.create(user, ORIGIN);

    expect(await store.revokeAllOfUser(user, kept.id)).toBe(1);

    expect(await store.resolve(kept.id)).not.toBeNull();
    expect(await store.resolve(dropped.id)).toBeNull();
  });

  it('a revogação não alcança as sessões de outra conta', async () => {
    const mine = await store.create(userId(), ORIGIN);
    const other = userId();
    await store.create(other, ORIGIN);

    await store.revokeAllOfUser(other);

    expect(await store.resolve(mine.id)).not.toBeNull();
  });

  /**
   * `ADR-0013` §16: **não existe modo degradado**. A indisponibilidade do Redis faz o
   * erro subir — a borda o converte em negativa —, e em nenhuma hipótese devolve estado
   * que faria a requisição ser aceita sem verificação.
   */
  it('a indisponibilidade do Redis faz o erro subir, e nunca devolve sessão', async () => {
    const unreachable = new Redis('redis://localhost:1', {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    unreachable.on('error', () => undefined);

    const degraded = new RedisSessionStore(unreachable, CONFIG);

    try {
      await expect(degraded.resolve('qualquer-identificador')).rejects.toThrow();
      await expect(degraded.create('u-1', ORIGIN)).rejects.toThrow();
    } finally {
      unreachable.disconnect();
    }
  });
});
