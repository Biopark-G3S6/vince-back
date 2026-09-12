import { Module, type DynamicModule, type ModuleMetadata } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';

import { AssignInstitutionAdminUseCase } from './application/assign-institution-admin.use-case';
import { CreateInstitutionUseCase } from './application/create-institution.use-case';
import { FindInstitutionUseCase } from './application/find-institution.use-case';
import { InstitutionFacadeImpl } from './application/institution.facade.impl';
import { ListInstitutionsUseCase } from './application/list-institutions.use-case';
import { ListInvitationsUseCase } from './application/list-invitations.use-case';
import { IssueInvitationUseCase } from './application/issue-invitation.use-case';
import { ReadInstitutionStateUseCase } from './application/read-institution-state.use-case';
import { SetInstitutionActiveUseCase } from './application/set-institution-active.use-case';
import { RevokeInvitationUseCase } from './application/revoke-invitation.use-case';
import { UpdateInstitutionUseCase } from './application/update-institution.use-case';
import { InstitutionFacade } from './contracts/institution.facade';
import { InstitutionAdminRepository } from './domain/ports/institution-admin-repository';
import { InstitutionRepository } from './domain/ports/institution-repository';
import { InstitutionStateCache } from './domain/ports/institution-state-cache';
import { InstitutionPrisma, createInstitutionPrisma } from './infrastructure/institution-prisma';
import { PrismaInstitutionAdminRepository } from './infrastructure/prisma-institution-admin.repository';
import { PrismaInstitutionRepository } from './infrastructure/prisma-institution.repository';
import { RedisInstitutionStateCache } from './infrastructure/redis-institution-state-cache';
import { InstitutionAdminController } from './presentation/institution-admin.controller';
import { InstitutionController } from './presentation/institution.controller';

/**
 * O que o composition root fornece ao módulo além das conexões.
 *
 * `imports` traz o registro do módulo `access`, cuja fachada este módulo consome para
 * atribuir e revogar o papel `INSTITUTION_ADMIN` (`ADR-0028` §16, §17). É a **primeira
 * dependência síncrona entre módulos de negócio do sistema**, e ela aponta para `access`
 * porque `ADR-0027` §9 o declara módulo folha — a direção contrária fecharia o ciclo que
 * `ADR-0005` §6 proíbe.
 */
export interface InstitutionModuleOptions {
  readonly imports: ModuleMetadata['imports'];
}

/**
 * Composition root do módulo `institution` — o único ponto de registro dos seus providers
 * (`ADR-0003` §9). O `exports` contém exclusivamente o token da fachada (`ADR-0004` §4).
 *
 * O módulo recebe do composition root da aplicação a instância crua de `PrismaClient` e a
 * conexão de Redis, ambas criadas uma única vez no processo (`ADR-0010` §7,
 * `ADR-0020` §4). O cliente Prisma é estendido para o escopo dos seus models antes de ser
 * entregue a quem quer que seja (`ADR-0010` §4, §5); as chaves de Redis nascem sob o
 * prefixo do módulo (`ADR-0020` §6).
 */
@Module({})
export class InstitutionModule {
  static forRoot(
    prisma: PrismaClient,
    redis: Redis,
    options: InstitutionModuleOptions,
  ): DynamicModule {
    return {
      module: InstitutionModule,
      imports: options.imports,
      controllers: [InstitutionController, InstitutionAdminController],
      providers: [
        { provide: InstitutionPrisma, useValue: createInstitutionPrisma(prisma) },
        { provide: InstitutionStateCache, useValue: new RedisInstitutionStateCache(redis) },
        { provide: InstitutionRepository, useClass: PrismaInstitutionRepository },
        { provide: InstitutionAdminRepository, useClass: PrismaInstitutionAdminRepository },
        CreateInstitutionUseCase,
        FindInstitutionUseCase,
        ListInstitutionsUseCase,
        ListInvitationsUseCase,
        IssueInvitationUseCase,
        UpdateInstitutionUseCase,
        SetInstitutionActiveUseCase,
        RevokeInvitationUseCase,
        ReadInstitutionStateUseCase,
        AssignInstitutionAdminUseCase,
        { provide: InstitutionFacade, useClass: InstitutionFacadeImpl },
      ],
      exports: [InstitutionFacade],
    };
  }
}
