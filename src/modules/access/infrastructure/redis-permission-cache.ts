import { Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

import { PermissionCache } from '../domain/ports/permission-cache';

/**
 * Cache das permissões efetivas em Redis (decisão D3, `ADR-0014` §10).
 *
 * **Chave por conta, prefixada pelo módulo** (`ADR-0020` §6): o módulo `access` só cria
 * chave sob o seu próprio prefixo, e nenhum outro módulo escreve sob ele.
 *
 * **Invalidação por escrita, não por expiração.** `ADR-0014` §10 exige invalidação
 * imediata, o que descarta a expiração como mecanismo principal: uma janela de validade
 * é exatamente o intervalo em que permissão revogada continuaria valendo. O prazo abaixo
 * é rede de segurança, não mecanismo — cobre a janela estreita entre o commit de uma
 * escrita e o apagamento da chave, em que uma apuração concorrente iniciada antes do
 * commit ainda pode gravar o valor anterior.
 *
 * **Falha fechada.** Nenhum erro é engolido: `ADR-0013` §16 e a implicação 3 de
 * `ADR-0014` equiparam a indisponibilidade do cache à do sistema. Devolver conjunto vazio
 * diante de erro pareceria seguro e não seria: negaria acesso legítimo em massa e
 * esconderia a queda. Devolver o que houvesse em memória concederia permissão sem base
 * íntegra. Resta deixar o erro subir.
 */

/** `ADR-0020` §6: toda chave do módulo carrega o seu nome. */
const KEY_PREFIX = 'access:permissions:';

/** Rede de segurança, não mecanismo de invalidação. Uma hora. */
const TTL_SECONDS = 3600;

export function permissionCacheKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

@Injectable()
export class RedisPermissionCache extends PermissionCache {
  constructor(private readonly redis: Redis) {
    super();
  }

  async read(userId: string): Promise<readonly string[] | null> {
    const raw = await this.redis.get(permissionCacheKey(userId));

    if (raw === null) {
      return null;
    }

    // Conteúdo ilegível é chave corrompida, não ausência: tratá-la como ausência
    // esconderia o defeito e produziria uma apuração que ora bate no banco, ora não.
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
      throw new Error(`Cache de permissões corrompido na chave \`${permissionCacheKey(userId)}\`.`);
    }

    return parsed as string[];
  }

  /** O conjunto vazio é valor legítimo — conta inativa —, e não ausência de valor. */
  async write(userId: string, permissions: readonly string[]): Promise<void> {
    await this.redis.set(
      permissionCacheKey(userId),
      JSON.stringify(permissions),
      'EX',
      TTL_SECONDS,
    );
  }

  async invalidate(userId: string): Promise<void> {
    await this.redis.del(permissionCacheKey(userId));
  }
}
