import { Injectable } from '@nestjs/common';

import { assertCatalogIsValid, DECLARED_CATALOG, type CatalogDeclaration } from '../domain/catalog';
import { CatalogRepository, type CatalogReconciliation } from '../domain/ports/catalog-repository';

/**
 * A carga inicial do catálogo (ADR-0023 §5, ADR-0027 §20).
 *
 * A validação precede qualquer gravação e a reconciliação é transacional: declaração
 * inválida deixa a base exatamente como estava.
 */
@Injectable()
export class SeedCatalogUseCase {
  constructor(private readonly repository: CatalogRepository) {}

  /** O parâmetro existe para o teste declarar a sua própria declaração inválida. */
  async execute(catalog: CatalogDeclaration = DECLARED_CATALOG): Promise<CatalogReconciliation> {
    assertCatalogIsValid(catalog);

    return this.repository.reconcile(catalog);
  }
}
