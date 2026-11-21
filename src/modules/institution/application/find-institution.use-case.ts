import { Injectable } from '@nestjs/common';

import { AccessFacade } from '@modules/access/contracts/access.facade';

import { FAILURE, fail, ok, type Result } from '../domain/failure';
import type { Institution } from '../domain/institution';
import { InstitutionRepository } from '../domain/ports/institution-repository';
import { readerInstitution } from './reader-scope';

/**
 * A consulta por identificador (RF-INS-001).
 *
 * Devolve ativas e inativas: a desativação não esconde a instituição de quem tem
 * `INSTITUTION:READ` — ela muda o estado que a consulta informa. O leitor vinculado só
 * alcança a própria instituição (RN4); a alheia responde como inexistente, para não
 * revelar que existe.
 */
@Injectable()
export class FindInstitutionUseCase {
  constructor(
    private readonly institutions: InstitutionRepository,
    private readonly access: AccessFacade,
  ) {}

  async execute(institutionId: string, actorId?: string): Promise<Result<Institution>> {
    const reader = await readerInstitution(this.access, actorId);

    if (reader.scoped && reader.institutionId !== institutionId) {
      return fail(FAILURE.RESOURCE_NOT_FOUND);
    }

    const institution = await this.institutions.findById(institutionId);

    return institution === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(institution);
  }
}
