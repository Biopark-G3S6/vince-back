import { Injectable } from '@nestjs/common';

import { FAILURE, fail, ok, type Result } from '../domain/failure';
import type { Institution } from '../domain/institution';
import { InstitutionRepository } from '../domain/ports/institution-repository';

/**
 * A consulta por identificador (RF-INS-001).
 *
 * Devolve ativas e inativas: a desativação não esconde a instituição de quem tem
 * `INSTITUTION:READ` — ela muda o estado que a consulta informa.
 */
@Injectable()
export class FindInstitutionUseCase {
  constructor(private readonly institutions: InstitutionRepository) {}

  async execute(institutionId: string): Promise<Result<Institution>> {
    const institution = await this.institutions.findById(institutionId);

    return institution === null ? fail(FAILURE.RESOURCE_NOT_FOUND) : ok(institution);
  }
}
