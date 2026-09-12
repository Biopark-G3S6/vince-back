import { Injectable } from '@nestjs/common';

import { FAILURE, fail, failValidation, ok, VIOLATION, type Result } from '../domain/failure';
import {
  violationsOfUpdate,
  withChanges,
  type Institution,
  type InstitutionDraft,
} from '../domain/institution';
import { InstitutionRepository } from '../domain/ports/institution-repository';

/**
 * A alteração de instituição (RF-INS-001).
 *
 * **Não muda o estado** (`ADR-0028` §11). O comando não tem campo de estado, `withChanges`
 * não o toca, e a gravação não o inclui: são três camadas dizendo a mesma coisa, e é
 * deliberado — a alteração exige `INSTITUTION:UPDATE`, e a desativação, `INSTITUTION:DEACTIVATE`.
 * Um campo de estado aceito aqui daria a quem só pode alterar o poder de desativar.
 *
 * A alteração de instituição inativa é permitida: corrigir o nome de uma instituição
 * desativada não a reativa, e proibi-lo congelaria o registro sem que regra alguma o peça.
 */
@Injectable()
export class UpdateInstitutionUseCase {
  constructor(private readonly institutions: InstitutionRepository) {}

  async execute(institutionId: string, draft: InstitutionDraft): Promise<Result<Institution>> {
    const violations = violationsOfUpdate(draft);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    const current = await this.institutions.findById(institutionId);

    if (current === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const outcome = await this.institutions.save(withChanges(current, draft));

    // Sumiu entre a leitura e a gravação. É a mesma resposta da leitura que não a achou.
    if (outcome === null) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    if (!outcome.ok) {
      return failValidation([{ field: outcome.duplicated, code: VIOLATION.DUPLICATE }]);
    }

    return ok(outcome.institution);
  }
}
