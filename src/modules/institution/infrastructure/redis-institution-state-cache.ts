import { Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

import type { InstitutionState } from '../domain/ports/institution-repository';
import { InstitutionStateCache } from '../domain/ports/institution-state-cache';

/**
 * Cache do estado da instituição em Redis (`ADR-0028` §14).
 *
 * **Chave por instituição, prefixada pelo módulo** (`ADR-0020` §6): o módulo
 * `institution` só cria chave sob o seu próprio prefixo, e nenhum outro módulo escreve
 * sob ele.
 *
 * **Invalidação por escrita, não por expiração.** A desativação e a reativação apagam a
 * chave da instituição afetada — uma chave, não uma por usuário (`ADR-0011` §13). O prazo
 * abaixo é rede de segurança, não mecanismo: cobre a janela estreita entre o commit de
 * uma mudança de estado e o apagamento da chave.
 *
 * **Instituição inexistente NÃO é gravada.** Não há escrita que invalide a sua chave, e
 * guardá-la deixaria resíduo que o cadastro de uma instituição de mesmo identificador
 * herdaria — o mesmo raciocínio que o cache de permissões aplica à conta inexistente.
 *
 * **Falha fechada.** Nenhum erro é engolido: devolver "ativa" diante de indisponibilidade
 * concederia acesso a usuário de instituição desativada, e devolver "inativa" negaria
 * acesso legítimo em massa e esconderia a queda. Resta deixar o erro subir.
 */

/** `ADR-0020` §6: toda chave do módulo carrega o seu nome. */
const KEY_PREFIX = 'institution:state:';

/** Rede de segurança, não mecanismo de invalidação. Uma hora. */
const TTL_SECONDS = 3600;

export function institutionStateKey(institutionId: string): string {
  return `${KEY_PREFIX}${institutionId}`;
}

/** O estado gravado. Só instituição existente chega ao cache, daí `exists` implícito. */
function decode(raw: string, key: string): InstitutionState {
  const parsed: unknown = JSON.parse(raw);

  if (typeof parsed !== 'object' || parsed === null || typeof parsed !== 'object') {
    throw new Error(`Cache de estado de instituição corrompido na chave \`${key}\`.`);
  }

  const active = (parsed as { active?: unknown }).active;

  if (typeof active !== 'boolean') {
    throw new Error(`Cache de estado de instituição corrompido na chave \`${key}\`.`);
  }

  return { exists: true, active };
}

@Injectable()
export class RedisInstitutionStateCache extends InstitutionStateCache {
  constructor(private readonly redis: Redis) {
    super();
  }

  async read(institutionId: string): Promise<InstitutionState | null> {
    const key = institutionStateKey(institutionId);
    const raw = await this.redis.get(key);

    return raw === null ? null : decode(raw, key);
  }

  /** Um `MGET`, e não uma leitura por identificador (`ADR-0011` §13). */
  async readMany(
    institutionIds: readonly string[],
  ): Promise<ReadonlyMap<string, InstitutionState>> {
    const found = new Map<string, InstitutionState>();

    if (institutionIds.length === 0) {
      return found;
    }

    const unique = [...new Set(institutionIds)];
    const raws = await this.redis.mget(unique.map(institutionStateKey));

    unique.forEach((id, index) => {
      const raw = raws[index];

      if (raw !== null && raw !== undefined) {
        found.set(id, decode(raw, institutionStateKey(id)));
      }
    });

    return found;
  }

  async write(institutionId: string, state: InstitutionState): Promise<void> {
    if (!state.exists) {
      return;
    }

    await this.redis.set(
      institutionStateKey(institutionId),
      JSON.stringify({ active: state.active }),
      'EX',
      TTL_SECONDS,
    );
  }

  async invalidate(institutionId: string): Promise<void> {
    await this.redis.del(institutionStateKey(institutionId));
  }
}
