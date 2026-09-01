import { Module, type DynamicModule, type INestApplicationContext } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';

import { AccessFacadeImpl } from './application/access.facade.impl';
import { AssignRoleUseCase } from './application/assign-role.use-case';
import { CreateUserUseCase } from './application/create-user.use-case';
import { FindRolePermissionsUseCase } from './application/find-role-permissions.use-case';
import { FindUserProfileUseCase } from './application/find-user-profile.use-case';
import { ResolveEffectivePermissionsUseCase } from './application/resolve-effective-permissions.use-case';
import { SeedCatalogUseCase } from './application/seed-catalog.use-case';
import {
  SeedSystemAdminUseCase,
  type SystemAdminSeedReport,
} from './application/seed-system-admin.use-case';
import { SetUserActiveUseCase } from './application/set-user-active.use-case';
import { UpdateUserProfileUseCase } from './application/update-user-profile.use-case';
import { AccessFacade } from './contracts/access.facade';
import { DECLARED_CATALOG, type CatalogDeclaration } from './domain/catalog';
import { CatalogRepository, type CatalogReconciliation } from './domain/ports/catalog-repository';
import { PermissionCache } from './domain/ports/permission-cache';
import {
  RoleAssignmentAuditRepository,
  RoleAssignmentRepository,
} from './domain/ports/role-assignment-repository';
import { UserRepository } from './domain/ports/user-repository';
import { AccessPrisma, createAccessPrisma } from './infrastructure/access-prisma';
import { PrismaCatalogRepository } from './infrastructure/prisma-catalog.repository';
import {
  PrismaRoleAssignmentAuditRepository,
  PrismaRoleAssignmentRepository,
} from './infrastructure/prisma-role-assignment.repository';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { RedisPermissionCache } from './infrastructure/redis-permission-cache';

/** O que a carga inicial do módulo alterou. */
export interface AccessSeedReport {
  readonly catalog: CatalogReconciliation;
  readonly systemAdmin: SystemAdminSeedReport;
}

/**
 * Composition root do módulo `access` — o único ponto de registro dos seus providers
 * (`ADR-0003` §9). O `exports` contém exclusivamente o token da fachada (`ADR-0004` §4).
 *
 * O módulo recebe do composition root da aplicação a instância crua de `PrismaClient` e
 * a conexão de Redis, ambas criadas uma única vez no processo (`ADR-0010` §7,
 * `ADR-0020` §4). O cliente Prisma é estendido para o escopo dos seus models antes de
 * ser entregue a quem quer que seja (`ADR-0010` §4, §5); as chaves de Redis nascem sob o
 * prefixo do módulo (`ADR-0020` §6).
 *
 * A carga inicial e a conferência com a URS entram por método estático desta classe, e
 * não por script residente fora de `src/` (`ADR-0027` §21): fora de `src/` a importação
 * escaparia da análise estática de fronteiras, produzindo conformidade aparente.
 */
@Module({})
export class AccessModule {
  static forRoot(prisma: PrismaClient, redis: Redis): DynamicModule {
    return {
      module: AccessModule,
      providers: [
        { provide: AccessPrisma, useValue: createAccessPrisma(prisma) },
        { provide: PermissionCache, useValue: new RedisPermissionCache(redis) },
        { provide: CatalogRepository, useClass: PrismaCatalogRepository },
        { provide: UserRepository, useClass: PrismaUserRepository },
        { provide: RoleAssignmentRepository, useClass: PrismaRoleAssignmentRepository },
        {
          provide: RoleAssignmentAuditRepository,
          useClass: PrismaRoleAssignmentAuditRepository,
        },
        FindRolePermissionsUseCase,
        CreateUserUseCase,
        FindUserProfileUseCase,
        UpdateUserProfileUseCase,
        SetUserActiveUseCase,
        AssignRoleUseCase,
        ResolveEffectivePermissionsUseCase,
        SeedCatalogUseCase,
        SeedSystemAdminUseCase,
        { provide: AccessFacade, useClass: AccessFacadeImpl },
      ],
      exports: [AccessFacade],
    };
  }

  /**
   * Executa a carga inicial do módulo: primeiro o catálogo, depois a conta de
   * `SYSTEM_ADMIN` — nesta ordem, porque a conta se vincula a um papel que precisa
   * existir.
   *
   * Idempotente: a reexecução devolve o catálogo todo em zero, preserva os
   * identificadores já gravados (`ADR-0027` §20) e reencontra a conta inicial em vez de
   * criar a segunda.
   *
   * O parâmetro `catalog` existe para o teste declarar a sua própria declaração — de
   * composição reduzida ou inválida. A carga real usa a declarada no repositório.
   */
  static async seed(
    context: INestApplicationContext,
    catalog?: CatalogDeclaration,
  ): Promise<AccessSeedReport> {
    const reconciliation = await context.get(SeedCatalogUseCase).execute(catalog);
    const systemAdmin = await context.get(SeedSystemAdminUseCase).execute();

    return { catalog: reconciliation, systemAdmin };
  }

  /** O catálogo declarado no repositório, para a conferência com a URS (`ADR-0027` §18). */
  static declaredCatalog(): CatalogDeclaration {
    return DECLARED_CATALOG;
  }
}
