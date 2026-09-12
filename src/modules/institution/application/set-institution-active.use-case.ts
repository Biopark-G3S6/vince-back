import { Injectable } from '@nestjs/common';

import { FAILURE, fail, ok, type Result } from '../domain/failure';
import type { Institution } from '../domain/institution';
import { InstitutionRepository } from '../domain/ports/institution-repository';
import { InstitutionStateCache } from '../domain/ports/institution-state-cache';

/**
 * A desativação e a reativação (RF-INS-001, RF-INS-001 E2, RN2).
 *
 * As duas operações vivem no mesmo caso de uso porque são a mesma regra em dois sentidos:
 * mesma pré-condição, mesma invalidação, mesma idempotência. Separá-las duplicaria as
 * três.
 *
 * **Aceita com cursos ativos** (E2): não há verificação de dependências, e a ausência é a
 * regra. A desativação se propaga ao acesso dos usuários (RN2), e o que existe dentro da
 * instituição permanece registrado (`ADR-0028` §10).
 *
 * **Idempotente**: desativar instituição já inativa conclui com sucesso e nada muda.
 *
 * **A invalidação segue a gravação, e é de UMA chave** — a da instituição, não a de cada
 * usuário dela (`ADR-0028` §14, `ADR-0011` §13). Uma instituição com dez mil usuários
 * custa a mesma invalidação que uma com dez.
 *
 * A invalidação ocorre mesmo quando o estado já era o pedido. Custa um `DEL` e fecha a
 * janela em que uma apuração concorrente, iniciada antes desta gravação, ainda pode ter
 * escrito o valor anterior na chave.
 */
@Injectable()
export class SetInstitutionActiveUseCase {
  constructor(
    private readonly institutions: InstitutionRepository,
    private readonly cache: InstitutionStateCache,
  ) {}

  async execute(institutionId: string, active: boolean): Promise<Result<Institution>> {
    const institution = await this.institutions.setActive(institutionId, active);

    if (institution === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    await this.cache.invalidate(institutionId);

    return ok(institution);
  }
}
