import { Injectable } from '@nestjs/common';

import {
  InstitutionRepository,
  type InstitutionState,
} from '../domain/ports/institution-repository';
import { InstitutionStateCache } from '../domain/ports/institution-state-cache';

/** O que se devolve para identificador que não corresponde a instituição alguma. */
const ABSENT: InstitutionState = { exists: false, active: false };

/**
 * A consulta de existência e estado, para o consumidor interno (`ADR-0028` §21).
 *
 * É o **caminho crítico de toda requisição autenticada** de usuário com vínculo: a
 * composição de borda a chama para decidir se as permissões efetivas valem
 * (`ADR-0028` §13). Daí o cache: sem ele, seria uma consulta ao banco por requisição.
 *
 * **Instituição inexistente não vai para o cache.** Não há escrita que invalide a sua
 * chave, e guardá-la deixaria resíduo que o cadastro de uma instituição de mesmo
 * identificador herdaria — o mesmo raciocínio que o módulo `access` aplica à conta
 * inexistente.
 *
 * **`exists: false` não é falha**, é resposta: uma conta com vínculo para instituição
 * inexistente é dado inconsistente, e transformá-lo em exceção na borda derrubaria a
 * requisição em vez de negá-la.
 *
 * **Contagem de consultas independente da quantidade de identificadores** (§21,
 * `ADR-0011` §9): uma ida ao cache e, no máximo, uma consulta ao banco pelos que faltarem.
 */
@Injectable()
export class ReadInstitutionStateUseCase {
  constructor(
    private readonly institutions: InstitutionRepository,
    private readonly cache: InstitutionStateCache,
  ) {}

  async execute(institutionId: string): Promise<InstitutionState> {
    const cached = await this.cache.read(institutionId);

    if (cached !== null) {
      return cached;
    }

    const found = (await this.institutions.statesOf([institutionId])).get(institutionId) ?? ABSENT;

    if (found.exists) {
      await this.cache.write(institutionId, found);
    }

    return found;
  }

  async executeMany(
    institutionIds: readonly string[],
  ): Promise<ReadonlyMap<string, InstitutionState>> {
    const states = new Map<string, InstitutionState>();

    if (institutionIds.length === 0) {
      return states;
    }

    const unique = [...new Set(institutionIds)];
    const cached = await this.cache.readMany(unique);

    const missing = unique.filter((id) => !cached.has(id));

    for (const [id, state] of cached) {
      states.set(id, state);
    }

    if (missing.length === 0) {
      return states;
    }

    // Uma consulta pelos que faltaram, e não uma por identificador (`ADR-0011` §13).
    const fetched = await this.institutions.statesOf(missing);

    for (const id of missing) {
      const state = fetched.get(id) ?? ABSENT;

      states.set(id, state);

      if (state.exists) {
        await this.cache.write(id, state);
      }
    }

    return states;
  }
}
