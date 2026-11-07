import { Injectable } from '@nestjs/common';

import { InstitutionAdminRepository } from '../domain/ports/institution-admin-repository';

/**
 * As instituições que um usuário administra (`ADR-0028` §21).
 *
 * É a consulta inversa da designação: o vínculo diz **onde** o papel global
 * `INSTITUTION_ADMIN` vale (RF-INS-002 RN2), e quem avalia escopo fora deste módulo
 * precisa dessa lista — não do papel, que por si não delimita nada.
 *
 * Sem cache, de propósito: não está no caminho crítico de toda requisição, e um cache a
 * mais seria uma chave a mais para invalidar a cada designação.
 */
@Injectable()
export class ReadAdminLinksUseCase {
  constructor(private readonly admins: InstitutionAdminRepository) {}

  async execute(userId: string): Promise<readonly string[]> {
    return this.admins.findByUser(userId);
  }
}
