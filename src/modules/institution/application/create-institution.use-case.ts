import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { failValidation, ok, VIOLATION, type Result } from '../domain/failure';
import { institutionOf, violationsOfDraft, type Institution } from '../domain/institution';
import { InstitutionRepository } from '../domain/ports/institution-repository';

/**
 * O cadastro de instituição (RF-INS-001).
 *
 * A instituição **nasce ativa**, e o estado não é informado pelo cadastro: quem cria não
 * escolhe criar desativada. Desativar é operação própria, com permissão própria.
 *
 * O identificador é UUIDv7 gerado **pela aplicação** (`ADR-0018` §9, §10): o banco não o
 * gera, e a ordenação temporal embutida na versão 7 é o que impede que a chave primária
 * espalhe as escritas pelo índice.
 */
@Injectable()
export class CreateInstitutionUseCase {
  constructor(private readonly institutions: InstitutionRepository) {}

  async execute(draft: {
    readonly name?: string;
    readonly code?: string;
    readonly cnpj?: string | null;
    readonly website?: string | null;
    readonly contactEmail?: string | null;
  }): Promise<Result<Institution>> {
    const violations = violationsOfDraft(draft);

    if (violations.length > 0) {
      return failValidation(violations);
    }

    const outcome = await this.institutions.create(institutionOf(uuidv7(), draft));

    // Sigla ou CNPJ já usados. É `VALIDATION_FAILED` com o campo nomeado, e não um código
    // próprio: a URS §2.4 não cataloga conflito de instituição, e inventar código aqui
    // criaria vocabulário que o cliente não sabe traduzir (`ADR-0025` §8, §20).
    if (!outcome.ok) {
      return failValidation([{ field: outcome.duplicated, code: VIOLATION.DUPLICATE }]);
    }

    return ok(outcome.institution);
  }
}
