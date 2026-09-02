import { DynamicModule, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { AuthModule } from '@shared/auth/auth.module';
import { CredentialVerifier } from '@shared/auth/credential-verifier';
import { IdentityResolver } from '@shared/auth/identity';
import { RedisSessionStore } from '@shared/auth/redis-session-store';
import { loadAuthConfig } from '@shared/config/environment';

import { AccessModule } from '@modules/access/access.module';

import { AccessCredentialVerifier, AccessIdentityResolver } from './auth/access-auth-ports';
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
      // `DiscoveryModule` é o que permite percorrer os controllers na inicialização para
      // recusar rota sem declaração de acesso (decisão D4).
      imports: [DiscoveryModule, ...(registry ?? [])],
    };
  }

  /**
   * Seleciona os módulos ativos. Lista vazia significa todos (ADR-0008 §7).
   *
   * Cada módulo é registrado uma única vez, em seu próprio `<modulo>.module.ts`,
   * que é o único ponto de registro de providers, rotas, consumidores e jobs (ADR-0003 §9).
   *
   * No papel `api`, a borda **envolve** os módulos: `AuthModule` importa o registro de
   * `access` e liga os ports de `shared/` à sua fachada (decisão D1). O módulo é
   * registrado uma única vez, dentro dela — registrá-lo também no topo o duplicaria.
   */
  private static registryFor(role: Role, modules: string[]): DynamicModule['imports'] {
    const active = (name: string): boolean => modules.length === 0 || modules.includes(name);

    // A configuração é lida uma vez, aqui: a aplicação recusa subir com variável ausente,
    // e recusa antes de abrir conexão com coisa alguma.
    const config = loadAuthConfig();

    // `getPrismaClient()` e `getRedisClient()` devolvem as instâncias únicas do
    // processo (ADR-0010 §7, ADR-0020 §4); cada módulo recebe delas a sua extensão
    // escopada e o seu prefixo de chave, e nenhuma conexão é aberta quando módulo algum
    // que dependa dela está ativo.
    //
    // Adicione aqui o registro de cada módulo, uma linha por módulo.
    // Uma única instância do repositório de sessões no processo: a borda a usa para
    // resolver a sessão, e o módulo `access`, para revogá-las na troca de senha.
    const sessions = new RedisSessionStore(getRedisClient(), config.session);

    const access = active('access')
      ? AccessModule.forRoot(getPrismaClient(), getRedisClient(), {
          passwordHashing: config.passwordHashing,
          passwordResetTtlSeconds: config.passwordResetTtlSeconds,
          sessions,
        })
      : null;

    if (role !== 'api') {
      return [access].filter((entry) => entry !== null);
    }

    const registry = [
      access === null
        ? null
        : AuthModule.forRoot({
            config,
            sessions,
            imports: [access],
            ports: [
              { provide: CredentialVerifier, useClass: AccessCredentialVerifier },
              { provide: IdentityResolver, useClass: AccessIdentityResolver },
            ],
          }),
    ];

    return registry.filter((entry) => entry !== null);
  }
}
