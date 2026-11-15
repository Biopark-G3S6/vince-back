import { Injectable } from '@nestjs/common';

import { UserRepository } from '../domain/ports/user-repository';

/**
 * O vínculo institucional de um conjunto de contas (`ADR-0011` §9).
 *
 * Existe para quem avalia escopo fora deste módulo. Não decide nada sobre o vínculo —
 * quem sabe se a instituição existe e está ativa é o módulo dono dela (`ADR-0028` §25).
 *
 * Conjunto vazio não vai ao banco: a consulta sem identificador algum devolveria a tabela
 * inteira ou nada, e nenhuma das duas é o que quem pergunta quis dizer.
 */
@Injectable()
export class FindInstitutionLinksUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(userIds: readonly string[]): Promise<ReadonlyMap<string, string | null>> {
    if (userIds.length === 0) {
      return new Map();
    }

    return this.users.institutionLinksOf(userIds);
  }
}
