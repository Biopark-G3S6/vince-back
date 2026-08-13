import { DynamicModule, Module } from '@nestjs/common';

import type { Role } from './bootstrap/role';

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
  private static registryFor(_role: Role, _modules: string[]): DynamicModule['imports'] {
    // Adicione aqui o registro de cada módulo, uma linha por módulo.
    //
    //   ObservabilidadeModule.forRole(role),
    //
    return [];
  }
}
