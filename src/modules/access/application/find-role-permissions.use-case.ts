import { Injectable } from '@nestjs/common';

import { CatalogRepository } from '../domain/ports/catalog-repository';

/**
 * Consulta das permissões de um conjunto de papéis.
 *
 * Uma classe, um método público de execução (ADR-0003 §8). A resolução é feita em
 * número de consultas independente da quantidade de papéis informados (ADR-0011 §9).
 */
@Injectable()
export class FindRolePermissionsUseCase {
  constructor(private readonly repository: CatalogRepository) {}

  async execute(roleCodes: readonly string[]): Promise<readonly string[]> {
    const distinct = [...new Set(roleCodes)];

    if (distinct.length === 0) {
      return [];
    }

    return this.repository.findPermissionsOfRoles(distinct);
  }
}
