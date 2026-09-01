import { DynamicModule, Module } from '@nestjs/common';

import { AccessModule } from '@modules/access/access.module';

import type { Role } from './bootstrap/role';
import { getPrismaClient } from './prisma/prisma-client';
import { getRedisClient } from './redis/redis-client';

/**
 * Composition root da aplicação (ADR-0003 §10).
 *
 * Conhece apenas a lista de módulos. Adicionar ou remover um módulo deve ser
 * alteração de uma linha, e a remoção não pode quebrar a compilação dos demais (§11).
 *
 * Nenhum módulo é importado aqui por seu interno: apenas seu registro e, quando
 * necessário, seus contratos (ADR-0004 §4).
 */
@Module({})
export class AppModule {
  static forRole(role: Role, modules: string[]): DynamicModule {
    const registry = AppModule.registryFor(role, modules);

    return {
      module: AppModule,
      imports: registry,
    };
  }

  /**
   * Seleciona os módulos ativos. Lista vazia significa todos (ADR-0008 §7).
   *
   * Cada módulo é registrado uma única vez, em seu próprio `<modulo>.module.ts`,
   * que é o único ponto de registro de providers, rotas, consumidores e jobs (ADR-0003 §9).
   */
  private static registryFor(_role: Role, modules: string[]): DynamicModule['imports'] {
    const active = (name: string): boolean => modules.length === 0 || modules.includes(name);

    // `getPrismaClient()` e `getRedisClient()` devolvem as instâncias únicas do
    // processo (ADR-0010 §7, ADR-0020 §4); cada módulo recebe delas a sua extensão
    // escopada e o seu prefixo de chave, e nenhuma conexão é aberta quando módulo algum
    // que dependa dela está ativo.
    //
    // Adicione aqui o registro de cada módulo, uma linha por módulo.
    const registry = [
      active('access') ? AccessModule.forRoot(getPrismaClient(), getRedisClient()) : null,
    ];

    return registry.filter((entry) => entry !== null);
  }
}
