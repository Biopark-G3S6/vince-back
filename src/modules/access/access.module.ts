import { Module, type DynamicModule, type INestApplicationContext } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { AccessFacadeImpl } from './application/access.facade.impl';
import { FindRolePermissionsUseCase } from './application/find-role-permissions.use-case';
import { SeedCatalogUseCase } from './application/seed-catalog.use-case';
import { AccessFacade } from './contracts/access.facade';
import { DECLARED_CATALOG, type CatalogDeclaration } from './domain/catalog';
import { CatalogRepository, type CatalogReconciliation } from './domain/ports/catalog-repository';
import { AccessPrisma, createAccessPrisma } from './infrastructure/access-prisma';
import { PrismaCatalogRepository } from './infrastructure/prisma-catalog.repository';

/**
 * Composition root do módulo `access` — o único ponto de registro dos seus providers
 * (ADR-0003 §9). O `exports` contém exclusivamente o token da fachada (ADR-0004 §4).
 *
 * O módulo recebe a instância crua de `PrismaClient`, criada uma única vez pelo
 * composition root da aplicação (ADR-0010 §7), e a estende para o escopo dos seus três
 * models antes de entregá-la a quem quer que seja (ADR-0010 §4, §5).
 *
 * A carga inicial e a conferência com a URS entram por método estático desta classe, e
 * não por script residente fora de `src/` (ADR-0027 §21): fora de `src/` a importação
 * escaparia da análise estática de fronteiras, produzindo conformidade aparente.
 */
@Module({})
export class AccessModule {
  static forRoot(prisma: PrismaClient): DynamicModule {
    return {
      module: AccessModule,
      providers: [
        { provide: AccessPrisma, useValue: createAccessPrisma(prisma) },
        { provide: CatalogRepository, useClass: PrismaCatalogRepository },
        FindRolePermissionsUseCase,
        SeedCatalogUseCase,
        { provide: AccessFacade, useClass: AccessFacadeImpl },
      ],
      exports: [AccessFacade],
    };
  }

  /**
   * Executa a carga inicial do catálogo. Idempotente: a reexecução devolve tudo em
   * zero e preserva os identificadores já gravados (ADR-0027 §20).
   *
   * O parâmetro `catalog` existe para o teste declarar a sua própria declaração — de
   * composição reduzida ou inválida. A carga real usa a declarada no repositório.
   */
  static async seed(
    context: INestApplicationContext,
    catalog?: CatalogDeclaration,
  ): Promise<CatalogReconciliation> {
    return context.get(SeedCatalogUseCase).execute(catalog);
  }

  /** O catálogo declarado no repositório, para a conferência com a URS (ADR-0027 §18). */
  static declaredCatalog(): CatalogDeclaration {
    return DECLARED_CATALOG;
  }
}
